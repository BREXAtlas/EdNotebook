const DEFAULT_ENVIRONMENT = "production";
const LEGACY_MIGRATION_ENVIRONMENT = "production";
const MANAGED_KEY_PREFIX = "ednotebook-";
const INSTALL_FLAG = Symbol.for("ednotebook.environment-storage-installed");

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

function isManagedKey(key) {
  return typeof key === "string" && key.startsWith(MANAGED_KEY_PREFIX);
}

export function createEnvironmentStorage(storage, environment = DEFAULT_ENVIRONMENT) {
  const normalizedEnvironment = normalizeEnvironment(environment);
  const prefix = storagePrefix(normalizedEnvironment);
  const rawGet = storage?.getItem?.bind(storage);
  const rawSet = storage?.setItem?.bind(storage);
  const rawRemove = storage?.removeItem?.bind(storage);

  const scopedKey = (key) => `${prefix}${key}`;

  function getItem(key) {
    if (!rawGet) return null;

    const current = rawGet(scopedKey(key));
    if (current !== null) return current;

    // EdNotebook historically stored course state without an environment
    // namespace. Treat those records as production-only so staging can never
    // inherit production course IDs or drafts from the same browser origin.
    if (normalizedEnvironment !== LEGACY_MIGRATION_ENVIRONMENT) return null;

    const legacy = rawGet(key);
    if (legacy === null) return null;

    rawSet?.(scopedKey(key), legacy);
    rawRemove?.(key);
    return legacy;
  }

  function setItem(key, value) {
    rawSet?.(scopedKey(key), String(value));
  }

  function removeItem(key) {
    rawRemove?.(scopedKey(key));
    if (normalizedEnvironment === LEGACY_MIGRATION_ENVIRONMENT) {
      rawRemove?.(key);
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
const browserLocalStorage = typeof window === "undefined" ? null : window.localStorage;
const browserSessionStorage = typeof window === "undefined" ? null : window.sessionStorage;

export const environmentStorage = createEnvironmentStorage(
  browserLocalStorage,
  buildEnvironment,
);

export function installEnvironmentStorageNamespace() {
  if (typeof window === "undefined" || typeof Storage === "undefined") return;
  if (Storage.prototype[INSTALL_FLAG]) return;

  const local = createEnvironmentStorage(window.localStorage, buildEnvironment);
  const session = createEnvironmentStorage(window.sessionStorage, buildEnvironment);
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Object.defineProperty(Storage.prototype, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  Storage.prototype.getItem = function getEnvironmentItem(key) {
    if (isManagedKey(key)) {
      if (this === window.localStorage) return local.getItem(key);
      if (this === window.sessionStorage) return session.getItem(key);
    }
    return originalGetItem.call(this, key);
  };

  Storage.prototype.setItem = function setEnvironmentItem(key, value) {
    if (isManagedKey(key)) {
      if (this === window.localStorage) return local.setItem(key, value);
      if (this === window.sessionStorage) return session.setItem(key, value);
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function removeEnvironmentItem(key) {
    if (isManagedKey(key)) {
      if (this === window.localStorage) return local.removeItem(key);
      if (this === window.sessionStorage) return session.removeItem(key);
    }
    return originalRemoveItem.call(this, key);
  };
}
