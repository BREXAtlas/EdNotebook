import { useState } from "react";
import BrandLogo from "../Brand.jsx";
import { FEATURE_DEFAULTS, PERSONAS } from "./demoData.js";
import { cx, NotebookLabel, VerifiedBadge } from "./demoShared.jsx";

const WORKSPACE_TABS = [["today", "Today"], ["homework", "Homework & due dates"], ["calendar", "Calendar"], ["syllabus", "Syllabus upload"], ["library", "Notes & sources"], ["chat", "AI chat"], ["social", "Social page"], ["profile", "Full profile"]];
const PROFESSOR_TABS = [["today", "Today"], ["homework", "Review queue"], ["calendar", "Calendar"], ["syllabus", "Course setup"], ["library", "Research & sources"], ["chat", "AI memory"], ["social", "Community"], ["profile", "Professor page"]];
const TOUR_STEPS = [["One page, one semester", "The Today view combines classes, grades, points, deadlines, and anything that needs attention."], ["Dates extracted from syllabi", "Upload or paste a syllabus, review the extracted details, then add approved dates to the shared calendar."], ["Overlaps become visible", "Assignments due on the same day are grouped together with estimated work time and a collision warning."], ["Missed work stays actionable", "A missed item remains in the rescue queue until a new plan, message, or completion is recorded."], ["Ask your own learning memory", "The AI demo searches documents, notes, saved sources, assignments, and past conversations before answering."], ["You control the page", "Every social-profile module can be hidden without deleting the underlying learning record."]];

function WorkspaceHeader({ persona, onlineStatus, setOnlineStatus, statusLine, setStatusLine, onTour, onCustomize }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statusLine);
  function saveStatus() {
    setStatusLine(draft.trim() || statusLine);
    setEditing(false);
  }
  return (
    <header className="workspace-header">
      <a href="#/tour" className="workspace-brand"><BrandLogo size={36} tagline="Demo workspace" /></a>
      <div className="workspace-persona-mini">
        <img src={persona.image} alt="" />
        <div><strong>{persona.name}</strong><span>{persona.roleLine}</span></div>
        <VerifiedBadge label={persona.verifiedTitle} small />
      </div>
      <div className="workspace-status-control">
        <label>
          <span className="sr-only">Online status</span>
          <select value={onlineStatus} onChange={(event) => setOnlineStatus(event.target.value)}>
            <option value="online">Online</option>
            <option value="focus">Focus mode</option>
            <option value="away">Away</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        {editing ? <div className="status-editor"><input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Status update" /><button type="button" onClick={saveStatus}>Save</button></div> : <button className="status-line-button" type="button" onClick={() => setEditing(true)}>{statusLine}</button>}
      </div>
      <div className="workspace-header-actions">
        <button type="button" onClick={onCustomize}>Customize cards</button>
        <button type="button" onClick={onTour}>Guided tour</button>
        <a href="#/presentation">Presentation</a>
      </div>
    </header>
  );
}

function WorkspaceSidebar({ persona, tab, setTab, features, professor }) {
  const tabs = professor ? PROFESSOR_TABS : WORKSPACE_TABS;
  const alertCount = persona.assignments.filter((item) => item.status === "needs-rescue").length;
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-profile-chip">
        <div className="workspace-avatar"><img src={persona.image} alt="" /><i /></div>
        <div><strong>{persona.shortName}</strong><span>{persona.institution}</span></div>
      </div>
      <nav aria-label={`${persona.shortName} demo sections`}>
        {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}><span>{label}</span>{id === "homework" && alertCount > 0 && <i>{alertCount}</i>}</button>)}
      </nav>
      <div className="sidebar-availability-card">
        <strong>Independent mode</strong>
        <span>{professor ? "Organize courses, research, advising, and memory without requiring another account." : "Upload syllabi and use planning, notes, AI search, digital literacy, and financial literacy without a teacher account."}</span>
      </div>
      <div className="sidebar-visible-count"><strong>{Object.values(features).filter(Boolean).length}</strong><span>profile cards visible</span></div>
    </aside>
  );
}

function FeatureDrawer({ open, onClose, features, setFeatures }) {
  const labels = {
    profile: "Profile summary",
    homework: "Homework / review queue",
    dueDates: "Due-date collisions",
    calendar: "Calendar preview",
    syllabus: "Syllabus tools",
    conversations: "Conversations",
    notes: "Notes",
    sources: "Sources",
    social: "Social updates",
    grades: "Grades / progress",
    activities: "Sports, clubs, and activities",
    family: "Family and support",
    relationships: "Dating / personal growth",
    literacy: "Literacy course cards",
  };
  function toggle(id) {
    const next = { ...features, [id]: !features[id] };
    setFeatures(next);
  }
  return (
    <div className={cx("feature-drawer-backdrop", open && "is-open")} aria-hidden={!open} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="feature-drawer" aria-label="Customize profile cards">
        <div className="feature-drawer-heading"><div><NotebookLabel>VISIBILITY</NotebookLabel><h2>Choose what appears.</h2></div><button type="button" onClick={onClose} aria-label="Close feature settings">×</button></div>
        <p>Hiding a card removes it from the demo page. It does not delete the underlying learning record.</p>
        <div className="feature-toggle-list">
          {Object.entries(labels).map(([id, label]) => <label key={id}><span>{label}</span><input type="checkbox" checked={Boolean(features[id])} onChange={() => toggle(id)} /></label>)}
        </div>
        <button className="drawer-reset" type="button" onClick={() => setFeatures(FEATURE_DEFAULTS)}>Restore all cards</button>
      </aside>
    </div>
  );
}

function TourCoach({ open, step, setStep, onClose, persona }) {
  if (!open) return null;
  const [title, copy] = TOUR_STEPS[step];
  return (
    <div className="tour-coach" role="dialog" aria-label="Brooke guided tour">
      <img src={PERSONAS.student.image} alt="Brooke" />
      <div>
        <span>Brooke’s tour · {step + 1}/{TOUR_STEPS.length}</span>
        <h3>{title}</h3>
        <p>{copy}</p>
        {persona.id !== "student" && <small>I’m showing you {persona.shortName}’s version of the same system.</small>}
        <footer><button type="button" onClick={onClose}>Close</button><button type="button" onClick={() => step === TOUR_STEPS.length - 1 ? onClose() : setStep(step + 1)}>{step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}</button></footer>
      </div>
    </div>
  );
}

export { WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach };
