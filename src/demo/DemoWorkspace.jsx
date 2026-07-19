import { useEffect, useState } from "react";
import FullscreenSurface from "../FullscreenSurface.jsx";
import { FEATURE_DEFAULTS, PERSONAS } from "./demoData.js";
import { safeRead } from "./demoShared.jsx";
import { TOUR_STEPS, WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach } from "./WorkspaceChrome.jsx";
import { TodayPanel, HomeworkPanel } from "./WorkspaceOverview.jsx";
import { CalendarPanel } from "./WorkspaceCalendar.jsx";
import { SyllabusPanel } from "./WorkspaceSyllabus.jsx";
import { SourcesPanel } from "./WorkspaceLibrary.jsx";
import { ChatPanel, SocialPanel, ProfilePanel, StoryPanel } from "./WorkspaceCommunityTools.jsx";

const SURFACE_PAGES = [
  { id: "community", label: "Community" },
  { id: "profile", label: "Personal page" },
  { id: "story", label: "Story" },
];

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
  const [surfacePage, setSurfacePage] = useState(null);
  const [reminders, setRemindersState] = useState(() => safeRead(`ed-demo-${persona.id}-reminders`, { week: true, twoDays: true, twoHours: true, rescue: true }));
  useEffect(() => {
    setTab("today");
    setAssignments(persona.assignments);
    setOnlineStatus(persona.status);
    setStatusLine(persona.statusLine);
    setFeaturesState(safeRead(`ed-demo-${persona.id}-features`, FEATURE_DEFAULTS));
    setTourStep(0);
    setTourOpen(persona.id === "student");
    setSurfacePage(null);
  }, [persona.id, persona.assignments, persona.status, persona.statusLine]);
  useEffect(() => {
    if (!tourOpen) return undefined;
    const step = TOUR_STEPS[tourStep];
    if (step.surface) {
      setDrawerOpen(false);
      setSurfacePage(step.surface);
    } else {
      setSurfacePage(null);
      if (step.tab) setTab(step.tab);
      setDrawerOpen(Boolean(step.drawer));
    }
    const timer = window.setTimeout(() => {
      document.querySelectorAll(".tour-focus").forEach((node) => node.classList.remove("tour-focus"));
      const target = document.querySelector(`[data-tour-section="${step.target}"]`);
      if (!target) return;
      target.classList.add("tour-focus");
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      document.querySelectorAll(".tour-focus").forEach((node) => node.classList.remove("tour-focus"));
    };
  }, [tourOpen, tourStep]);
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
        <WorkspaceSidebar persona={persona} tab={tab} setTab={setTab} features={features} professor={professor} onOpenSurface={setSurfacePage} />
        <main className="workspace-main" data-tour-section={`panel-${tab}`}>
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
      {surfacePage && <FullscreenSurface key={surfacePage} title={`${persona.shortName} · EdNotebook`} pages={SURFACE_PAGES} initialPage={surfacePage} onClose={() => setSurfacePage(null)} renderPage={(page) => {
        if (page === "community") return <SocialPanel persona={persona} statusLine={statusLine} setStatusLine={setStatusLine} />;
        if (page === "story") return <StoryPanel persona={persona} />;
        return <ProfilePanel persona={persona} features={features} onlineStatus={onlineStatus} statusLine={statusLine} />;
      }} />}
    </div>
  );
}

export default DemoWorkspace;
