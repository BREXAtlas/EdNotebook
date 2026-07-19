import { useState } from "react";
import BrandLogo from "../Brand.jsx";
import { FEATURE_DEFAULTS, PERSONAS } from "./demoData.js";
import { cx, NotebookLabel, VerifiedBadge } from "./demoShared.jsx";

const WORKSPACE_TABS = [["today", "Today"], ["homework", "Homework & due dates"], ["calendar", "Calendar"], ["syllabus", "Syllabus upload"], ["library", "Notes & sources"], ["chat", "Assistant"], ["social", "Social page"], ["profile", "Personal page"]];
const PROFESSOR_TABS = [["today", "Today"], ["homework", "Review queue"], ["calendar", "Calendar"], ["syllabus", "Course setup"], ["library", "Research & sources"], ["chat", "Assistant"], ["social", "Community"], ["profile", "Professor page"]];
const TOUR_STEPS = [
  { title: "Start with today", copy: "This is the quick view: classes, deadlines, progress, and the next thing that needs attention.", tryIt: "Open a card or update the status line, then continue when you are ready.", tab: "today", target: "panel-today" },
  { title: "Plan the work", copy: "Homework and review items stay together. Missed work remains visible until there is a new plan or it is finished.", tryIt: "Change an item’s status and watch the queue update.", tab: "homework", target: "panel-homework" },
  { title: "See the whole week", copy: "The calendar shows class dates, activities, and busy days before they become surprises.", tryIt: "Use the calendar controls and look for days with more than one item.", tab: "calendar", target: "panel-calendar" },
  { title: "Turn a syllabus into a plan", copy: "Paste or upload course information, check what was found, and approve the dates you want to keep.", tryIt: "Try the sample syllabus or change one of the details.", tab: "syllabus", target: "panel-syllabus" },
  { title: "Keep notes and sources close", copy: "Books, links, notes, and course files live beside the work they support.", tryIt: "Open a saved source and explore its details.", tab: "library", target: "panel-library" },
  { title: "Ask the workspace assistant", copy: "The assistant checks the material saved in this demo before it answers. It does not search the open internet here.", tryIt: "Choose a suggested question or ask about an assignment, person, or date.", tab: "chat", target: "panel-chat" },
  { title: "Connect with your community", copy: "The social page keeps class and campus updates in one place with clear audience controls.", tryIt: "Write a practice update, choose who can see it, or add a picture.", surface: "community", target: "surface-community" },
  { title: "Make the page yours", copy: "The personal page uses clean, colorful sections for school, people, interests, progress, and life outside class.", tryIt: "Open and close a section. Nothing disappears unless you choose to hide it.", surface: "profile", target: "surface-profile" },
  { title: "Look back without losing your place", copy: "The story view turns posts and milestones into an easy timeline. Back, forward, refresh, and Close work like a small browser inside EdNotebook.", tryIt: "Use the arrows above or move between Community, Personal page, and Story.", surface: "story", target: "surface-story" },
  { title: "Choose what belongs on your page", copy: "Visibility controls let you simplify the page without deleting the information behind it.", tryIt: "Toggle a card, restore everything, or close the drawer to finish.", tab: "today", target: "feature-drawer", drawer: true },
];

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

function WorkspaceSidebar({ persona, tab, setTab, features, professor, onOpenSurface }) {
  const tabs = professor ? PROFESSOR_TABS : WORKSPACE_TABS;
  const alertCount = persona.assignments.filter((item) => item.status === "needs-rescue").length;
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-profile-chip">
        <div className="workspace-avatar"><img src={persona.image} alt="" /><i /></div>
        <div><strong>{persona.shortName}</strong><span>{persona.institution}</span></div>
      </div>
      <nav aria-label={`${persona.shortName} demo sections`}>
        {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "is-active" : ""} onClick={() => ["social", "profile"].includes(id) ? onOpenSurface(id === "social" ? "community" : "profile") : setTab(id)}><span>{label}</span>{id === "homework" && alertCount > 0 && <i>{alertCount}</i>}</button>)}
      </nav>
      <div className="sidebar-availability-card">
        <strong>Independent mode</strong>
        <span>{professor ? "Organize courses, research, advising, and saved material without requiring another account." : "Upload syllabi and use planning, notes, workspace search, digital literacy, and financial literacy without a teacher account."}</span>
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
      <aside className="feature-drawer" aria-label="Customize profile cards" data-tour-section="feature-drawer">
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
  const current = TOUR_STEPS[step];
  return (
    <div className="tour-coach" role="dialog" aria-label="Brooke guided tour">
      <img src={PERSONAS.student.image} alt="Brooke" />
      <div>
        <span>Brooke’s tour · {step + 1}/{TOUR_STEPS.length}</span>
        <h3>{current.title}</h3>
        <p>{current.copy}</p>
        <div className="tour-try-it"><strong>Try it here</strong><span>{current.tryIt}</span></div>
        {persona.id !== "student" && <small>I’m showing you {persona.shortName}’s version of the same system.</small>}
        <footer><button type="button" onClick={onClose}>Close</button>{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Previous</button>}<button type="button" onClick={() => step === TOUR_STEPS.length - 1 ? onClose() : setStep(step + 1)}>{step === TOUR_STEPS.length - 1 ? "Finish" : "Next"}</button></footer>
      </div>
    </div>
  );
}

export { WORKSPACE_TABS, PROFESSOR_TABS, TOUR_STEPS, WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach };
