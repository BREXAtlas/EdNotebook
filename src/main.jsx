import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import MotionFrame from "./MotionFrame.jsx";
import PortalHome from "./portal/PortalHome.jsx";
import SiteFooter from "./SiteFooter.jsx";
import "./index.css";
import "./portal/portal.css";
import "./site-navigation.css";

const Landing = lazy(() => import("./Landing.jsx"));
const Builder = lazy(() => import("./Builder.jsx"));
const CourseStart = lazy(() => import("./CourseStart.jsx"));
const CourseJourneyShell = lazy(() => import("./CourseJourneyShell.jsx"));
const LearningStudio = lazy(() => import("./studio/LearningStudio.jsx"));
const StudentAudienceChooser = lazy(() => import("./portal/StudentAudienceChooser.jsx"));
const StudentLanding = lazy(() => import("./portal/StudentLanding.jsx"));
const PublishingLanding = lazy(() => import("./portal/PublishingLanding.jsx"));
const StudentDashboard = lazy(() => import("./portal/StudentDashboard.jsx"));
const ProfessorDashboard = lazy(() => import("./portal/ProfessorDashboard.jsx"));
const PlatformAdminDashboard = lazy(() => import("./portal/PlatformAdminDashboard.jsx"));
const PasswordUpdate = lazy(() => import("./portal/PasswordUpdate.jsx"));
const DemoExperience = lazy(() => import("./demo/DemoExperience.jsx"));
const PublicCourseExperience = lazy(() => import("./PublicCourseExperience.jsx"));
const CourseJoinExperience = lazy(() => import("./CourseJoinExperience.jsx"));

function routeParams(route = window.location.hash) {
  return new URLSearchParams(route.split("?")[1] || "");
}

