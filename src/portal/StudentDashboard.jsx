import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import BrandLogo from "../Brand.jsx";
import {
  COMMUNITY_POSTS,
  GRADE_ROWS,
  K12_COMMUNITY_POSTS,
  K12_GRADE_ROWS,
  K12_STUDENT_CLASSES,
  K12_STUDENT_GROUPS,
  STUDENT_CLASSES,
  STUDENT_GROUPS,
  STUDENT_PRICING,
} from "./demoData.js";
import { educationTrack as getTrack } from "./educationTracks.js";
import AssignmentTemplateWorkspace from "./AssignmentTemplateWorkspace.jsx";
import AccountSettings, { LiveDateTime, readAccountSettings, saveAccountSettings } from "../AccountSettings.jsx";
import { STORY_GUIDES, STORY_REACTION_TYPES, generateStoryFeed, getDefaultConnection, localCalendarDate } from "../demo/storyEngine.js";
import {
  listCurrentStudentCourses,
  loadPublicStudentPage,
  savePublicStudentPage,
  searchEducatorProfiles,
  searchStudentProfiles,
} from "./portalService.js";

const OwnYourSemester = lazy(() => import("../ai/OwnYourSemester.jsx"));

const TABS = [
  ["overview", "Overview"], ["semester", "Own your semester"], ["classes", "Classes"], ["assignments", "Assignments"], ["grades", "Grades"], ["notes", "Notes"],
  ["life", "Student life"], ["friends", "Find friends"], ["messages", "Messages"], ["page", "My page"], ["opportunities", "Opportunities"],
  ["demo", "Brooke's demo"],
  ["settings", "Settings"],
];

const TOUR = [
  ["Your term at a glance", "Start here for classes, grades, points, deadlines, and anything that needs attention."],
  ["Every class in one list", "Open Classes to see your educator, progress, next work, and protected course content."],
  ["The same grade scale", "Grades mirrors the categories and weights your educator publishes."],
  ["The right community", "Class and school conversations stay in the education space where they started."],
  ["Private tools stay private", "Device messages clear with this browser session. You choose what appears on your page."],
];

