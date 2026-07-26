const DEFAULT_ENVIRONMENT = "production";
const LEGACY_MIGRATION_ENVIRONMENT = "production";

export const STORAGE_KEYS = Object.freeze({
  courseDraft: "ednotebook-course-draft",
  courseId: "ednotebook-course-id",
  courseStep: "ednotebook-course-step",
  aiCourseOutline: "ednotebook-ai-course-outline",
  generatedCoursePackage: "ednotebook-generated-course-package",
});

function normalizeEnvironment(value) {
  const normalized = String(value || DEFAULT_ENVIRONMENT)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || DEFAULT_ENVIRONMENT;
}

function storagePrefix(environment) {
  return `ednotebook:${normalizeEnvironment(environment)}:`;
}

export function createEnvironmentStorage(storage, environment = DEFAULT_ENVIRONMENT) {
  const normalizedEnvironment = normalizeEnvironment(environment);
  const prefix = storagePrefix(normalizedEnvironment);

  const scopedKey = (key) => `${prefix}${key}`;

  function getItem(key) {
    if (!storage) return null;

    const current = storage.getItem(scopedKey(key));
    if (current !== null) return current;

    // EdNotebook historically stored course state without an environment
    // namespace. Treat those records as production-only so staging can never
    // inherit production course IDs or drafts from the same browser origin.
    if (normalizedEnvironment !== LEGACY_MIGRATION_ENVIRONMENT) return null;

    const legacy = storage.getItem(key);
    if (legacy === null) return null;

    storage.setItem(scopedKey(key), legacy);
    storage.removeItem(key);
    return legacy;
  }

  function setItem(key, value) {
    storage?.setItem(scopedKey(key), String(value));
  }

  function removeItem(key) {
    if (!storage) return;
    storage.removeItem(scopedKey(key));
    if (normalizedEnvironment === LEGACY_MIGRATION_ENVIRONMENT) {
      storage.removeItem(key);
    }
  }

  function getJson(key, fallback = null) {
    const value = getItem(key);
    if (value === null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function setJson(key, value) {
    setItem(key, JSON.stringify(value));
  }

  return Object.freeze({
    environment: normalizedEnvironment,
    prefix,
    scopedKey,
    getItem,
    setItem,
    removeItem,
    getJson,
    setJson,
  });
}

const buildEnvironment = import.meta.env?.VITE_APP_ENVIRONMENT || DEFAULT_ENVIRONMENT;
const browserStorage = typeof window === "undefined" ? null : window.localStorage;

export const environmentStorage = createEnvironmentStorage(browserStorage, buildEnvironment);