function signupRoute(path) {
  const inviteCode = window.sessionStorage.getItem("ednotebook-invite-code");
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}signup=1${inviteCode ? `&ref=${encodeURIComponent(inviteCode)}` : ""}`;
}

function RouteLoading() { return <main className="portal-route-loading" aria-live="polite"><strong>EdNotebook</strong><span>Opening your portal…</span></main>; }

function SkipToContent() {
  const focusMain = (event) => {
    event.preventDefault();
    const main = document.querySelector("main");
    if (!main) return;
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: false });
  };
  return <a className="skip-to-content" href="#main-content" onClick={focusMain}>Skip to main content</a>;
}

function Router() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => { const onHash = () => setRoute(window.location.hash || "#/"); window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector("main");
      if (!main) return;
      main.id = "main-content";
      main.tabIndex = -1;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route]);
  useEffect(() => {
    const inviteCode = routeParams(route).get("ref")?.trim().toUpperCase();
    if (inviteCode) window.sessionStorage.setItem("ednotebook-invite-code", inviteCode);
  }, [route]);
  const navigate = (next) => { window.location.hash = next; };

  function studentDashboard(track) {
    const returnTo = route.startsWith(`#/student/${track}/app`) || (track === "university" && route.startsWith("#/student/app")) ? route : `#/student/${track}/app`;
    return <AuthGate accountType="student" educationTrack={track} returnTo={returnTo}>{({ profile, session }) => <MotionFrame routeKey={`student-${track}-dashboard`}><StudentDashboard profile={profile} session={session} track={track} onHome={() => navigate(`#/students/${track}`)} onProfessorPortal={() => navigate("#/professors")} /></MotionFrame>}</AuthGate>;
  }

  function studentLanding(track) {
    return <MotionFrame routeKey={`student-${track}-landing`}><StudentLanding track={track} onSignup={() => navigate(signupRoute(`#/student/${track}/app`))} onEnter={(course) => { if (course) window.sessionStorage.setItem("ednotebook-requested-course", JSON.stringify({ id: course.id, schoolId: course.school.id, track })); navigate(`#/student/${track}/app`); }} /></MotionFrame>;
  }

  if (route.startsWith("#/tour") || route.startsWith("#/presentation") || route.startsWith("#/about") || route.startsWith("#/careers")) {
    return <MotionFrame routeKey={route}><DemoExperience route={route} /></MotionFrame>;
  }

  if (route.startsWith("#/course-live/")) {
    const shareCode = route.split("/")[2]?.split("?")[0] || "";
    return <PublicCourseExperience shareCode={shareCode} />;
  }

  if (route.startsWith("#/join/")) {
    const token = route.split("/")[2]?.split("?")[0] || "";
    return <CourseJoinExperience token={token} />;
  }

  if (route.startsWith("#/account/update-password")) return <MotionFrame routeKey="password-update"><PasswordUpdate /></MotionFrame>;

  if (route.startsWith("#/student/k12/app")) return studentDashboard("k12");
  if (route.startsWith("#/student/university/app") || route.startsWith("#/student/app")) return studentDashboard("university");

  if (route.startsWith("#/admin")) {
    return <AuthGate accountType="professor" returnTo="#/admin" allowedRoles={["admin", "owner"]} allowSignup={false}>{() => <MotionFrame routeKey="platform-admin"><PlatformAdminDashboard onHome={() => navigate("#/")} onEducatorPortal={() => navigate("#/professor/dashboard")} /></MotionFrame>}</AuthGate>;
  }

  if (route.startsWith("#/professor/dashboard")) {
    return <AuthGate accountType="professor" returnTo={route}>{({ profile, session }) => <MotionFrame routeKey="professor-dashboard"><ProfessorDashboard profile={profile} session={session} onHome={() => navigate("#/professors")} onBuild={() => navigate("#/app")} onLesson={() => navigate("#/app/builder")} onStudentPortal={() => navigate("#/students")} onAdmin={() => navigate("#/admin")} /></MotionFrame>}</AuthGate>;
  }

  if (route.startsWith("#/app/studio")) return <AuthGate accountType="professor" returnTo="#/app/studio?tab=materials"><MotionFrame routeKey={route}><LearningStudio onBack={() => navigate("#/app/builder")} onCourseSetup={() => navigate("#/app")} /></MotionFrame></AuthGate>;
  if (route.startsWith("#/app/builder")) return <AuthGate accountType="professor" returnTo="#/app/builder"><MotionFrame routeKey="builder"><CourseJourneyShell onBack={() => navigate("#/app")} onStudio={() => navigate("#/app/studio?tab=materials")}><Builder /></CourseJourneyShell></MotionFrame></AuthGate>;
  if (route.startsWith("#/app")) return <AuthGate accountType="professor" returnTo="#/app"><MotionFrame routeKey="course-start"><CourseStart onContinue={() => navigate("#/app/builder")} onHome={() => navigate("#/")} /></MotionFrame></AuthGate>;

  if (route.startsWith("#/students/k12")) return studentLanding("k12");
  if (route.startsWith("#/students/university")) return studentLanding("university");
  if (route === "#/students" || route === "#/students/") return <MotionFrame routeKey="student-audience"><StudentAudienceChooser /></MotionFrame>;
  if (route.startsWith("#/students")) return studentLanding("university");

  if (route.startsWith("#/publishers")) return <MotionFrame routeKey="publishing-landing"><PublishingLanding onEnter={() => navigate("#/app/studio?tab=reader")} /></MotionFrame>;
  if (route.startsWith("#/professors")) return <MotionFrame routeKey="professor-landing"><Landing onSignup={() => navigate(signupRoute("#/professor/dashboard"))} onEnter={() => navigate("#/app")} onDashboard={() => navigate("#/professor/dashboard")} onStudentPortal={() => navigate("#/students")} onPublishingPortal={() => navigate("#/publishers")} /></MotionFrame>;
  return <MotionFrame routeKey="portal-home"><PortalHome /></MotionFrame>;
}

document.body.setAttribute("spellcheck", "true");
try { document.documentElement.dataset.layoutMode = window.localStorage.getItem("ednotebook-layout-mode") || "auto"; } catch { document.documentElement.dataset.layoutMode = "auto"; }
createRoot(document.getElementById("root")).render(<><SkipToContent /><Suspense fallback={<RouteLoading />}><Router /><SiteFooter /></Suspense></>);
