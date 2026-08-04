import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { uploadCloudFile } from "../studio/storageService.js";
import { PROFESSOR_PRICING } from "./demoData.js";
import {
  approveClassLink,
  listProfessorCourseLibrary,
  listProfessorEnrollmentRequests,
  submitEducatorVerification,
  updateCourseLibraryListing,
  updatePublishedCourseEnrollment,
} from "./portalService.js";
import AssignmentTemplateWorkspace from "./AssignmentTemplateWorkspace.jsx";
import AccountSettings, { LiveDateTime, readAccountSettings } from "../AccountSettings.jsx";
import { STORY_GUIDES, STORY_REACTION_TYPES, generateStoryFeed, getDefaultConnection, localCalendarDate } from "../demo/storyEngine.js";
import BlackboardExportWorkspace from "../integrations/blackboard/BlackboardExportWorkspace.jsx";
import { ProfessorSocialLearningPanel } from "../social-learning/SocialLearningPanels.jsx";
import CampusSocialFeed from "../social-learning/CampusSocialFeed.jsx";
import CourseCommunicationPanel from "../communication/CourseCommunicationPanel.jsx";
import { ProfessorDigitalLiteracyPilot } from "../digital-literacy/DigitalLiteracyPilotWorkspace.jsx";

const ProfessorSemesterCalendar = lazy(() =>
  import("../ai/ProfessorSemesterCalendar.jsx")
);

const NAV_GROUPS = [
  { label: "Teach", items: [["overview", "Overview"], ["classes", "Course Library"], ["semester", "Syllabus & Calendar"], ["digital-literacy", "Digital Literacy Course"], ["templates", "Assignments"]] },
  { label: "Students", items: [["students", "Students & Roster"], ["rewards", "Social Learning"], ["grades", "Progress & Analytics"], ["attendance", "Attendance"]] },
  { label: "Connect", items: [["notifications", "Notifications"], ["announcements", "Campus Social"], ["communication", "Course Communication"], ["profile", "Educator Page"]] },
  { label: "Account", items: [["verification", "School Verification"], ["security", "Security"], ["settings", "Settings"], ["help", "Help & Support"]] },
];

const TOUR = [
  ["Teaching overview", "See your real courses, enrollment requests, progress, and upcoming work."],
  ["Review Digital Literacy", "Open the complete canonical course inside EdNotebook and preview the learner experience."],
  ["Create and publish a course", "Create a course, review it, then control student and Library visibility when it is ready."],
  ["Match and approve students", "Upload a roster or add student IDs, then approve the account match."],
  ["Publish grades carefully", "Student progress and grade publishing re-lock whenever you leave the tab and after five minutes."],
];

function EducatorTour({ step, setStep }) {
  if (step === null) return null;
  return <div className="dashboard-tour-backdrop" role="dialog" aria-modal="true"><div className="dashboard-tour-card"><span>EDUCATOR TOUR · {step + 1} OF {TOUR.length}</span><h2>{TOUR[step][0]}</h2><p>{TOUR[step][1]}</p><div><button type="button" onClick={() => setStep(null)}>Close</button><button type="button" onClick={() => setStep(step === TOUR.length - 1 ? null : step + 1)}>{step === TOUR.length - 1 ? "Finish" : "Next"}</button></div></div></div>;
}

function ProfessorNavigation({ tab, setTab, pendingRequests = 0 }) {
  return <nav aria-label="Educator dashboard">{NAV_GROUPS.map((group) => <div className="professor-nav-group" key={group.label}><span>{group.label}</span>{group.items.map(([id, label]) => <button className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined} type="button" key={id} onClick={() => setTab(id)}>{label}{id === "students" && pendingRequests > 0 && <i>{pendingRequests}</i>}</button>)}</div>)}</nav>;
}

function SensitiveAccess({ session, unlocked, onUnlock, onLock, children }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const lockWhenHidden = () => { if (document.hidden) onLock(); }; document.addEventListener("visibilitychange", lockWhenHidden); return () => document.removeEventListener("visibilitychange", lockWhenHidden); }, [onLock]);
  async function verify(event) { event.preventDefault(); setBusy(true); setError(""); try { if (!isSupabaseConfigured || !session?.user?.email) throw new Error("A signed-in educator account is required."); const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password }); if (verifyError) throw verifyError; setPassword(""); onUnlock(); } catch (verifyError) { setError(verifyError.message || "The account could not be verified."); } finally { setBusy(false); } }
  if (unlocked) return <>{children}</>;
  return <section className="sensitive-access-card"><span className="portal-kicker">SENSITIVE EDUCATOR AREA</span><h1>Verify it's you before opening student progress.</h1><p>Re-enter the password for {session?.user?.email || "this educator account"}. This area locks when you leave the tab or after five minutes.</p><form onSubmit={verify}><label>Account password<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div role="alert">{error}</div>}<button type="submit" disabled={busy}>{busy ? "Verifying…" : "Unlock for five minutes"}</button></form></section>;
}