function readStorage(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function DashboardTour({ step, setStep, showOnSignIn, onShowOnSignIn }) {
  if (step === null) return null;
  const [title, description] = TOUR[step];
  return <div className="dashboard-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="dashboard-tour-title"><div className="dashboard-tour-card"><div className="brooke-tour-label"><span aria-hidden="true">B</span><strong>Brooke · your EdNotebook guide</strong></div><span>TOUR · {step + 1} OF {TOUR.length}</span><h2 id="dashboard-tour-title">{title}</h2><p>{description}</p><label className="tour-preference"><input type="checkbox" checked={showOnSignIn} onChange={(event) => onShowOnSignIn(event.target.checked)} />Show Brooke when I sign in</label><div><button type="button" onClick={() => setStep(null)}>Close</button><button type="button" onClick={() => setStep(step === TOUR.length - 1 ? null : step + 1)}>{step === TOUR.length - 1 ? "Finish" : "Next"}</button></div></div></div>;
}

function GradeStatus({ status }) { return <span className={`grade-status is-${status}`}>{status}</span>; }

function OverviewPanel({ name, onTab, classes, track }) {
  const copy = getTrack(track);
  if (!classes.length) {
    return <div className="student-panel-stack"><section className={`student-welcome-card student-empty-welcome ${track === "k12" ? "is-k12" : ""}`}><div><span>WELCOME TO YOUR WORKSPACE</span><h1>Good to see you, {name}.</h1><p>Brooke can show you around. Your classes, grades, notes, and points will appear here after an educator approves your class link.</p><div className="empty-workspace-actions"><a href={`#/students/${track}`}>Find a class</a><button type="button" onClick={() => onTab("demo")}>Explore Brooke's demo</button></div></div><div className="brooke-empty-avatar" aria-label="Brooke guide">B</div></section><section className="student-stat-grid"><article><span>Classes</span><strong>0</strong><button onClick={() => onTab("classes")} type="button">How linking works</button></article><article><span>Overall grade</span><strong>—</strong><small>Appears after grades publish</small></article><article><span>Points earned</span><strong>0</strong><small>Your progress starts here</small></article><article><span>Needs attention</span><strong>0</strong><small>Nothing due yet</small></article></section><section className="dashboard-card empty-dashboard-card"><span className="portal-kicker">START HERE</span><h2>Your account is ready.</h2><p>Search for your school and class, request access, and use the same student ID your educator placed on the roster. Course content stays closed until the link is approved.</p><a href={`#/students/${track}`}>Search classes</a></section></div>;
  }
  const gradedCourses = classes.filter((course) => Number.isFinite(course.grade));
  const average = gradedCourses.length ? `${(gradedCourses.reduce((sum, course) => sum + course.grade, 0) / gradedCourses.length).toFixed(1)}%` : "—";
  return <div className="student-panel-stack"><section className={`student-welcome-card ${track === "k12" ? "is-k12" : ""}`}><div><span>FALL 2026 · {track === "k12" ? "EXAMPLE HIGH SCHOOL" : "EXAMPLE UNIVERSITY"}</span><h1>Good morning, {name}.</h1><p>{gradedCourses.length ? "Your linked classes and published progress are ready below." : "Your classes are linked. Grades and points appear after your educators publish them."}</p></div>{gradedCourses.length > 0 && <div className="student-streak"><strong>11</strong><span>day study streak</span></div>}</section><section className="student-stat-grid"><article><span>Classes</span><strong>{classes.length}</strong><button onClick={() => onTab("classes")} type="button">View all</button></article><article><span>Overall grade</span><strong>{average}</strong><button onClick={() => onTab("grades")} type="button">Open report</button></article><article><span>Points earned</span><strong>{gradedCourses.length ? "1,645" : "0"}</strong><small>{gradedCourses.length ? "355 to next level" : "Starts when class work is published"}</small></article><article><span>Needs attention</span><strong>{gradedCourses.length ? "2" : "0"}</strong><small>{gradedCourses.length ? "1 missing · 1 pending" : "No published items yet"}</small></article></section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">YOUR CLASSES</span><h2>Pick up where you left off.</h2></div><button type="button" onClick={() => onTab("classes")}>All classes</button></div><div className="student-class-list">{classes.map((course) => <article key={course.id}><div className="class-list-code">{course.code}</div><div><strong>{course.title}</strong><span>{course.professor}</span><p>{course.next}</p><div className="mini-progress"><i style={{ width: `${course.progress}%` }} /></div></div><div><strong>{Number.isFinite(course.grade) ? `${course.grade}%` : "—"}</strong><span>{course.progress}% complete</span></div></article>)}</div></section><section className="student-dashboard-columns"><article className="dashboard-card"><span className="portal-kicker">FROM YOUR {copy.teacherLabel.toUpperCase()}S</span><h2>Current notes</h2><p><strong>{classes[0].code}</strong> · {gradedCourses.length ? "A new review guide is ready. Bring one question to the next class." : "No class note has been published yet."}</p></article><article className="dashboard-card"><span className="portal-kicker">{copy.shortLabel.toUpperCase()} HIGHLIGHT</span><h2>{track === "k12" ? "Club and project week" : "Portfolio week"}</h2><p>{track === "k12" ? "Join a school group, finish one project, and celebrate a classmate's progress." : "Add one finished project to your student page and ask a peer mentor for feedback."}</p><button type="button" onClick={() => onTab("page")}>Open my page</button></article></section></div>;
}

function ClassesPanel({ classes, track }) {
  const [openClass, setOpenClass] = useState(null);
  const destination = `#/students/${track}`;
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">ENROLLED CLASSES</span><h1>All classes</h1><p>Approved enrollment opens lessons, assignments, classmates, and grades.</p></div><a href={destination}>Find another class</a></div>{classes.length === 0 ? <div className="empty-class-list"><strong>No linked classes yet.</strong><p>Find your class, request access with your student ID, and it will appear here after educator approval.</p><a href={destination}>Search for a class</a></div> : <div className="student-class-grid">{classes.map((course) => <article key={course.id}><span>{course.code}</span><h2>{course.title}</h2><p>{course.professor}</p><div className="class-grade-line"><strong>{course.grade === null ? "—" : `${course.grade}%`}</strong><span>{course.points} points</span></div><div className="mini-progress"><i style={{ width: `${course.progress}%` }} /></div><small>{course.progress}% complete · {course.next}</small><button type="button" onClick={() => setOpenClass(openClass === course.id ? null : course.id)}>{openClass === course.id ? "Close class" : "Open class"}</button>{openClass === course.id && <div className="protected-course-preview"><span>ENROLLMENT CONFIRMED</span><strong>Protected class content</strong><p>Your lessons, assignments, files, class group, and educator feedback open here.</p><button type="button">Continue current lesson</button></div>}</article>)}</div>}</section>;
}

function GradesPanel({ classes, rows, track }) {
  const [current, setCurrent] = useState(88.4);
  const [remainingWeight, setRemainingWeight] = useState(25);
  const [target, setTarget] = useState(90);
  const [shareNotice, setShareNotice] = useState("");
  const needed = remainingWeight > 0 ? ((target - current * (1 - remainingWeight / 100)) / (remainingWeight / 100)).toFixed(1) : "—";
  function createShareLink() { setShareNotice("No grades were shared. Choose a specific educator, class scope, and expiration after the secure sharing service is connected."); }
  if (!classes.length) return <section className="dashboard-card empty-dashboard-card"><span className="portal-kicker">REPORT CARD</span><h1>No grades yet.</h1><p>Your published grades and the educator's grade scale will appear here after you join a class.</p><a href={`#/students/${track}`}>Find a class</a></section>;
  if (!classes.some((course) => Number.isFinite(course.grade))) return <section className="dashboard-card empty-dashboard-card"><span className="portal-kicker">REPORT CARD</span><h1>No grades have been published.</h1><p>Your classes are linked. Scores, status, and the educator's grade scale will appear here after publishing.</p></section>;
  const overallGrade = (classes.filter((course) => Number.isFinite(course.grade)).reduce((sum, course) => sum + course.grade, 0) / classes.filter((course) => Number.isFinite(course.grade)).length).toFixed(1);
  return <div className="student-panel-stack"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">REPORT CARD</span><h1>Your grades</h1><p>Educators see only classes they manage. You see your full {track === "k12" ? "school" : "university"} report.</p></div><button type="button" onClick={createShareLink}>Set up report sharing</button></div><div className="report-card-summary"><div><span>Overall</span><strong>{overallGrade}%</strong></div>{classes.map((course) => <div key={course.id}><span>{course.code}</span><strong>{Number.isFinite(course.grade) ? `${course.grade}%` : "—"}</strong><small>{course.professor}</small></div>)}</div><div className="grade-table" role="table" aria-label="Student grades"><div className="grade-table-row is-head" role="row"><span>Class / item</span><span>Category</span><span>Weight</span><span>Score</span><span>Status</span></div>{rows.map((grade) => <div className="grade-table-row" role="row" key={grade.id}><span><strong>{grade.course}</strong>{grade.item}</span><span>{grade.category}</span><span>{grade.weight}%</span><span>{grade.score === null ? "—" : `${grade.score}%`}</span><GradeStatus status={grade.status} /></div>)}</div>{shareNotice && <div className="report-share-box"><strong>Secure sharing setup</strong><span>{shareNotice}</span></div>}</section><section className="grade-calculator-grid"><article className="dashboard-card"><span className="portal-kicker">GRADE CALCULATOR</span><h2>What do I need?</h2><label>Current grade<input type="number" value={current} onChange={(event) => setCurrent(Number(event.target.value))} /></label><label>Remaining class weight<input type="number" value={remainingWeight} onChange={(event) => setRemainingWeight(Number(event.target.value))} /></label><label>Target grade<input type="number" value={target} onChange={(event) => setTarget(Number(event.target.value))} /></label><div className="calculator-result"><span>Average needed on remaining work</span><strong>{needed}%</strong></div></article><article className="dashboard-card"><span className="portal-kicker">PUBLISHED SCALE</span><h2>{classes[0].code} weights</h2>{[["Projects", 25], ["Checks", 15], ["Quizzes", 25], ["Practice", 25], ["Participation", 10]].map(([label, weight]) => <div className="weight-row" key={label}><span>{label}</span><div><i style={{ width: `${weight * 3}%` }} /></div><strong>{weight}%</strong></div>)}<p className="weight-note">This mirrors the educator's published gradebook.</p></article></section></div>;
}

function NotesPanel({ classes, track, storageScope }) {
  const storageKey = `ednotebook-${track}-${storageScope}-student-notes`;
  const [notes, setNotes] = useState(() => readStorage(window.localStorage, storageKey, []));
  const [course, setCourse] = useState(classes[0]?.code || "General");
  const [body, setBody] = useState("");
  function save(next) { setNotes(next); window.localStorage.setItem(storageKey, JSON.stringify(next)); }
  function add(event) { event.preventDefault(); if (!body.trim()) return; save([{ id: crypto.randomUUID(), course, body: body.trim(), createdAt: new Date().toISOString() }, ...notes]); setBody(""); }
  return <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">MY NOTES</span><h1>Keep the thought beside the class.</h1><p>These notes stay on this device until signed-in sync is connected.</p></div></div><form className="student-note-form" onSubmit={add}>{classes.length ? <select value={course} onChange={(event) => setCourse(event.target.value)}>{classes.map((item) => <option key={item.id}>{item.code}</option>)}</select> : <input value="General" readOnly aria-label="General notes" />}<textarea rows={4} spellCheck="true" lang="en" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a study note, question, or reminder…" /><button type="submit">Save note</button></form><div className="student-note-list">{notes.length === 0 ? <p>No notes yet.</p> : notes.map((note) => <article key={note.id}><span>{note.course} · {new Date(note.createdAt).toLocaleDateString()}</span><p>{note.body}</p><button type="button" onClick={() => save(notes.filter((item) => item.id !== note.id))}>Delete</button></article>)}</div></section>;
}

function StudentLifePanel({ groups, initialPosts, track }) {
  const scopes = track === "k12" ? ["Class", "School", "K–12 network"] : ["Class", "Campus", "Public"];
  const [scope, setScope] = useState(scopes[0]);
  const [postBody, setPostBody] = useState("");
  const [posts, setPosts] = useState(initialPosts);
  const [sharePoints, setSharePoints] = useState(true);
  function post(event) { event.preventDefault(); if (!postBody.trim()) return; setPosts([{ id: crypto.randomUUID(), author: "You", badge: "Student", group: scope, body: postBody.trim(), reactions: 0, replies: 0 }, ...posts]); setPostBody(""); }
  return <div className="student-life-dashboard"><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">GROUPS</span><h1>Student life</h1><p>{track === "k12" ? "Class, school, and K–12 groups stay separate from university feeds." : "Campus, class, and public university learning groups stay visibly separate."}</p></div></div><div className="student-group-grid">{groups.map((group) => <article key={group.id}><span>{group.scope}</span><h2>{group.name}</h2><p>{group.description}</p><small>{group.members} members</small><button type="button" onClick={() => setScope(group.scope)}>Open group</button></article>)}</div></section><section className="student-social-layout"><main className="dashboard-card"><form className="student-post-form" onSubmit={post}><div><strong>Post to {scope}</strong><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((item) => <option key={item}>{item}</option>)}</select></div><textarea rows={3} value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="Share a study update, useful link, question, or milestone…" /><button type="submit">Post</button></form>{posts.map((item) => <article className="student-social-post" key={item.id}><div><strong>{item.author}</strong><span>{item.badge} · {item.group}</span></div><p>{item.body}</p><footer><span>♡ {item.reactions}</span><span>{item.replies} replies</span></footer></article>)}</main><aside className="dashboard-card student-highlight-settings"><span className="portal-kicker">MY HIGHLIGHTS</span><h2>You choose what appears.</h2><label><input type="checkbox" checked={sharePoints} onChange={(event) => setSharePoints(event.target.checked)} />Show my points and streak to classmates</label><label><input type="checkbox" />Show a completed assignment</label><label><input type="checkbox" />Show a grade I select</label><p>Grades never enter a feed automatically.</p><div className="student-highlight-preview"><strong>{sharePoints ? "1,645 points · 11-day streak" : "Highlights hidden"}</strong><span>Visible only in this {track === "k12" ? "K–12" : "university"} community</span></div></aside></section></div>;
}

function StudentLifePanelV2({ groups, initialPosts, track, accountSettings, storageScope }) {
  const personaId = track === "k12" ? "k12" : "student";
  const guide = getDefaultConnection(personaId);
  const scopes = track === "k12" ? ["Class", "School", "Connections"] : ["Class", "Campus", "Public"];
  const storageKey = `ednotebook-${track}-${storageScope}-student-social-posts`;
  const reactionStorageKey = `${storageKey}-reactions`;
  const savedStorageKey = `${storageKey}-saved`;
  const [scope, setScope] = useState(scopes[0]);
  const [postBody, setPostBody] = useState("");
  const [localPosts, setLocalPosts] = useState(() => readStorage(window.localStorage, storageKey, []));
  const [reactions, setReactions] = useState(() => readStorage(window.localStorage, reactionStorageKey, {}));
  const [savedPosts, setSavedPosts] = useState(() => readStorage(window.localStorage, savedStorageKey, []));
  const [sharePoints, setSharePoints] = useState(true);
  const [storyNow, setStoryNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setStoryNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const storyPosts = useMemo(() => generateStoryFeed({ persona: personaId, now: storyNow, newestFirst: true }), [personaId, storyNow]);
  const feed = [...localPosts, ...storyPosts, ...initialPosts].filter((item, index, all) => all.findIndex((candidate) => (candidate.id || candidate.body) === (item.id || item.body)) === index);
  function post(event) {
    event.preventDefault();
    if (!postBody.trim()) return;
    const now = new Date();
    const next = [{ id: crypto.randomUUID(), author: accountSettings.displayName || "You", badge: "Student", group: scope, body: postBody.trim(), date: localCalendarDate(now), timeLabel: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now), reactions: { types: STORY_REACTION_TYPES.map((item, index) => ({ ...item, count: index === 0 ? 1 : 0 })) } }, ...localPosts];
    setLocalPosts(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setPostBody("");
  }
  function react(postId, reactionId) { const next = { ...reactions, [postId]: reactions[postId] === reactionId ? null : reactionId }; setReactions(next); window.localStorage.setItem(reactionStorageKey, JSON.stringify(next)); }
  function toggleSaved(postId) { const next = savedPosts.includes(postId) ? savedPosts.filter((id) => id !== postId) : [...savedPosts, postId]; setSavedPosts(next); window.localStorage.setItem(savedStorageKey, JSON.stringify(next)); }
  return <div className="student-life-dashboard"><section className="dashboard-card student-feed-welcome"><img src={guide.image} alt="" /><div><span className="portal-kicker">YOUR FIRST FOLLOWER</span><h1>{guide.name} keeps the weekly story moving.</h1><p>New posts appear each Sunday with study ideas, campus or school life, points, progress, and a little personality.</p></div><button type="button">Following {guide.shortName}</button></section><section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">GROUPS</span><h2>Student life</h2><p>{track === "k12" ? "Class and school groups stay in the school community." : "Campus, class, and public learning groups stay clearly labeled."}</p></div></div><div className="student-group-grid">{groups.map((group) => <article key={group.id}><span>{group.scope}</span><h2>{group.name}</h2><p>{group.description}</p><small>{group.members} members</small><button type="button" onClick={() => setScope(group.scope)}>Open group</button></article>)}</div></section><section className="student-social-layout"><main className="dashboard-card"><form className="student-post-form" onSubmit={post}><div><strong>Post to {scope}</strong><select value={scope} onChange={(event) => setScope(event.target.value)}>{scopes.map((item) => <option key={item}>{item}</option>)}</select></div><textarea rows={3} value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="Share a study update, useful link, question, or milestone…" /><button type="submit">Post</button></form>{feed.map((item, index) => { const story = Boolean(item.personaId); const itemReactions = item.reactions?.types || STORY_REACTION_TYPES.map((reaction) => ({ ...reaction, count: item.reactions || 0 })); return <article className="student-social-post" key={item.id || `${item.body}-${index}`}><div><strong>{story ? STORY_GUIDES[personaId].name : item.author}</strong><span>{story ? `Guide · ${item.audience} · ${item.date}` : `${item.badge || "Student"} · ${item.group || scope}`}</span></div><p>{item.body}</p>{item.snapshot && <div className="portal-story-snapshot"><span>{item.snapshot.points} points</span><span>{item.snapshot.progressPercent}% progress</span></div>}<footer>{itemReactions.map((reaction) => <button type="button" className={reactions[item.id] === reaction.id ? "is-active" : ""} key={reaction.id} onClick={() => react(item.id, reaction.id)}>{reaction.symbol} {reaction.count + (reactions[item.id] === reaction.id ? 1 : 0)}</button>)}<button type="button" className={savedPosts.includes(item.id) ? "is-active" : ""} onClick={() => toggleSaved(item.id)}>{savedPosts.includes(item.id) ? "Saved" : "Save"}</button></footer></article>; })}</main><aside className="dashboard-card student-highlight-settings"><span className="portal-kicker">MY HIGHLIGHTS</span><h2>You choose what appears.</h2><label><input type="checkbox" checked={sharePoints} onChange={(event) => setSharePoints(event.target.checked)} />Show my points and streak to classmates</label><label><input type="checkbox" />Show a completed assignment</label><label><input type="checkbox" />Show a grade I select</label><div className="student-highlight-preview"><strong>{sharePoints ? "1,645 points · 11-day streak" : "Highlights hidden"}</strong><span>Visible in the audience you choose</span></div></aside></section></div>;
}

function MessagesPanel({ track, storageScope }) {
  const storageKey = `ednotebook-${track}-${storageScope}-session-messages`;
  const [messages, setMessages] = useState(() => readStorage(window.sessionStorage, storageKey, []));
  const [body, setBody] = useState("");
  function send(event) { event.preventDefault(); if (!body.trim()) return; const next = [...messages, { id: crypto.randomUUID(), body: body.trim(), createdAt: new Date().toISOString(), sender: "You" }]; setMessages(next); window.sessionStorage.setItem(storageKey, JSON.stringify(next)); setBody(""); }
  function clear() { setMessages([]); window.sessionStorage.removeItem(storageKey); }
  return <div className="student-message-layout"><section className="dashboard-card"><span className="portal-kicker">DEVICE MESSAGES</span><h1>Quick conversations for this session.</h1><p>University and K–12 conversations use separate stores. This preview clears when you delete it or end this browser session.</p><div className="device-message-thread">{messages.length ? messages.map((item) => <article key={item.id}><strong>{item.sender}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleTimeString()}</small></article>) : <p>No messages in this session.</p>}</div><form className="device-message-form" onSubmit={send}><textarea rows={3} spellCheck="true" lang="en" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" /><button type="submit">Send on this device</button></form><button className="clear-message-button" type="button" onClick={clear}>Clear this session</button></section><aside className="dashboard-card"><span className="portal-kicker">OPTIONAL SYNC</span><h2>Keep messages across devices.</h2><p>Cloud sync is planned as an optional service. It is not available for purchase yet, and class access does not depend on it.</p><strong>Paid services coming soon</strong></aside></div>;
}

function FriendsPanel({ track, userId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) { setStatus("Enter at least two letters."); return; }
    setStatus("Searching…");
    const { data, error } = await searchStudentProfiles(query, track, userId);
    if (error) { setStatus("Friend search is not available yet. Try again shortly."); return; }
    setResults(data);
    setStatus(data.length ? `${data.length} profile${data.length === 1 ? "" : "s"} found.` : "No visible profiles matched that name.");
  }
  return <section className="dashboard-card friend-finder"><span className="portal-kicker">FIND YOUR PEOPLE</span><h1>Find friends by name.</h1><p>Search shows only students who turned on name discovery. Hidden and private profiles never appear.</p><form onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Student name" aria-label="Student name" /><button type="submit">Search</button></form>{status && <p role="status" className="friend-search-status">{status}</p>}<div className="friend-result-grid">{results.map((person) => <article key={person.user_id}><span>{person.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{person.display_name}</strong><small>{person.school_name || (track === "k12" ? "K–12 student" : "University student")}{person.graduation_year ? ` · ${person.graduation_year}` : ""}</small><p>{person.bio || "Learning with EdNotebook."}</p></div></article>)}</div></section>;
}

