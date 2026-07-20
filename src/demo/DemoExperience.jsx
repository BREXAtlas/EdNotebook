import { useEffect, useState } from "react";
import DemoWorkspace from "./DemoWorkspace.jsx";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { DemoLanding, routeSection } from "./demoShared.jsx";
import { AboutCareers, PresentationSite } from "./PresentationAbout.jsx";
import "./demo.css";

export default function DemoExperience({ route = window.location.hash || "#/tour" }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  const section = routeSection(route);
  if (section === "presentation") return <PresentationSite />;
  if (section === "about") return <AboutCareers />;
  if (section === "careers") return <AboutCareers careersFirst />;
  if (section === "workspace") {
    const personaId = (route.split("/")[2] || "student").split("?")[0];
    return <DemoWorkspace personaId={personaId} signedIn={signedIn} />;
  }
  return <DemoLanding />;
}