function Overview({ setTab, classes, enrollmentRequests }) {
  const published = classes.filter((course) => course.published);
  const students = classes.reduce((sum, course) => sum + course.students, 0);
  const pending = enrollmentRequests.filter((request) => request.status === "pending");
  return <div className="professor-panel-stack">
    <section className="professor-welcome-card"><div><span>EDUCATOR WORKSPACE</span><h1>Every course, student, and conversation in one teaching home.</h1><p>Create and manage courses, review the learner experience, organize assignments, and publish when ready.</p></div><button type="button" onClick={() => setTab("classes")}>Open Course Library</button></section>
    <section className="dashboard-card professor-digital-literacy-entry"><div><span className="portal-kicker">AUTOMATIC COURSE · READY TO REVIEW</span><h2>Digital Literacy Course</h2><p>The full canonical course is available to every professor account. Open it to preview the learner experience, review modules and quizzes, or assign selected content to your students.</p></div><button type="button" onClick={() => setTab("digital-literacy")}>Open Digital Literacy Course</button></section>
    <section className="student-stat-grid professor-stat-grid"><article><span>Published courses</span><strong>{published.length}</strong><button type="button" onClick={() => setTab("classes")}>Manage</button></article><article><span>Enrolled students</span><strong>{students}</strong><button type="button" onClick={() => setTab("students")}>Open roster</button></article><article><span>Enrollment requests</span><strong>{pending.length}</strong><button type="button" onClick={() => setTab("students")}>{pending.length ? "Review now" : "Queue is clear"}</button></article><article><span>Draft courses</span><strong>{classes.length - published.length}</strong><button type="button" onClick={() => setTab("classes")}>Continue building</button></article></section>
    <section className="professor-dashboard-columns"><article className="dashboard-card"><span className="portal-kicker">ACCOUNT LINKING</span><h2>{pending.length ? "Students waiting" : "No requests waiting"}</h2>{pending.slice(0, 4).map((request) => <div className="professor-alert-row" key={request.id}><span>{request.course?.course_code || "COURSE"}</span><strong>approval requested</strong></div>)}<button type="button" onClick={() => setTab("students")}>Open approval queue</button></article><article className="dashboard-card"><span className="portal-kicker">SCHOOL AFFILIATION</span><h2>Verification is separate from workspace access.</h2><p>Your professor workspace remains active. Institutional review adds the verified affiliation badge and governs access to institution-owned records.</p><button type="button" onClick={() => setTab("verification")}>Open School Verification</button></article></section>
  </div>;
}

function CourseAccessControls({ course, onSave, busy }) {
  const [enrollmentPolicy, setEnrollmentPolicy] = useState(course.enrollmentPolicy || "approval_required");
  const [universalAssignment, setUniversalAssignment] = useState(Boolean(course.universalAssignment));
  const [badgeName, setBadgeName] = useState(course.completionBadgeName || `Completed · ${course.title}`);
  const [badgeDescription, setBadgeDescription] = useState(course.completionBadgeDescription || `Recognizes completion of ${course.title} in EdNotebook.`);
  function changePolicy(event) {
    const next = event.target.value;
    setEnrollmentPolicy(next);
    if (next !== "open_self_enroll") setUniversalAssignment(false);
  }
  return <div className="professor-course-access-controls">
    <div>
      <label>Student access<select value={enrollmentPolicy} onChange={changePolicy} disabled={busy}><option value="approval_required">Professor approval required</option><option value="open_self_enroll">Open · students join immediately</option></select></label>
      <label className="professor-universal-course"><input type="checkbox" checked={universalAssignment} disabled={busy || enrollmentPolicy !== "open_self_enroll"} onChange={(event) => setUniversalAssignment(event.target.checked)} />Assign to every eligible new student</label>
    </div>
    <p>{enrollmentPolicy === "approval_required"
      ? "Matching-school students can find this class, but protected content opens only after you approve them."
      : universalAssignment
        ? "Matching-school students join instantly, and eligible new students receive this course automatically."
        : "Matching-school students join instantly from the published directory."}</p>
    <div className="professor-course-badge-fields">
      <label>Completion badge<input value={badgeName} maxLength={120} onChange={(event) => setBadgeName(event.target.value)} disabled={busy} /></label>
      <label>Badge meaning<input value={badgeDescription} maxLength={300} onChange={(event) => setBadgeDescription(event.target.value)} disabled={busy} /></label>
    </div>
    <button type="button" disabled={busy || !badgeName.trim() || badgeDescription.trim().length < 10} onClick={() => onSave?.({
      courseId: course.id,
      enrollmentPolicy,
      universalAssignment,
      badgeName: badgeName.trim(),
      badgeDescription: badgeDescription.trim(),
    })}>{busy ? "Saving access…" : "Save student access"}</button>
  </div>;
}

function CourseLibraryControls({ course, onSave, busy }) {
  const [accessModel, setAccessModel] = useState(course.libraryAccessModel || "not_listed");
  const [price, setPrice] = useState(course.libraryPriceCents ? (course.libraryPriceCents / 100).toFixed(2) : "");
  const [rentalDays, setRentalDays] = useState(course.libraryRentalDays || 30);
  const commercial = accessModel === "purchase" || accessModel === "rental";
  return <div className="professor-library-listing-controls">
    <div>
      <label>Alex B. Morrison listing<select value={accessModel} disabled={busy} onChange={(event) => setAccessModel(event.target.value)}>
        <option value="not_listed">Not listed in Library</option>
        <option value="open_free">Free Library course</option>
        <option value="purchase">Bookstore purchase · submit for review</option>
        <option value="rental">Bookstore rental · submit for review</option>
      </select></label>
      {commercial && <label>Price (USD)<input type="number" min="0.01" step="0.01" value={price} disabled={busy} onChange={(event) => setPrice(event.target.value)} /></label>}
      {accessModel === "rental" && <label>Rental days<input type="number" min="1" max="365" value={rentalDays} disabled={busy} onChange={(event) => setRentalDays(event.target.value)} /></label>}
    </div>
    <p>{accessModel === "not_listed"
      ? "This course stays in professor and class workflows but does not appear in the Alex B. Morrison catalog."
      : accessModel === "open_free"
        ? "Students can discover this course in the Library for free. Enrollment approval and automatic assignment remain separate settings above."
        : "The catalog preview can be prepared now. Checkout stays unavailable until rights, seller, tax, refund, and payout controls are approved."}</p>
    <button type="button" disabled={busy || (commercial && Number(price) <= 0)} onClick={() => onSave?.({
      courseId: course.id,
      accessModel,
      priceCents: commercial ? Math.round(Number(price) * 100) : null,
      rentalDays: accessModel === "rental" ? Number(rentalDays) : null,
    })}>{busy ? "Saving Library listing…" : "Save Library listing"}</button>
    {course.libraryListingStatus !== "not_listed" && <span className={`library-listing-state is-${course.libraryListingStatus}`}>Library status · {course.libraryListingStatus}</span>}
  </div>;
}

