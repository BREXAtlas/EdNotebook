import {
  CONTROL_SCOPES,
  FEATURE_CATALOG,
  getFeatureDefinition,
  requireFeatureDefinition,
} from "./featureCatalog.js";

/**
 * More specific scopes normally override broader scopes. A locked broader
 * policy stops evaluation before a more specific policy can widen access.
 */
export const SCOPE_PRECEDENCE = Object.freeze({
  default: 0,
  platform: 100,
  institution: 200,
  pathway: 300,
  course: 400,
  account: 500,
});

export const CONNECTION_STATUS_DETAILS = Object.freeze({
  not_connected: Object.freeze({ label: "Not connected", description: "No approved connection is configured.", tone: "neutral" }),
  setup_needed: Object.freeze({ label: "Setup needed", description: "The connection exists in the product but still needs approved configuration.", tone: "warning" }),
  testing: Object.freeze({ label: "Testing", description: "Configuration is present and required test evidence is still being collected.", tone: "warning" }),
  ready: Object.freeze({ label: "Ready to activate", description: "Required setup is complete and an authorized administrator may activate it.", tone: "positive" }),
  active: Object.freeze({ label: "Active", description: "The connection is approved, available, and within its expected test window.", tone: "positive" }),
  degraded: Object.freeze({ label: "Needs attention", description: "The connection is available only in part or its latest health check did not fully pass.", tone: "danger" }),
  suspended: Object.freeze({ label: "Suspended", description: "An authorized administrator has stopped the connection without deleting its history.", tone: "danger" }),
  failed: Object.freeze({ label: "Test failed", description: "The latest connection test failed and activation should remain blocked.", tone: "danger" }),
  planned: Object.freeze({ label: "Planned", description: "The integration direction is documented but no active connection is available.", tone: "neutral" }),
});

const CONNECTION_STATUS_ALIASES = Object.freeze({
  live: "active",
  enabled: "active",
  setup: "setup_needed",
  configured: "testing",
  prepared: "ready",
  partner: "setup_needed",
  adapter: "setup_needed",
  inactive: "not_connected",
  disabled: "suspended",
  error: "failed",
});

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function valueForPolicy(policy, currentValue) {
  if (policy.mode === "on") return true;
  if (policy.mode === "off") return false;
  if (Object.prototype.hasOwnProperty.call(policy, "value")) return policy.value;
  return currentValue;
}

function policyTimeState(policy, evaluatedAt) {
  const startsAt = asDate(policy.startsAt ?? policy.starts_at);
  const endsAt = asDate(policy.endsAt ?? policy.ends_at);
  if (startsAt && evaluatedAt < startsAt) return { active: false, state: "scheduled", startsAt, endsAt };
  if (endsAt && evaluatedAt >= endsAt) return { active: false, state: "expired", startsAt, endsAt };
  return { active: true, state: startsAt || endsAt ? "in_window" : "current", startsAt, endsAt };
}

function sameId(left, right) {
  return left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right);
}

function policyMatchesContext(policy, definition, context) {
  if (!policy || policy.enabled === false || policy.featureKey !== definition.key) return false;
  if (!CONTROL_SCOPES.includes(policy.scope) || !definition.allowedScopes.includes(policy.scope)) return false;
  if (policy.mode === "inherit") return false;

  switch (policy.scope) {
    case "platform": return true;
    case "institution": return sameId(policy.scopeId ?? policy.scope_id, context.institutionId ?? context.institution_id);
    case "pathway": return sameId(policy.scopeId ?? policy.scope_id ?? policy.pathway, context.pathway ?? definition.pathway);
    case "course": return sameId(policy.scopeId ?? policy.scope_id, context.courseId ?? context.course_id);
    case "account": return sameId(policy.scopeId ?? policy.scope_id, context.accountId ?? context.account_id ?? context.userId ?? context.user_id);
    default: return false;
  }
}

