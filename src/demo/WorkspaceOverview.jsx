import { useEffect, useState } from "react";
import { CORE_LEARNING } from "./demoData.js";
import { cx, safeRead, dateKey, formatDate, formatDateTime, dueLabel, statusLabel, nextAssignmentStatus, iconForType, VerifiedBadge, OnlineBadge, NotebookLabel } from "./demoShared.jsx";

function ProfileHeroCard({ persona, onlineStatus, statusLine }) {
  return (
    <article className="paper-card profile-hero-card">
      <div className="profile-photo-column">
        <img src={persona.image} alt={`${persona.name} profile`} />
        <OnlineBadge value={onlineStatus} />
      </div>
      <div className="profile-hero-copy">
        <div className="profile-name-line"><div><NotebookLabel>{persona.accountType}</NotebookLabel><h1>{persona.name}</h1></div><VerifiedBadge label={persona.verifiedTitle} /></div>
        <p className="profile-role-line">{persona.roleLine} · {persona.institution}</p>
        <p>{persona.profile.bio}</p>
        <div className="persona-tags">{persona.profile.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
        <blockquote>{statusLine}</blockquote>
      </div>
    </article>
  );
}

function VerificationCard({ persona }) {
  return (
    <article className="paper-card verification-card">
      <div className="card-title-row"><NotebookLabel>{persona.verifiedTitle.toUpperCase()}</NotebookLabel><span className="shield-mark">✓</span></div>
      <ul>{persona.verifiedCopy.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>Verification is completed by a person, not awarded automatically by an algorithm.</p>
    </article>
  );
}

function StatsCard({ persona }) {
  return (
    <article className="paper-card stats-card">
      <NotebookLabel>{persona.id === "professor" ? "TEACHING & PROFESSIONAL PROGRESS" : "ACADEMIC PROGRESS"}</NotebookLabel>
      <div className="stat-list">{persona.stats.map(([label, value], index) => <div key={label}><span>{label}</span><strong>{value}</strong><div><i style={{ width: `${Math.max(42, 92 - index * 9)}%` }} /></div></div>)}</div>
    </article>
  );
}

function AssignmentList({ assignments, setAssignments, persona, compact = false }) {
  const professor = persona.id === "professor";
  return (
    <div className={cx("assignment-list", compact && "is-compact")}>
      {assignments.map((assignment) => <article key={assignment.id} className={cx("assignment-row", `is-${assignment.status}`)}>
        <div className="assignment-course-dot" style={{ "--assignment-color": persona.classes.find((course) => course.code === assignment.course)?.color || "#6f72c9" }} />
        <div className="assignment-main">
          <span>{assignment.course}</span>
          <strong>{assignment.title}</strong>
          <p>{assignment.description}</p>
          <div className="assignment-meta"><b>{formatDateTime(assignment.due)}</b><span>{assignment.hours} estimated hour{assignment.hours === 1 ? "" : "s"}</span><span>{dueLabel(assignment.due)}</span></div>
        </div>
        <div className="assignment-actions">
          <span className={cx("status-pill", `is-${assignment.status}`)}>{statusLabel(assignment.status, professor)}</span>
          <button type="button" onClick={() => setAssignments(assignments.map((item) => item.id === assignment.id ? { ...item, status: nextAssignmentStatus(item.status) } : item))}>{assignment.status === "complete" ? "Reopen" : assignment.status === "in-progress" ? (professor ? "Mark feedback sent" : "Mark complete") : assignment.status === "needs-rescue" ? "Make recovery plan" : "Start"}</button>
        </div>
      </article>)}
    </div>
  );
}

function CollisionCard({ assignments }) {
  const groups = Object.entries(assignments.reduce((map, assignment) => {
    const key = dateKey(assignment.due);
    map[key] = [...(map[key] || []), assignment];
    return map;
  }, {})).filter(([, items]) => items.length > 1);
  return (
    <article className="paper-card collision-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>DUE-DATE COLLISIONS</NotebookLabel><h2>Overlapping work is visible before it becomes a crisis.</h2></div><span className="collision-count">{groups.length} collision days</span></div>
      {groups.length === 0 ? <p>No overlapping due dates.</p> : <div className="collision-groups">{groups.map(([day, items]) => <section key={day}><div className="collision-date"><strong>{formatDate(`${day}T12:00:00`)}</strong><span>{items.reduce((sum, item) => sum + item.hours, 0)} estimated hours</span></div><div>{items.map((item) => <span key={item.id}>{item.course} · {item.title} · {new Date(item.due).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>)}</div></section>)}</div>}
    </article>
  );
}

function ConversationsCard({ persona, onOpenMessages }) {
  return (
    <article className="paper-card conversation-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>CONVERSATIONS</NotebookLabel><h2>Messages that may change the plan.</h2></div><button type="button" onClick={onOpenMessages}>Open all messages</button></div>
      <div className="conversation-list">{persona.conversations.map((item) => <div key={item.name}><span className="conversation-avatar">{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><p>{item.preview}</p></div><span>{item.time}{item.unread > 0 && <i>{item.unread}</i>}</span></div>)}</div>
    </article>
  );
}

function ClassProgressCard({ persona }) {
  return (
    <article className="paper-card class-progress-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>{persona.id === "professor" ? "COURSES" : "CLASSES"}</NotebookLabel><h2>{persona.id === "professor" ? "Teaching load" : "Current semester"}</h2></div><span>{persona.classes.length} active</span></div>
      <div className="class-progress-list">{persona.classes.map((course) => <div key={course.code}><span className="class-code" style={{ "--course-color": course.color }}>{course.code}</span><div><strong>{course.title}</strong><small>{course.instructor}</small><div><i style={{ width: `${course.progress}%`, background: course.color }} /></div></div><b>{course.grade}</b></div>)}</div>
    </article>
  );
}

function CalendarMiniCard({ persona, onOpenCalendar }) {
  const grouped = persona.calendarEvents.slice(0, 6);
  return (
    <article className="paper-card mini-calendar-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>CALENDAR</NotebookLabel><h2>Dates from every class.</h2></div><button type="button" onClick={onOpenCalendar}>Open calendar</button></div>
      <div className="calendar-agenda">{grouped.map((event, index) => <div key={`${event.date}-${event.title}`}><span className={cx("agenda-icon", `is-${event.type}`)}>{iconForType(event.type)}</span><div><strong>{event.title}</strong><span>{formatDate(`${event.date}T12:00:00`)} · {event.time}</span></div>{index < 2 && <i>soon</i>}</div>)}</div>
    </article>
  );
}

function LiteracyCard() {
  return (
    <article className="paper-card literacy-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>OPEN LEARNING</NotebookLabel><h2>Available with or without a teacher account.</h2></div></div>
      <div className="literacy-card-grid">{CORE_LEARNING.map((course) => <section key={course.id}><span>{course.badge}</span><h3>{course.title}</h3><p>{course.description}</p><button type="button">Open {course.lessons}-lesson course</button></section>)}</div>
    </article>
  );
}

function TodayPanel({ persona, assignments, setAssignments, features, onlineStatus, statusLine, onOpenCalendar, onOpenMessages }) {
  const urgent = assignments.filter((item) => item.status !== "complete").slice(0, 4);
  return (
    <div className="workspace-panel-stack">
      <section className="workspace-top-grid">
        {features.profile && <ProfileHeroCard persona={persona} onlineStatus={onlineStatus} statusLine={statusLine} />}
        <VerificationCard persona={persona} />
        {features.grades && <StatsCard persona={persona} />}
      </section>
      <section className="today-summary-grid">
        {features.homework && <article className="paper-card urgent-work-card"><div className="dashboard-card-heading"><div><NotebookLabel>{persona.id === "professor" ? "REVIEW QUEUE" : "HOMEWORK"}</NotebookLabel><h2>{persona.id === "professor" ? "Feedback promises coming due" : "What needs attention next"}</h2></div><span>{assignments.filter((item) => item.status !== "complete").length} open</span></div><AssignmentList assignments={urgent} setAssignments={setAssignments} persona={persona} compact /></article>}
        {features.dueDates && <CollisionCard assignments={assignments} />}
      </section>
      <section className="today-lower-grid">
        <ClassProgressCard persona={persona} />
        {features.calendar && <CalendarMiniCard persona={persona} onOpenCalendar={onOpenCalendar} />}
        {features.conversations && <ConversationsCard persona={persona} onOpenMessages={onOpenMessages} />}
      </section>
      {features.literacy && <LiteracyCard />}
    </div>
  );
}

function ReminderControls({ reminders, setReminders, notice, setNotice }) {
  function toggle(id) {
    const next = { ...reminders, [id]: !reminders[id] };
    setReminders(next);
    setNotice("Reminder plan saved in this demonstration browser.");
  }
  return (
    <article className="paper-card reminder-card">
      <NotebookLabel>ALERTS & REMINDERS</NotebookLabel>
      <h2>Keep work visible before—and after—the due date.</h2>
      <div className="reminder-toggle-grid">
        {[["week", "7 days before", "Enough time to plan a multi-step project."], ["twoDays", "48 hours before", "A practical start-now reminder."], ["twoHours", "2 hours before", "Final submission and attachment check."], ["rescue", "Missed-work rescue", "The item stays active until a recovery action is recorded."]].map(([id, label, copy]) => <label key={id}><div><strong>{label}</strong><span>{copy}</span></div><input type="checkbox" checked={Boolean(reminders[id])} onChange={() => toggle(id)} /></label>)}
      </div>
      {notice && <p className="inline-notice" role="status">{notice}</p>}
    </article>
  );
}

function TodoCard({ persona }) {
  const storageKey = `ed-demo-${persona.id}-todos`;
  const [todos, setTodos] = useState(() => safeRead(storageKey, [
    { id: "todo-1", body: persona.id === "professor" ? "Reply to advisee scheduling request" : "Confirm the next two due dates in each class", complete: false },
    { id: "todo-2", body: persona.id === "k12" ? "Add scholarship deadline to the college list" : persona.id === "professor" ? "Block dissertation reading time" : "Pack the required book for tomorrow", complete: false },
  ]));
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setTodos(safeRead(storageKey, []));
    setDraft("");
  }, [storageKey]);
  function save(next) {
    setTodos(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }
  function add(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    save([...todos, { id: crypto.randomUUID(), body: draft.trim(), complete: false }]);
    setDraft("");
  }
  return (
    <article className="paper-card todo-card">
      <div className="dashboard-card-heading"><div><NotebookLabel>TO-DO LIST</NotebookLabel><h2>Small commitments beside the formal assignments.</h2></div><span>{todos.filter((item) => !item.complete).length} open</span></div>
      <form onSubmit={add}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a personal task…" /><button type="submit">Add task</button></form>
      <div className="todo-list">{todos.length ? todos.map((item) => <label className={item.complete ? "is-complete" : ""} key={item.id}><input type="checkbox" checked={item.complete} onChange={() => save(todos.map((todo) => todo.id === item.id ? { ...todo, complete: !todo.complete } : todo))} /><span>{item.body}</span><button type="button" onClick={() => save(todos.filter((todo) => todo.id !== item.id))} aria-label={`Delete ${item.body}`}>×</button></label>) : <p>No personal tasks yet.</p>}</div>
    </article>
  );
}

function HomeworkPanel({ persona, assignments, setAssignments, reminders, setReminders }) {
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");
  const filtered = assignments.filter((item) => filter === "all" || (filter === "open" && item.status !== "complete") || item.status === filter);
  const rescue = assignments.filter((item) => item.status === "needs-rescue");
  return (
    <div className="workspace-panel-stack">
      <section className="paper-card homework-command-card">
        <div className="dashboard-card-heading"><div><NotebookLabel>{persona.id === "professor" ? "ASSIGNMENT REVIEW COMMAND CENTER" : "HOMEWORK COMMAND CENTER"}</NotebookLabel><h1>{persona.id === "professor" ? "Feedback, review dates, and teaching promises in one queue." : "Assignments, due dates, workload, and recovery in one queue."}</h1><p>Demo clock: August 19, 2026 · Central Time</p></div><label className="filter-control">Show<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="open">Open work</option><option value="all">All work</option><option value="in-progress">In progress</option><option value="needs-rescue">Needs rescue</option><option value="complete">Complete</option></select></label></div>
        <AssignmentList assignments={filtered} setAssignments={setAssignments} persona={persona} />
      </section>
      <section className="homework-support-grid">
        <CollisionCard assignments={assignments} />
        <TodoCard persona={persona} />
        <article className="paper-card rescue-card"><NotebookLabel>{persona.id === "professor" ? "FOLLOW-UP RESCUE" : "MISSED-ASSIGNMENT RESCUE"}</NotebookLabel><h2>{rescue.length ? `${rescue.length} item${rescue.length === 1 ? "" : "s"} will not disappear.` : "The rescue queue is clear."}</h2><p>{persona.id === "professor" ? "Overdue feedback remains visible until you send it, reschedule it, or communicate the new plan." : "A missed assignment remains visible until you finish it, contact the teacher, or make a realistic recovery plan."}</p>{rescue.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{item.course} · {dueLabel(item.due)}</span><button type="button" onClick={() => setAssignments(assignments.map((assignment) => assignment.id === item.id ? { ...assignment, status: "in-progress" } : assignment))}>Create recovery plan</button></div>)}</article>
      </section>
      <ReminderControls reminders={reminders} setReminders={setReminders} notice={notice} setNotice={setNotice} />
    </div>
  );
}

export { ProfileHeroCard, StatsCard, AssignmentList, CollisionCard, TodayPanel, HomeworkPanel };
