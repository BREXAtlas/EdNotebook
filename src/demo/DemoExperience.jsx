import DemoWorkspace from "./DemoWorkspace.jsx";
import { DemoLanding, routeSection } from "./demoShared.jsx";
import { AboutCareers, PresentationSite } from "./PresentationAbout.jsx";
import "./demo.css";

export default function DemoExperience({ route = window.location.hash || "#/tour" }) {
  const section = routeSection(route);
  if (section === "presentation") return <PresentationSite />;
  if (section === "about") return <AboutCareers />;
  if (section === "careers") return <AboutCareers careersFirst />;
  if (section === "workspace") {
    const personaId = route.split("/")[2] || "student";
    return <DemoWorkspace personaId={personaId} />;
  }
  return <DemoLanding />;
}