function policySort(left, right) {
  const scopeDifference = SCOPE_PRECEDENCE[left.policy.scope] - SCOPE_PRECEDENCE[right.policy.scope];
  if (scopeDifference) return scopeDifference;
  const priorityDifference = Number(left.policy.priority || 0) - Number(right.policy.priority || 0);
  if (priorityDifference) return priorityDifference;
  const leftUpdated = asDate(left.policy.updatedAt ?? left.policy.updated_at)?.getTime() || 0;
  const rightUpdated = asDate(right.policy.updatedAt ?? right.policy.updated_at)?.getTime() || 0;
  if (leftUpdated !== rightUpdated) return leftUpdated - rightUpdated;
  return left.index - right.index;
}

export function getScopeRank(scope) {
  if (!Object.prototype.hasOwnProperty.call(SCOPE_PRECEDENCE, scope)) throw new RangeError(`Unknown control scope: ${scope}`);
  return SCOPE_PRECEDENCE[scope];
}

export function validateControlPolicy(policy, featureOrKey = policy?.featureKey) {
  const definition = typeof featureOrKey === "string" ? requireFeatureDefinition(featureOrKey) : featureOrKey;
  if (!policy || typeof policy !== "object") throw new TypeError("A control policy must be an object.");
  if (policy.featureKey !== definition.key) throw new TypeError(`Policy feature key must be ${definition.key}.`);
  if (!CONTROL_SCOPES.includes(policy.scope)) throw new RangeError(`Unknown control scope: ${policy.scope}`);
  if (!definition.allowedScopes.includes(policy.scope)) throw new RangeError(`${definition.name} cannot be controlled at ${policy.scope} scope.`);
  if (policy.scope !== "platform" && !String(policy.scopeId ?? policy.scope_id ?? policy.pathway ?? "").trim()) {
    throw new TypeError(`${policy.scope} policy requires a scope ID.`);
  }
  if (policy.mode && !["inherit", "on", "off", "set", "locked"].includes(policy.mode)) throw new RangeError(`Unknown policy mode: ${policy.mode}`);
  if ((policy.mode === "set" || policy.mode === "locked" || policy.locked) && !Object.prototype.hasOwnProperty.call(policy, "value")) {
    throw new TypeError(`${policy.mode || "locked"} policy requires a value.`);
  }
  const startsAt = policy.startsAt ?? policy.starts_at;
  const endsAt = policy.endsAt ?? policy.ends_at;
  if (startsAt && !asDate(startsAt)) throw new TypeError("Policy start time is invalid.");
  if (endsAt && !asDate(endsAt)) throw new TypeError("Policy end time is invalid.");
  if (startsAt && endsAt && asDate(startsAt) >= asDate(endsAt)) throw new RangeError("Policy end time must be after its start time.");
  return true;
}

/**
 * Resolve one effective feature value from broad to specific scope.
 *
 * Locked policies stop lower-authority scopes. `locked: true` and
 * `mode: "locked"` are equivalent. Scheduled or expired policies are reported
 * but do not affect the current value.
 */
export function resolveFeatureControl(featureOrKey, policies = [], context = {}, options = {}) {
  const definition = typeof featureOrKey === "string" ? requireFeatureDefinition(featureOrKey) : featureOrKey;
  if (!definition?.key) throw new TypeError("A feature definition or feature key is required.");
  const evaluatedAt = asDate(options.at) || new Date();
  const matching = [];
  const scheduled = [];

  policies.forEach((policy, index) => {
    if (!policyMatchesContext(policy, definition, context)) return;
    const time = policyTimeState(policy, evaluatedAt);
    if (!time.active) {
      scheduled.push({ policy, state: time.state, startsAt: time.startsAt, endsAt: time.endsAt });
      return;
    }
    matching.push({ policy, index, time });
  });

  matching.sort(policySort);
  let value = definition.defaultValue;
  let source = { scope: "default", scopeId: null, policyId: null, label: "Feature default" };
  let locked = Boolean(definition.alwaysOn);
  let lockSource = definition.alwaysOn ? source : null;
  const appliedPolicyIds = [];
  const ignoredByLock = [];

  for (const entry of matching) {
    if (locked) {
      ignoredByLock.push(entry.policy.id || null);
      continue;
    }
    const policy = entry.policy;
    value = valueForPolicy(policy, value);
    source = {
      scope: policy.scope,
      scopeId: policy.scopeId ?? policy.scope_id ?? null,
      policyId: policy.id || null,
      label: policy.label || `${policy.scope} policy`,
    };
    appliedPolicyIds.push(policy.id || null);
    if (policy.locked === true || policy.mode === "locked") {
      locked = true;
      lockSource = source;
    }
  }

  if (definition.alwaysOn) value = true;
  const upcomingTimes = scheduled
    .flatMap((entry) => [entry.startsAt, entry.endsAt])
    .filter((date) => date && date > evaluatedAt)
    .sort((left, right) => left - right);

  return {
    featureKey: definition.key,
    value,
    enabled: value !== false && value !== null && value !== "off" && value !== "none",
    source,
    locked,
    lockSource,
    appliedPolicyIds,
    ignoredByLock,
    matchingPolicyCount: matching.length,
    scheduledPolicies: scheduled,
    nextChangeAt: upcomingTimes[0]?.toISOString() || null,
    evaluatedAt: evaluatedAt.toISOString(),
  };
}

function cleanCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function plural(count, singular, pluralWord = `${singular}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralWord}`;
}

function displayValue(value) {
  if (value === true) return "On";
  if (value === false) return "Off";
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isDisabledValue(value) {
  return value === false || value === null || value === "off" || value === "none";
}

function addWarning(warnings, code, severity, message) {
  if (!warnings.some((warning) => warning.code === code)) warnings.push({ code, severity, message });
}

export function generateControlWarnings({ feature, previousValue, nextValue, scope = "account", affected = {}, startsAt = null, endsAt = null } = {}) {
  const definition = typeof feature === "string" ? requireFeatureDefinition(feature) : feature;
  if (!definition?.key) throw new TypeError("A feature definition or feature key is required.");
  const warnings = [];
  const disabling = isDisabledValue(nextValue) && !isDisabledValue(previousValue);
  const institutionCount = cleanCount(affected.institutions);
  const courseCount = cleanCount(affected.courses);
  const accountCount = cleanCount(affected.accounts ?? affected.people ?? affected.users);

  if (definition.alwaysOn && disabling) addWarning(warnings, "required-control", "critical", `${definition.name} is a required safety or accessibility control and cannot be turned off.`);
  if (definition.sensitivity === "critical") addWarning(warnings, "critical-feature", "critical", "This feature controls sensitive access, records, security, grades, identity, or institutional data.");
  else if (definition.sensitivity === "sensitive") addWarning(warnings, "sensitive-feature", "warning", "Review privacy, accessibility, and support effects before applying this change.");

  if (["platform", "institution"].includes(scope) || institutionCount > 1 || courseCount > 1 || accountCount > 25) {
    addWarning(warnings, "wide-impact", "warning", "This change can affect many people or courses. Review the affected counts before confirming.");
  }
  if (disabling) {
    const effect = {
      hide: "Users will no longer see this feature while the underlying records remain preserved.",
      read_only: "Users may lose editing or submission access while existing records remain readable.",
      block: "Related actions will be blocked. Confirm that a recovery or alternate pathway remains available.",
      degrade: "Users will receive a reduced experience or fallback instead of the full feature.",
    }[definition.disableBehavior];
    addWarning(warnings, `disable-${definition.disableBehavior}`, definition.disableBehavior === "block" ? "critical" : "warning", effect);
  }
  if (definition.dependencies.length) {
    addWarning(warnings, "dependencies", "warning", `This feature depends on ${definition.dependencies.join(", ")}. Check dependent controls and connection readiness.`);
  }
  if (definition.pathway === "accessibility" || definition.dependencies.some((key) => key.startsWith("accessibility."))) {
    addWarning(warnings, "accessibility-review", "critical", "Confirm that the change preserves keyboard access, readable contrast, text alternatives, reduced motion, and assistive-technology behavior.");
  }
  if (definition.pathway === "integration") {
    addWarning(warnings, "connection-review", "warning", "Changing a connection control does not deploy, test, rotate, or delete credentials. Review the latest test and sync evidence separately.");
  }
  if (startsAt || endsAt) addWarning(warnings, "scheduled-change", "warning", "Confirm the institution timezone, start time, end time, and automatic rollback behavior.");
  if (!institutionCount && !courseCount && !accountCount && scope !== "account") {
    addWarning(warnings, "missing-impact-counts", "warning", "Affected counts were not provided. Run the server-side impact preview before applying this change.");
  }
  return warnings;
}

/** Build the plain-language preview shown before an administrator confirms. */
export function buildControlImpact({
  feature,
  previousValue,
  nextValue,
  scope = "account",
  scopeLabel = "the selected account",
  affected = {},
  startsAt = null,
  endsAt = null,
} = {}) {
  const definition = typeof feature === "string" ? requireFeatureDefinition(feature) : feature;
  if (!definition?.key) throw new TypeError("A feature definition or feature key is required.");
  if (!CONTROL_SCOPES.includes(scope)) throw new RangeError(`Unknown control scope: ${scope}`);
  const counts = {
    institutions: cleanCount(affected.institutions),
    courses: cleanCount(affected.courses),
    accounts: cleanCount(affected.accounts ?? affected.people ?? affected.users),
  };
  const countParts = [];
  if (counts.institutions) countParts.push(plural(counts.institutions, "institution"));
  if (counts.courses) countParts.push(plural(counts.courses, "course"));
  if (counts.accounts) countParts.push(plural(counts.accounts, "account"));
  const changed = JSON.stringify(previousValue) !== JSON.stringify(nextValue);
  const timing = startsAt || endsAt
    ? ` The change is scheduled${startsAt ? ` to start ${asDate(startsAt)?.toISOString() || startsAt}` : ""}${endsAt ? ` and end ${asDate(endsAt)?.toISOString() || endsAt}` : ""}.`
    : "";
  const summary = changed
    ? `Change ${definition.name} from ${displayValue(previousValue)} to ${displayValue(nextValue)} for ${scopeLabel}.${countParts.length ? ` Expected reach: ${countParts.join(", ")}.` : ""}${timing}`
    : `${definition.name} will remain ${displayValue(nextValue)} for ${scopeLabel}. No effective value change is expected.${timing}`;
  const warnings = generateControlWarnings({ feature: definition, previousValue, nextValue, scope, affected: counts, startsAt, endsAt });
  return {
    featureKey: definition.key,
    featureName: definition.name,
    scope,
    scopeLabel,
    previousValue,
    nextValue,
    changed,
    affected: counts,
    affectedPathways: definition.affectedPathways,
    disableBehavior: definition.disableBehavior,
    summary,
    warnings,
    requiresConfirmation: changed || warnings.length > 0,
    confirmationLevel: warnings.some((warning) => warning.severity === "critical") ? "multiple" : "standard",
  };
}

export function normalizeConnectionStatus(status) {
  const normalized = String(status || "not_connected").trim().toLowerCase().replace(/[\s-]+/gu, "_");
  const resolved = CONNECTION_STATUS_ALIASES[normalized] || normalized;
  return Object.prototype.hasOwnProperty.call(CONNECTION_STATUS_DETAILS, resolved) ? resolved : "not_connected";
}

export function getConnectionStatusDetails(status) {
  const key = normalizeConnectionStatus(status);
  return { key, ...CONNECTION_STATUS_DETAILS[key] };
}

export function getConnectionStatusLabel(status) {
  return getConnectionStatusDetails(status).label;
}

function normalizeFilterList(value) {
  if (value === null || value === undefined || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

/**
 * Search and filter the catalog without mutating it.
 *
 * Call as `filterFeatures({ query: "grade" })` or
 * `filterFeatures(customCatalog, { pathways: "student" })`.
 */
export function filterFeatures(catalogOrFilters = FEATURE_CATALOG, maybeFilters = {}) {
  const catalog = Array.isArray(catalogOrFilters) ? catalogOrFilters : FEATURE_CATALOG;
  const filters = Array.isArray(catalogOrFilters) ? maybeFilters : catalogOrFilters || {};
  const query = String(filters.query || "").trim().toLowerCase();
  const pathways = normalizeFilterList(filters.pathways ?? filters.pathway);
  const categories = normalizeFilterList(filters.categories ?? filters.category);
  const readiness = normalizeFilterList(filters.readiness);
  const sensitivities = normalizeFilterList(filters.sensitivities ?? filters.sensitivity);
  const controlTypes = normalizeFilterList(filters.controlTypes ?? filters.controlType);
  const keys = normalizeFilterList(filters.keys);
  const expandedPathways = new Set(pathways);
  if (pathways.length && filters.includeShared) ["shared", "security", "accessibility", "theme"].forEach((pathway) => expandedPathways.add(pathway));
  if (pathways.length && filters.includeIntegrations) expandedPathways.add("integration");

  return catalog
    .filter((definition) => {
      if (expandedPathways.size && !expandedPathways.has(definition.pathway.toLowerCase())) return false;
      if (categories.length && !categories.includes(definition.category.toLowerCase())) return false;
      if (readiness.length && !readiness.includes(definition.readiness.toLowerCase())) return false;
      if (sensitivities.length && !sensitivities.includes(definition.sensitivity.toLowerCase())) return false;
      if (controlTypes.length && !controlTypes.includes(definition.controlType.toLowerCase())) return false;
      if (keys.length && !keys.includes(definition.key.toLowerCase())) return false;
      if (typeof filters.institutionDelegable === "boolean" && definition.institutionDelegable !== filters.institutionDelegable) return false;
      if (typeof filters.alwaysOn === "boolean" && definition.alwaysOn !== filters.alwaysOn) return false;
      if (!query) return true;
      const searchable = [
        definition.key,
        definition.name,
        definition.pathway,
        definition.category,
        definition.description,
        definition.helpText,
        ...definition.tags,
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    })
    .slice()
    .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
}

export function featuresForPathway(pathway, options = {}) {
  return filterFeatures({ pathways: pathway, includeShared: options.includeShared !== false, includeIntegrations: Boolean(options.includeIntegrations), ...options });
}

function plainReportValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    try { return JSON.stringify(value); }
    catch { return "[Value could not be serialized]"; }
  }
  return String(value).replaceAll("\0", "");
}

/**
 * Make a value safe for spreadsheet CSV import. Prefixing formula-like text
 * prevents a downloaded report from executing as a spreadsheet formula.
 */
export function sanitizeCsvValue(value) {
  const text = plainReportValue(value);
  if (/^[\t\r\n ]*[=+\-@]/u.test(text)) return `'${text}`;
  return text;
}

function quoteCsv(value) {
  return `"${sanitizeCsvValue(value).replaceAll('"', '""')}"`;
}

function reportColumns(rows, requestedColumns) {
  if (Array.isArray(requestedColumns) && requestedColumns.length) {
    return requestedColumns.map((column) => typeof column === "string" ? { key: column, label: column } : { key: column.key, label: column.label || column.key });
  }
  const keys = [];
  const seen = new Set();
  rows.forEach((row) => Object.keys(row || {}).forEach((key) => {
    if (!seen.has(key)) { seen.add(key); keys.push(key); }
  }));
  return keys.map((key) => ({ key, label: key }));
}

export function serializeReportToCsv(rows = [], columns = null) {
  if (!Array.isArray(rows)) throw new TypeError("Report rows must be an array.");
  const normalizedRows = rows.map((row) => row && typeof row === "object" && !Array.isArray(row) ? row : { value: row });
  const selectedColumns = reportColumns(normalizedRows, columns);
  if (!selectedColumns.length) return "";
  const lines = [selectedColumns.map((column) => quoteCsv(column.label)).join(",")];
  normalizedRows.forEach((row) => lines.push(selectedColumns.map((column) => quoteCsv(row[column.key])).join(",")));
  return `${lines.join("\r\n")}\r\n`;
}

export const serializeControlReport = serializeReportToCsv;

export function featureByKey(featureKey) {
  return getFeatureDefinition(featureKey);
}
