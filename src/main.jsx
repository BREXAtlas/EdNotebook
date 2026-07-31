import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import EnvironmentBanner from "./EnvironmentBanner.jsx";
import MotionFrame from "./MotionFrame.jsx";
import PortalHome from "./portal/PortalHome.jsx";
import { FeatureBoundary, FeatureManifestProvider } from "./admin-control/FeatureBoundary.jsx";
import { installEnvironmentStorageNamespace } from "./storage/environmentStorage.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import "./index.css";
import "./portal/portal.css";

const Landing = lazy(() => import("./Landing.jsx"));
const CourseOutlineBuilder = lazy(() => import("./ai/CourseOutlineBuilder.jsx"));
const SyllabusToCourse = lazy(() => import("./ai/SyllabusToCourse.jsx"));
const CourseStart = lazy(() => import("./CourseStart.jsx"));
const CourseJourneyShell = lazy(() => import("./CourseJourneyShell.jsx"));
const LearningStudio = lazy(() => import("./studio/LearningStudio.jsx"));
const CoursePackageStudio = lazy(() => import("./course-runtime/ConnectedCoursePackageStudio.jsx"));
const CourseRuntimePage = lazy(() => import("./course-runtime/CourseRuntimePage.jsx"));
const StudentAudienceChooser = lazy(() => import("./portal/StudentAudienceChooser.jsx"));
const StudentLanding = lazy(() => import("./portal/StudentLanding.jsx"));
const PublishingLanding = lazy(() => import("./portal/PublishingLanding.jsx"));
const LibraryBookPage = lazy(() => import("./studio/LibraryBookPage.jsx"));
const StudentDashboard = lazy(() => import("./portal/ConnectedStudentDashboard.jsx"));
const ProfessorDashboard = lazy(() => import("./portal/ProfessorDashboard.jsx"));
const PlatformAdminDashboard = lazy(() => import("./portal/PlatformAdminDashboard.jsx"));
const PasswordUpdate = lazy(() => import("./portal/PasswordUpdate.jsx"));
const DemoExperience = lazy(() => import("./demo/DemoExperience.jsx"));
const BusinessPresentation = lazy(() => import("./business/BusinessPresentation.jsx"));
const LtiOwnerSetup = lazy(() => import("./integrations/lti/LtiOwnerSetup.jsx"));
const LtiLaunchWorkspace = lazy(() => import("./integrations/lti/LtiLaunchWorkspace.jsx"));
const AdminControlCenter = lazy(() => import("./admin-control/AdminControlCenter.jsx"));
const InstitutionAccessPage = lazy(() => import("./admin-control/InstitutionAccessPage.jsx"));
const TosIntegrationPreview = lazy(() => import("./integrations/tos/TosIntegrationPreview.jsx"));
const SyntheticInstitutionPilot = lazy(() => import("./integrations/tos/SyntheticInstitutionPilot.jsx"));

function RouteLoading() { return <main className="portal-route-loading" aria-live="polite"><strong>EdNotebook</strong><span>Opening your portal…</span></main>; }