function Classes({ onBuild, onOpenDigitalLiteracy, classes, onSaveAccess, accessBusyCourse, onSaveLibrary, libraryBusyCourse }) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [status, setStatus] = useState("all");
  const visible = classes.filter((course) => {
    const matchesQuery = `${course.code} ${course.title} ${course.subject || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesDivision = division === "all" || course.division === division;
    const matchesStatus = status === "all" || (status === "published" ? course.published : !course.published);
    return matchesQuery && matchesDivision && matchesStatus;
  });
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">MY COURSES</span><h1>Course Library</h1><p>Create, reopen, edit, preview, and publish your courses from one organized library.</p></div><button type="button" onClick={() => onBuild(null)}>Create Course</button></div><article className="professor-canonical-library-row"><div><span>PLATFORM STANDARD · AUTOMATIC</span><strong>Digital Literacy Course</strong><small>Full repository-backed course · learner preview · modules, activities, and quizzes</small></div><button type="button" onClick={onOpenDigitalLiteracy}>Open Course</button></article><div className="class-library-controls professor-library-controls"><label>Search courses<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, title, or subject" /></label><label>Division<select value={division} onChange={(event) => setDivision(event.target.value)}><option value="all">All divisions</option><option value="university">University</option><option value="k12">K–12</option></select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft or review</option></select></label></div>{classes.length === 0 ? <div className="empty-class-list"><strong>Your first original course starts in Course Builder.</strong><p>The Digital Literacy Course above is already available. Create another course, review its student experience, and publish when it is ready.</p><button type="button" onClick={() => onBuild(null)}>Create Course</button></div> : visible.length === 0 ? <div className="empty-class-list"><strong>No courses match these filters.</strong><button type="button" onClick={() => { setQuery(""); setDivision("all"); setStatus("all"); }}>Clear filters</button></div> : <div className="professor-class-grid">{visible.map((course) => <article key={course.id}><div><span>{course.code} · {course.division === "k12" ? "K–12" : "University"}</span><strong>{course.title}</strong><small>{course.term} · {course.students} student{course.students === 1 ? "" : "s"} · {course.pendingRequests} waiting</small></div><div className="professor-class-status"><span className={course.published ? "is-live" : "is-draft"}>{course.published ? "Published to student search" : `${course.publicationStatus || "draft"} · not in search`}</span><span className={`educator-verification-badge is-${course.verificationStatus}`}>Affiliation {course.verificationStatus}</span></div>{course.published && <CourseAccessControls course={course} onSave={onSaveAccess} busy={accessBusyCourse === course.id} />}{course.published && <CourseLibraryControls course={course} onSave={onSaveLibrary} busy={libraryBusyCourse === course.id} />}<footer><button type="button" onClick={() => onBuild(course)}>Open in Course Builder</button>{course.published && <a href={`#/students/${course.division}?course=${course.id}`}>View student listing</a>}{course.published && <a href={`#/publishers?course=${course.id}`}>View Alex B. Morrison</a>}</footer></article>)}</div>}<div className="class-publishing-note"><strong>One course package, three governed choices</strong><span>Course Builder controls the live state and owns the approved package. Student enrollment, universal assignment, and Library/Bookstore visibility reference that same package instead of creating duplicate courses.</span></div></section>;
}

function parseRosterCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase().replaceAll(" ", "_"));
  return lines.slice(1).map((line, index) => { const values = line.split(",").map((item) => item.trim()); const row = Object.fromEntries(headers.map((header, position) => [header, values[position] || ""])); const rawId = row.student_id || row.university_id || ""; const program = row.major || row.grade_level || "Not provided"; const enteredCourses = row.courses || row.classes || row.course; return { id: `upload-${index}`, studentId: rawId ? `••••${rawId.slice(-4)}` : "missing", name: row.name || row.student_name || "Unnamed student", program, courses: enteredCourses ? enteredCourses.split("|").map((item) => item.trim()).filter(Boolean) : [], status: "pending", account: "needs link" }; });
}

