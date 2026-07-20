import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import MotionFrame from "./MotionFrame.jsx";
import PortalHome from "./portal/PortalHome.jsx";
import "./index.css";
import "./portal/portal.css";

const Landing = lazy(() => import("./Landing.jsx"));
const Builder = lazy(() => import("./Builder.jsx"));
const CourseStart = lazy(() => import("./CourseStart.jsx"));
const CourseJourneyShell = lazy(() => import("./CourseJourneyShell.jsx"));
const LearningStudio = lazy(() => import("./studio/LearningStudio.jsx"));
const CoursePackageStudio = lazy(() => import("./course-runtime/ConnectedCoursePackageStudio.jsx"));
const CourseRuntimePage = lazy(() => import("./course-runtime/CourseRuntimePage.jsx"));
const StudentAudienceChooser = lazy(() => import("./portal/StudentAudienceChooser.jsx"));
const StudentLanding = lazy(() => import("./portal/StudentLanding.jsx"));
const PublishingLanding = lazy(() => import("./portal/PublishingLanding.jsx"));
const StudentDashboard = lazy(() => import("./portal/ConnectedStudentDashboard.jsx"));
const ProfessorDashboard = lazy(() => import("./portal/ProfessorDashboard.jsx"));
const PlatformAdminDashboard = lazy(() => import("./portal/PlatformAdminDashboard.jsx"));
const PasswordUpdate = lazy(() => import("./portal/PasswordUpdate.jsx"));
const DemoExperience = lazy(() => import("./demo/DemoExperience.jsx"));
const BusinessPresentation = lazy(() => import("./business/BusinessPresentation.jsx"));

function RouteLoading() { return <main className="portal-route-loading" aria-live="polite"><strong>EdNotebook</strong><span>Opening your portal…</span></main>; }

function Router() {
  const [route, setRoute] = useState(window.location.hash || "#/");
  useEffect(() => { const onHash = () => setRoute(window.location.hash || "#/"); window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  const navigate = (next) => { window.location.hash = next; };

  function studentDashboard(track) {
    const returnTo = `#/student/${track}/app`;
    return <AuthGate accountType="student" educationTrack={track} returnTo={returnTo}>{({ profile, session }) => <MotionFrame routeKey={`student-${track}-dashboard`}><StudentDashboard profile={profile} session={session} track={track} onHome={() => navigate(`#/students/${track}`)} onProfessorPortal={() => navigate("#/professors")} /></MotionFrame>}</AuthGate>;
  }

  function studentLanding(track) {
    return <MotionFrame routeKey={`student-${track}-landing`}><StudentLanding track={track} onEnter={(course) => { if (course) window.sessionStorage.setItem("ednotebook-requested-course", JSON.stringify({ id: course.id, schoolId: course.school.id, track })); navigate(`#/student/${track}/app`); }} /></MotionFrame>;
  }

  if (route.startsWith("#/business-presentation") || route.startsWith("#/business")) return <MotionFrame routeKey="business-presentation"><BusinessPresentation /></MotionFrame>;
  if (route.startsWith("#/tour") || route.startsWith("#/presentation") || route.startsWith("#/about") || route.startsWith("#/careers")) return <MotionFrame routeKey={route}><DemoExperience route={route} /></MotionFrame>;
  if (route.startsWith("#/account/update-password")) return <MotionFrame routeKey="password-update"><PasswordUpdate /></MotionFrame>;

  const courseRoute = route.match(/^#\/student\/(?:university\/|k12\/)?course\/([0-9a-f-]{36})/i) || route.match(/^#\/student\/course\/([0-9a-f-]{36})/i);
  if (courseRoute) {
    const track = route.includes("/k12/") ? "k12" : "university";
    const publicationId = courseRoute[1];
    return <AuthGate accountType="student" educationTrack={track} returnTo={route}>{({ profile, session }) => <CourseRuntimePage publicationId={publicationId} profile={profile} session={session} track={track} onBack={() => navigate(`#/student/${track}/app`)} />}</AuthGate>;
  }

  if (route.startsWith("#/student/k12/app")) return studentDashboard("k12");
  if (route.startsWith("#/student/university/app") || route.startsWith("#/student/app")) return studentDashboard("university");

  if (route.startsWith("#/admin")) return <AuthGate accountType="professor" returnTo="#/admin" allowedRoles={["admin", "owner"]} allowSignup={false}>{() => <MotionFrame routeKey="platform-admin"><PlatformAdminDashboard onHome={() => navigate("#/")} onEducatorPortal={() => navigate("#/professor/dashboard")} /></MotionFrame>}</AuthGate>;

  if (route.startsWith("#/professor/dashboard")) return <AuthGate accountType="professor" returnTo="#/professor/dashboard">{({ profile, session }) => <MotionFrame routeKey="professor-dashboard"><ProfessorDashboard profile={profile} session={session} onHome={() => navigate("#/professors")} onBuild={() => navigate("#/app")} onStudentPortal={() => navigate("#/students")} onAdmin={() => navigate("#/admin")} /></MotionFrame>}</AuthGate>;

  if (route.startsWith("#/app/course-output")) return <AuthGate accountType="professor" returnTo="#/app/course-output">{({ session }) => <CoursePackageStudio session={session} onBack={() => navigate("#/app/builder")} onOpenStudentCourse={(publicationId) => navigate(`#/student/course/${publicationId}`)} />}</AuthGate>;
  if (route.startsWith("#/app/studio")) return <AuthGate accountType="professor" returnTo="#/app/studio?tab=materials"><MotionFrame routeKey={route}><LearningStudio onBack={() => navigate("#/app/builder")} onCourseSetup={() => navigate("#/app")} /></MotionFrame></AuthGate>;
  if (route.startsWith("#/app/builder")) return <AuthGate accountType="professor" returnTo="#/app/builder"><MotionFrame routeKey="builder"><CourseJourneyShell onBack={() => navigate("#/app")} onStudio={() => navigate("#/app/studio?tab=materials")} onCourseOutput={() => navigate("#/app/course-output")}><Builder /></CourseJourneyShell></MotionFrame></AuthGate>;
  if (route.startsWith("#/app")) return <AuthGate accountType="professor" returnTo="#/app"><MotionFrame routeKey="course-start"><CourseStart onContinue={() => navigate("#/app/builder")} onHome={() => navigate("#/")} /></MotionFrame></AuthGate>;

  if (route.startsWith("#/students/k12")) return studentLanding("k12");
  if (route.startsWith("#/students/university")) return studentLanding("university");
  if (route === "#/students" || route === "#/students/") return <MotionFrame routeKey="student-audience"><StudentAudienceChooser /></MotionFrame>;
  if (route.startsWith("#/students")) return studentLanding("university");

  if (route.startsWith("#/publishers")) return <MotionFrame routeKey="publishing-landing"><PublishingLanding onEnter={() => navigate("#/app/studio?tab=reader")} /></MotionFrame>;
  if (route.startsWith("#/professors")) return <MotionFrame routeKey="professor-landing"><Landing onEnter={() => navigate("#/app")} onDashboard={() => navigate("#/professor/dashboard")} onStudentPortal={() => navigate("#/students")} onPublishingPortal={() => navigate("#/publishers")} /></MotionFrame>;
  return <MotionFrame routeKey="portal-home"><PortalHome /></MotionFrame>;
}

document.body.setAttribute("spellcheck", "true");
createRoot(document.getElementById("root")).render(<Suspense fallback={<RouteLoading />}><Router /></Suspense>);