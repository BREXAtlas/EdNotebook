import { useEffect } from "react";

const environment = import.meta.env.VITE_APP_ENVIRONMENT || "production";
const isStaging = environment === "staging";

export default function EnvironmentBanner() {
  useEffect(() => {
    document.documentElement.dataset.environment = environment;
    if (!isStaging) return;

    document.title = `STAGING · ${document.title}`;

    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow, noarchive");

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://ednotebook.com/staging/");
  }, []);

  if (!isStaging) return null;

  return (
    <div
      role="status"
      aria-label="Staging environment"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 10000,
        padding: "8px 12px",
        borderRadius: 999,
        background: "#7a3e00",
        color: "#ffffff",
        boxShadow: "0 6px 20px rgba(0,0,0,.24)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: ".08em",
      }}
    >
      EDNOTEBOOK STAGING · TEST DATA ONLY
    </div>
  );
}