function StudentsPanel({ enrollmentRequests, onApproveEnrollment }) {
  const [roster, setRoster] = useState([]);
  const [csv, setCsv] = useState("student_id,name,program,courses\n");
  const [notice, setNotice] = useState("");
  function previewRoster() { const rows = parseRosterCsv(csv); if (!rows.length) { setNotice("Add a header row and at least one real Beta student."); return; } setRoster([...roster, ...rows]); setNotice(`${rows.length} student${rows.length === 1 ? "" : "s"} added to this browser's import preview. Review before saving or linking any account.`); }
  function approve(id) { setRoster(roster.map((student) => student.id === id ? { ...student, status: "approved", account: student.account === "needs link" ? "link requested" : student.account } : student)); }
  const pendingCloud = enrollmentRequests.filter((request) => request.status === "pending");
  return <div className="professor-panel-stack">
    <section className="dashboard-card governed-enrollment-queue">
      <div className="dashboard-card-heading"><div><span className="portal-kicker">LIVE APPROVAL QUEUE</span><h1>Published-course requests</h1><p>Approving a request adds the student to this course only. The course then appears in the student's organized class library.</p></div><span>{pendingCloud.length} waiting</span></div>
      {pendingCloud.length ? <div className="governed-request-list">{pendingCloud.map((request) => <article key={request.id}><div><strong>{request.course?.course_code || "CLASS"} · {request.course?.title || "Published course"}</strong><span>Student account ending {request.student_id.slice(-6)} · {new Date(request.requested_at).toLocaleString()}</span></div><button type="button" onClick={() => onApproveEnrollment(request.id)}>Approve course link</button></article>)}</div> : <div className="empty-class-list"><strong>The live queue is clear.</strong><p>New requests from the public student directory will appear here.</p></div>}
    </section>
    <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ROSTER IMPORT</span><h1>Add real Beta students by course and student ID.</h1><p>The form starts empty. Use student_id, name, program, and courses only when you are ready to test with an authorized account.</p></div></div><div className="roster-import-layout"><div><label>Paste CSV<textarea rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} /></label><button type="button" onClick={previewRoster}>Preview students</button>{notice && <div className="portal-form-notice">{notice}</div>}</div><aside><strong>Accepted columns</strong><code>student_id,name,program,courses</code><p>Separate multiple courses with a vertical bar.</p><span>Saved ID matching uses a protected server-side value. Raw IDs are not placed in public tables.</span></aside></div></section>
    <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ROSTER PREVIEW</span><h2>Imported student rows</h2></div><span>{roster.filter((item) => item.status === "pending").length} waiting</span></div>{roster.length ? <div className="roster-table"><div className="roster-row is-head"><span>Student</span><span>Student ID</span><span>Program</span><span>Course assignment</span><span>Status</span><span>Action</span></div>{roster.map((student) => <div className="roster-row" key={student.id}><span><strong>{student.name}</strong><small>{student.account}</small></span><span>{student.studentId}</span><span>{student.program}</span><span>{student.courses.length ? student.courses.join(", ") : "Unassigned"}</span><span className={`roster-status is-${student.status}`}>{student.status}</span><span>{student.status === "pending" ? <button type="button" onClick={() => approve(student.id)}>Approve preview</button> : <button type="button">Manage</button>}</span></div>)}</div> : <div className="empty-class-list"><strong>No students have been added.</strong><p>New professor accounts begin empty. Only real enrollment requests or rows you deliberately preview will appear here.</p></div>}</section>
  </div>;
}

function GradesPanel({ onLock }) {
  const [rows, setRows] = useState([]); const [quizWeight, setQuizWeight] = useState(25); const [projectWeight, setProjectWeight] = useState(25); const [blackboardExportOpen, setBlackboardExportOpen] = useState(false);
  function updateStatus(id, status) { setRows(rows.map((row) => row.id === id ? { ...row, status } : row)); }
  if (blackboardExportOpen) return <BlackboardExportWorkspace onClose={() => setBlackboardExportOpen(false)} />;
  return <div className="professor-panel-stack"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">GRADEBOOK</span><h1>Pending, missing, and finalized grades</h1><p>Students see the same status and published weights. Finalizing makes the grade visible only to that student.</p></div><button type="button" onClick={onLock}>Lock now</button></div>{rows.length ? <><div className="grade-table professor-grade-table"><div className="grade-table-row is-head"><span>Student</span><span>Item</span><span>Score</span><span>Status</span><span>Publish</span></div>{rows.map((row) => <div className="grade-table-row" key={row.id}><span><strong>{row.student}</strong>{row.studentId}</span><span>{row.item}</span><span><input aria-label={`Score for ${row.student}`} type="number" value={row.score ?? ""} onChange={(event) => setRows(rows.map((item) => item.id === row.id ? { ...item, score: event.target.value === "" ? null : Number(event.target.value) } : item))} /></span><span className={`grade-status is-${row.status}`}>{row.status}</span><span><select value={row.status} onChange={(event) => updateStatus(row.id, event.target.value)}><option value="pending">Pending</option><option value="missing">Missing</option><option value="finalized">Finalize</option></select></span></div>)}</div><button className="publish-grade-button" type="button">Publish finalized grades</button></> : <div className="empty-class-list"><strong>No student grades yet.</strong><p>Real assignment results appear here after students enroll and submit work. New accounts do not load sample students or grades.</p></div>}</section><section className="grade-calculator-grid"><article className="dashboard-card"><span className="portal-kicker">PUBLISHED WEIGHTS</span><h2>Mirror the scale students see.</h2><label>Projects<input type="number" value={projectWeight} onChange={(event) => setProjectWeight(Number(event.target.value))} /></label><label>Quizzes<input type="number" value={quizWeight} onChange={(event) => setQuizWeight(Number(event.target.value))} /></label><div className="weight-row"><span>Projects</span><div><i style={{ width: `${projectWeight * 3}%` }} /></div><strong>{projectWeight}%</strong></div><div className="weight-row"><span>Quizzes</span><div><i style={{ width: `${quizWeight * 3}%` }} /></div><strong>{quizWeight}%</strong></div><p className="weight-note">Remaining categories total {100 - projectWeight - quizWeight}%.</p><button type="button">Publish scale</button></article><article className="dashboard-card"><span className="portal-kicker">EXPORT &amp; INTEGRATIONS</span><h2>Move approved grades into Blackboard.</h2><p>Upload the gradebook CSV you downloaded from Blackboard, match students and columns, preview every change, and download an updated file.</p><ul><li>Blackboard structure is preserved.</li><li>Only finalized grades are eligible.</li><li>Every confirmed export is recorded.</li></ul><button type="button" onClick={() => setBlackboardExportOpen(true)}>Export to Blackboard</button></article><article className="dashboard-card"><span className="portal-kicker">COURSE BOUNDARY</span><h2>Only courses you manage.</h2><p>This gradebook cannot display the same student's grades from another educator's course.</p><ul><li>Students see their own cross-course report.</li><li>Educators see managed-course grades only.</li><li>Another educator needs a student-authorized report link.</li></ul></article></section></div>;
}

