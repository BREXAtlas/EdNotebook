import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studentDashboardUrl = new URL("../portal/StudentDashboard.jsx", import.meta.url);
const professorDashboardUrl = new URL("../portal/ProfessorDashboard.jsx", import.meta.url);
const panelUrl = new URL("./CourseCommunicationPanel.jsx", import.meta.url);
const serviceUrl = new URL("./courseCommunicationService.js", import.meta.url);
const studioRoomUrl = new URL("../studio/CloudCourseRoom.jsx", import.meta.url);
const communicationRoomUrl = new URL("../studio/CommunicationRoom.jsx", import.meta.url);
const migrationUrl = new URL("../../supabase/migrations/20260729043209_govern_course_communication_sync.sql", import.meta.url);
const safetyHarnessUrl = new URL("../../supabase/tests/institution_student_data_safety.sql", import.meta.url);

test("professor, student, and studio surfaces use the same course communication service", async () => {
  const [student, professor, panel, service, studio] = await Promise.all([
    readFile(studentDashboardUrl, "utf8"),
    readFile(professorDashboardUrl, "utf8"),
    readFile(panelUrl, "utf8"),
    readFile(serviceUrl, "utf8"),
    readFile(studioRoomUrl, "utf8"),
  ]);
  assert.match(student, /CourseCommunicationPanel[\s\S]*role="student"[\s\S]*educationDivision=\{track\}/u);
  assert.match(professor, /CourseCommunicationPanel[\s\S]*role="professor"[\s\S]*educationDivision="both"/u);
  assert.match(studio, /courseCommunicationService/u);
  assert.doesNotMatch(studio, /\.from\("learning_messages"\)/u);
  assert.match(panel, /Device-only notes are not messages/u);
  assert.match(panel, /not sent · not synced/u);
  assert.match(panel, /no infinite feed/u);
  assert.match(panel, /Authorized course resource/u);
  assert.match(service, /\.rpc\("send_course_message"/u);
  assert.match(service, /\.rpc\("publish_course_announcement"/u);
  assert.match(service, /\.rpc\("mark_course_communication_read"/u);
  assert.match(service, /source:\s*"unavailable"/u);
  assert.doesNotMatch(service, /source:\s*"device"/u);
  assert.doesNotMatch(service, /\.select\("[^"]*(email|grade|reward|points)/u);
});

test("database contract derives identity, isolates courses, and exposes no anonymous write path", async () => {
  const [migration, harness] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(safetyHarnessUrl, "utf8"),
  ]);
  assert.match(migration, /new\.sender_id := \(select auth\.uid\(\)\)/u);
  assert.match(migration, /new\.professor_id := \(select auth\.uid\(\)\)/u);
  assert.match(migration, /private\.can_access_course\(p_course_id\)/u);
  assert.match(migration, /private\.can_manage_course\(p_course_id\)/u);
  assert.match(migration, /course_id,recipient_id,body,message_kind[\s\S]*p_course_id,null,trim\(p_body\)/u);
  assert.match(migration, /Replies must reference a visible root question in the same course/u);
  assert.match(migration, /Attachment references must be authorized resources from the same course/u);
  assert.match(migration, /alter table public\.course_communication_reads enable row level security/u);
  assert.match(migration, /alter table public\.course_communication_preferences enable row level security/u);
  assert.match(migration, /user_id=\(select auth\.uid\(\)\)[\s\S]*private\.can_access_course\(course_id\)/u);
  assert.match(migration, /public\.send_course_message[\s\S]*security invoker/u);
  assert.match(migration, /public\.publish_course_announcement[\s\S]*security invoker/u);
  assert.match(migration, /revoke execute on function public\.send_course_message[\s\S]*from anon/u);
  assert.match(migration, /grant execute on function public\.send_course_message[\s\S]*to authenticated/u);
  assert.match(migration, /pg_publication_tables[\s\S]*professor_announcements/u);
  assert.match(harness, /PASS enrolled student announcement, shared thread, and read-state sync gate/u);
  assert.match(harness, /PASS cross-institution communication, receipt, and write denial/u);
});

test("profile messaging routes to the course room beside the shared campus feed", async () => {
  const [student, professor, panel] = await Promise.all([
    readFile(studentDashboardUrl, "utf8"),
    readFile(professorDashboardUrl, "utf8"),
    readFile(panelUrl, "utf8"),
  ]);

  assert.doesNotMatch(student, /session-messages|Send message/u);
  assert.match(student, /onOpenCourseCommunication=\{\(\) => chooseTab\("messages"\)\}/u);
  assert.match(student, /Profiles do not create private direct-message threads/u);
  assert.match(student, /nextTab === "settings" \|\| nextTab === "messages"[\s\S]*setDemoMode\(false\)/u);
  assert.match(professor, /\["announcements", "Campus Social"\][\s\S]*\["communication", "Course Communication"\]/iu);
  assert.match(professor, /tab === "announcements" && <CampusSocialFeed/u);
  assert.match(professor, /tab === "communication" && <CourseCommunicationPanel/u);
  assert.match(professor, /onOpenMessages=\{\(\) => setTab\("communication"\)\}/u);
  assert.match(professor, /Course Builder controls the live state/u);
  assert.doesNotMatch(professor, /<option value="class">/u);

  assert.match(panel, /requestedCourseId !== currentCourseIdRef\.current/u);
  assert.match(panel, /requestGeneration !== refreshGenerationRef\.current/u);
  assert.match(panel, /requestId !== refreshRequestRef\.current/u);
  assert.match(panel, /if \(!preferencesDirtyRef\.current\)[\s\S]*setPreferences\(result\.data\.preferences\)/u);
  assert.match(panel, /setReplyTo\(null\)[\s\S]*setAttachmentResourceId\(""\)/u);
  assert.match(panel, /courseDeviceNotesKey\(\{[\s\S]*courseId,/u);
});

test("communication tabs and dashboard navigation expose complete keyboard and ARIA state", async () => {
  const [student, professor, panel, room] = await Promise.all([
    readFile(studentDashboardUrl, "utf8"),
    readFile(professorDashboardUrl, "utf8"),
    readFile(panelUrl, "utf8"),
    readFile(communicationRoomUrl, "utf8"),
  ]);

  assert.match(student, /aria-current=\{\(id === "demo" \? demoMode : tab === id && !demoMode\) \? "page" : undefined\}/u);
  assert.equal((professor.match(/aria-current=\{tab === id \? "page" : undefined\}/gu) || []).length, 1);

  assert.match(panel, /id="course-communication-cloud-tab"[\s\S]*aria-controls="course-communication-cloud-panel"/u);
  assert.match(panel, /id="course-communication-device-tab"[\s\S]*aria-controls="course-communication-device-panel"/u);
  assert.match(panel, /tabIndex=\{mode === "cloud" \? 0 : -1\}/u);
  assert.match(panel, /tabIndex=\{mode === "device" \? 0 : -1\}/u);
  assert.match(panel, /id="course-communication-cloud-panel"[\s\S]*role="tabpanel"[\s\S]*aria-labelledby="course-communication-cloud-tab"[\s\S]*hidden=\{mode !== "cloud"\}/u);
  assert.match(panel, /id="course-communication-device-panel"[\s\S]*role="tabpanel"[\s\S]*aria-labelledby="course-communication-device-tab"[\s\S]*hidden=\{mode !== "device"\}/u);
  assert.match(panel, /onKeyDown=\{handleModeKeyDown\}/u);
  assert.match(panel, /modeTabRefs\.current\[nextMode\]\?\.focus\(\)/u);

  assert.match(room, /id="studio-course-room-tab"[\s\S]*aria-controls="studio-course-room-panel"/u);
  assert.match(room, /id="studio-device-notebook-tab"[\s\S]*aria-controls="studio-device-notebook-panel"/u);
  assert.match(room, /id="studio-course-room-panel"[\s\S]*role="tabpanel"[\s\S]*aria-labelledby="studio-course-room-tab"/u);
  assert.match(room, /id="studio-device-notebook-panel"[\s\S]*role="tabpanel"[\s\S]*aria-labelledby="studio-device-notebook-tab"/u);
  assert.match(room, /onKeyDown=\{handleModeKeyDown\}/u);
});
