import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { uploadCloudFile } from "../studio/storageService.js";
import { PROFESSOR_PRICING } from "./demoData.js";
import { submitEducatorVerification } from "./portalService.js";
import AssignmentTemplateWorkspace from "./AssignmentTemplateWorkspace.jsx";
import AccountSettings, { LiveDateTime, readAccountSettings } from "../AccountSettings.jsx";
import { STORY_GUIDES, STORY_REACTION_TYPES, generateStoryFeed, getDefaultConnection, localCalendarDate } from "../demo/storyEngine.js";
import LiveLearningRooms from "../live/LiveLearningRooms.jsx";
import FeatureFinder from "../FeatureFinder.jsx";
import { PERSONAS } from "../demo/demoData.js";
import { SyllabusPanel } from "../demo/WorkspaceSyllabus.jsx";
import EngagementPoints from "./EngagementPoints.jsx";
import LiveCourseUpdates from "./LiveCourseUpdates.jsx";

const TABS = [
  ["overview", "Overview"], ["classes", "Classes"], ["live", "Live class updates"], ["scanner", "Syllabus scanner"], ["lesson", "Lesson creator"], ["templates", "Assignment templates"], ["students", "Students & rosters"], ["grades", "Grades"],
  ["engagement", "Points & groups"], ["attendance", "Attendance & SIS"], ["office", "Live office hours"], ["announcements", "Faculty & school feed"], ["profile", "Educator page"], ["atlas-demo", "Atlas demo"],
  ["verification", "School verification"], ["security", "Security"], ["settings", "Settings"],
];

const TAB_IDS = new Set(TABS.map(([id]) => id));

function tabFromRoute(fallback = "overview") {
  const requested = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tab");
  return TAB_IDS.has(requested) ? requested : fallback;
}

function saveTabToRoute(tab) {
  const route = window.location.hash.split("?")[0];
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  params.set("tab", tab);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${route}?${params}`);
}

const ATLAS_DEMO_CLASSES = [
  { id: "sci-101-cell", code: "SCI 101", title: "What Is a Cell?", term: "Fall 2026", students: 38, published: true, division: "university" },
  { id: "bio-2301-anatomy", code: "BIOL 2301", title: "Human Anatomy", term: "Fall 2026", students: 29, published: false, division: "university" },
  { id: "eng10-stories", code: "ENG 10", title: "Stories and Evidence", term: "2026–27", students: 26, published: true, division: "k12" },
];

const ATLAS_DEMO_ROSTER = [
  { id: "r1", studentId: "••••1842", name: "Maya Reynolds", program: "Biology", courses: ["SCI 101"], status: "approved", account: "linked" },
  { id: "r2", studentId: "••••3921", name: "Jordan Lee", program: "Health Sciences", courses: ["SCI 101", "BIOL 2301"], status: "pending", account: "needs link" },
  { id: "r3", studentId: "••••5048", name: "Avery Johnson", program: "Grade 10", courses: ["ENG 10"], status: "approved", account: "linked" },
];

const ATLAS_DEMO_GRADEBOOK = [
  { id: "g1", student: "Maya Reynolds", studentId: "••••1842", item: "Cell structure lab", score: 92, status: "finalized" },
  { id: "g2", student: "Jordan Lee", studentId: "••••3921", item: "Cell structure lab", score: 84, status: "pending" },
  { id: "g3", student: "Avery Johnson", studentId: "••••5048", item: "Evidence paragraph", score: null, status: "missing" },
];

const TOUR = [
  ["Teaching overview", "See classes, link requests, grades, and upcoming work across University and K–12.", "overview"],
  ["Publish a class listing", "Students can find a public class before signing in, including an honest school-verification badge.", "classes"],
  ["Match and approve students", "Upload a roster or add student IDs, then approve the account match.", "students"],
  ["Publish grades carefully", "Student progress and grade publishing re-lock whenever you leave the tab and after five minutes.", "grades"],
  ["Connect school systems later", "Attendance works now. PowerSchool connection controls remain disabled until district setup is ready.", "attendance"],
];

function EducatorTour({ step, setStep, onNavigate }) {
  useEffect(() => {
    if (step === null) return;
    onNavigate(TOUR[step][2] || "overview", { updateRoute: false });
  }, [step]);
  if (step === null) return null;
  return <div className="dashboard-tour-backdrop" role="dialog" aria-modal="true"><div className="dashboard-tour-card"><span>EDUCATOR TOUR · {step + 1} OF {TOUR.length}</span><h2>{TOUR[step][0]}</h2><p>{TOUR[step][1]}</p><div><button type="button" onClick={() => setStep(null)}>Close educator tour</button><button type="button" onClick={() => setStep(step === TOUR.length - 1 ? null : step + 1)}>{step === TOUR.length - 1 ? "Finish educator tour" : "Show next tour step"}</button></div></div></div>;
}

function EducatorSyllabusScanner() {
  const [assignments, setAssignments] = useState([]);
  return <div className="signed-syllabus-workspace"><div className="dashboard-card signed-tool-intro"><span className="portal-kicker">SYLLABUS SCANNER</span><h1>Extract the syllabus, then review every date.</h1><p>Upload PDF, DOCX, text, or paper pages. Edit the source and calendar output before saving anything to the course.</p></div><SyllabusPanel persona={PERSONAS.professor} assignments={assignments} setAssignments={setAssignments} /></div>;
}

function LessonCreatorEntry({ onOpen }) {
  return <section className="dashboard-card signed-tool-entry"><span className="portal-kicker">LESSON CREATOR</span><h1>Shape a lesson in under five minutes.</h1><p>Start with the topic and goals, build a draft, then edit every section before students see it.</p><ol><li>Name the lesson and student level.</li><li>Add the goal, source material, and checks.</li><li>Preview, edit, and save it to the course.</li></ol><button type="button" onClick={onOpen}>Open lesson creator</button></section>;
}

function AtlasDemo({ setTab }) {
  return <div className="professor-panel-stack"><section className="dashboard-card signed-tool-intro"><span className="portal-kicker">ATLAS DEMONSTRATION · EXAMPLE DATA</span><h1>Explore a filled educator workspace.</h1><p>These classes, students, and grades belong to the fictional Atlas guide. Nothing here is connected to your account.</p><div className="dashboard-card-heading"><button type="button" onClick={() => setTab("scanner")}>Try the syllabus scanner</button><button type="button" onClick={() => setTab("lesson")}>Try the lesson creator</button></div></section><section className="student-stat-grid professor-stat-grid"><article><span>Example classes</span><strong>{ATLAS_DEMO_CLASSES.length}</strong></article><article><span>Example students</span><strong>{ATLAS_DEMO_CLASSES.reduce((total, course) => total + course.students, 0)}</strong></article><article><span>Example link requests</span><strong>{ATLAS_DEMO_ROSTER.filter((student) => student.status === "pending").length}</strong></article><article><span>Example grades</span><strong>{ATLAS_DEMO_GRADEBOOK.length}</strong></article></section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">EXAMPLE CLASS LIST</span><h2>What a populated workspace can look like.</h2></div></div><div className="professor-class-grid">{ATLAS_DEMO_CLASSES.map((course) => <article key={course.id}><div><span>{course.code} · {course.division === "k12" ? "K–12" : "University"}</span><strong>{course.title}</strong><small>{course.term} · {course.students} example students</small></div><div className="professor-class-status"><span className={course.published ? "is-live" : "is-draft"}>{course.published ? "Example listing" : "Example draft"}</span></div></article>)}</div></section></div>;
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

function Overview({ setTab }) {
  return <div className="professor-panel-stack"><section className="professor-welcome-card"><div><span>EDUCATOR WORKSPACE</span><h1>Start with the syllabus or build the first lesson.</h1><p>Your account begins clean. School verification is optional unless you want a verified affiliation badge.</p></div><button type="button" onClick={() => setTab("scanner")}>Scan a syllabus</button></section><section className="student-stat-grid professor-stat-grid"><article><span>Classes</span><strong>0</strong><button type="button" onClick={() => setTab("classes")}>Open classes</button></article><article><span>Students</span><strong>0</strong><button type="button" onClick={() => setTab("students")}>Open roster</button></article><article><span>Link requests</span><strong>0</strong><small>Requests appear after a class is linked</small></article><article><span>Grades to finish</span><strong>0</strong><button type="button" onClick={() => setTab("grades")}>Open gradebook</button></article></section><section className="professor-dashboard-columns"><article className="dashboard-card"><span className="portal-kicker">QUICK START</span><h2>Build the teaching pieces first.</h2><p>Extract a syllabus in about a minute or shape a lesson draft in less than five minutes.</p><button type="button" onClick={() => setTab("lesson")}>Create a lesson</button></article><article className="dashboard-card"><span className="portal-kicker">EXPLORE FIRST</span><h2>See Atlas's example workspace.</h2><p>Open a clearly labeled demonstration without mixing fictional students or grades into your account.</p><button type="button" onClick={() => setTab("atlas-demo")}>Explore Atlas demo</button></article></section></div>;
}

function Classes({ onBuild }) {
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">CLASS PUBLISHING</span><h1>Your classes</h1><p>Create the first course in Course Builder. School verification is optional; protected content still requires approved enrollment.</p></div><button type="button" onClick={onBuild}>Create a class</button></div><div className="empty-class-list"><strong>No account classes are shown yet.</strong><p>Course Builder is the source of truth while dashboard class sync is being connected. Atlas's fictional classes stay in the separate demo.</p><button type="button" onClick={onBuild}>Open course builder</button></div><div className="class-publishing-note"><strong>What a public listing can show</strong><span>School, code, title, educator, subject, term, schedule, summary, seat availability, and verification badge. Never roster, lessons, files, messages, or grades.</span></div></section>;
}

function parseRosterCsv(text, autoAssign = true) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase().replaceAll(" ", "_"));
  return lines.slice(1).map((line, index) => { const values = line.split(",").map((item) => item.trim()); const row = Object.fromEntries(headers.map((header, position) => [header, values[position] || ""])); const rawId = row.student_id || row.university_id || ""; const program = row.major || row.grade_level || "Not provided"; const enteredCourses = row.classes || row.course; const suggested = /biology|science/i.test(program) ? ["SCI 101"] : /grade\s*10|english|writing/i.test(program) ? ["ENG 10"] : []; return { id: `upload-${index}`, studentId: rawId ? `••••${rawId.slice(-4)}` : "missing", name: row.name || row.student_name || "Unnamed student", program, courses: enteredCourses ? enteredCourses.split("|").map((item) => item.trim()).filter(Boolean) : autoAssign ? suggested : [], status: "pending", account: "needs link" }; });
}

function StudentsPanel() {
  const [roster, setRoster] = useState([]);
  const [csv, setCsv] = useState("student_id,name,major,classes\nA10492,Taylor Morgan,Biology,SCI 101\nA10931,Sam Rivera,Grade 10,ENG 10");
  const [notice, setNotice] = useState("");
  const [autoAssign, setAutoAssign] = useState(true);
  function previewRoster() { const rows = parseRosterCsv(csv, autoAssign); if (!rows.length) { setNotice("Add a header row and at least one student."); return; } setRoster([...roster, ...rows]); const suggested = rows.filter((row) => row.courses.length > 0).length; setNotice(`${rows.length} students added to the review queue. ${autoAssign ? `${suggested} received class suggestions from the program or grade fields.` : "Automatic class suggestions were off."}`); }
  function approve(id) { setRoster(roster.map((student) => student.id === id ? { ...student, status: "approved", account: student.account === "needs link" ? "link requested" : student.account } : student)); }
  return <div className="professor-panel-stack"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ROSTER IMPORT</span><h1>Add students by class and student ID.</h1><p>Use student_id, name, major or grade_level, and classes. Only the last four ID characters appear here.</p></div></div><div className="roster-import-layout"><div><label>Paste CSV<textarea rows={7} value={csv} onChange={(event) => setCsv(event.target.value)} /></label><label className="auto-assign-check"><input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />Suggest classes from the classes and program columns</label><button type="button" onClick={previewRoster}>Preview students</button>{notice && <div className="portal-form-notice">{notice}</div>}</div><aside><strong>Accepted columns</strong><code>student_id,name,major,grade_level,classes</code><p>Separate multiple classes with a vertical bar.</p><span>This screen is a review preview until the protected roster-match service is deployed. Do not use real student IDs during testing.</span></aside></div></section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">PREVIEW QUEUE</span><h2>Student account links</h2></div><span>{roster.filter((item) => item.status === "pending").length} waiting</span></div>{roster.length === 0 ? <div className="empty-class-list"><strong>No students in this preview.</strong><p>Paste a test-only CSV above to check the review flow.</p></div> : <div className="roster-table"><div className="roster-row is-head"><span>Student</span><span>Student ID</span><span>Program / grade</span><span>Class assignment</span><span>Status</span><span>Action</span></div>{roster.map((student) => <div className="roster-row" key={student.id}><span><strong>{student.name}</strong><small>{student.account}</small></span><span>{student.studentId}</span><span>{student.program}</span><span>{student.courses.length ? student.courses.join(", ") : "Unassigned"}</span><span className={`roster-status is-${student.status}`}>{student.status}</span><span>{student.status === "pending" ? <button type="button" onClick={() => approve(student.id)}>Approve preview</button> : <button type="button" disabled>Preview approved</button>}</span></div>)}</div>}</section></div>;
}

function GradesPanel({ onLock }) {
  const [rows, setRows] = useState([]); const [quizWeight, setQuizWeight] = useState(25); const [projectWeight, setProjectWeight] = useState(25); const [notice, setNotice] = useState("");
  function updateStatus(id, status) { setRows(rows.map((row) => row.id === id ? { ...row, status } : row)); }
  return <div className="professor-panel-stack"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">GRADEBOOK</span><h1>Pending, missing, and finalized grades</h1><p>Only grades from account classes belong here. Atlas's sample grades remain in the separate demo.</p></div><button type="button" onClick={onLock}>Lock now</button></div>{rows.length === 0 ? <div className="empty-class-list"><strong>No grade rows yet.</strong><p>Create a cloud class and assignment before publishing student grades.</p></div> : <div className="grade-table professor-grade-table"><div className="grade-table-row is-head"><span>Student</span><span>Item</span><span>Score</span><span>Status</span><span>Publish</span></div>{rows.map((row) => <div className="grade-table-row" key={row.id}><span><strong>{row.student}</strong>{row.studentId}</span><span>{row.item}</span><span><input aria-label={`Score for ${row.student}`} type="number" value={row.score ?? ""} onChange={(event) => setRows(rows.map((item) => item.id === row.id ? { ...item, score: event.target.value === "" ? null : Number(event.target.value) } : item))} /></span><span className={`grade-status is-${row.status}`}>{row.status}</span><span><select value={row.status} onChange={(event) => updateStatus(row.id, event.target.value)}><option value="pending">Pending</option><option value="missing">Missing</option><option value="finalized">Finalize</option></select></span></div>)}</div>}<button className="publish-grade-button" type="button" disabled={!rows.length} onClick={() => setNotice("Grade publishing is ready after a real class and grade service are connected.")}>Publish finalized grades</button>{notice && <div className="portal-form-notice" role="status">{notice}</div>}</section><section className="grade-calculator-grid"><article className="dashboard-card"><span className="portal-kicker">GRADE WEIGHTS PREVIEW</span><h2>Plan the scale students will see.</h2><label>Projects<input type="number" value={projectWeight} onChange={(event) => setProjectWeight(Number(event.target.value))} /></label><label>Quizzes<input type="number" value={quizWeight} onChange={(event) => setQuizWeight(Number(event.target.value))} /></label><div className="weight-row"><span>Projects</span><div><i style={{ width: `${Math.max(0, Math.min(100, projectWeight * 3))}%` }} /></div><strong>{projectWeight}%</strong></div><div className="weight-row"><span>Quizzes</span><div><i style={{ width: `${Math.max(0, Math.min(100, quizWeight * 3))}%` }} /></div><strong>{quizWeight}%</strong></div><p className="weight-note">Remaining categories total {100 - projectWeight - quizWeight}%.</p><button type="button" disabled>Publish after class setup</button></article><article className="dashboard-card"><span className="portal-kicker">CLASS BOUNDARY</span><h2>Only classes you manage.</h2><p>This gradebook cannot display the same student's grades from another educator's class.</p><ul><li>Students see their own cross-class report.</li><li>Educators see managed-class grades only.</li><li>Another educator needs a student-authorized report link.</li></ul></article></section></div>;
}

function AttendancePanel() {
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState("");
  return <div className="professor-panel-stack"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ATTENDANCE</span><h1>Take attendance inside the class.</h1><p>Use the same educator workspace for K–12 or university classes after a roster is connected.</p></div><button type="button" disabled={!course || !rows.length} onClick={() => setNotice("Attendance preview saved on this device.")}>Save attendance</button></div><div className="attendance-controls"><label>Class<select value={course} onChange={(event) => setCourse(event.target.value)}><option value="">No linked class yet</option></select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>{rows.length ? <div className="attendance-list">{rows.map((row) => <div key={row.id}><strong>{row.name}</strong><select value={row.status} onChange={(event) => setRows(rows.map((item) => item.id === row.id ? { ...item, status: event.target.value } : item))}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></div>)}</div> : <div className="empty-class-list"><strong>No attendance roster yet.</strong><p>Create a class and approve students before taking attendance.</p></div>}{notice && <div className="portal-form-notice">{notice}</div>}</section><section className="sis-integration-grid"><article className="dashboard-card is-disabled"><span className="portal-kicker">POWERSCHOOL SIS</span><h2>Attendance sync</h2><p>Planned district connection for SIS-synced sections and attendance exchange.</p><button type="button" disabled>Connect district first</button></article><article className="dashboard-card is-disabled"><span className="portal-kicker">POWERSCHOOL SIS</span><h2>Grade passback</h2><p>Planned category mapping and grade transfer into PowerTeacher Pro.</p><button type="button" disabled>PowerSchool sync coming later</button></article></section></div>;
}

function AnnouncementsPanel() {
  const [audience, setAudience] = useState("SCI 101"); const [body, setBody] = useState(""); const [posts, setPosts] = useState([{ id: "a1", audience: "SCI 101", body: "The membrane review sheet is posted. Bring one question on Thursday.", createdAt: new Date().toISOString() }]);
  function publish(event) { event.preventDefault(); if (!body.trim()) return; setPosts([{ id: crypto.randomUUID(), audience, body: body.trim(), createdAt: new Date().toISOString() }, ...posts]); setBody(""); }
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">EDUCATOR ANNOUNCEMENTS</span><h1>Reach the right group.</h1><p>University and K–12 social spaces never share an audience.</p></div></div><form className="professor-announcement-form" onSubmit={publish}><label>Audience<select value={audience} onChange={(event) => setAudience(event.target.value)}><option>SCI 101</option><option>ENG 10</option><option>Example University followers</option><option>Example High School followers</option></select></label><label>Announcement<textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></label><button type="submit">Publish announcement</button></form><div className="professor-announcement-list">{posts.map((post) => <article key={post.id}><span>{post.audience}</span><p>{post.body}</p><small>{new Date(post.createdAt).toLocaleString()}</small></article>)}</div></section>;
}

function FacultyFeedPanel({ accountSettings, storageScope }) {
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
  const feed = [...localPosts, ...storyPosts].filter((post) => feedAudience === "all" || post.audience === feedAudience);
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
  return <div className="professor-panel-stack"><section className="dashboard-card faculty-feed-guide"><img src={guide.image} alt="" /><div><span className="portal-kicker">FIRST FACULTY CONNECTION</span><h1>{guide.name}</h1><p>Atlas shares a new teaching chapter each Sunday and welcomes new educator accounts.</p></div><button type="button">Following Atlas</button></section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">FACULTY & SCHOOL COMMUNITY</span><h2>Choose the room before posting.</h2><p>The faculty feed is for educators. The school feed can carry announcements to the matching school community.</p></div><label>Show<select value={feedAudience} onChange={(event) => setFeedAudience(event.target.value)}><option value="all">All feeds</option><option value="faculty">Faculty</option><option value="school">School</option><option value="class">Class</option></select></label></div><form className="professor-announcement-form" onSubmit={publish}><label>Faculty post<textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share an announcement, teaching idea, or course highlight…" /></label><label>Choose post audience<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="faculty">Faculty</option><option value="school">School</option><option value="class">Class</option></select></label><button type="submit">Publish faculty post</button></form><div className="faculty-story-feed">{feed.map((post, index) => { const isStory = Boolean(post.personaId); const items = post.reactions?.types || STORY_REACTION_TYPES.map((item) => ({ ...item, count: 0 })); return <article key={post.id || index}><header><img src={isStory ? STORY_GUIDES.professor.image : guide.image} alt="" /><div><strong>{isStory ? STORY_GUIDES.professor.name : post.author}</strong><span>{post.date} · {post.timeLabel} · {post.audience}</span></div></header><p>{post.body}</p>{post.snapshot && <div className="portal-story-snapshot"><span>{post.snapshot.feedbackCompleted} feedback items</span><span>{post.snapshot.responseRate}% response rate</span></div>}<footer>{items.map((reaction) => <button type="button" className={reactions[post.id] === reaction.id ? "is-active" : ""} key={reaction.id} onClick={() => react(post.id, reaction.id)}>{reaction.symbol} {reaction.count + (reactions[post.id] === reaction.id ? 1 : 0)}</button>)}<button type="button" className={savedPosts.includes(post.id) ? "is-active" : ""} onClick={() => toggleSaved(post.id)}>{savedPosts.includes(post.id) ? "Remove saved faculty post" : "Save faculty post"}</button></footer></article>; })}</div></section></div>;
}

function EducatorProfile({ profile }) {
  const [bio, setBio] = useState("Biology educator focused on helping students connect small structures to larger systems.");
  const [notice, setNotice] = useState("");
  return <div className="professor-profile-layout"><section className="dashboard-card"><span className="portal-kicker">EDUCATOR PAGE PREVIEW</span><h1>A public home for classes and announcements.</h1><p>Preview the page before cloud profile publishing is connected. A verified badge requires manual school-affiliation review.</p><label>Public bio<textarea rows={5} value={bio} onChange={(event) => setBio(event.target.value)} /></label><div className="interest-field-grid"><label>Office hours<input defaultValue="Tue / Thu · 1–3 PM" /></label><label>Department or subject<input defaultValue="Biological Sciences" /></label></div><label>Professional or school page<input type="url" placeholder="https://…" /></label><label>Video or YouTube link<input type="url" placeholder="https://youtube.com/…" /></label><button type="button" onClick={() => setNotice("Preview updated on this screen. Cloud profile publishing is not connected yet.")}>Update preview</button>{notice && <div className="portal-form-notice" role="status">{notice}</div>}</section><aside className="professor-public-page"><span>UNVERIFIED SCHOOL AFFILIATION · PREVIEW</span><h2>{profile?.full_name || "Educator"}</h2><p>{bio}</p><div><strong>0</strong><span>published classes</span></div><article><strong>Your first class will appear here.</strong><span>Create it in Course Builder.</span></article></aside><section className="professor-plan-strip">{PROFESSOR_PRICING.map((plan) => <article key={plan.name}><span>{plan.name}</span><strong>{plan.price}</strong><p>{plan.description}</p></article>)}</section></div>;
}

function VerificationPanel({ session }) {
  const [division, setDivision] = useState("university"); const [school, setSchool] = useState(""); const [department, setDepartment] = useState(""); const [teacherId, setTeacherId] = useState(""); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  async function submit(event) { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { if (!file) throw new Error("Choose a teacher ID image or PDF."); if (file.size > 10 * 1024 * 1024) throw new Error("Teacher ID files must be 10 MB or smaller."); if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error("Upload a PDF, JPG, or PNG."); const uploaded = await uploadCloudFile(file, { scope: "private", title: "Educator verification document", category: "educator-verification", metadata: { educationDivision: division } }); const { error: requestError } = await submitEducatorVerification({ user_id: session.user.id, institution_name: school.trim(), education_division: division, department: department.trim() || null, teacher_identifier_last4: teacherId.trim().slice(-4) || null, secure_file_id: uploaded.secureFileId, status: "pending", submitted_at: new Date().toISOString() }); if (requestError) throw requestError; setNotice("Verification request submitted. Manual review may take a few days. Your classes and subscription remain available while you wait."); } catch (submitError) { setError(submitError.message || "Verification request could not be submitted."); } finally { setBusy(false); } }
  return <section className="dashboard-card verification-panel"><div className="dashboard-card-heading"><div><span className="portal-kicker">OPTIONAL SCHOOL VERIFICATION</span><h1>Add a verified affiliation badge.</h1><p>Verification is only for being listed as affiliated with a school or university. It is not required to create classes, publish unverified listings, or subscribe.</p></div><span className="educator-verification-badge is-unverified">Currently unverified</span></div><form onSubmit={submit}><div className="interest-field-grid"><label>Education division<select value={division} onChange={(event) => setDivision(event.target.value)}><option value="university">University / college</option><option value="k12">K–12 school</option><option value="both">Both</option></select></label><label>School or university<input required value={school} onChange={(event) => setSchool(event.target.value)} /></label><label>Department or subject<input value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label>Teacher ID number, if shown<input value={teacherId} onChange={(event) => setTeacherId(event.target.value)} autoComplete="off" /><small>Only the last four characters are saved in the review queue.</small></label></div><label>Teacher ID or staff document<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>PDF, JPG, or PNG · 10 MB maximum · stored in the private file service</small></label>{error && <div className="portal-form-error" role="alert">{error}</div>}{notice && <div className="portal-form-notice" role="status">{notice}</div>}<button type="submit" disabled={busy}>{busy ? "Uploading securely…" : "Submit for manual review"}</button></form></section>;
}

function SecurityPanel({ unlocked, onLock }) { return <section className="dashboard-card professor-security-panel"><span className="portal-kicker">EDUCATOR SECURITY</span><h1>Private student areas get an extra lock.</h1><div className="security-setting-grid"><article><strong>Current sensitive session</strong><span className={unlocked ? "is-on" : "is-off"}>{unlocked ? "Unlocked · less than five minutes" : "Locked"}</span><button type="button" onClick={onLock}>Lock now</button></article><article><strong>Auto-lock</strong><span>Five minutes or whenever this browser tab is hidden</span></article><article><strong>Grade publishing</strong><span>Password re-entry before opening the gradebook; course ownership still controls writes</span></article><article><strong>Student account links</strong><span>Notifications appear when a student ID match needs educator approval</span></article></div></section>; }

export default function ProfessorDashboard({ profile, session, onHome, onBuild, onLesson, onStudentPortal, onAdmin }) {
  const [tab, setTabState] = useState(tabFromRoute); const [tourStep, setTourStep] = useState(null); const [unlockedUntil, setUnlockedUntil] = useState(0); const [, setClock] = useState(Date.now());
  const settingsScope = `professor-${session?.user?.id || "guest"}`;
  const [accountSettings, setAccountSettings] = useState(() => readAccountSettings(settingsScope, { accountType: "professor", name: profile?.full_name || "Educator", email: session?.user?.email || "" }));
  const unlocked = unlockedUntil > Date.now(); const sensitive = tab === "students" || tab === "grades"; const displayName = useMemo(() => accountSettings.displayName || profile?.full_name || "Educator", [accountSettings.displayName, profile?.full_name]);
  useEffect(() => { setAccountSettings(readAccountSettings(settingsScope, { accountType: "professor", name: profile?.full_name || "Educator", email: session?.user?.email || "" })); }, [settingsScope, profile?.full_name, session?.user?.email]);
  useEffect(() => { if (!unlockedUntil) return undefined; const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, [unlockedUntil]);
  useEffect(() => { const syncTab = () => setTabState(tabFromRoute(tab)); window.addEventListener("hashchange", syncTab); return () => window.removeEventListener("hashchange", syncTab); }, [tab]);
  function setTab(nextTab, { updateRoute = true } = {}) { setTabState(nextTab); if (updateRoute) saveTabToRoute(nextTab); }
  function unlock() { setUnlockedUntil(Date.now() + 5 * 60 * 1000); } function lock() { setUnlockedUntil(0); }
  if (tab === "settings") return <div className={`professor-dashboard-page ${accountSettings.showDescriptions ? "" : "is-description-light"}`}><header className="dashboard-topbar professor-topbar"><button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline="Educator portal" /></button><span className="sample-workspace-badge">Your educator workspace</span><div className="dashboard-top-actions"><LiveDateTime /><FeatureFinder audience="professor" onSelectTab={setTab} /><button type="button" onClick={() => setTourStep(0)}>Take the tour</button><button className="primary" type="button" onClick={onBuild}>Course builder</button></div></header><div className="student-dashboard-shell professor-dashboard-shell"><aside className="student-dashboard-sidebar professor-sidebar"><div className="student-sidebar-profile"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Educator workspace</small></div></div><label className="dashboard-mobile-feature-picker">Go to a feature<select value={tab} onChange={(event) => setTab(event.target.value)}>{TABS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label><nav aria-label="Educator dashboard">{TABS.map(([id, label]) => <button className={tab === id ? "is-active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>)}</nav></aside><main className="student-dashboard-main professor-dashboard-main"><AccountSettings scope={settingsScope} accountType="professor" settings={accountSettings} onSettingsChange={setAccountSettings} authenticated={Boolean(session?.user)} accountEmail={session?.user?.email || ""} /></main></div><EducatorTour step={tourStep} setStep={setTourStep} onNavigate={setTab} /></div>;
  const protectedContent = tab === "students" ? <StudentsPanel /> : <GradesPanel onLock={lock} />;
  return (
    <div className={`professor-dashboard-page ${accountSettings.showDescriptions ? "" : "is-description-light"}`}>
      <header className="dashboard-topbar professor-topbar">
        <button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline="Educator portal" /></button>
        <span className="sample-workspace-badge">Your educator workspace</span>
        <div className="dashboard-top-actions">
          <LiveDateTime />
          <FeatureFinder audience="professor" onSelectTab={setTab} />
          {["admin", "owner"].includes(profile?.role) && <button type="button" onClick={onAdmin}>Master admin</button>}
          <button type="button" onClick={() => setTourStep(0)}>Take the tour</button>
          <button className="primary" type="button" onClick={onBuild}>Course builder</button>
        </div>
      </header>
      <div className="student-dashboard-shell professor-dashboard-shell">
        <aside className="student-dashboard-sidebar professor-sidebar">
          <div className="student-sidebar-profile"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>Educator workspace</small></div></div>
          <label className="dashboard-mobile-feature-picker">Go to a feature<select value={tab} onChange={(event) => setTab(event.target.value)}>{TABS.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          <nav aria-label="Educator dashboard">{TABS.map(([id, label]) => <button className={tab === id ? "is-active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>)}</nav>
          <div className="professor-lock-summary"><strong>{unlocked ? "Sensitive areas unlocked" : "Sensitive areas locked"}</strong><span>{unlocked ? "Locks in less than five minutes" : "Password required for rosters and grades"}</span>{unlocked && <button type="button" onClick={lock}>Lock now</button>}</div>
        </aside>
        <main className="student-dashboard-main professor-dashboard-main">
          {tab === "overview" && <Overview setTab={setTab} />}
          {tab === "classes" && <Classes onBuild={onBuild} />}
          {tab === "live" && <LiveCourseUpdates mode="professor" />}
          {tab === "scanner" && <EducatorSyllabusScanner />}
          {tab === "lesson" && <LessonCreatorEntry onOpen={onLesson || onBuild} />}
          {tab === "templates" && <AssignmentTemplateWorkspace mode="professor" session={session} classes={[]} />}
          {sensitive && <SensitiveAccess session={session} unlocked={unlocked} onUnlock={unlock} onLock={lock}>{protectedContent}</SensitiveAccess>}
          {tab === "engagement" && <EngagementPoints mode="professor" session={session} />}
          {tab === "attendance" && <AttendancePanel />}
          {tab === "office" && <LiveLearningRooms mode="professor" session={session} />}
          {tab === "announcements" && <FacultyFeedPanel key={`faculty-feed-${settingsScope}`} accountSettings={accountSettings} storageScope={settingsScope} />}
          {tab === "profile" && <EducatorProfile profile={profile} />}
          {tab === "atlas-demo" && <AtlasDemo setTab={setTab} />}
          {tab === "verification" && <VerificationPanel session={session} />}
          {tab === "security" && <SecurityPanel unlocked={unlocked} onLock={lock} />}
        </main>
      </div>
      <EducatorTour step={tourStep} setStep={setTourStep} onNavigate={setTab} />
    </div>
  );
}
