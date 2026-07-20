import { useState } from "react";
import BrandLogo from "../Brand.jsx";
import { LiveDateTime } from "../AccountSettings.jsx";
import { FEATURE_DEFAULTS } from "./demoData.js";
import { cx, NotebookLabel, VerifiedBadge } from "./demoShared.jsx";

const WORKSPACE_TABS = [["today", "Today"], ["homework", "Homework & due dates"], ["calendar", "Calendar"], ["syllabus", "Syllabus upload"], ["library", "Notes & sources"], ["chat", "Assistant"], ["social", "Social page"], ["profile", "Personal page"]];
const PROFESSOR_TABS = [["today", "Today"], ["syllabus", "Syllabus scanner"], ["lesson", "Lesson creator"], ["homework", "Review queue"], ["calendar", "Calendar"], ["library", "Research & sources"], ["chat", "Assistant"], ["social", "Community"], ["profile", "Professor page"]];
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

const PROFESSOR_TOUR_STEPS = [
  { title: "Extract the syllabus in about 60 seconds", copy: "Upload the source, inspect every date and course detail, and edit the review before saving a clean course plan.", tryIt: "Use a sample or upload a file and change one extracted detail.", tab: "syllabus", target: "panel-syllabus" },
  { title: "Shape a lesson in under five minutes", copy: "Build the lesson from the same teaching workspace, then keep editing until the plan fits your class.", tryIt: "Choose an objective and add or adjust one activity.", tab: "lesson", target: "panel-lesson" },
  { title: "Run the day", copy: "Courses, review work, advising, and the next teaching task are gathered into one practical view.", tryIt: "Open a course card and check the next action.", tab: "today", target: "panel-today" },
  { title: "Review student work", copy: "Pending, missing, and finalized work stays visible with the class and grading scale.", tryIt: "Change a review item status and watch the queue update.", tab: "homework", target: "panel-homework" },
  { title: "See the teaching calendar", copy: "Course dates, office hours, and busy weeks remain easy to scan.", tryIt: "Move through the calendar and inspect a busy date.", tab: "calendar", target: "panel-calendar" },
  { title: "Keep research and sources close", copy: "Sources, notes, course files, and citation details stay beside the work they support.", tryIt: "Open a source and review its details.", tab: "library", target: "panel-library" },
  { title: "Use the workspace assistant", copy: "Ask about saved courses, deadlines, and teaching materials in plain language.", tryIt: "Ask for the next deadline or choose a suggested question.", tab: "chat", target: "panel-chat" },
  { title: "Connect with faculty", copy: "The faculty area keeps educator updates together without mixing private student work.", tryIt: "Open a post or write a practice update.", surface: "community", target: "surface-community" },
  { title: "Build your professor page", copy: "Your teaching page can collect courses, interests, links, and highlights in clean sections.", tryIt: "Open and close a section to see how the page works.", surface: "profile", target: "surface-profile" },
  { title: "Choose what appears", copy: "Visibility controls simplify the page without deleting the information behind it.", tryIt: "Toggle a card, restore everything, or finish the tour.", tab: "today", target: "feature-drawer", drawer: true },
];

function tourStepsFor(persona) {
  if (persona?.id === "professor") return PROFESSOR_TOUR_STEPS;
  const syllabus = TOUR_STEPS.find((step) => step.tab === "syllabus");
  return [
    { ...syllabus, title: "Scan the syllabus first", copy: "Upload a PDF, Word file, text file, or paper scan. Check the review before anything reaches your calendar." },
    ...TOUR_STEPS.filter((step) => step !== syllabus),
  ];
}

function WorkspaceHeader({ persona, accountSettings, onlineStatus, setOnlineStatus, statusLine, setStatusLine, onTour, onCustomize }) {
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
        <div><strong>{accountSettings?.displayName || persona.name}</strong><span>{persona.roleLine}</span></div>
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
        {editing ? <div className="status-editor"><input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Status update" /><button type="button" onClick={saveStatus}>Save status update</button></div> : <button className="status-line-button" type="button" onClick={() => setEditing(true)}>{statusLine}</button>}
      </div>
      <div className="workspace-header-actions">
        <LiveDateTime />
        <button type="button" onClick={onCustomize}>Customize cards</button>
        <button type="button" onClick={onTour}>Guided tour</button>
        <a href="#/presentation">Presentation</a>
      </div>
    </header>
  );
}

function WorkspaceSidebar({ persona, accountSettings, tab, setTab, features, professor, onOpenSurface }) {
  const tabs = professor ? PROFESSOR_TABS : WORKSPACE_TABS;
  const alertCount = persona.assignments.filter((item) => item.status === "needs-rescue").length;
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-profile-chip">
        <div className="workspace-avatar"><img src={persona.image} alt="" /><i /></div>
        <div><strong>{accountSettings?.displayName || persona.shortName}</strong><span>{persona.institution}</span></div>
      </div>
      <nav aria-label={`${persona.shortName} demo sections`}>
        {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? "is-active" : ""} onClick={() => ["social", "profile"].includes(id) ? onOpenSurface(id === "social" ? "community" : "profile") : setTab(id)}><span>{label}</span>{id === "homework" && alertCount > 0 && <i>{alertCount}</i>}</button>)}
      </nav>
      <div className="sidebar-availability-card">
        <strong>Independent mode</strong>
        <span>{professor ? "Organize courses, research, advising, and saved material without requiring another account." : "Upload syllabi and use planning, notes, workspace search, digital literacy, and financial literacy without a teacher account."}</span>
      </div>
      <button className={cx("sidebar-settings-button", tab === "settings" && "is-active")} type="button" onClick={() => setTab("settings")}><span>Settings</span><small>Profile, assistant, privacy, billing</small></button>
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

function TourCoach({ open, step, setStep, onClose, onFinish, persona, steps = tourStepsFor(persona) }) {
  if (!open) return null;
  const current = steps[step];
  return (
    <div className="tour-coach" role="dialog" aria-label={`${persona.shortName} guided tour`}>
      <img src={persona.image} alt={persona.shortName} />
      <div>
        <span className="tour-host-label">{persona.shortName}&apos;s tour · {step + 1}/{steps.length}</span>
        <h3>{current.title}</h3>
        <p>{current.copy}</p>
        <div className="tour-try-it"><strong>Try it here</strong><span>{current.tryIt}</span></div>
        <footer><button type="button" onClick={onClose}>Close tour</button>{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Previous tour step</button>}<button type="button" onClick={() => step === steps.length - 1 ? (onFinish || onClose)() : setStep(step + 1)}>{step === steps.length - 1 ? "Finish tour" : "Next tour step"}</button></footer>
      </div>
    </div>
  );
}

export { WORKSPACE_TABS, PROFESSOR_TABS, TOUR_STEPS, PROFESSOR_TOUR_STEPS, tourStepsFor, WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach };
