import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FEATURE_CATALOG, getFeatureDefinition } from "./featureCatalog.js";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

const FeatureManifestContext = createContext(null);

function withManifestLoadTimeout(request, timeoutMs = 10000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("Feature controls took too long to load.")),
      timeoutMs,
    );
  });
  return Promise.race([request, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function defaultsForPathway(pathway) {
  return FEATURE_CATALOG
    .filter((feature) => ["shared", pathway, "security", "accessibility", "theme", "integration"].includes(feature.pathway))
    .map((feature) => ({
      feature_key: feature.key,
      display_name: feature.name,
      value: feature.defaultValue,
      source_scope: "repository_default",
      locked: Boolean(feature.alwaysOn),
      reason: "Repository default while the control manifest is unavailable",
      disable_behavior: feature.disableBehavior,
      build_status: feature.readiness,
    }));
}

export function FeatureManifestProvider({ pathway, courseId = null, children }) {
  const [manifest, setManifest] = useState(() => ({
    revision: 0,
    pathway,
    institution_id: null,
    course_id: courseId,
    features: defaultsForPathway(pathway),
    source: "repository_default",
  }));
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function load() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error: requestError } = await withManifestLoadTimeout(
          supabase.rpc("get_effective_feature_manifest", {
            p_pathway: pathway,
            p_course_id: courseId,
          }),
        );
        if (requestError) throw requestError;
        if (!current) return;
        setManifest({ ...data, source: "database" });
        setError("");
      } catch (requestError) {
        if (!current) return;
        // Database authorization remains the security boundary. Repository
        // defaults keep an undeployed control-center migration from stranding
        // existing users; the control center clearly reports that setup state.
        setManifest({
          revision: 0,
          pathway,
          institution_id: null,
          course_id: courseId,
          features: defaultsForPathway(pathway),
          source: "repository_default",
        });
        setError(requestError?.message || "Feature controls could not be loaded.");
      } finally {
        if (current) setLoading(false);
      }
    }
    load();
    return () => { current = false; };
  }, [pathway, courseId]);

  const value = useMemo(() => {
    const byKey = new Map((manifest?.features || []).map((feature) => [feature.feature_key, feature]));
    return {
      manifest,
      loading,
      error,
      getFeature(featureKey) {
        return byKey.get(featureKey) || null;
      },
      isEnabled(featureKey) {
        const feature = byKey.get(featureKey);
        if (feature) return feature.value !== false;
        return getFeatureDefinition(featureKey)?.defaultValue !== false;
      },
    };
  }, [manifest, loading, error]);

  useEffect(() => {
    const campaign = value.getFeature("theme.platform_campaign")?.value || "none";
    const themeLock = value.getFeature("theme.platform_lock")?.value === true;
    document.documentElement.dataset.ednotebookCampaign = String(campaign);
    document.documentElement.toggleAttribute("data-ednotebook-theme-locked", themeLock);
    return () => {
      delete document.documentElement.dataset.ednotebookCampaign;
      document.documentElement.removeAttribute("data-ednotebook-theme-locked");
    };
  }, [value]);

  return <FeatureManifestContext.Provider value={value}>{children}</FeatureManifestContext.Provider>;
}

export function useFeatureManifest() {
  return useContext(FeatureManifestContext);
}

export function FeatureBoundary({ featureKey, children, fallback = null }) {
  const controls = useFeatureManifest();
  const definition = getFeatureDefinition(featureKey);
  const resolved = controls?.getFeature(featureKey);
  const enabled = controls ? controls.isEnabled(featureKey) : definition?.defaultValue !== false;

  if (controls?.loading) {
    return <main className="portal-route-loading" aria-live="polite"><strong>EdNotebook</strong><span>Checking workspace access…</span></main>;
  }
  if (enabled) return children;
  if (fallback) return fallback;

  const behavior = resolved?.disable_behavior || definition?.disableBehavior || "hide";
  return (
    <main className="portal-route-loading" role="status">
      <strong>{resolved?.display_name || definition?.name || "This feature"} is unavailable.</strong>
      <span>{behavior === "read_only"
        ? "An administrator placed this workspace in read-only mode. Your existing records are preserved."
        : "An authorized administrator turned off this feature for the current platform, institution, course, or account scope."}</span>
      <a href="#/" style={{ color: "#245397", fontWeight: 800 }}>Return to EdNotebook</a>
    </main>
  );
}

export default FeatureBoundary;
