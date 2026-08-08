import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import "./environment-banner.css";

const environment = import.meta.env.VITE_APP_ENVIRONMENT || "production";
const isStagingSandbox = environment === "staging";
const configuredLiveLane = ["beta", "pilot", "production"].includes(
  String(import.meta.env.VITE_LIVE_OPERATING_LANE || "beta").toLowerCase(),
)
  ? String(import.meta.env.VITE_LIVE_OPERATING_LANE || "beta").toLowerCase()
  : "beta";

export default function EnvironmentBanner() {
  const [liveLane, setLiveLane] = useState(configuredLiveLane);

  useEffect(() => {
    document.documentElement.dataset.environment = isStagingSandbox ? "staging" : "live";
    document.documentElement.dataset.deploymentSurface = isStagingSandbox
      ? "staging_sandbox"
      : "live_service";
    if (!isStagingSandbox) return;

    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow, noarchive");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://ednotebook.com/staging/");
  }, []);

  useEffect(() => {
    if (isStagingSandbox) return undefined;
    let active = true;

    async function refreshLane() {
      let nextLane = configuredLiveLane;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc("get_live_service_operating_lane");
        if (!error && ["beta", "pilot", "production"].includes(data?.operating_lane)) {
          nextLane = data.operating_lane;
        }
      }
      if (active) setLiveLane(nextLane);
    }

    const onLaneChange = () => { refreshLane(); };
    const authListener = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange(() => { window.queueMicrotask(refreshLane); }).data
      : null;
    window.addEventListener("ednotebook:live-lane-changed", onLaneChange);
    refreshLane();
    return () => {
      active = false;
      window.removeEventListener("ednotebook:live-lane-changed", onLaneChange);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const displayLane = isStagingSandbox ? "sandbox" : liveLane;
    document.documentElement.dataset.operatingLane = displayLane;
    const baseTitle = document.title.replace(/^(?:BETA|PILOT|STAGING) · /u, "");
    if (isStagingSandbox) document.title = `STAGING · ${baseTitle}`;
    else if (["beta", "pilot"].includes(liveLane)) document.title = `${liveLane.toUpperCase()} · ${baseTitle}`;
    else document.title = baseTitle;
  }, [liveLane]);

  if (isStagingSandbox) {
    return (
      <div
        className="environment-banner environment-banner--staging"
        role="status"
        aria-label="Staging upgrade sandbox"
      >
        EDNOTEBOOK STAGING SANDBOX · TEST DATA ONLY
      </div>
    );
  }

  if (liveLane === "production") return null;

  const isPilot = liveLane === "pilot";

  return (
    <div
      className={`environment-banner environment-banner--${liveLane}`}
      role="status"
      aria-label={`${isPilot ? "Pilot" : "Beta"} live operating lane`}
    >
      {isPilot
        ? "EDNOTEBOOK PILOT · LIVE SERVICE · AUTHORIZED PILOT DATA"
        : "EDNOTEBOOK BETA · LIVE SERVICE · AUTHORIZED BETA DATA"}
    </div>
  );
}
