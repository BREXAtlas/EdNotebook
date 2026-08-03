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
  const [route, setRoute] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
        <strong>EDNOTEBOOK STAGING SANDBOX · TEST DATA ONLY</strong>
      </div>
    );
  }

  if (liveLane === "production") return null;

  const isPilot = liveLane === "pilot";
  const isInsideApp = /^(#\/(?:app|student\/|professor\/dashboard|admin(?:\/|$)|institution-admin\/|library\/book\/|lti\/))/u.test(route);

  return (
    <div
      className={`environment-banner environment-banner--${liveLane}`}
      role="status"
      aria-label={`${isPilot ? "Pilot" : "Beta"} live operating lane`}
    >
      <strong>
        {isPilot
          ? "EDNOTEBOOK PILOT · LIVE SERVICE · AUTHORIZED PILOT DATA"
          : "EDNOTEBOOK BETA · LIVE SERVICE · AUTHORIZED BETA DATA"}
      </strong>
      <span>
        {isPilot
          ? "You’re participating in an authorized EdNotebook pilot. Your feedback helps us prepare the official experience."
          : isInsideApp
            ? "Beta Version — You’re helping test EdNotebook before its official release. You may encounter bugs or incomplete features. Thank you for your feedback!"
            : "Early Access Beta — You’re using a pre-release version of EdNotebook. Some features may change as we improve the experience based on your feedback."}
      </span>
    </div>
  );
}