function Router() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      if (!window.location.hash.startsWith("#/account/update-password") && !window.location.hash.startsWith("#/reset-password")) window.location.hash = "#/account/update-password";
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const navigate = (next) => { window.location.hash = next; };

  function studentDashboard(track) {
    const returnTo = `#/student/${track}/app`;
    return <AuthGate accountType="student" educationTrack={track} returnTo={returnTo}>{({ profile, session }) => <FeatureManifestProvider pathway="student"><FeatureBoundary featureKey="student.dashboard"><MotionFrame routeKey={`student-${track}-dashboard`}><StudentDashboard profile={profile} session={session} track={track} onHome={() => navigate(`#/students/${track}`)} /></MotionFrame></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;
  }

  function studentLanding(track) {
    return <MotionFrame routeKey={`student-${track}-landing`}><StudentLanding track={track} onEnter={(course) => { if (course) window.sessionStorage.setItem("ednotebook-requested-course", JSON.stringify({ id: course.id, schoolId: course.school.id, track })); navigate(`#/student/${track}/app`); }} /></MotionFrame>;
  }

  if (route.startsWith("#/business-presentation") || route.startsWith("#/business")) return <MotionFrame routeKey="business-presentation"><BusinessPresentation /></MotionFrame>;
  if (route.startsWith("#/tour") || route.startsWith("#/presentation") || route.startsWith("#/about") || route.startsWith("#/careers")) return <MotionFrame routeKey={route}><DemoExperience route={route} /></MotionFrame>;
  if (route.startsWith("#/account/update-password") || route.startsWith("#/reset-password")) return <MotionFrame routeKey="password-update"><PasswordUpdate /></MotionFrame>;
  if (route.startsWith("#/lti/instructor")) return <MotionFrame routeKey="lti-instructor"><LtiLaunchWorkspace audience="instructor" /></MotionFrame>;
  if (route.startsWith("#/lti/student")) return <MotionFrame routeKey="lti-student"><LtiLaunchWorkspace audience="student" /></MotionFrame>;
  if (route.startsWith("#/institution-access") || route === "#/institution-admin" || route === "#/institution-admin/") return <MotionFrame routeKey="institution-access"><InstitutionAccessPage onAuthorized={() => navigate("#/admin/control-center")} onBack={() => navigate("#/")} /></MotionFrame>;

  const courseRoute = route.match(/^#\/student\/(?:university\/|k12\/)?course\/([0-9a-f-]{36})/i) || route.match(/^#\/student\/course\/([0-9a-f-]{36})/i);
  if (courseRoute) {
    const track = route.includes("/k12/") ? "k12" : "university";
    const publicationId = courseRoute[1];
    return <AuthGate accountType="student" educationTrack={track} returnTo={route}>{({ profile, session }) => <FeatureManifestProvider pathway="student"><FeatureBoundary featureKey="student.course_runtime"><CourseRuntimePage publicationId={publicationId} profile={profile} session={session} track={track} onBack={() => navigate(`#/student/${track}/app`)} /></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;
  }

  const libraryBookRoute = route.match(/^#\/library\/book\/([0-9a-f-]{36})/i);
  if (libraryBookRoute) {
    return <AuthGate accountType="student" educationTrack="university" returnTo={route}>{() => <FeatureManifestProvider pathway="student"><FeatureBoundary featureKey="student.library_reader"><LibraryBookPage publicationId={libraryBookRoute[1]} onBack={() => navigate("#/publishers")} /></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;
  }

  if (route.startsWith("#/student/k12/app")) return studentDashboard("k12");
  if (route.startsWith("#/student/university/app") || route.startsWith("#/student/app")) return studentDashboard("university");
  if (route.startsWith("#/admin/synthetic-pilot")) return <AuthGate accountType="institution" returnTo="#/admin/synthetic-pilot" allowSignup={false}>{() => <MotionFrame routeKey="synthetic-institution-pilot"><SyntheticInstitutionPilot onBack={() => navigate("#/admin/control-center")} onOpenTos={() => window.open("https://brexatlas.github.io/TOS-Platform/control-center/institutions/example-university/pilots/", "_blank", "noopener,noreferrer")} /></MotionFrame>}</AuthGate>;
  if (route.startsWith("#/admin/tos-integration")) return <AuthGate accountType="institution" returnTo="#/admin/tos-integration" allowSignup={false}>{() => <MotionFrame routeKey="tos-integration-preview"><TosIntegrationPreview onBack={() => navigate("#/admin/control-center")} /></MotionFrame>}</AuthGate>;
  if (route.startsWith("#/admin/control-center") || route.startsWith("#/institution-admin/control-center")) return <AuthGate accountType="institution" returnTo="#/admin/control-center" allowSignup={false}>{() => <MotionFrame routeKey="admin-control-center"><AdminControlCenter onExit={() => navigate("#/admin")} /></MotionFrame>}</AuthGate>;
  if (route.startsWith("#/admin/integrations/lti")) return <AuthGate accountType="professor" returnTo="#/admin/integrations/lti" allowedRoles={["admin", "owner"]} allowSignup={false}>{() => <MotionFrame routeKey="lti-owner-setup"><LtiOwnerSetup onBack={() => navigate("#/admin")} /></MotionFrame>}</AuthGate>;
  if (route.startsWith("#/admin")) return <AuthGate accountType="professor" returnTo="#/admin" allowedRoles={["admin", "owner"]} allowSignup={false}>{() => <MotionFrame routeKey="platform-admin"><PlatformAdminDashboard onHome={() => navigate("#/")} onEducatorPortal={() => navigate("#/professor/dashboard")} /></MotionFrame>}</AuthGate>;
  if (route.startsWith("#/professor/dashboard")) return <AuthGate accountType="professor" returnTo="#/professor/dashboard">{({ profile, session }) => <FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey="professor.dashboard"><MotionFrame routeKey="professor-dashboard"><ProfessorDashboard profile={profile} session={session} onHome={() => navigate("#/professors")} onBuild={() => navigate("#/app")} onAdmin={() => navigate("#/admin")} /></MotionFrame></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;

  if (route.startsWith("#/app/course-output")) return <AuthGate accountType="professor" returnTo="#/app/course-output">{({ session }) => <FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey="professor.course_publish"><CoursePackageStudio session={session} onBack={() => navigate("#/app/builder")} onOpenStudentCourse={(publicationId) => navigate(`#/student/course/${publicationId}`)} /></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;
  if (route.startsWith("#/app/syllabus")) return <AuthGate accountType="professor" returnTo="#/app/syllabus"><FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey="professor.course_builder"><MotionFrame routeKey="professor-syllabus-extraction"><SyllabusToCourse onBack={() => navigate("#/app/builder")} onContinue={() => navigate("#/app/builder")} /></MotionFrame></FeatureBoundary></FeatureManifestProvider></AuthGate>;
  if (route.startsWith("#/app/studio")) return <AuthGate accountType="professor" returnTo="#/app/studio?tab=materials"><FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey={route.includes("tab=reader") ? "professor.studio_reader" : route.includes("tab=slides") ? "professor.studio_slides" : route.includes("tab=room") ? "professor.studio_room" : "professor.studio_materials"}><MotionFrame routeKey={route}><LearningStudio onBack={() => navigate("#/app/builder")} onCourseSetup={() => navigate("#/app")} /></MotionFrame></FeatureBoundary></FeatureManifestProvider></AuthGate>;
  if (route.startsWith("#/app/builder")) return <AuthGate accountType="professor" returnTo="#/app/builder">{({ session }) => <FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey="professor.course_builder"><MotionFrame routeKey="builder"><CourseJourneyShell onBack={() => navigate("#/app")} onStudio={() => navigate("#/app/studio?tab=materials")} onCourseOutput={() => navigate("#/app/course-output")}><CourseOutlineBuilder session={session} onBack={() => navigate("#/app")} onStudio={() => navigate("#/app/studio?tab=materials")} onSyllabus={() => navigate("#/app/syllabus")} onCourseOutput={() => navigate("#/app/course-output")} /></CourseJourneyShell></MotionFrame></FeatureBoundary></FeatureManifestProvider>}</AuthGate>;
  if (route.startsWith("#/app")) return <AuthGate accountType="professor" returnTo="#/app"><FeatureManifestProvider pathway="professor"><FeatureBoundary featureKey="professor.course_builder"><MotionFrame routeKey="course-start"><CourseStart onContinue={() => navigate("#/app/builder")} onHome={() => navigate("#/")} /></MotionFrame></FeatureBoundary></FeatureManifestProvider></AuthGate>;

  if (route.startsWith("#/students/k12")) return studentLanding("k12");
  if (route.startsWith("#/students/university")) return studentLanding("university");
  if (route === "#/students" || route === "#/students/") return <MotionFrame routeKey="student-audience"><StudentAudienceChooser /></MotionFrame>;
  if (route.startsWith("#/students")) return studentLanding("university");
  if (route.startsWith("#/publishers")) return <MotionFrame routeKey="publishing-landing"><PublishingLanding onEnter={() => navigate("#/app/studio?tab=reader")} onOpenCourse={(course) => { window.sessionStorage.setItem("ednotebook-requested-course", JSON.stringify({ id: course.course_id, schoolId: null, track: course.education_division || "university" })); navigate(`#/student/${course.education_division || "university"}/app`); }} /></MotionFrame>;
  if (route.startsWith("#/professors")) return <MotionFrame routeKey="professor-landing"><Landing onEnter={() => navigate("#/app")} onDashboard={() => navigate("#/professor/dashboard")} onStudentPortal={() => navigate("#/students")} onPublishingPortal={() => navigate("#/publishers")} /></MotionFrame>;
  return <MotionFrame routeKey="portal-home"><PortalHome /></MotionFrame>;
}

installEnvironmentStorageNamespace();
document.body.setAttribute("spellcheck", "true");
createRoot(document.getElementById("root")).render(<><EnvironmentBanner /><Suspense fallback={<RouteLoading />}><Router /></Suspense></>);
