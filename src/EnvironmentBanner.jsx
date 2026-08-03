import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase, supabaseProjectRef } from "./supabaseClient.js";
import "./environment-banner.css";

const environment = import.meta.env.VITE_APP_ENVIRONMENT || "production";
const isStaging = environment === "staging";
const STAGING_PROJECT_REF = "gfalgonektwdylsxsgzc";

function courseIdFromHash() {
  const match = String(window.location.hash || "").match(/\/course\/([0-9a-f-]{36})(?:\/|$)/iu);
  return match?.[1] || null;
}

export default function EnvironmentBanner() {
  const [dataLane, setDataLane] = useState("beta");

  useEffect(() => {
    document.documentElement.dataset.environment = environment;
    if (!isStaging) return;

    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow, noarchive");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://ednotebook.com/staging/");
  }, []);

  useEffect(() => {
    if (!isStaging) return undefined;
    let active = true;

    async function refreshLane() {
      let nextLane = "beta";
      if (isSupabaseConfigured && supabaseProjectRef === STAGING_PROJECT_REF) {
        const { data, error } = await supabase.rpc("get_my_student_data_environment_lane", {
          p_course_id: courseIdFromHash(),
        });
        if (!error && ["beta", "pilot"].includes(data?.data_lane)) nextLane = data.data_lane;
      }
      if (active) setDataLane(nextLane);
    }

    const onHashChange = () => { refreshLane(); };
    const authListener = isSupabaseConfigured && supabaseProjectRef === STAGING_PROJECT_REF
      ? supabase.auth.onAuthStateChange(() => { window.queueMicrotask(refreshLane); }).data
      : null;
    window.addEventListener("hashchange", onHashChange);
    refreshLane();
    return () => {
      active = false;
      window.removeEventListener("hashchange", onHashChange);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isStaging) return;
    document.documentElement.dataset.dataLane = dataLane;
    const baseTitle = document.title.replace(/^(?:BETA|PILOT|STAGING) · /u, "");
    document.title = `${dataLane.toUpperCase()} · ${baseTitle}`;
  }, [dataLane]);

  if (!isStaging) return null;

  const isPilot = dataLane === "pilot";

  return (
    <div
      className={`environment-banner environment-banner--${dataLane}`}
      role="status"
      aria-label={`${isPilot ? "Pilot" : "Beta"} testing environment`}
    >
      {isPilot
        ? "EDNOTEBOOK PILOT MODE · STAGING · AUTHORIZED PILOT DATA"
        : "EDNOTEBOOK BETA MODE · STAGING · TEST DATA ONLY"}
    </div>
  );
}
