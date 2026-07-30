import { useEffect } from "react";
import "./environment-banner.css";

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
      className="environment-banner"
      role="status"
      aria-label="Staging environment"
    >
      EDNOTEBOOK STAGING · TEST DATA ONLY
    </div>
  );
}
