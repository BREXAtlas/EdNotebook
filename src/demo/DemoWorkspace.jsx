import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import FullscreenSurface from "../FullscreenSurface.jsx";
import AccountSettings, { readAccountSettings } from "../AccountSettings.jsx";
import { FEATURE_DEFAULTS, PERSONAS } from "./demoData.js";
import { safeRead } from "./demoShared.jsx";
import { tourStepsFor, WorkspaceHeader, WorkspaceSidebar, FeatureDrawer, TourCoach } from "./WorkspaceChrome.jsx";
import { TodayPanel, HomeworkPanel } from "./WorkspaceOverview.jsx";
import { CalendarPanel } from "./WorkspaceCalendar.jsx";
import { SyllabusPanel } from "./WorkspaceSyllabus.jsx";
import { SourcesPanel } from "./WorkspaceLibrary.jsx";
import { ChatPanel, SocialPanel, ProfilePanel, StoryPanel } from "./WorkspaceCommunityTools.jsx";

const LessonBuilder = lazy(() => import("../Builder.jsx"));

const SURFACE_PAGES = [
  { id: "community", label: "Community" },
  { id: "profile", label: "Personal page" },
  { id: "story", label: "Story" },
];

function DemoWorkspace({ personaId, signedIn = false }) {
  const persona = PERSONAS[personaId] || PERSONAS.student;
  const professor = persona.id === "professor";
  const [tab, setTab] = useState("today");
  const [assignments, setAssignments] = useState(persona.assignments);
  const [onlineStatus, setOnlineStatus] = useState(persona.status);
  const [statusLine, setStatusLine] = useState(persona.statusLine);
  const [features, setFeaturesState] = useState(() => safeRead(`ed-demo-${persona.id}-features`, FEATURE_DEFAULTS));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [tourCompleteOpen, setTourCompleteOpen] = useState(false);
  const [surfacePage, setSurfacePage] = useState(null);
  const [reminders, setRemindersState] = useState(() => safeRead(`ed-demo-${persona.id}-reminders`, { week: true, twoDays: true, twoHours: true, rescue: true }));
  const settingsScope = `demo-${persona.id}`;
  const tourSteps = useMemo(() => tourStepsFor(persona), [persona]);
  const [accountSettings, setAccountSettings] = useState(() => readAccountSettings(settingsScope, { accountType: professor ? "professor" : "student", name: persona.name, email: `${persona.shortName.toLowerCase()}@example.com`, bio: persona.profile.bio }));
  useEffect(() => {
    setTab("today");
    setAssignments(persona.assignments);
    setOnlineStatus(persona.status);
    setStatusLine(persona.statusLine);
    setFeaturesState(safeRead(`ed-demo-${persona.id}-features`, FEATURE_DEFAULTS));
    setTourStep(0);
    setTourOpen(true);
    setTourCompleteOpen(false);
    setSurfacePage(null);
    setAccountSettings(readAccountSettings(`demo-${persona.id}`, { accountType: professor ? "professor" : "student", name: persona.name, email: `${persona.shortName.toLowerCase()}@example.com`, bio: persona.profile.bio }));
  }, [persona.id, persona.assignments, persona.status, persona.statusLine]);
  useEffect(() => {
    if (!tourOpen) return undefined;
    const step = tourSteps[tourStep];
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
  }, [tourOpen, tourStep, tourSteps]);

  function signupLink() {
    const destination = professor ? "#/professor/dashboard" : `#/student/${persona.id === "k12" ? "k12" : "university"}/app`;
    const inviteCode = window.sessionStorage.getItem("ednotebook-invite-code");
    return `${destination}?signup=1${inviteCode ? `&ref=${encodeURIComponent(inviteCode)}` : ""}`;
  }

  function dashboardLink() {
    return professor ? "#/professor/dashboard" : `#/student/${persona.id === "k12" ? "k12" : "university"}/app`;
  }

  function finishTour() {
    setTourOpen(false);
    setTourCompleteOpen(true);
  }

  function tryFeaturedProduct() {
    setTourCompleteOpen(false);
    setSurfacePage(null);
    setTab(professor ? "lesson" : "syllabus");
  }

  function explorePersonalPage() {
    setTourCompleteOpen(false);
    setSurfacePage("profile");
  }
  function setFeatures(next) {
    setFeaturesState(next);
    window.localStorage.setItem(`ed-demo-${persona.id}-features`, JSON.stringify(next));
  }
  function setReminders(next) {
    setRemindersState(next);
    window.localStorage.setItem(`ed-demo-${persona.id}-reminders`, JSON.stringify(next));
  }
  return (
    <div className={`demo-page workspace-page ${accountSettings.showDescriptions ? "" : "is-description-light"}`}>
      <WorkspaceHeader persona={persona} accountSettings={accountSettings} onlineStatus={onlineStatus} setOnlineStatus={setOnlineStatus} statusLine={statusLine} setStatusLine={setStatusLine} onTour={() => { setTourStep(0); setTourOpen(true); }} onCustomize={() => setDrawerOpen(true)} />
      <div className="workspace-shell">
        <WorkspaceSidebar persona={persona} accountSettings={accountSettings} tab={tab} setTab={setTab} features={features} professor={professor} onOpenSurface={setSurfacePage} />
        <main className="workspace-main" data-tour-section={`panel-${tab}`}>
          {tab === "today" && <TodayPanel persona={persona} assignments={assignments} setAssignments={setAssignments} features={features} onlineStatus={onlineStatus} statusLine={statusLine} onOpenCalendar={() => setTab("calendar")} onOpenMessages={() => setTab("chat")} />}
          {tab === "homework" && <HomeworkPanel persona={persona} assignments={assignments} setAssignments={setAssignments} reminders={reminders} setReminders={setReminders} />}
          {tab === "calendar" && <CalendarPanel persona={persona} assignments={assignments} />}
          {tab === "syllabus" && <SyllabusPanel persona={persona} assignments={assignments} setAssignments={setAssignments} />}
          {tab === "lesson" && <Suspense fallback={<div className="guest-product-loading">Opening the lesson creator…</div>}><LessonBuilder guest={!signedIn} lockedView="professor" onSignup={() => { window.location.hash = signupLink(); }} /></Suspense>}
          {tab === "library" && <SourcesPanel persona={persona} />}
          {tab === "chat" && <ChatPanel persona={persona} assignments={assignments} accountSettings={accountSettings} settingsScope={settingsScope} />}
          {tab === "social" && <SocialPanel persona={persona} statusLine={statusLine} setStatusLine={setStatusLine} accountSettings={accountSettings} />}
          {tab === "profile" && <ProfilePanel persona={persona} features={features} onlineStatus={onlineStatus} statusLine={statusLine} accountSettings={accountSettings} />}
          {tab === "settings" && <AccountSettings scope={settingsScope} accountType={professor ? "professor" : "student"} settings={accountSettings} onSettingsChange={setAccountSettings} compact />}
        </main>
      </div>
      <footer className="workspace-footer"><span>Interactive sample workspace</span><nav><a href="#/presentation">Presentation</a><a href="#/about">About & values</a><a href="#/careers">Work with us</a><a href="#/tour">Switch demo</a></nav></footer>
      <FeatureDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} features={features} setFeatures={setFeatures} />
      <TourCoach open={tourOpen} step={tourStep} setStep={setTourStep} onClose={() => setTourOpen(false)} onFinish={finishTour} persona={persona} steps={tourSteps} />
      {tourCompleteOpen && <div className="tour-signup-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-signup-title"><section className="tour-signup-card"><img src={persona.image} alt="" /><span>TOUR COMPLETE</span><h2 id="tour-signup-title">Choose what to do next.</h2><p>{signedIn ? "Your workspace is ready. Go to your dashboard, try the featured tool, or explore the sample page." : `Try the ${professor ? "lesson creator" : "syllabus scanner"} now, explore the sample page, or create a free account when you want to save.`}</p><div className="tour-next-actions">{signedIn ? <a href={dashboardLink()}>Go to my dashboard</a> : <a href={signupLink()}>Create free account</a>}<button type="button" onClick={tryFeaturedProduct}>Try the {professor ? "lesson creator" : "syllabus scanner"}</button><button type="button" onClick={explorePersonalPage}>Explore {persona.shortName}'s sample page</button><button type="button" onClick={() => { setTourCompleteOpen(false); setTab("today"); }}>Return to workspace</button></div><small>{signedIn ? "Nothing in this tour changes your saved work unless you choose to save it." : "Guest exploration stays on this device until you create an account."}</small></section></div>}
      {surfacePage && <FullscreenSurface key={surfacePage} title={`${persona.shortName} · EdNotebook`} pages={SURFACE_PAGES} initialPage={surfacePage} onClose={() => setSurfacePage(null)} renderPage={(page) => {
        if (page === "community") return <SocialPanel persona={persona} statusLine={statusLine} setStatusLine={setStatusLine} accountSettings={accountSettings} />;
        if (page === "story") return <StoryPanel persona={persona} />;
        return <ProfilePanel persona={persona} features={features} onlineStatus={onlineStatus} statusLine={statusLine} accountSettings={accountSettings} />;
      }} />}
    </div>
  );
}

export default DemoWorkspace;