function FriendsPanelV2({ track, userId, storageScope }) {
  const personaId = track === "k12" ? "k12" : "student";
  const guide = getDefaultConnection(personaId);
  const followingKey = `ednotebook-${track}-${storageScope}-following-guides`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selected, setSelected] = useState({ user_id: `guide-${personaId}`, display_name: guide.name, school_name: guide.role, bio: personaId === "k12" ? "Accounting, college prep, training, and school life." : "Business classes, art, campus life, and honest study updates.", online: true, image: guide.image, guide: true });
  const [following, setFollowing] = useState(() => readStorage(window.localStorage, followingKey, []).includes(personaId));
  const [message, setMessage] = useState("");
  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) { setStatus("Enter at least two letters."); return; }
    setStatus("Searching…");
    const [students, educators] = await Promise.all([searchStudentProfiles(query, track, userId), searchEducatorProfiles(query, track)]);
    if (students.error && educators.error) { setStatus("Live search is unavailable, but your guide profile is ready below."); return; }
    const data = [...(students.data || []).map((person) => ({ ...person, role: "Student", online: false })), ...(educators.data || []).map((person) => ({ ...person, online: false }))];
    setResults(data);
    setStatus(data.length ? `${data.length} visible profile${data.length === 1 ? "" : "s"} found.` : "No visible profiles matched that name.");
  }
  function sendMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    const key = `ednotebook-${track}-${storageScope}-session-messages`;
    const current = readStorage(window.sessionStorage, key, []);
    window.sessionStorage.setItem(key, JSON.stringify([...current, { id: crypto.randomUUID(), body: message.trim(), createdAt: new Date().toISOString(), sender: "You", recipient: selected.display_name }]));
    setMessage("");
    setStatus(`Message saved for ${selected.display_name}.`);
  }
  function toggleGuideFollow() { const next = !following; setFollowing(next); window.localStorage.setItem(followingKey, JSON.stringify(next ? [personaId] : [])); }
  const people = [{ user_id: `guide-${personaId}`, display_name: guide.name, school_name: guide.role, bio: selected.guide ? selected.bio : "Weekly EdNotebook guide.", online: true, image: guide.image, guide: true }, ...results].filter((person) => !onlineOnly || person.online);
  return <div className="portal-friends-layout"><section className="dashboard-card friend-finder"><span className="portal-kicker">FIND YOUR PEOPLE</span><h1>Friends and followers</h1><p>Search visible profiles, filter who is online, and open a profile before messaging.</p><form onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Student or professor name" aria-label="Student or professor name" /><button type="submit">Search</button></form><label className="friends-online-toggle"><input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} />Online now</label>{status && <p role="status" className="friend-search-status">{status}</p>}<div className="friend-result-grid">{people.map((person) => <button type="button" className={selected?.user_id === person.user_id ? "is-active" : ""} key={person.user_id} onClick={() => setSelected(person)}>{person.image ? <img src={person.image} alt="" /> : <span>{person.display_name.slice(0, 1).toUpperCase()}</span>}<div><strong>{person.display_name}</strong><small>{person.role ? `${person.role} · ${person.school_name || "School profile"}` : person.school_name || (track === "k12" ? "School student" : "University student")} · {person.online ? "Online" : "Status unavailable"}</small><p>{person.bio || "Learning with EdNotebook."}</p></div></button>)}</div></section><aside className="dashboard-card portal-friend-profile">{selected && <><div className="portal-friend-profile-hero">{selected.image ? <img src={selected.image} alt="" /> : <span>{selected.display_name.slice(0, 1)}</span>}<div><span className="portal-kicker">PROFILE</span><h2>{selected.display_name}</h2><p>{selected.bio}</p></div></div>{selected.guide && <button type="button" onClick={toggleGuideFollow}>{following ? `Following ${guide.shortName}` : `Follow ${guide.shortName}`}</button>}<form onSubmit={sendMessage}><label>Message<textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} /></label><button type="submit">Send message</button></form></>}</aside></div>;
}

function StudentPagePanel({ name, track, userId, storageScope, accountSettings, onSettingsChange }) {
  const key = `ednotebook-${track}-${storageScope}-student-page`;
  const stored = readStorage(window.localStorage, key, {});
  const [bio, setBio] = useState(stored.bio ?? accountSettings.bio ?? "");
  const [schoolName, setSchoolName] = useState(stored.schoolName || "");
  const [graduationYear, setGraduationYear] = useState(stored.graduationYear || "");
  const [youtubeUrl, setYoutubeUrl] = useState(stored.youtubeUrl || "");
  const [visibility, setVisibility] = useState(stored.visibility ?? accountSettings.profileVisibility ?? "private");
  const [discoverable, setDiscoverable] = useState(Object.prototype.hasOwnProperty.call(stored, "discoverable") ? Boolean(stored.discoverable) : accountSettings.discoverable !== false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    loadPublicStudentPage(userId, track).then(({ data }) => {
      if (!active || !data) return;
      setBio(data.bio || ""); setSchoolName(data.school_name || ""); setGraduationYear(data.graduation_year || ""); setYoutubeUrl(data.youtube_url || ""); setVisibility(data.visibility || "private"); setDiscoverable(Boolean(data.discoverable_by_name));
    });
    return () => { active = false; };
  }, [track, userId]);
  async function save() {
    const local = { bio, schoolName, graduationYear, youtubeUrl, visibility, discoverable, track };
    window.localStorage.setItem(key, JSON.stringify(local));
    const nextSettings = saveAccountSettings(storageScope, { ...accountSettings, bio, profileVisibility: visibility, discoverable }, "Student page settings saved");
    onSettingsChange?.(nextSettings);
    const { error } = await savePublicStudentPage({ user_id: userId, education_division: track, display_name: nextSettings.displayName || name, school_name: schoolName.trim() || null, graduation_year: graduationYear ? Number(graduationYear) : null, bio: bio.trim() || null, youtube_url: youtubeUrl.trim() || null, visibility, discoverable_by_name: discoverable, social_links: {}, theme_key: "classic" });
    setNotice(error ? "Saved on this device. Cloud publishing unlocks after your class profile is linked." : discoverable && visibility !== "private" ? "Page saved. Students can now find it by name at the visibility you selected." : "Page saved. Your profile remains hidden from name search.");
  }
  return <div className="student-page-builder"><section className="dashboard-card"><span className="portal-kicker">MY {track === "k12" ? "SCHOOL" : "STUDENT"} PAGE</span><h1>A page for the work and interests you choose.</h1><p>New pages start private and hidden from name search. You decide if classmates or the public can see yours.</p><label>School or university<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} /></label><label>Bio<textarea rows={4} spellCheck="true" lang="en" value={bio} onChange={(event) => setBio(event.target.value)} /></label><div className="interest-field-grid"><label>Graduation year<input type="number" min="1900" max="2200" value={graduationYear} onChange={(event) => setGraduationYear(event.target.value)} placeholder="2028" /></label><label>Page visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Private</option><option value="class">Classmates</option><option value="public">Public</option></select></label></div><label>YouTube or project link<input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://…" /></label><label className="profile-discovery-toggle"><input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} />Allow students to find this page by my name</label><button type="button" onClick={save}>Save page</button>{notice && <div className="portal-form-notice" role="status">{notice}</div>}</section><aside className="student-public-page"><span>{schoolName || (track === "k12" ? "YOUR SCHOOL" : "YOUR UNIVERSITY")}</span><h2>{name}</h2><p>{bio || "Add a short bio when you are ready."}</p><div><strong>0</strong><span>learning points</span></div><article><strong>Discovery</strong><span>{discoverable && visibility !== "private" ? `Findable · ${visibility}` : "Hidden"}</span></article></aside>{track === "k12" && <section className="dashboard-card student-transfer-card"><span className="portal-kicker">AFTER HIGH SCHOOL</span><h2>Carry your progress forward.</h2><p>When you move to the university portal, completed work history and selected preferences can transfer. Your K–12 posts, groups, messages, and school profile stay in the K–12 space.</p><button type="button">Preview university transfer</button></section>}<section className="professor-plan-strip">{STUDENT_PRICING.map((plan) => <article key={plan.name}><span>{plan.name}</span><strong>{plan.price}</strong><p>{plan.description}</p></article>)}</section></div>;
}