function AttendancePanel({ classes = [] }) {
  const [course, setCourse] = useState(classes[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (!course && classes[0]?.id) setCourse(classes[0].id);
  }, [classes, course]);
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ATTENDANCE</span><h1>Attendance begins with your real course roster.</h1><p>No sample courses or student profiles are loaded. Enrolled students will appear only after you create or publish a course and approve their enrollment.</p></div></div>{classes.length ? <div className="attendance-controls"><label>Course<select value={course} onChange={(event) => setCourse(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{item.code || item.course_code || "COURSE"} · {item.title}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div> : null}<div className="empty-class-list"><strong>{classes.length ? "No enrolled students in this course yet." : "No original courses yet."}</strong><p>{classes.length ? "Approve a real enrollment request before taking attendance." : "The Digital Literacy Course is ready to review. Create an original course when you want to enroll students and take attendance."}</p></div></section>;
}

function FacultyFeedPanel({ accountSettings, storageScope, onOpenCourseCommunication }) {
  const guide = getDefaultConnection("professor");
  const storageKey = `ednotebook-${storageScope}-professor-social-posts`;
  const reactionStorageKey = `${storageKey}-reactions`;
  const savedStorageKey = `${storageKey}-saved`;
  const [audience, setAudience] = useState("faculty");
  const [feedAudience, setFeedAudience] = useState("all");
  const [body, setBody] = useState("");
  const [localPosts, setLocalPosts] = useState(() => { try { return JSON.parse(window.localStorage.getItem(storageKey)) || []; } catch { return []; } });
  const [reactions, setReactions] = useState(() => { try { return JSON.parse(window.localStorage.getItem(reactionStorageKey)) || {}; } catch { return {}; } });
  const [savedPosts, setSavedPosts] = useState(() => { try { return JSON.parse(window.localStorage.getItem(savedStorageKey)) || []; } catch { return []; } });
  const [storyNow, setStoryNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setStoryNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const storyPosts = useMemo(() => generateStoryFeed({ persona: "professor", now: storyNow, newestFirst: true }), [storyNow]);
  const feed = [...localPosts, ...storyPosts]
    .filter((post) => post.audience !== "class")
    .filter((post) => feedAudience === "all" || post.audience === feedAudience);
  function publish(event) {
    event.preventDefault();
    if (!body.trim()) return;
    const now = new Date();
    const next = [{ id: crypto.randomUUID(), author: accountSettings.displayName || "Educator", audience, body: body.trim(), date: localCalendarDate(now), timeLabel: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now), reactions: { types: STORY_REACTION_TYPES.map((item, index) => ({ ...item, count: index === 0 ? 1 : 0 })) } }, ...localPosts];
    setLocalPosts(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setBody("");
  }
  function react(postId, reactionId) { const next = { ...reactions, [postId]: reactions[postId] === reactionId ? null : reactionId }; setReactions(next); window.localStorage.setItem(reactionStorageKey, JSON.stringify(next)); }
  function toggleSaved(postId) { const next = savedPosts.includes(postId) ? savedPosts.filter((id) => id !== postId) : [...savedPosts, postId]; setSavedPosts(next); window.localStorage.setItem(savedStorageKey, JSON.stringify(next)); }
  return (
    <div className="professor-panel-stack">
      <section className="dashboard-card faculty-feed-guide">
        <img src={guide.image} alt="" />
        <div><span className="portal-kicker">FIRST FACULTY CONNECTION</span><h1>{guide.name}</h1><p>Atlas shares a new teaching chapter each Sunday and welcomes new educator accounts.</p></div>
        <button type="button">Following Atlas</button>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card-heading">
          <div>
            <span className="portal-kicker">FACULTY &amp; SCHOOL COMMUNITY</span>
            <h2>Choose the educator community before posting.</h2>
            <p>This social preview is for faculty peers and school staff. Student-delivered class announcements use the governed course room.</p>
          </div>
          <div>
            <label>
              Show
              <select value={feedAudience} onChange={(event) => setFeedAudience(event.target.value)}>
                <option value="all">All educator feeds</option>
                <option value="faculty">Faculty peers</option>
                <option value="school">School staff</option>
              </select>
            </label>
            <button type="button" onClick={onOpenCourseCommunication}>Open course communication</button>
          </div>
        </div>
        <div className="portal-form-notice" role="note">
          Social posts here are saved only on this device. They are not delivered to a class.
        </div>
        <form className="professor-announcement-form" onSubmit={publish}>
          <label>
            Educator social audience
            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="faculty">Faculty peers</option>
              <option value="school">School staff</option>
            </select>
          </label>
          <label>
            Social post
            <textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share a teaching idea or educator-community highlight…" />
          </label>
          <button type="submit">Save device-only social post</button>
        </form>
        <div className="faculty-story-feed">
          {feed.map((post, index) => {
            const isStory = Boolean(post.personaId);
            const items = post.reactions?.types || STORY_REACTION_TYPES.map((item) => ({ ...item, count: 0 }));
            return (
              <article key={post.id || index}>
                <header><img src={isStory ? STORY_GUIDES.professor.image : guide.image} alt="" /><div><strong>{isStory ? STORY_GUIDES.professor.name : post.author}</strong><span>{post.date} · {post.timeLabel} · {post.audience}</span></div></header>
                <p>{post.body}</p>
                {post.snapshot && <div className="portal-story-snapshot"><span>{post.snapshot.feedbackCompleted} feedback items</span><span>{post.snapshot.responseRate}% response rate</span></div>}
                <footer>
                  {items.map((reaction) => <button type="button" className={reactions[post.id] === reaction.id ? "is-active" : ""} key={reaction.id} onClick={() => react(post.id, reaction.id)}>{reaction.symbol} {reaction.count + (reactions[post.id] === reaction.id ? 1 : 0)}</button>)}
                  <button type="button" className={savedPosts.includes(post.id) ? "is-active" : ""} onClick={() => toggleSaved(post.id)}>{savedPosts.includes(post.id) ? "Saved" : "Save"}</button>
                </footer>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EducatorProfile({ profile, classes = [] }) {
  const [bio, setBio] = useState("");
  const published = classes.filter((course) => course.published);
  return <div className="professor-profile-layout"><section className="dashboard-card"><span className="portal-kicker">EDUCATOR PAGE</span><h1>Your public home for courses and announcements.</h1><p>Your profile starts empty. Add only information you want to make public. A verified badge requires manual school-affiliation review.</p><label>Public bio<textarea rows={5} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Describe your teaching, research, or academic-support work." /></label><div className="interest-field-grid"><label>Office hours<input placeholder="Optional" /></label><label>Department or subject<input placeholder="Optional" /></label></div><label>Professional or school page<input type="url" placeholder="https://…" /></label><label>Video or YouTube link<input type="url" placeholder="https://youtube.com/…" /></label><button type="button">Save educator page</button></section><aside className="professor-public-page"><span>UNVERIFIED SCHOOL AFFILIATION</span><h2>{profile?.full_name || "Educator"}</h2><p>{bio || "Your public biography will appear here after you add it."}</p><div><strong>{published.length}</strong><span>published courses</span></div>{published.length ? published.slice(0, 3).map((course) => <article key={course.id}><strong>{course.code || course.course_code || "COURSE"} · {course.title}</strong><span>{course.term || course.teaching_window || "Published course"}</span></article>) : <article><strong>No published courses yet</strong><span>The automatic Digital Literacy Course remains available in your private professor workspace.</span></article>}</aside><section className="professor-plan-strip">{PROFESSOR_PRICING.map((plan) => <article key={plan.name}><span>{plan.name}</span><strong>{plan.price}</strong><p>{plan.description}</p></article>)}</section></div>;
}

function VerificationPanel({ session }) {
  const [division, setDivision] = useState("university"); const [school, setSchool] = useState(""); const [department, setDepartment] = useState(""); const [teacherId, setTeacherId] = useState(""); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  async function submit(event) { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { if (!file) throw new Error("Choose a teacher ID image or PDF."); if (file.size > 10 * 1024 * 1024) throw new Error("Teacher ID files must be 10 MB or smaller."); if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error("Upload a PDF, JPG, or PNG."); const uploaded = await uploadCloudFile(file, { scope: "private", title: "Educator verification document", category: "educator-verification", metadata: { educationDivision: division } }); const { error: requestError } = await submitEducatorVerification({ user_id: session.user.id, institution_name: school.trim(), education_division: division, department: department.trim() || null, teacher_identifier_last4: teacherId.trim().slice(-4) || null, secure_file_id: uploaded.secureFileId, status: "pending", submitted_at: new Date().toISOString() }); if (requestError) throw requestError; setNotice("Verification request submitted to the governed TOS affiliation queue. Authorized university reviewers can now see it in Control Center. Your classes remain available while you wait."); } catch (submitError) { setError(submitError.message || "Verification request could not be submitted."); } finally { setBusy(false); } }
  return <section className="dashboard-card verification-panel"><div className="dashboard-card-heading"><div><span className="portal-kicker">GOVERNED SCHOOL VERIFICATION</span><h1>Add a verified affiliation badge.</h1><p>Your request, private evidence file, institution scope, and final decision follow the TOS Control Center review route. Verification is not required to create or publish an independent class.</p></div><span className="educator-verification-badge is-unverified">Currently unverified</span></div><form onSubmit={submit}><div className="interest-field-grid"><label>Education division<select value={division} onChange={(event) => setDivision(event.target.value)}><option value="university">University / college</option><option value="k12">K–12 school</option><option value="both">Both</option></select></label><label>School or university<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label><label>Department or subject<input value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label>Teacher ID number, if shown<input value={teacherId} onChange={(event) => setTeacherId(event.target.value)} autoComplete="off" /><small>Only the last four characters are saved in the review queue.</small></label></div><label>Teacher ID or staff document<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>PDF, JPG, or PNG · 10 MB maximum · stored in the private file service</small></label>{error && <div className="portal-form-error" role="alert">{error}</div>}{notice && <div className="portal-form-notice" role="status">{notice}</div>}<button type="submit" disabled={busy}>{busy ? "Uploading securely…" : "Submit to TOS review queue"}</button></form></section>;
}

function SecurityPanel({ unlocked, onLock }) { return <section className="dashboard-card professor-security-panel"><span className="portal-kicker">EDUCATOR SECURITY</span><h1>Private student areas get an extra lock.</h1><div className="security-setting-grid"><article><strong>Current sensitive session</strong><span className={unlocked ? "is-on" : "is-off"}>{unlocked ? "Unlocked · less than five minutes" : "Locked"}</span><button type="button" onClick={onLock}>Lock now</button></article><article><strong>Auto-lock</strong><span>Five minutes or whenever this browser tab is hidden</span></article><article><strong>Grade publishing</strong><span>Password re-entry before opening the gradebook; course ownership still controls writes</span></article><article><strong>Student account links</strong><span>Notifications appear when a student ID match needs educator approval</span></article></div></section>; }

function NotificationsPanel({ enrollmentRequests = [], onOpenRequests, onOpenDigitalLiteracy }) {
  const pending = enrollmentRequests.filter((request) => request.status === "pending");
  return <section className="dashboard-card professor-notification-panel"><div className="dashboard-card-heading"><div><span className="portal-kicker">NOTIFICATIONS</span><h1>Teaching updates in one place.</h1><p>Open the item that triggered a notification. Course reminders, enrollment requests, published feedback, and school-verification updates stay connected to their source.</p></div><span>{pending.length} action{pending.length === 1 ? "" : "s"}</span></div><div className="professor-notification-list">{pending.map((request) => <button type="button" key={request.id} onClick={onOpenRequests}><span>Enrollment request</span><strong>{request.course?.course_code || "COURSE"} · {request.course?.title || "Published course"}</strong><small>Open Students & Roster to review</small></button>)}<button type="button" onClick={onOpenDigitalLiteracy}><span>Course ready</span><strong>Digital Literacy Course</strong><small>Open the full course or assign modules</small></button></div></section>;
}

function HelpSupportPanel({ onTour }) {
  return <section className="dashboard-card professor-help-panel"><span className="portal-kicker">HELP & SUPPORT · PROFESSOR BETA</span><h1>Test confidently and tell us what needs attention.</h1><p>Use non-sensitive content during Beta. If something does not work, include the page, device, browser, expected result, actual result, and a screenshot when possible.</p><div className="professor-help-grid"><article><strong>First-time walkthrough</strong><span>Account, Digital Literacy Course, Course Library, Create Course, Syllabus & Calendar, assignments, due dates, and learner preview.</span><button type="button" onClick={onTour}>Take the professor tour</button></article><article><strong>Account access</strong><span>Institutional review does not block the professor workspace. Pending accounts remain visibly unverified until the affiliation is approved.</span><a href="mailto:support@ednotebook.com?subject=Professor%20Beta%20feedback">Email Beta feedback</a></article></div></section>;
}

export default function ProfessorDashboard({ profile, session, onHome, onBuild, onAdmin }) {
  const [tab, setTab] = useState("overview"); const [tourStep, setTourStep] = useState(null); const [unlockedUntil, setUnlockedUntil] = useState(0); const [, setClock] = useState(Date.now());
  const [courseLibrary, setCourseLibrary] = useState([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState([]);
  const [portalNotice, setPortalNotice] = useState("");
  const [accessBusyCourse, setAccessBusyCourse] = useState("");
  const [libraryBusyCourse, setLibraryBusyCourse] = useState("");
  const settingsScope = `professor-${session?.user?.id || "guest"}`;
  const [accountSettings, setAccountSettings] = useState(() => readAccountSettings(settingsScope, { accountType: "professor", name: profile?.full_name || "Educator", email: session?.user?.email || "" }));
  const unlocked = unlockedUntil > Date.now(); const sensitive = tab === "students" || tab === "rewards" || tab === "grades"; const displayName = useMemo(() => accountSettings.displayName || profile?.full_name || "Educator", [accountSettings.displayName, profile?.full_name]);
  const teachingClasses = courseLibrary;
  const pendingRequestCount = enrollmentRequests.filter((request) => request.status === "pending").length;
  useEffect(() => { setAccountSettings(readAccountSettings(settingsScope, { accountType: "professor", name: profile?.full_name || "Educator", email: session?.user?.email || "" })); }, [settingsScope, profile?.full_name, session?.user?.email]);
  useEffect(() => { if (!unlockedUntil) return undefined; const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, [unlockedUntil]);
  useEffect(() => {
    let active = true;
    Promise.all([listProfessorCourseLibrary(), listProfessorEnrollmentRequests()]).then(([courseResult, enrollmentResult]) => {
      if (!active) return;
      setCourseLibrary(courseResult.data || []);
      setEnrollmentRequests(enrollmentResult.data || []);
    });
    return () => { active = false; };
  }, [session?.user?.id]);
  function unlock() { setUnlockedUntil(Date.now() + 5 * 60 * 1000); } function lock() { setUnlockedUntil(0); }
  async function approveEnrollment(requestId) {
    setPortalNotice("Approving the course link…");
    const result = await approveClassLink(requestId);
    if (result.error) {
      setPortalNotice(result.error.message || "The course link could not be approved.");
      return;
    }
    const [courseResult, enrollmentResult] = await Promise.all([listProfessorCourseLibrary(), listProfessorEnrollmentRequests()]);
    setCourseLibrary(courseResult.data || []);
    setEnrollmentRequests(enrollmentResult.data || []);
    setPortalNotice("Course link approved. The published course is now available in the student's class library.");
  }
  async function saveCourseAccess(preferences) {
    setAccessBusyCourse(preferences.courseId);
    setPortalNotice("Saving student access and completion badge settings…");
    const result = await updatePublishedCourseEnrollment(preferences);
    if (result.error) {
      setPortalNotice(result.error.message || "Student access settings could not be saved.");
      setAccessBusyCourse("");
      return;
    }
    const [courseResult, enrollmentResult] = await Promise.all([listProfessorCourseLibrary(), listProfessorEnrollmentRequests()]);
    setCourseLibrary(courseResult.data || []);
    setEnrollmentRequests(enrollmentResult.data || []);
    setPortalNotice(preferences.universalAssignment
      ? "Open enrollment saved. Eligible current and new students receive this universal course automatically."
      : preferences.enrollmentPolicy === "open_self_enroll"
        ? "Open enrollment saved. Matching-school students can join immediately."
        : "Professor approval saved. Students remain pending until you accept them.");
    setAccessBusyCourse("");
  }
  async function saveLibraryListing(preferences) {
    setLibraryBusyCourse(preferences.courseId);
    setPortalNotice("Saving the Alex B. Morrison Library listing…");
    const result = await updateCourseLibraryListing(preferences);
    if (result.error) {
      setPortalNotice(result.error.message || "The Library listing could not be saved.");
      setLibraryBusyCourse("");
      return;
    }
    const courseResult = await listProfessorCourseLibrary();
    setCourseLibrary(courseResult.data || []);
    setPortalNotice(preferences.accessModel === "open_free"
      ? "Free Library listing published. Enrollment and automatic assignment remain separate controls."
      : preferences.accessModel === "not_listed"
        ? "Course removed from the Alex B. Morrison catalog. Its class publication is unchanged."
        : "Commercial catalog preview submitted for review. Checkout remains unavailable until marketplace controls are approved.");
    setLibraryBusyCourse("");
  }
  if (tab === "settings") return <div className={`professor-dashboard-page ${accountSettings.showDescriptions ? "" : "is-description-light"}`}><header className="dashboard-topbar professor-topbar"><button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline="Educator portal" /></button><span className="sample-workspace-badge">Teaching workspace</span><div className="dashboard-top-actions"><LiveDateTime /><button type="button" onClick={() => setTourStep(0)}>Take the tour</button><button className="primary" type="button" onClick={() => onBuild(null)}>Create Course</button></div></header><div className="student-dashboard-shell professor-dashboard-shell"><aside className="student-dashboard-sidebar professor-sidebar"><div className="student-sidebar-profile"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{courseLibrary.length} original course{courseLibrary.length === 1 ? "" : "s"} · Digital Literacy ready</small></div></div><ProfessorNavigation tab={tab} setTab={setTab} pendingRequests={pendingRequestCount} /></aside><main className="student-dashboard-main professor-dashboard-main"><AccountSettings scope={settingsScope} accountType="professor" settings={accountSettings} onSettingsChange={setAccountSettings} authenticated={Boolean(session?.user)} accountEmail={session?.user?.email || ""} /></main></div><EducatorTour step={tourStep} setStep={setTourStep} /></div>;
  const protectedContent = tab === "students"
    ? <StudentsPanel enrollmentRequests={enrollmentRequests} onApproveEnrollment={approveEnrollment} />
    : tab === "rewards"
      ? <ProfessorSocialLearningPanel />
      : <GradesPanel onLock={lock} />;
  return (
    <div className={`professor-dashboard-page ${accountSettings.showDescriptions ? "" : "is-description-light"}`}>
      <header className="dashboard-topbar professor-topbar">
        <button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline="Educator portal" /></button>
        <span className="sample-workspace-badge">Teaching workspace</span>
        <div className="dashboard-top-actions">
          <LiveDateTime />
          {["admin", "owner"].includes(profile?.role) && <button type="button" onClick={onAdmin}>Master admin</button>}
          <button type="button" onClick={() => setTourStep(0)}>Take the tour</button>
          <button className="primary" type="button" onClick={() => onBuild(null)}>Create Course</button>
        </div>
      </header>
      <div className="student-dashboard-shell professor-dashboard-shell">
        <aside className="student-dashboard-sidebar professor-sidebar">
          <div className="student-sidebar-profile"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{courseLibrary.length} original course{courseLibrary.length === 1 ? "" : "s"} · Digital Literacy ready</small></div></div>
          <ProfessorNavigation tab={tab} setTab={setTab} pendingRequests={pendingRequestCount} />
          <div className="professor-lock-summary"><strong>{unlocked ? "Sensitive areas unlocked" : "Sensitive areas locked"}</strong><span>{unlocked ? "Locks in less than five minutes" : "Password required for rosters and grades"}</span>{unlocked && <button type="button" onClick={lock}>Lock now</button>}</div>
        </aside>
        <main className="student-dashboard-main professor-dashboard-main">
          {portalNotice && <div className="portal-form-notice class-link-status" role="status">{portalNotice}<button type="button" onClick={() => setPortalNotice("")}>×</button></div>}
          {tab === "overview" && <Overview setTab={setTab} classes={courseLibrary} enrollmentRequests={enrollmentRequests} />}
          {tab === "classes" && <Classes onBuild={onBuild} onOpenDigitalLiteracy={() => setTab("digital-literacy")} classes={courseLibrary} onSaveAccess={saveCourseAccess} accessBusyCourse={accessBusyCourse} onSaveLibrary={saveLibraryListing} libraryBusyCourse={libraryBusyCourse} />}
          {tab === "semester" && <Suspense fallback={<section className="dashboard-card" role="status">Opening syllabus and calendar…</section>}><ProfessorSemesterCalendar profile={profile} session={session} classes={teachingClasses} /></Suspense>}
          {tab === "digital-literacy" && <ProfessorDigitalLiteracyPilot classes={teachingClasses} />}
          {tab === "templates" && <AssignmentTemplateWorkspace mode="professor" session={session} classes={teachingClasses} />}
          {sensitive && <SensitiveAccess session={session} unlocked={unlocked} onUnlock={unlock} onLock={lock}>{protectedContent}</SensitiveAccess>}
          {tab === "attendance" && <AttendancePanel classes={teachingClasses} />}
          {tab === "notifications" && <NotificationsPanel enrollmentRequests={enrollmentRequests} onOpenRequests={() => setTab("students")} onOpenDigitalLiteracy={() => setTab("digital-literacy")} />}
          {tab === "announcements" && <CampusSocialFeed key={`campus-social-${settingsScope}`} session={session} role="professor" educationDivision="university" displayName={displayName} onOpenMessages={() => setTab("communication")} />}
          {tab === "communication" && <CourseCommunicationPanel key={`course-communication-${settingsScope}`} role="professor" session={session} educationDivision="both" />}
          {tab === "profile" && <EducatorProfile profile={profile} classes={courseLibrary} />}
          {tab === "verification" && <VerificationPanel session={session} />}
          {tab === "security" && <SecurityPanel unlocked={unlocked} onLock={lock} />}
          {tab === "help" && <HelpSupportPanel onTour={() => setTourStep(0)} />}
        </main>
      </div>
      <EducatorTour step={tourStep} setStep={setTourStep} />
    </div>
  );
}
