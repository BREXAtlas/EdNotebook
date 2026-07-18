import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing.jsx";
import Builder from "./Builder.jsx";
import AuthGate from "./AuthGate.jsx";
import CourseStart from "./CourseStart.jsx";
import CourseJourneyShell from "./CourseJourneyShell.jsx";
import MotionFrame from "./MotionFrame.jsx";
import LearningStudio from "./studio/LearningStudio.jsx";
import "./index.css";

function Router() {
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (next) => {
    window.location.hash = next;
  };

  if (route.startsWith("#/app/studio")) {
    return (
      <AuthGate>
        <MotionFrame routeKey={route}>
          <LearningStudio
            onBack={() => navigate("#/app/builder")}
            onCourseSetup={() => navigate("#/app")}
          />
        </MotionFrame>
      </AuthGate>
    );
  }

  if (route.startsWith("#/app/builder")) {
    return (
      <AuthGate>
        <MotionFrame routeKey="builder">
          <CourseJourneyShell
            onBack={() => navigate("#/app")}
            onStudio={() => navigate("#/app/studio?tab=materials")}
          >
            <Builder />
          </CourseJourneyShell>
        </MotionFrame>
      </AuthGate>
    );
  }

  if (route.startsWith("#/app")) {
    return (
      <AuthGate>
        <MotionFrame routeKey="course-start">
          <CourseStart
            onContinue={() => navigate("#/app/builder")}
            onHome={() => navigate("#/")}
          />
        </MotionFrame>
      </AuthGate>
    );
  }

  return (
    <MotionFrame routeKey="landing">
      <Landing onEnter={() => navigate("#/app")} />
    </MotionFrame>
  );
}

createRoot(document.getElementById("root")).render(<Router />);