function OpportunitiesPanel({ track }) {
  return <div className="opportunity-grid"><article className="dashboard-card"><span className="portal-kicker">HELP SHAPE EDNOTEBOOK</span><h2>Suggest what students need next.</h2><p>Share product feedback or test a student workflow. This feedback form does not request grades or school records.</p><button type="button">Suggest a feature</button></article><article className="dashboard-card"><span className="portal-kicker">{track === "k12" ? "FUTURE PROGRAMS" : "FUTURE ROLES"}</span><h2>{track === "k12" ? "Student advisory and job-shadow opportunities" : "Internships and future jobs"}</h2><p>{track === "k12" ? "Join the waitlist for age-appropriate student advisory projects as they open." : "Join the waitlist for product testing, student advisory work, internships, and future roles."}</p><button type="button">Join opportunities list</button></article><article className="dashboard-card"><span className="portal-kicker">DIGITAL LITERACY</span><h2>Build skills you can use anywhere.</h2><p>Open short learning pages about source checks, passwords, online communication, and responsible publishing.</p><a href={`#/students/${track}`}>Find literacy classes</a></article></div>;
}

export default function StudentDashboard({ profile, session, track = "university", onHome, onProfessorPortal }) {
  const [tab, setTab] = useState("overview");
  const [tourStep, setTourStep] = useState(null);
  const [liveClasses, setLiveClasses] = useState([]);
  const [demoMode, setDemoMode] = useState(false);
  const settingsScope = `student-${session?.user?.id || `guest-${track}`}`;
  const [accountSettings, setAccountSettings] = useState(() => readAccountSettings(settingsScope, {
    accountType: "student",
    name: profile?.full_name || "Student",
    email: session?.user?.email || "",
  }));
  const copy = getTrack(track);
  const tourKey = `ednotebook-brooke-tour-${session?.user?.id || "guest"}-${track}`;
  const [showTourOnSignIn, setShowTourOnSignIn] = useState(() => readStorage(window.localStorage, tourKey, { enabled: true }).enabled !== false);
  const demoClasses = track === "k12" ? K12_STUDENT_CLASSES : STUDENT_CLASSES;
  const classes = demoMode ? demoClasses : liveClasses;
  const rows = demoMode ? (track === "k12" ? K12_GRADE_ROWS : GRADE_ROWS) : [];
  const groups = demoMode ? (track === "k12" ? K12_STUDENT_GROUPS : STUDENT_GROUPS) : [];
  const posts = demoMode ? (track === "k12" ? K12_COMMUNITY_POSTS : COMMUNITY_POSTS) : [];
  const displayName = useMemo(() => accountSettings.displayName?.split(" ")[0] || profile?.full_name?.split(" ")[0] || "Student", [accountSettings.displayName, profile?.full_name]);

  useEffect(() => {
    setAccountSettings(readAccountSettings(settingsScope, { accountType: "student", name: profile?.full_name || "Student", email: session?.user?.email || "" }));
  }, [settingsScope, profile?.full_name, session?.user?.email]);

  useEffect(() => {
    let active = true;
    listCurrentStudentCourses().then(({ data }) => {
      if (!active) return;
      setLiveClasses((data || []).filter((course) => course.education_division === track).map((course) => ({
        id: course.id,
        code: course.course_code || "CLASS",
        title: course.title,
        professor: "Educator",
        progress: 0,
        points: 0,
        grade: null,
        next: "No work published yet",
        division: course.education_division,
      })));
    });
    return () => { active = false; };
  }, [track, session?.user?.id]);

  useEffect(() => {
    const sessionKey = `${tourKey}-shown`;
    if (showTourOnSignIn && !window.sessionStorage.getItem(sessionKey)) {
      setTourStep(0);
      window.sessionStorage.setItem(sessionKey, "1");
    }
  }, [showTourOnSignIn, tourKey]);

  function chooseTab(nextTab) {
    if (nextTab === "demo") {
      setDemoMode(true);
      setTab("overview");
      return;
    }
    if (nextTab === "settings") setDemoMode(false);
    setTab(nextTab);
  }

  function exitDemo() {
    setDemoMode(false);
    setTab("overview");
  }

  function updateTourPreference(enabled) {
    setShowTourOnSignIn(enabled);
    window.localStorage.setItem(tourKey, JSON.stringify({ enabled }));
  }

  async function applyAccountSettings(next) {
    setAccountSettings(next);
    const userId = session?.user?.id;
    if (!userId) return;
    const { data } = await loadPublicStudentPage(userId, track);
    await savePublicStudentPage({
      ...(data || {}),
      user_id: userId,
      education_division: track,
      display_name: next.displayName || profile?.full_name || "Student",
      school_name: data?.school_name || null,
      graduation_year: data?.graduation_year || null,
      bio: next.bio?.trim() || data?.bio || null,
      youtube_url: data?.youtube_url || null,
      social_links: { ...(data?.social_links || {}), links: String(next.links || "").split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) },
      visibility: ["class", "public"].includes(next.profileVisibility) ? next.profileVisibility : "private",
      discoverable_by_name: next.profileVisibility !== "private" && next.discoverable === true,
      theme_key: data?.theme_key || "classic",
    });
  }

  return (
    <div className={`student-dashboard-page ${track === "k12" ? "is-k12" : ""} ${accountSettings.showDescriptions ? "" : "is-description-light"}`}>
      <header className="dashboard-topbar">
        <button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline={`${copy.shortLabel} student`} /></button>
        {demoMode && <span className="sample-workspace-badge">Brooke's demo workspace</span>}
        <div className="dashboard-top-actions">
          <LiveDateTime />
          {demoMode && <button type="button" onClick={exitDemo}>Return to my workspace</button>}
          <button type="button" onClick={onProfessorPortal}>Educator portal</button>
          <button type="button" onClick={() => setTourStep(0)}>Brooke tour</button>
          <button className="primary" type="button" onClick={() => setTab("assignments")}>Open assignments</button>
        </div>
      </header>
      <div className="student-dashboard-shell">
        <aside className="student-dashboard-sidebar">
          <div className="student-sidebar-profile"><span>{(demoMode ? "B" : displayName.slice(0, 1)).toUpperCase()}</span><div><strong>{demoMode ? "Brooke" : displayName}</strong><small>{demoMode ? "Demonstration student" : liveClasses.length ? `${liveClasses.length} linked class${liveClasses.length === 1 ? "" : "es"}` : "New student workspace"}</small></div></div>
          <nav aria-label={`${copy.shortLabel} student dashboard`}>{TABS.map(([id, label]) => <button className={(id === "demo" ? demoMode : tab === id && !demoMode) ? "is-active" : ""} type="button" key={id} onClick={() => chooseTab(id)}>{label}{id === "grades" && classes.length > 0 && <i>{rows.filter((row) => row.status !== "final").length}</i>}</button>)}</nav>
          <div className="student-sidebar-points"><span>{demoMode ? "DEMO LEVEL 8" : "YOUR PROGRESS"}</span><strong>{demoMode ? "1,645 points" : "0 points"}</strong><div><i style={{ width: demoMode ? "78%" : "0%" }} /></div><small>{demoMode ? "355 points to level 9" : "Points appear as you learn"}</small></div>
        </aside>
        <main className="student-dashboard-main">
          {demoMode && <div className="brooke-demo-banner"><div><span aria-hidden="true">B</span><div><strong>You're exploring Brooke's demonstration workspace.</strong><p>Nothing here belongs to your account. Use it to safely explore how classes, grades, assignments, and student life will work.</p></div></div><button type="button" onClick={exitDemo}>Back to my workspace</button></div>}
          {tab === "overview" && <OverviewPanel name={demoMode ? "Brooke" : displayName} onTab={chooseTab} classes={classes} track={track} />}
          {tab === "semester" && <Suspense fallback={<section className="dashboard-card" role="status">Opening Own Your Semester…</section>}><OwnYourSemester profile={profile} session={session} track={track} classes={classes} /></Suspense>}
          {tab === "classes" && <ClassesPanel classes={classes} track={track} />}
          {tab === "assignments" && (classes.length ? <AssignmentTemplateWorkspace mode="student" session={session} track={track} classes={classes} /> : <section className="dashboard-card empty-dashboard-card"><span className="portal-kicker">ASSIGNMENTS</span><h1>No assignments yet.</h1><p>Templates, full-page writing, and submitted work will appear here after you join a class.</p><a href={`#/students/${track}`}>Find a class</a></section>)}
          {tab === "grades" && <GradesPanel classes={classes} rows={rows} track={track} />}
          {tab === "notes" && <NotesPanel key={`notes-${settingsScope}-${track}`} classes={classes} track={track} storageScope={settingsScope} />}
          {tab === "life" && <StudentLifePanelV2 key={`life-${settingsScope}-${track}`} groups={groups} initialPosts={posts} track={track} accountSettings={accountSettings} storageScope={settingsScope} />}
          {tab === "friends" && <FriendsPanelV2 key={`friends-${settingsScope}-${track}`} track={track} userId={session?.user?.id} storageScope={settingsScope} />}
          {tab === "messages" && <MessagesPanel key={`messages-${settingsScope}-${track}`} track={track} storageScope={settingsScope} />}
          {tab === "page" && <StudentPagePanel key={`page-${settingsScope}-${track}`} name={accountSettings.displayName || profile?.full_name || displayName} track={track} userId={session?.user?.id} storageScope={settingsScope} accountSettings={accountSettings} onSettingsChange={applyAccountSettings} />}
          {tab === "opportunities" && <OpportunitiesPanel track={track} />}
          {tab === "settings" && <AccountSettings scope={settingsScope} accountType="student" settings={accountSettings} onSettingsChange={applyAccountSettings} authenticated={Boolean(session?.user)} accountEmail={session?.user?.email || ""} />}
        </main>
      </div>
      <DashboardTour step={tourStep} setStep={setTourStep} showOnSignIn={showTourOnSignIn} onShowOnSignIn={updateTourPreference} />
    </div>
  );
}
