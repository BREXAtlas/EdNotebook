import { useEffect, useState } from "react";
import { FEATURE_DEFAULTS, PERSONAS } from "./demoData.js";
import { safeRead } from "./demoShared.jsx";
import { WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach } from "./WorkspaceChrome.jsx";
import { TodayPanel, HomeworkPanel } from "./WorkspaceOverview.jsx";
import { CalendarPanel, SyllabusPanel, SourcesPanel } from "./WorkspaceAcademicTools.jsx";
import { ChatPanel, SocialPanel, ProfilePanel } from "./WorkspaceCommunityTools.jsx";

function DemoWorkspace({ personaId }) {
  const persona = PERSONAS[personaId] || PERSONAS.student;
  const professor = persona.id === "professor";
  const [tab, setTab] = useState("today");
  const [assignments, setAssignments] = useState(persona.assignments);
  const [onlineStatus, setOnlineStatus] = useState(persona.status);
  const [statusLine, setStatusLine] = useState(persona.statusLine);
  const [features, setFeaturesState] = useState(() => safeRead(`ed-demo-${persona.id}-features`, FEATURE_DEFAULTS));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(persona.id === "student");
  const [tourStep, setTourStep] = useState(0);
  const [reminders, setRemindersState] = useState(() => safeRead(`ed-demo-${persona.id}-reminders`, { week: true, twoDays: true, twoHours: true, rescue: true }));
  useEffect(() => {
    setTab("today");
    setAssignments(persona.assignments);
    setOnlineStatus(persona.status);
    setStatusLine(persona.statusLine);
    setFeaturesState(safeRead(`ed-demo-${persona.id}-features`, FEATURE_DEFAULTS));
    setTourStep(0);
    setTourOpen(persona.id === "student");
  }, [persona.id]);
  function setFeatures(next) {
    setFeaturesState(next);
    window.localStorage.setItem(`ed-demo-${persona.id}-features`, JSON.stringify(next));
  }
  function setReminders(next) {
    setRemindersState(next);
    window.localStorage.setItem(`ed-demo-${persona.id}-reminders`, JSON.stringify(next));
  }
  return (
    <div className="demo-page workspace-page">
      <WorkspaceHeader persona={persona} onlineStatus={onlineStatus} setOnlineStatus={setOnlineStatus} statusLine={statusLine} setStatusLine={setStatusLine} onTour={() => { setTourStep(0); setTourOpen(true); }} onCustomize={() => setDrawerOpen(true)} />
      <div className="workspace-shell">
        <WorkspaceSidebar persona={persona} tab={tab} setTab={setTab} features={features} professor={professor} />
        <main className="workspace-main">
          {tab === "today" && <TodayPanel persona={persona} assignments={assignments} setAssignments={setAssignments} features={features} onlineStatus={onlineStatus} statusLine={statusLine} />}
          {tab === "homework" && <HomeworkPanel persona={persona} assignments={assignments} setAssignments={setAssignments} reminders={reminders} setReminders={setReminders} />}
          {tab === "calendar" && <CalendarPanel persona={persona} assignments={assignments} />}
          {tab === "syllabus" && <SyllabusPanel persona={persona} assignments={assignments} setAssignments={setAssignments} />}
          {tab === "library" && <SourcesPanel persona={persona} />}
          {tab === "chat" && <ChatPanel persona={persona} assignments={assignments} />}
          {tab === "social" && <SocialPanel persona={persona} statusLine={statusLine} setStatusLine={setStatusLine} />}
          {tab === "profile" && <ProfilePanel persona={persona} features={features} onlineStatus={onlineStatus} statusLine={statusLine} />}
        </main>
      </div>
      <footer className="workspace-footer"><span>Fictional interactive demo · not an official academic record</span><nav><a href="#/presentation">Presentation</a><a href="#/about">About & values</a><a href="#/careers">Work with us</a><a href="#/tour">Switch demo</a></nav></footer>
      <FeatureDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} features={features} setFeatures={setFeatures} />
      <TourCoach open={tourOpen} step={tourStep} setStep={setTourStep} onClose={() => setTourOpen(false)} persona={persona} />
    </div>
  );
}

export default DemoWorkspace;
