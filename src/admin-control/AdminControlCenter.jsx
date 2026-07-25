import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import * as adminService from "./adminControlService.js";
import { FEATURE_CATALOG } from "./featureCatalog.js";
import {
  buildControlImpact,
  filterFeatures,
  getConnectionStatusDetails,
  serializeReportToCsv,
} from "./controlModel.js";
import "./admin-control-center.css";

const TABS = Object.freeze([
  ["overview", "Overview"],
  ["student", "Student"],
  ["professor", "Professor"],
  ["publisher", "Publisher"],
  ["connections", "Connections"],
  ["accounts", "Accounts & courses"],
  ["institutions", "Institutions"],
  ["platform-access", "Platform access"],
  ["team", "Team"],
  ["changes-reports", "Changes & reports"],
]);

const EVERY_WEEKDAY = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
const WEEKDAYS = Object.freeze([
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"],
]);

const TEAM_CAPABILITIES = Object.freeze([
  ["view_control_center", "Open this control center"],
  ["view_accounts", "Review institution accounts and courses"],
  ["view_records", "Review protected institution records"],
  ["control_features", "Change delegated feature controls"],
  ["view_integrations", "Review institution connections"],
  ["manage_integrations", "Manage institution connections"],
  ["test_integrations", "Record connection test evidence"],
  ["view_audit", "Review audit and version history"],
  ["export_reports", "Download institution reports"],
  ["manage_team", "Invite and manage institution administrators"],
  ["manage_affiliations", "Review student and professor affiliations"],
  ["manage_retention", "Manage approved retention and legal-hold workflows"],
  ["manage_institution_profile", "Update the institution profile"],
]);

const PLATFORM_CAPABILITIES = Object.freeze([
  ["view_control_center", "Open the platform control center", "Review the platform status and only the sections separately allowed below."],
  ["view_accounts", "Search accounts and courses", "Find approved account and course records across institution boundaries without changing membership."],
  ["view_feature_controls", "Review feature controls", "See feature definitions and current settings without changing them."],
  ["view_integrations", "Review connections", "See connection readiness and safe test status without revealing credentials."],
  ["test_integrations", "Record connection tests", "Add plain-language test evidence for approved integrations."],
  ["view_audit", "Review audit and version history", "See recorded administrative changes and test evidence."],
  ["view_reports", "Review administration reports", "See approved platform report records without creating or downloading a new export."],
]);

const PLATFORM_ROLE_DEFAULTS = Object.freeze({
  operator: Object.freeze({
    view_control_center: true,
    view_accounts: true,
    view_feature_controls: true,
    view_integrations: true,
    test_integrations: true,
    view_audit: true,
  }),
  auditor: Object.freeze({
    view_control_center: true,
    view_feature_controls: true,
    view_integrations: true,
    view_audit: true,
    view_reports: true,
  }),
  support: Object.freeze({ view_control_center: true, view_accounts: true }),
});

const DEFAULT_PLATFORM_AUTHORIZATION = Object.freeze({
  userId: "",
  account: null,
  accessLevel: "auditor",
  capabilities: PLATFORM_ROLE_DEFAULTS.auditor,
  status: "active",
  expiresAt: "",
  reason: "",
  expectedUpdatedAt: null,
});

const DEFAULT_CONTROL = Object.freeze({
  value: undefined,
  scopeType: "",
  lockDescendants: false,
  scheduled: false,
  startsAt: "",
  endsAt: "",
  weekdays: EVERY_WEEKDAY,
  localStartTime: "",
  localEndTime: "",
  timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
});

function formatDate(value, includeTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function titleCase(value) {
  return String(value || "Not set").replaceAll("_", " ").replace(/\b\w/gu, (character) => character.toUpperCase());
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function friendlyError(error, fallback = "The request could not be completed.") {
  const message = String(error?.message || fallback);
  if (/admin control center|function .* does not exist|schema cache/iu.test(message)) {
    return "The administration service is not deployed for this environment yet. Apply the institution control-center database migration, then try again.";
  }
  if (/access required|permission denied|not authorized/iu.test(message)) {
    return "This account does not have permission for that institution, feature, or administrative action.";
  }
  return message;
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "ready", "passed", "approved", "healthy", "generated"].includes(normalized)) return "positive";
  if (["failed", "rejected", "degraded", "suspended", "expired", "blocked"].includes(normalized)) return "danger";
  if (["testing", "warning", "pending", "reviewing", "setup", "scheduled"].includes(normalized)) return "warning";
  return "neutral";
}

function StatusPill({ status, label }) {
  return <span className={`ac-status ac-status--${statusTone(status)}`}>{label || titleCase(status)}</span>;
}

function HelpTip({ title, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="ac-help">
      <button
        type="button"
        className="ac-help-button"
        aria-label={`Explain ${title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >?</button>
      {open ? <span className="ac-help-box" id={id} role="note"><strong>{title}</strong><span>{children}</span></span> : null}
    </span>
  );
}

function StatCard({ label, value, note }) {
  return (
    <article className="ac-stat-card">
      <span>{label}</span>
      <strong>{safeNumber(value).toLocaleString("en-US")}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function normalizeFeature(serverFeature) {
  const key = serverFeature?.feature_key || serverFeature?.key;
  const local = FEATURE_CATALOG.find((feature) => feature.key === key) || {};
  const options = serverFeature?.allowed_values ?? serverFeature?.options ?? local.options ?? [];
  return {
    ...local,
    ...serverFeature,
    key,
    name: serverFeature?.display_name || serverFeature?.name || local.name || key,
    pathway: serverFeature?.pathway || local.pathway || "shared",
    category: serverFeature?.category || local.category || "Other",
    description: serverFeature?.description || local.description || "",
    helpText: serverFeature?.help_text || serverFeature?.helpText || local.helpText || "",
    readiness: serverFeature?.build_status || serverFeature?.readiness || local.readiness || "planned",
    controlType: serverFeature?.control_type || serverFeature?.controlType || local.controlType || "boolean",
    defaultValue: serverFeature?.default_value ?? serverFeature?.defaultValue ?? local.defaultValue ?? false,
    options: Array.isArray(options) ? options : [],
    minimum: serverFeature?.minimum_value ?? serverFeature?.minimum ?? local.minimum ?? 0,
    maximum: serverFeature?.maximum_value ?? serverFeature?.maximum ?? local.maximum ?? 100,
    allowedScopes: serverFeature?.allowed_scopes || serverFeature?.allowedScopes || local.allowedScopes || ["platform"],
    institutionDelegable: serverFeature?.institution_delegable ?? serverFeature?.institutionDelegable ?? local.institutionDelegable ?? false,
    lockable: serverFeature?.lockable ?? local.lockable ?? true,
    sensitivity: serverFeature?.risk_level || serverFeature?.sensitivity || local.sensitivity || "standard",
    disableBehavior: serverFeature?.disable_behavior || serverFeature?.disableBehavior || local.disableBehavior || "hide",
    affectedPathways: serverFeature?.affected_pathways || serverFeature?.affectedPathways || local.affectedPathways || [serverFeature?.pathway || "shared"],
    dependencies: serverFeature?.dependencies || local.dependencies || [],
    tags: serverFeature?.tags || local.tags || [],
    alwaysOn: serverFeature?.always_on ?? serverFeature?.alwaysOn ?? local.alwaysOn ?? false,
    impactExplanation: serverFeature?.impact_explanation || local.impactExplanation || "",
  };
}

function normalizeWarning(warning, index) {
  if (typeof warning === "string") return { code: `warning-${index}`, severity: "warning", message: warning };
  return {
    code: warning?.code || `warning-${index}`,
    severity: warning?.severity || "warning",
    message: warning?.message || "Review this change before applying it.",
  };
}

const POLICY_SCOPE_RANK = Object.freeze({
  platform: 30,
  platform_pathway: 40,
  institution: 50,
  institution_pathway: 60,
  course: 70,
  account: 80,
});

const WEEKDAY_NUMBER = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

function policyTimeParts(value, timezoneName) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneName || "America/Chicago",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(value);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      weekday: WEEKDAY_NUMBER[byType.weekday],
      seconds: (Number(byType.hour) * 3600) + (Number(byType.minute) * 60) + Number(byType.second),
    };
  } catch {
    return {
      weekday: value.getDay(),
      seconds: (value.getHours() * 3600) + (value.getMinutes() * 60) + value.getSeconds(),
    };
  }
}

function timeStringSeconds(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/u);
  if (!match) return null;
  return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3] || 0);
}

function policyIsEffective(policy, evaluatedAt = new Date()) {
  if (policy?.control_status && !["active", "scheduled"].includes(policy.control_status)) return false;
  const startsAt = policy?.starts_at ? new Date(policy.starts_at) : null;
  const endsAt = policy?.ends_at ? new Date(policy.ends_at) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && evaluatedAt < startsAt) return false;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && evaluatedAt >= endsAt) return false;

  const local = policyTimeParts(evaluatedAt, policy?.timezone_name);
  const weekdays = Array.isArray(policy?.weekdays) ? policy.weekdays.map(Number) : EVERY_WEEKDAY;
  if (!weekdays.includes(local.weekday)) return false;

  const localStart = timeStringSeconds(policy?.local_start_time);
  const localEnd = timeStringSeconds(policy?.local_end_time);
  if (localStart === null || localEnd === null) return true;
  if (localStart <= localEnd) return local.seconds >= localStart && local.seconds <= localEnd;
  return local.seconds >= localStart || local.seconds <= localEnd;
}

function policyContext(scopeType, institutionId, pathway, selectedTarget) {
  const targetInstitutionId = selectedTarget?.institutionId || institutionId || null;
  switch (scopeType) {
    case "platform":
      return { scopeType, institutionId: null, pathway: null, courseId: null, userId: null };
    case "platform_pathway":
      return { scopeType, institutionId: null, pathway, courseId: null, userId: null };
    case "institution":
      return { scopeType, institutionId, pathway: null, courseId: null, userId: null };
    case "institution_pathway":
      return { scopeType, institutionId, pathway, courseId: null, userId: null };
    case "course":
      return { scopeType, institutionId: targetInstitutionId, pathway, courseId: selectedTarget?.type === "course" ? selectedTarget.id : null, userId: null };
    case "account":
      return { scopeType, institutionId: targetInstitutionId, pathway: selectedTarget?.pathway || pathway, courseId: null, userId: selectedTarget?.type === "account" ? selectedTarget.id : null };
    default:
      return { scopeType: "default", institutionId: null, pathway: null, courseId: null, userId: null };
  }
}

function policyMatchesContext(policy, context) {
  const allowedByTarget = {
    platform: ["platform"],
    platform_pathway: ["platform", "platform_pathway"],
    institution: ["platform", "institution"],
    institution_pathway: ["platform", "platform_pathway", "institution", "institution_pathway"],
    course: ["platform", "platform_pathway", "institution", "institution_pathway", "course"],
    account: ["platform", "platform_pathway", "institution", "institution_pathway", "account"],
  };
  if (!(allowedByTarget[context.scopeType] || []).includes(policy.scope_type)) return false;
  if (policy.scope_type === "platform") return true;
  if (policy.scope_type === "platform_pathway") return policy.pathway === context.pathway;
  if (policy.scope_type === "institution") return policy.institution_id === context.institutionId;
  if (policy.scope_type === "institution_pathway") {
    return policy.institution_id === context.institutionId && policy.pathway === context.pathway;
  }
  if (policy.scope_type === "course") {
    return policy.course_id === context.courseId && (!policy.institution_id || policy.institution_id === context.institutionId);
  }
  if (policy.scope_type === "account") {
    return policy.user_id === context.userId && (!policy.institution_id || policy.institution_id === context.institutionId);
  }
  return false;
}

function policyRank(policy) {
  if (policy.lock_descendants && ["platform", "platform_pathway"].includes(policy.scope_type)) return 100;
  if (policy.lock_descendants && ["institution", "institution_pathway"].includes(policy.scope_type)) return 95;
  return POLICY_SCOPE_RANK[policy.scope_type] || 0;
}

function policyValue(feature, policies, context) {
  const candidates = (policies || [])
    .filter((policy) => policy.feature_key === feature.key)
    .filter((policy) => policyIsEffective(policy))
    .filter((policy) => policyMatchesContext(policy, context))
    .sort((left, right) => {
      const rankDifference = policyRank(right) - policyRank(left);
      if (rankDifference) return rankDifference;
      return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    });
  return candidates[0]?.control_value ?? feature.defaultValue;
}

function editorValue(value, feature) {
  if (value !== undefined) return value;
  return feature.defaultValue;
}

function ControlValueEditor({ feature, value, onChange, disabled }) {
  const resolved = editorValue(value, feature);
  if (feature.controlType === "boolean") {
    return (
      <label className="ac-switch-row">
        <span className="ac-switch">
          <input
            type="checkbox"
            checked={Boolean(resolved)}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled || feature.alwaysOn}
          />
          <span aria-hidden="true" />
        </span>
        <strong>{feature.alwaysOn ? "Required on" : resolved ? "On" : "Off"}</strong>
      </label>
    );
  }
  if (feature.controlType === "select") {
    return (
      <label className="ac-compact-field">Setting
        <select value={String(resolved ?? "")} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          {feature.options.map((option) => {
            const optionValue = typeof option === "object" ? option.value : option;
            const optionLabel = typeof option === "object" ? option.label || option.value : titleCase(option);
            return <option key={String(optionValue)} value={String(optionValue)}>{optionLabel}</option>;
          })}
          {!feature.options.length ? <option value={String(resolved ?? "")}>{String(resolved ?? "Not set")}</option> : null}
        </select>
      </label>
    );
  }
  if (feature.controlType === "number") {
    const minimum = Number.isFinite(Number(feature.minimum)) ? Number(feature.minimum) : 0;
    const maximum = Number.isFinite(Number(feature.maximum)) ? Number(feature.maximum) : 100;
    return (
      <div className="ac-range-editor">
        <input type="range" min={minimum} max={maximum} value={Number(resolved)} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
        <label>Value
          <input type="number" min={minimum} max={maximum} value={Number(resolved)} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
        </label>
      </div>
    );
  }
  return (
    <label className="ac-compact-field">Setting
      <input value={String(resolved ?? "")} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function arrayData(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export default function AdminControlCenter({ onExit }) {
  const headingId = useId();
  const centerRequestRef = useRef(0);
  const [workspaces, setWorkspaces] = useState(null);
  const [workspaceKey, setWorkspaceKey] = useState("");
  const [center, setCenter] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [featureQuery, setFeatureQuery] = useState("");
  const [featureReadiness, setFeatureReadiness] = useState("");
  const [drafts, setDrafts] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewInput, setPreviewInput] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [criticalConfirmation, setCriticalConfirmation] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPathway, setSearchPathway] = useState("");
  const [searchResults, setSearchResults] = useState({ accounts: [], courses: [] });
  const [searchBusy, setSearchBusy] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [connectionForms, setConnectionForms] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [teamInvite, setTeamInvite] = useState({ email: "", role: "admin", permissions: {} });
  const [platformAuthorization, setPlatformAuthorization] = useState(DEFAULT_PLATFORM_AUTHORIZATION);
  const [platformAccountQuery, setPlatformAccountQuery] = useState("");
  const [platformAccountResults, setPlatformAccountResults] = useState([]);
  const [platformAuthorizationPreview, setPlatformAuthorizationPreview] = useState(null);
  const [reviewDecision, setReviewDecision] = useState(null);
  const [report, setReport] = useState({ type: "feature_inventory", format: "csv" });
  const [actionBusy, setActionBusy] = useState("");

  const institutionId = workspaceKey.startsWith("institution:") ? workspaceKey.slice("institution:".length) : null;
  const selectedWorkspace = institutionId
    ? workspaces?.institutions?.find((workspace) => workspace.id === institutionId)
    : null;
  const isPlatformWorkspace = !institutionId;
  const access = center?.access || {};

  async function loadWorkspaces() {
    setLoading(true);
    setError("");
    try {
      const result = await adminService.getAdminWorkspaces();
      setWorkspaces(result);
      const institutions = Array.isArray(result?.institutions) ? result.institutions : [];
      const firstKey = result?.platform_access ? "platform" : institutions[0] ? `institution:${institutions[0].id}` : "";
      setWorkspaceKey((current) => current || firstKey);
      if (!firstKey) setError("This account has no approved administration workspace. Ask the platform owner or institution owner to assign access.");
    } catch (nextError) {
      setError(friendlyError(nextError, "Administration workspaces could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  async function loadCenter(targetInstitutionId = institutionId) {
    if (!workspaceKey) return;
    const requestId = ++centerRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await adminService.getAdminControlCenter(targetInstitutionId || null);
      if (requestId !== centerRequestRef.current) return;
      setCenter(result);
      if (!targetInstitutionId && result?.access?.platform_access && Array.isArray(result?.institutions)) {
        setWorkspaces((previous) => {
          if (!previous) return previous;
          const byId = new Map((previous.institutions || []).map((item) => [item.id, item]));
          result.institutions.forEach((institution) => {
            byId.set(institution.id, {
              role: result?.access?.platform_owner ? "platform owner" : "platform delegate",
              permissions: {},
              ...byId.get(institution.id),
              ...institution,
            });
          });
          return { ...previous, institutions: [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "en-US")) };
        });
      }
      setNotice("");
    } catch (nextError) {
      if (requestId !== centerRequestRef.current) return;
      setCenter(null);
      setError(friendlyError(nextError, "The selected administration workspace could not be loaded."));
    } finally {
      if (requestId === centerRequestRef.current) setLoading(false);
    }
  }

  function changeWorkspace(nextWorkspaceKey) {
    centerRequestRef.current += 1;
    setWorkspaceKey(nextWorkspaceKey);
    setCenter(null);
    setActiveTab("overview");
    setDrafts({});
    setPreview(null);
    setPreviewInput(null);
    setSelectedTarget(null);
    setSearchResults({ accounts: [], courses: [] });
    setPlatformAccountResults([]);
    setPlatformAuthorization(DEFAULT_PLATFORM_AUTHORIZATION);
    setPlatformAuthorizationPreview(null);
    setReviewDecision(null);
    setConnectionForms({});
    setReviewNotes({});
    setNotice("");
    setError("");
  }

  useEffect(() => { loadWorkspaces(); }, []);
  useEffect(() => {
    if (workspaceKey) loadCenter(institutionId);
  }, [workspaceKey]);

  const features = useMemo(() => {
    if (Array.isArray(center?.features)) return center.features.map(normalizeFeature);
    return FEATURE_CATALOG.map(normalizeFeature);
  }, [center?.features]);

  const visibleFeatures = useMemo(() => {
    if (!["student", "professor", "publisher"].includes(activeTab)) return [];
    return filterFeatures(features, {
      query: featureQuery,
      pathway: activeTab,
      includeShared: true,
      includeIntegrations: true,
      readiness: featureReadiness || undefined,
    });
  }, [features, activeTab, featureQuery, featureReadiness]);

  function currentDraft(feature) {
    const stored = drafts[feature.key] || {};
    const availableScopes = scopeOptions(feature).map(([value]) => value);
    const preferredScope = institutionId ? "institution" : "platform";
    const initialScope = availableScopes.includes(preferredScope) ? preferredScope : availableScopes[0] || "";
    const scopeType = availableScopes.includes(stored.scopeType) ? stored.scopeType : initialScope;
    const context = policyContext(scopeType, institutionId, activeTab, selectedTarget);
    return {
      ...DEFAULT_CONTROL,
      ...stored,
      scopeType,
      value: stored.value !== undefined ? stored.value : policyValue(feature, center?.policies, context),
    };
  }

  function updateDraft(featureKey, patch) {
    setDrafts((previous) => ({
      ...previous,
      [featureKey]: { ...DEFAULT_CONTROL, ...previous[featureKey], ...patch },
    }));
  }

  const scopeOptions = useCallback((feature) => {
    const allowed = new Set(feature.allowedScopes || []);
    const options = [];
    if (isPlatformWorkspace && allowed.has("platform")) options.push(["platform", "Entire EdNotebook platform"]);
    if (isPlatformWorkspace && allowed.has("pathway")) options.push(["platform_pathway", `All ${activeTab} pathway accounts`]);
    if (institutionId && allowed.has("institution") && feature.institutionDelegable !== false) options.push(["institution", `${selectedWorkspace?.name || "This institution"} — all pathways`]);
    if (institutionId && allowed.has("pathway") && feature.institutionDelegable !== false) options.push(["institution_pathway", `${selectedWorkspace?.name || "This institution"} — ${activeTab} pathway`]);
    if (selectedTarget?.type === "course" && allowed.has("course")) options.push(["course", `Course: ${selectedTarget.label}`]);
    if (selectedTarget?.type === "account" && allowed.has("account")) options.push(["account", `Account: ${selectedTarget.label}`]);
    return options;
  }, [activeTab, institutionId, isPlatformWorkspace, selectedTarget, selectedWorkspace?.name]);

  useEffect(() => {
    setDrafts((previous) => {
      let changed = false;
      const next = { ...previous };
      features.forEach((feature) => {
        const stored = previous[feature.key];
        if (!stored) return;
        const availableScopes = scopeOptions(feature).map(([value]) => value);
        const preferredScope = institutionId ? "institution" : "platform";
        const normalizedScope = availableScopes.includes(stored.scopeType)
          ? stored.scopeType
          : availableScopes.includes(preferredScope) ? preferredScope : availableScopes[0] || "";
        if (stored.scopeType !== normalizedScope) {
          next[feature.key] = { ...stored, scopeType: normalizedScope };
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [features, institutionId, scopeOptions]);

  function makeControlInput(feature, draft) {
    const toIso = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };
    const targetInstitutionId = selectedTarget?.institutionId || institutionId || null;
    const scopeIds = {
      platform: { institutionId: null, pathway: null, courseId: null, userId: null },
      platform_pathway: { institutionId: null, pathway: activeTab, courseId: null, userId: null },
      institution: { institutionId, pathway: null, courseId: null, userId: null },
      institution_pathway: { institutionId, pathway: activeTab, courseId: null, userId: null },
      course: {
        institutionId: targetInstitutionId,
        pathway: null,
        courseId: selectedTarget?.type === "course" ? selectedTarget.id : null,
        userId: null,
      },
      account: {
        institutionId: targetInstitutionId,
        pathway: null,
        courseId: null,
        userId: selectedTarget?.type === "account" ? selectedTarget.id : null,
      },
    }[draft.scopeType] || { institutionId: null, pathway: null, courseId: null, userId: null };
    return {
      feature_key: feature.key,
      scope_type: draft.scopeType,
      institution_id: scopeIds.institutionId,
      pathway: scopeIds.pathway,
      course_id: scopeIds.courseId,
      user_id: scopeIds.userId,
      control_value: draft.value,
      lock_descendants: Boolean(draft.lockDescendants),
      starts_at: draft.scheduled ? toIso(draft.startsAt) : null,
      ends_at: draft.scheduled ? toIso(draft.endsAt) : null,
      weekdays: draft.scheduled ? draft.weekdays : EVERY_WEEKDAY,
      local_start_time: draft.scheduled ? draft.localStartTime || null : null,
      local_end_time: draft.scheduled ? draft.localEndTime || null : null,
      timezone_name: draft.scheduled ? draft.timezoneName : null,
    };
  }

  async function openPreview(feature) {
    const draft = currentDraft(feature);
    const availableScopes = scopeOptions(feature).map(([value]) => value);
    if (!availableScopes.includes(draft.scopeType)) {
      setError("Choose an available scope before previewing this change.");
      return;
    }
    if (draft.scheduled && (!Array.isArray(draft.weekdays) || draft.weekdays.length === 0)) {
      setError("Choose at least one day for a scheduled control.");
      return;
    }
    if (draft.scheduled && draft.startsAt && draft.endsAt && new Date(draft.startsAt) >= new Date(draft.endsAt)) {
      setError("The scheduled end must be after the start.");
      return;
    }
    const input = makeControlInput(feature, draft);
    setPreviewBusy(true);
    setError("");
    setChangeReason("");
    setWarningAcknowledged(false);
    setCriticalConfirmation("");
    try {
      const result = await adminService.previewFeatureControlChange(input);
      setPreview({ ...result, feature, serverVerified: true });
      setPreviewInput(input);
    } catch (nextError) {
      const local = buildControlImpact({
        feature,
        previousValue: policyValue(feature, center?.policies, policyContext(draft.scopeType, institutionId, activeTab, selectedTarget)),
        nextValue: draft.value,
        scope: draft.scopeType.includes("pathway") ? "pathway" : draft.scopeType,
        scopeLabel: scopeOptions(feature).find(([value]) => value === draft.scopeType)?.[1] || draft.scopeType,
        startsAt: input.starts_at,
        endsAt: input.ends_at,
      });
      setPreview({
        ...local,
        feature,
        display_name: feature.name,
        affected_accounts: local.affected.accounts,
        affected_courses: local.affected.courses,
        serverVerified: false,
        previewError: friendlyError(nextError, "A server impact preview is required before this change can be applied."),
      });
      setPreviewInput(input);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function applyPreviewedChange() {
    if (!preview?.serverVerified || !preview?.checksum || !previewInput) return;
    const warnings = (preview.warnings || []).map(normalizeWarning);
    const hasCritical = warnings.some((warning) => warning.severity === "critical");
    if (warnings.length && !warningAcknowledged) return;
    if (hasCritical && criticalConfirmation.trim().toUpperCase() !== "APPLY") return;
    setActionBusy("feature-change");
    setError("");
    try {
      await adminService.applyFeatureControlChange({
        ...previewInput,
        reason: changeReason.trim(),
        warning_acknowledgements: warnings.map((warning) => warning.code),
      }, preview.checksum);
      setPreview(null);
      setPreviewInput(null);
      setNotice(`${preview.display_name || preview.feature?.name || "Feature"} was updated. The change and affected scope were added to the version log.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The change could not be applied."));
    } finally {
      setActionBusy("");
    }
  }

  async function runSearch(event) {
    event?.preventDefault();
    setSearchBusy(true);
    setError("");
    try {
      const result = await adminService.searchAdminAccountsCourses(searchQuery, institutionId, searchPathway || null);
      setSearchResults({ accounts: result?.accounts || [], courses: result?.courses || [] });
    } catch (nextError) {
      setError(friendlyError(nextError, "Accounts and courses could not be searched."));
    } finally {
      setSearchBusy(false);
    }
  }

  function chooseAccount(account) {
    if (!access.can_view_feature_controls && !access.can_control_features) {
      setNotice("This delegated role may review the account summary but cannot open feature controls.");
      return;
    }
    setSelectedTarget({
      type: "account",
      id: account.user_id,
      institutionId: account.institution_id || institutionId,
      pathway: account.pathway,
      label: account.full_name || account.email || account.user_id,
    });
    if (["student", "professor", "publisher"].includes(account.pathway)) setActiveTab(account.pathway);
    else setActiveTab("student");
    setNotice("Individual account selected. Compatible feature controls now include an account-only scope.");
  }

  function chooseCourse(course) {
    if (!access.can_view_feature_controls && !access.can_control_features) {
      setNotice("This delegated role may review the course summary but cannot open feature controls.");
      return;
    }
    setSelectedTarget({
      type: "course",
      id: course.id,
      institutionId: course.institution_id || institutionId,
      label: [course.course_code, course.title].filter(Boolean).join(" — "),
    });
    setActiveTab("professor");
    setNotice("Course selected. Compatible feature controls now include a course-only scope.");
  }

  async function recordConnectionTest(connection) {
    const form = connectionForms[connection.id] || {};
    if (!form.safeSummary?.trim()) {
      setError("Add a plain-language test summary. Do not include credentials or private records.");
      return;
    }
    setActionBusy(`test:${connection.id}`);
    try {
      await adminService.recordConnectionTest(connection.id, form.capabilityKey || "", form.testStatus || "passed", form.safeSummary, {});
      setNotice(`${connection.display_name} test evidence was recorded.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "Connection test evidence could not be recorded."));
    } finally {
      setActionBusy("");
    }
  }

  async function updateConnectionStatus(connection) {
    const form = connectionForms[connection.id] || {};
    if (!form.statusReason?.trim()) {
      setError("Explain why the connection status is changing.");
      return;
    }
    setActionBusy(`connection:${connection.id}`);
    try {
      await adminService.setConnectionStatus(connection.id, form.nextStatus || connection.activation_status, form.statusReason);
      setNotice(`${connection.display_name} status was updated and logged.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The connection status could not be changed."));
    } finally {
      setActionBusy("");
    }
  }

  async function reviewApplication(application, decision) {
    setActionBusy(`application:${application.id}`);
    setError("");
    try {
      await adminService.reviewInstitutionApplication(application.id, decision, reviewNotes[application.id] || "");
      setNotice(`Application ${application.application_number || application.id} was ${decision}.`);
      setReviewDecision(null);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The application decision could not be saved."));
    } finally { setActionBusy(""); }
  }

  async function reviewTransfer(transfer, decision) {
    setActionBusy(`transfer:${transfer.id}`);
    setError("");
    try {
      await adminService.reviewInstitutionTransfer(transfer.id, decision, reviewNotes[transfer.id] || "");
      setNotice(`Transfer request was ${decision}. Prior and new institution boundaries will follow the reviewed decision.`);
      setReviewDecision(null);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The transfer decision could not be saved."));
    } finally { setActionBusy(""); }
  }

  async function reviewAffiliation(request, decision) {
    setActionBusy(`affiliation:${request.user_id}`);
    setError("");
    try {
      await adminService.reviewInstitutionAffiliation(request.user_id, decision);
      setNotice(`${request.full_name || request.email || "The account"}'s institution ${request.requested_role === "professor" ? "professor" : "student"} request was ${decision}.`);
      setReviewDecision(null);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The institution affiliation decision could not be saved."));
    } finally { setActionBusy(""); }
  }

  function requestReviewDecision(kind, record, decision) {
    const approved = decision === "approved";
    const recordId = kind === "affiliation" ? record.user_id : record.id;
    const reason = kind === "affiliation" ? "" : String(reviewNotes[recordId] || "").trim();
    if (kind !== "affiliation" && reason.length < 8) {
      setError("Add review notes with at least eight characters before previewing this decision.");
      return;
    }

    const details = kind === "application"
      ? {
          subject: record.display_name || record.legal_name || record.application_number || "Institution application",
          impact: approved
            ? "Approval creates an institution boundary and may establish the reviewed applicant's institution administration relationship."
            : "Rejection closes this application without creating an institution workspace or administrator relationship.",
        }
      : kind === "transfer"
        ? {
            subject: record.requested_institution_name || `Transfer for account ${record.user_id}`,
            impact: approved
              ? "Approval changes the account's institution boundary, ends inappropriate prior access, and preserves required history."
              : "Rejection preserves the current institution boundary and records that this transfer was not approved.",
          }
        : {
            subject: record.full_name || record.email || `Account ${record.user_id}`,
            impact: approved
              ? `Approval activates this ${record.requested_role === "professor" ? "professor" : "student"} affiliation inside the selected institution boundary.`
              : "Rejection ends the pending affiliation and does not grant institution course, roster, or grade access.",
          };

    setError("");
    setReviewDecision({
      kind,
      record,
      decision,
      reason,
      ...details,
      confirmationWord: approved ? "APPROVE" : "REJECT",
      busyKey: `${kind === "application" ? "application" : kind === "transfer" ? "transfer" : "affiliation"}:${recordId}`,
    });
  }

  async function applyReviewDecision() {
    if (!reviewDecision) return;
    if (reviewDecision.kind === "application") {
      await reviewApplication(reviewDecision.record, reviewDecision.decision);
    } else if (reviewDecision.kind === "transfer") {
      await reviewTransfer(reviewDecision.record, reviewDecision.decision);
    } else {
      await reviewAffiliation(reviewDecision.record, reviewDecision.decision);
    }
  }

  async function inviteTeamMember(event) {
    event.preventDefault();
    if (!institutionId) return;
    setActionBusy("team-invite");
    try {
      await adminService.inviteInstitutionTeamMember(institutionId, teamInvite.email, teamInvite.role, teamInvite.permissions);
      setTeamInvite({ email: "", role: "admin", permissions: {} });
      setNotice("Team invitation created. The invited account receives only the assigned institutional role and permissions.");
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The team invitation could not be created."));
    } finally { setActionBusy(""); }
  }

  async function updateTeamMember(member, patch) {
    setActionBusy(`member:${member.user_id}`);
    try {
      await adminService.setInstitutionTeamMember(
        institutionId,
        member.user_id,
        patch.role || member.role,
        patch.permissions || member.permissions || {},
        patch.status || member.status,
      );
      setNotice(`${member.full_name || member.email} access was updated and logged.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "Team access could not be changed."));
    } finally { setActionBusy(""); }
  }

  async function searchPlatformAccounts(event) {
    event.preventDefault();
    if (!access.platform_owner) return;
    if (platformAccountQuery.trim().length < 2) {
      setError("Enter at least two characters from the account name or email address.");
      return;
    }
    setActionBusy("platform-account-search");
    setError("");
    try {
      const result = await adminService.searchAdminAccountsCourses(platformAccountQuery, null, null);
      const accountsById = new Map();
      (result?.accounts || []).forEach((account) => {
        if (account?.user_id && !accountsById.has(account.user_id)) accountsById.set(account.user_id, account);
      });
      setPlatformAccountResults([...accountsById.values()]);
    } catch (nextError) {
      setError(friendlyError(nextError, "Platform accounts could not be searched."));
    } finally { setActionBusy(""); }
  }

  function editPlatformAuthorization(account, existing = null) {
    if (account?.platform_owner || account?.is_platform_owner) {
      setError("The platform owner account is not a delegated authorization and cannot be changed here.");
      return;
    }
    const matching = existing || (center?.platform_authorizations || []).find((item) => item.user_id === account?.user_id);
    const accessLevel = matching?.access_level || "auditor";
    setPlatformAuthorization({
      userId: account?.user_id || matching?.user_id || "",
      account: {
        user_id: account?.user_id || matching?.user_id,
        full_name: account?.full_name || matching?.full_name || matching?.profile?.full_name || "Name not provided",
        email: account?.email || matching?.email || matching?.profile?.email || "Email not available",
      },
      accessLevel,
      capabilities: matching
        ? Object.fromEntries(PLATFORM_CAPABILITIES.map(([key]) => [key, Boolean(matching.capabilities?.[key])]))
        : { ...(PLATFORM_ROLE_DEFAULTS[accessLevel] || {}) },
      status: matching?.status || "active",
      expiresAt: toLocalDateTimeInput(matching?.expires_at),
      reason: "",
      expectedUpdatedAt: matching?.updated_at || null,
    });
    setPlatformAuthorizationPreview(null);
  }

  function previewPlatformAuthorization(event) {
    event.preventDefault();
    if (!access.platform_owner || !platformAuthorization.userId) {
      setError("Select an existing account before reviewing platform access.");
      return;
    }
    const enabledCapabilities = PLATFORM_CAPABILITIES
      .filter(([key]) => Boolean(platformAuthorization.capabilities?.[key]))
      .map(([key, label]) => ({ key, label }));
    if (platformAuthorization.status === "active" && !enabledCapabilities.length) {
      setError("Choose at least one capability before activating delegated platform access.");
      return;
    }
    if (platformAuthorization.reason.trim().length < 8) {
      setError("Explain the reason for this access change using at least eight characters.");
      return;
    }
    const expiresAt = platformAuthorization.expiresAt ? new Date(platformAuthorization.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || (platformAuthorization.status === "active" && expiresAt <= new Date()))) {
      setError("Active access must have a valid future automatic end date.");
      return;
    }
    setError("");
    setPlatformAuthorizationPreview({
      ...platformAuthorization,
      enabledCapabilities,
      expiresAtIso: expiresAt?.toISOString() || null,
      confirmationWord: platformAuthorization.status === "revoked" ? "REVOKE" : platformAuthorization.status === "suspended" ? "SUSPEND" : "AUTHORIZE",
    });
  }

  async function applyPlatformAuthorization() {
    const proposed = platformAuthorizationPreview;
    if (!proposed || !access.platform_owner) return;
    setActionBusy("platform-authorization");
    setError("");
    try {
      await adminService.setPlatformAdminAuthorization({
        userId: proposed.userId,
        accessLevel: proposed.accessLevel,
        capabilities: proposed.capabilities,
        status: proposed.status,
        expiresAt: proposed.expiresAtIso,
        reason: proposed.reason,
        expectedUpdatedAt: proposed.expectedUpdatedAt,
      });
      setPlatformAuthorizationPreview(null);
      setPlatformAuthorization(DEFAULT_PLATFORM_AUTHORIZATION);
      setPlatformAccountResults([]);
      setPlatformAccountQuery("");
      setNotice(`${proposed.account?.full_name || proposed.account?.email || "Delegated platform access"} was updated. The authorization remains separate from platform ownership and the change was logged.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "Delegated platform access could not be updated."));
    } finally { setActionBusy(""); }
  }

  async function generateReport(event) {
    event.preventDefault();
    setActionBusy("report");
    try {
      const result = await adminService.generateAdminControlReport(institutionId, report.type, {});
      const rows = arrayData(result?.data ?? result);
      const timestamp = new Date().toISOString().replaceAll(":", "-");
      if (report.format === "csv") {
        downloadText(`ednotebook-${report.type}-${timestamp}.csv`, `\uFEFF${serializeReportToCsv(rows)}`, "text/csv;charset=utf-8");
      } else {
        downloadText(`ednotebook-${report.type}-${timestamp}.json`, JSON.stringify({
          report_type: report.type,
          scope: institutionId ? "institution" : "platform",
          institution_id: institutionId,
          generated_at: result?.generated_at || new Date().toISOString(),
          data: rows,
        }, null, 2), "application/json;charset=utf-8");
      }
      setNotice(`The ${titleCase(report.type)} report was generated, logged, and downloaded without connection secrets.`);
      await loadCenter();
    } catch (nextError) {
      setError(friendlyError(nextError, "The report could not be generated."));
    } finally { setActionBusy(""); }
  }

  const navTabs = useMemo(() => TABS.filter(([id]) => {
    if (id === "overview") return true;
    if (["student", "professor", "publisher"].includes(id)) {
      return Boolean(access.platform_owner || access.can_view_feature_controls || access.can_control_features);
    }
    if (id === "connections") {
      return Boolean(access.platform_owner || access.can_view_integrations || access.can_test_integrations || access.can_manage_integrations);
    }
    if (id === "accounts") return Boolean(access.platform_owner || access.can_view_accounts);
    if (id === "institutions") return Boolean(access.platform_owner || (institutionId && access.can_manage_affiliations));
    if (id === "platform-access") return Boolean(access.platform_owner);
    if (id === "team") return Boolean(institutionId && (access.platform_owner || access.can_manage_team || access.can_view_accounts));
    if (id === "changes-reports") {
      return Boolean(access.platform_owner || access.can_view_audit || access.can_view_reports || access.can_export_reports);
    }
    return false;
  }), [
    institutionId,
    access.platform_owner,
    access.can_view_feature_controls,
    access.can_control_features,
    access.can_view_integrations,
    access.can_test_integrations,
    access.can_manage_integrations,
    access.can_view_accounts,
    access.can_view_audit,
    access.can_view_reports,
    access.can_export_reports,
    access.can_manage_affiliations,
    access.can_manage_team,
  ]);

  useEffect(() => {
    if (!center || navTabs.some(([id]) => id === activeTab)) return;
    setActiveTab(navTabs[0]?.[0] || "overview");
  }, [activeTab, center, navTabs]);

  if (loading && !center) {
    return <main className="ac-center ac-loading" aria-busy="true"><p>Loading the approved administration workspace…</p></main>;
  }

  return (
    <main className="ac-center" aria-labelledby={headingId}>
      <header className="ac-topbar">
        <div>
          <p className="ac-eyebrow">Restricted administration</p>
          <h1 id={headingId}>EdNotebook control center</h1>
          <p>Plain-language controls for features, institutional boundaries, connections, testing, and accountability.</p>
        </div>
        <div className="ac-topbar-actions">
          <label>Administration workspace
            <select value={workspaceKey} onChange={(event) => changeWorkspace(event.target.value)}>
              {workspaces?.platform_access ? <option value="platform">EdNotebook platform — {workspaces?.platform_owner ? "owner controls" : "delegated review"}</option> : null}
              {(workspaces?.institutions || []).map((workspace) => <option key={workspace.id} value={`institution:${workspace.id}`}>{workspace.name} — {titleCase(workspace.role)}</option>)}
            </select>
          </label>
          <button type="button" className="ac-button ac-button--quiet" onClick={() => loadCenter()} disabled={loading}>Refresh</button>
          <a className="ac-button ac-button--quiet" href="#/admin/tos-integration">TOS integration preview</a>
          <a className="ac-button ac-button--quiet" href="#/admin/synthetic-pilot">Synthetic institution pilot</a>
          {onExit ? <button type="button" className="ac-button ac-button--quiet" onClick={onExit}>Exit admin</button> : null}
        </div>
      </header>

      <div className="ac-scope-banner">
        <strong>{isPlatformWorkspace ? (access.platform_owner ? "Platform owner scope" : "Delegated platform scope") : selectedWorkspace?.name || center?.institutions?.[0]?.name || "Institution scope"}</strong>
        <span>{isPlatformWorkspace
          ? access.platform_owner
            ? "Platform-wide owner controls can affect every institution. Delegated platform access remains limited to explicitly assigned review and testing capabilities."
            : "This is delegated platform access, not platform ownership. Only the explicitly assigned review and testing capabilities are available."
          : "Every list, search, control, report, and connection shown here is limited to this institution unless a platform-only item is clearly labeled."}</span>
        <HelpTip title="Workspace boundary">Switching workspaces changes what can be viewed and controlled. It does not copy people, courses, grades, or settings between institutions.</HelpTip>
      </div>

      {selectedTarget ? (
        <div className="ac-target-banner" role="status">
          <span><strong>{titleCase(selectedTarget.type)} selected:</strong> {selectedTarget.label}</span>
          <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => setSelectedTarget(null)}>Clear individual scope</button>
        </div>
      ) : null}
      {error ? <div className="ac-alert ac-alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="ac-alert ac-alert--success" role="status">{notice}</div> : null}

      <nav className="ac-tabs" aria-label="Control center sections">
        {navTabs.map(([id, label]) => (
          <button key={id} type="button" aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </nav>

      <section className="ac-content" aria-live="polite" aria-busy={loading}>
        {activeTab === "overview" ? (
          <OverviewPanel center={center} access={access} isPlatformWorkspace={isPlatformWorkspace} setActiveTab={setActiveTab} />
        ) : null}

        {["student", "professor", "publisher"].includes(activeTab) ? (
          <section className="ac-panel">
            <div className="ac-section-heading">
              <div>
                <p className="ac-eyebrow">{titleCase(activeTab)} pathway template</p>
                <h2>{titleCase(activeTab)} features</h2>
                <p>Set a broad template, or use a selected course or account for an authorized exception. A preview is required before any change.</p>
              </div>
              <HelpTip title={`${titleCase(activeTab)} pathway controls`}>Pathway controls change availability, timing, or approved options. They never bypass role checks, institution boundaries, course membership, grade privacy, or required accessibility protections.</HelpTip>
            </div>
            {!access.can_control_features ? <div className="ac-callout ac-callout--warning">This role may review feature status but cannot apply changes.</div> : null}
            <div className="ac-filter-bar">
              <label>Search features
                <input type="search" value={featureQuery} onChange={(event) => setFeatureQuery(event.target.value)} placeholder="Search by feature, purpose, or category" />
              </label>
              <label>Readiness
                <select value={featureReadiness} onChange={(event) => setFeatureReadiness(event.target.value)}>
                  <option value="">All readiness levels</option>
                  <option value="implemented">Implemented</option>
                  <option value="pilot_testing">Pilot testing</option>
                  <option value="deployment_required">Deployment required</option>
                  <option value="built_in_part">Built in part</option>
                  <option value="demonstration">Demonstration</option>
                  <option value="planned">Planned</option>
                </select>
              </label>
              <span className="ac-result-count">{visibleFeatures.length} feature{visibleFeatures.length === 1 ? "" : "s"}</span>
            </div>
            <div className="ac-feature-list">
              {visibleFeatures.map((feature) => {
                const draft = currentDraft(feature);
                const scopes = scopeOptions(feature);
                const selectedScope = scopes.some(([value]) => value === draft.scopeType) ? draft.scopeType : scopes[0]?.[0] || "";
                const currentValue = policyValue(
                  feature,
                  center?.policies,
                  policyContext(selectedScope, institutionId, activeTab, selectedTarget),
                );
                return (
                  <article className="ac-feature-card" key={feature.key}>
                    <div className="ac-feature-heading">
                      <div>
                        <div className="ac-card-kickers"><span>{feature.category}</span><StatusPill status={feature.readiness} /><StatusPill status={feature.sensitivity} label={`${titleCase(feature.sensitivity)} impact`} /></div>
                        <h3>{feature.name} <HelpTip title={feature.name}>{feature.helpText || feature.description}</HelpTip></h3>
                        <p>{feature.description}</p>
                      </div>
                      <code>{feature.key}</code>
                    </div>
                    {feature.readiness !== "implemented" ? <div className="ac-callout ac-callout--neutral"><strong>Readiness:</strong> {titleCase(feature.readiness)}. A control does not make undeployed code or an untested connection production-ready.</div> : null}
                    {!scopes.length ? <div className="ac-callout ac-callout--warning"><strong>Review only in this workspace.</strong> This feature is not delegated at the selected institution, pathway, course, or account scope. A platform owner must manage it from an authorized platform workspace.</div> : null}
                    <div className="ac-control-grid">
                      <ControlValueEditor feature={feature} value={draft.value} onChange={(value) => updateDraft(feature.key, { value })} disabled={!access.can_control_features} />
                      <label className="ac-compact-field">Who this controls
                        <select value={selectedScope} onChange={(event) => updateDraft(feature.key, { scopeType: event.target.value })} disabled={!access.can_control_features || !scopes.length}>
                          {scopes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      {feature.lockable && ["platform", "platform_pathway", "institution", "institution_pathway"].includes(selectedScope) ? (
                        <label className="ac-check ac-control-lock">
                          <input type="checkbox" checked={draft.lockDescendants} onChange={(event) => updateDraft(feature.key, { lockDescendants: event.target.checked })} disabled={!access.can_control_features} />
                          <span>Lock this setting below this scope <HelpTip title="Setting lock">A lock prevents lower-level course or account controls from widening or changing this setting. Accessibility and security requirements still take priority.</HelpTip></span>
                        </label>
                      ) : null}
                    </div>
                    <details className="ac-schedule">
                      <summary>Time controls and automatic end</summary>
                      <label className="ac-check">
                        <input type="checkbox" checked={draft.scheduled} onChange={(event) => updateDraft(feature.key, { scheduled: event.target.checked })} disabled={!access.can_control_features} />
                        <span>Use a schedule for this control</span>
                      </label>
                      {draft.scheduled ? (
                        <div className="ac-schedule-grid">
                          <label>Starts<input type="datetime-local" value={draft.startsAt} onChange={(event) => updateDraft(feature.key, { startsAt: event.target.value })} /></label>
                          <label>Ends<input type="datetime-local" value={draft.endsAt} onChange={(event) => updateDraft(feature.key, { endsAt: event.target.value })} /></label>
                          <label>Daily start<input type="time" value={draft.localStartTime} onChange={(event) => updateDraft(feature.key, { localStartTime: event.target.value })} /></label>
                          <label>Daily end<input type="time" value={draft.localEndTime} onChange={(event) => updateDraft(feature.key, { localEndTime: event.target.value })} /></label>
                          <label>Timezone<input value={draft.timezoneName} onChange={(event) => updateDraft(feature.key, { timezoneName: event.target.value })} /></label>
                          <fieldset><legend>Days</legend><div className="ac-weekdays">{WEEKDAYS.map(([day, label]) => <label key={day}><input type="checkbox" checked={draft.weekdays.includes(day)} onChange={(event) => updateDraft(feature.key, { weekdays: event.target.checked ? [...draft.weekdays, day].sort() : draft.weekdays.filter((item) => item !== day) })} />{label}</label>)}</div></fieldset>
                        </div>
                      ) : null}
                    </details>
                    <div className="ac-feature-footer">
                      <span>Current value: <strong>{String(currentValue)}</strong> · Turning off will <strong>{titleCase(feature.disableBehavior)}</strong> access while preserving records as designed.</span>
                      <button type="button" className="ac-button ac-button--primary" onClick={() => openPreview(feature)} disabled={!access.can_control_features || previewBusy || feature.alwaysOn || !scopes.length}>{previewBusy ? "Preparing preview…" : "Preview change"}</button>
                    </div>
                  </article>
                );
              })}
              {!visibleFeatures.length ? <div className="ac-empty">No features match these filters.</div> : null}
            </div>
          </section>
        ) : null}

        {activeTab === "connections" ? (
          <ConnectionsPanel
            connections={center?.connections || []}
            canTest={Boolean(access.can_test_integrations || access.can_manage_integrations)}
            canChange={Boolean(access.can_manage_integrations)}
            forms={connectionForms}
            setForms={setConnectionForms}
            actionBusy={actionBusy}
            recordTest={recordConnectionTest}
            updateStatus={updateConnectionStatus}
          />
        ) : null}

        {activeTab === "accounts" ? (
          <AccountsPanel
            query={searchQuery} setQuery={setSearchQuery}
            pathway={searchPathway} setPathway={setSearchPathway}
            results={searchResults} busy={searchBusy} onSearch={runSearch}
            chooseAccount={chooseAccount} chooseCourse={chooseCourse}
            institutionScoped={Boolean(institutionId)}
            canUseFeatureScopes={Boolean(access.can_view_feature_controls || access.can_control_features)}
          />
        ) : null}

        {activeTab === "institutions" ? (
          <InstitutionsPanel
            center={center}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
            requestReviewDecision={requestReviewDecision}
            platformOwner={Boolean(access.platform_owner)}
            canReviewAffiliations={Boolean(access.can_manage_affiliations)}
            canReviewTransfers={Boolean(access.platform_owner)}
            actionBusy={actionBusy}
          />
        ) : null}

        {activeTab === "platform-access" && access.platform_owner ? (
          <PlatformAccessPanel
            center={center}
            query={platformAccountQuery}
            setQuery={setPlatformAccountQuery}
            results={platformAccountResults}
            onSearch={searchPlatformAccounts}
            draft={platformAuthorization}
            setDraft={setPlatformAuthorization}
            selectAccount={editPlatformAuthorization}
            onPreview={previewPlatformAuthorization}
            actionBusy={actionBusy}
          />
        ) : null}

        {activeTab === "team" ? (
          <TeamPanel
            center={center} canManage={access.can_manage_team}
            currentUserId={access.current_user_id}
            platformOwner={Boolean(access.platform_owner)}
            invite={teamInvite} setInvite={setTeamInvite} onInvite={inviteTeamMember}
            updateMember={updateTeamMember} actionBusy={actionBusy}
          />
        ) : null}

        {activeTab === "changes-reports" ? (
          <ChangesReportsPanel
            center={center} canExport={access.can_export_reports}
            canViewAudit={Boolean(access.can_view_audit || access.can_export_reports)}
            canViewReports={Boolean(access.can_view_reports || access.can_export_reports)}
            report={report} setReport={setReport} generateReport={generateReport}
            actionBusy={actionBusy}
          />
        ) : null}
      </section>

      {preview ? (
        <ImpactDialog
          preview={preview}
          reason={changeReason}
          setReason={setChangeReason}
          acknowledged={warningAcknowledged}
          setAcknowledged={setWarningAcknowledged}
          criticalConfirmation={criticalConfirmation}
          setCriticalConfirmation={setCriticalConfirmation}
          busy={actionBusy === "feature-change"}
          onCancel={() => { setPreview(null); setPreviewInput(null); }}
          onApply={applyPreviewedChange}
        />
      ) : null}
      {platformAuthorizationPreview ? (
        <PlatformAuthorizationDialog
          key={`${platformAuthorizationPreview.userId}:${platformAuthorizationPreview.status}:${platformAuthorizationPreview.expiresAtIso || "none"}`}
          preview={platformAuthorizationPreview}
          busy={actionBusy === "platform-authorization"}
          onCancel={() => setPlatformAuthorizationPreview(null)}
          onApply={applyPlatformAuthorization}
        />
      ) : null}
      {reviewDecision ? (
        <ReviewDecisionDialog
          key={`${reviewDecision.kind}:${reviewDecision.record?.id || reviewDecision.record?.user_id}:${reviewDecision.decision}`}
          review={reviewDecision}
          busy={actionBusy === reviewDecision.busyKey}
          onCancel={() => setReviewDecision(null)}
          onApply={applyReviewDecision}
        />
      ) : null}
    </main>
  );
}

function OverviewPanel({ center, access, isPlatformWorkspace, setActiveTab }) {
  const statistics = center?.statistics || {};
  const canViewFeatureControls = Boolean(access?.can_view_feature_controls || access?.can_control_features);
  const canViewConnections = Boolean(access?.can_view_integrations || access?.can_test_integrations || access?.can_manage_integrations);
  const connectionCounts = (center?.connections || []).reduce((counts, connection) => {
    counts[connection.activation_status] = (counts[connection.activation_status] || 0) + 1;
    return counts;
  }, {});
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">At-a-glance status</p><h2>{isPlatformWorkspace ? "Platform oversight" : "Institution oversight"}</h2><p>Counts are limited to this administration workspace. Use the detailed tabs to review evidence or make a controlled change.</p></div></div>
      <div className="ac-stats">
        <StatCard label="Accounts" value={statistics.accounts} note="Authorized membership records" />
        <StatCard label="Courses" value={statistics.courses} note="Courses in this boundary" />
        <StatCard label="Active feature definitions" value={statistics.active_features} note="Available to control or review" />
        <StatCard label="Pending applications" value={statistics.pending_applications} note="Platform-owner review" />
        <StatCard label="Pending transfers" value={statistics.pending_transfers} note="Reviewed institution changes" />
      </div>
      <div className="ac-overview-grid">
        <article className="ac-card">
          <h3>Pathway templates</h3>
          <p>Manage the same understandable feature structure for each account pathway.</p>
          {canViewFeatureControls ? <div className="ac-pathway-actions">
            {["student", "professor", "publisher"].map((pathway) => <button type="button" className="ac-pathway-button" key={pathway} onClick={() => setActiveTab(pathway)}><strong>{titleCase(pathway)}</strong><span>Search and control features</span></button>)}
          </div> : <div className="ac-callout ac-callout--neutral">This assignment does not include feature-control review.</div>}
        </article>
        <article className="ac-card">
          <h3>Connection readiness</h3>
          <dl className="ac-summary-list">
            {Object.entries(connectionCounts).map(([status, count]) => <div key={status}><dt><StatusPill status={status} /></dt><dd>{count}</dd></div>)}
            {!Object.keys(connectionCounts).length ? <div><dt>No connections listed</dt><dd>0</dd></div> : null}
          </dl>
          {canViewConnections ? <button type="button" className="ac-button ac-button--quiet" onClick={() => setActiveTab("connections")}>Review connections and test evidence</button> : <div className="ac-callout ac-callout--neutral">This assignment does not include connection review.</div>}
        </article>
        <article className="ac-card ac-card--wide">
          <h3>Controls do not replace security boundaries</h3>
          <p>Feature switches change permitted availability. Server authorization, row-level data policies, approved institution memberships, course memberships, and verified integration launches continue to decide who can reach protected records.</p>
          <ul className="ac-plain-list"><li>No credentials or service keys are displayed here.</li><li>Every applied control includes an impact preview, reason, warning acknowledgement, and change record.</li><li>Institution administrators can manage only delegated controls for their assigned institution.</li></ul>
        </article>
      </div>
    </section>
  );
}

function ConnectionsPanel({ connections, canTest, canChange, forms, setForms, actionBusy, recordTest, updateStatus }) {
  const updateForm = (id, patch) => setForms((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">Services and integrations</p><h2>Connection readiness and evidence</h2><p>Status labels show what is connected, what needs setup, what needs testing, and what is ready. They never display secrets.</p></div><HelpTip title="Connection controls">A status change records an administrative decision. Connections managed by deployment or an external provider must still be activated in that approved system.</HelpTip></div>
      {!canTest && !canChange ? <div className="ac-callout ac-callout--warning">This role can review connection status but cannot record tests or change activation.</div> : null}
      {canTest && !canChange ? <div className="ac-callout ac-callout--privacy">This delegated role may record safe test evidence. Only the platform owner can change connection readiness or activation.</div> : null}
      <div className="ac-connection-list">
        {connections.map((connection) => {
          const form = forms[connection.id] || {};
          const modelStatus = getConnectionStatusDetails(connection.activation_status);
          const canActivateHere = connection.activation_managed_by === "control_center";
          return (
            <article className="ac-connection-card" key={connection.id}>
              <div className="ac-feature-heading">
                <div><div className="ac-card-kickers"><span>{connection.category}</span><StatusPill status={connection.activation_status} /><StatusPill status={connection.health_status} label={`Health: ${titleCase(connection.health_status)}`} /></div><h3>{connection.display_name}</h3><p>{modelStatus.description}</p></div>
                <span className="ac-provider">{connection.provider}</span>
              </div>
              <dl className="ac-detail-grid">
                <div><dt>Connected to</dt><dd>{connection.connected_to?.length ? connection.connected_to.join(", ") : "No active destinations recorded"}</dd></div>
                <div><dt>Activation pathway</dt><dd>{titleCase(connection.activation_managed_by)}</dd></div>
                <div><dt>Last test</dt><dd>{formatDate(connection.last_tested_at)} · {titleCase(connection.last_test_status)}</dd></div>
                <div><dt>Last sync</dt><dd>{formatDate(connection.last_synced_at)}</dd></div>
                <div><dt>Last successful sync</dt><dd>{formatDate(connection.last_successful_sync_at)}</dd></div>
                <div><dt>Responsible team</dt><dd>{connection.responsible_team || "Not assigned"}</dd></div>
              </dl>
              {connection.next_step ? <div className="ac-callout ac-callout--neutral"><strong>Next step:</strong> {connection.next_step}</div> : null}
              {canTest || canChange ? (
                <div className="ac-connection-controls">
                  {canTest ? <fieldset><legend>Record safe test evidence</legend>
                    <label>Capability (optional)<input value={form.capabilityKey || ""} onChange={(event) => updateForm(connection.id, { capabilityKey: event.target.value })} placeholder="Example: grade export" /></label>
                    <label>Result<select value={form.testStatus || "passed"} onChange={(event) => updateForm(connection.id, { testStatus: event.target.value })}><option value="passed">Passed</option><option value="warning">Passed with warning</option><option value="failed">Failed</option></select></label>
                    <label className="ac-span-all">Plain-language summary<textarea rows="2" value={form.safeSummary || ""} onChange={(event) => updateForm(connection.id, { safeSummary: event.target.value })} placeholder="What was tested and what happened. Do not include secrets or student records." /></label>
                    <button type="button" className="ac-button ac-button--quiet" onClick={() => recordTest(connection)} disabled={actionBusy === `test:${connection.id}`}>{actionBusy === `test:${connection.id}` ? "Recording…" : "Record test"}</button>
                  </fieldset> : null}
                  {canChange ? <fieldset><legend>Change readiness or activation</legend>
                    <label>Status<select value={form.nextStatus || connection.activation_status} onChange={(event) => updateForm(connection.id, { nextStatus: event.target.value })}><option value="setup">Setup needed</option><option value="testing">Testing</option><option value="ready">Ready</option><option value="active" disabled={!canActivateHere || connection.last_test_status !== "passed"}>Active</option><option value="suspended">Suspended</option><option value="retired">Retired</option></select></label>
                    <label className="ac-span-all">Reason<textarea rows="2" value={form.statusReason || ""} onChange={(event) => updateForm(connection.id, { statusReason: event.target.value })} placeholder="Explain the decision and expected effect." /></label>
                    {!canActivateHere ? <p className="ac-inline-status ac-span-all">Activation is completed through {titleCase(connection.activation_managed_by)}, not this switch.</p> : null}
                    <button type="button" className="ac-button ac-button--primary" onClick={() => updateStatus(connection)} disabled={actionBusy === `connection:${connection.id}`}>{actionBusy === `connection:${connection.id}` ? "Saving…" : "Save status"}</button>
                  </fieldset> : null}
                </div>
              ) : null}
            </article>
          );
        })}
        {!connections.length ? <div className="ac-empty">No connection records are available in this workspace.</div> : null}
      </div>
    </section>
  );
}

function AccountsPanel({ query, setQuery, pathway, setPathway, results, busy, onSearch, chooseAccount, chooseCourse, institutionScoped, canUseFeatureScopes }) {
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">Scoped search</p><h2>Accounts and courses</h2><p>{institutionScoped ? "Results are limited to the selected institution." : "Authorized platform results may span institutions and always show their boundary."} {canUseFeatureScopes ? "Select one result to make compatible account-only or course-only feature scopes available." : "This delegated role can review result summaries but cannot open feature controls."}</p></div><HelpTip title="Individual controls">An individual override changes only compatible feature availability for that account or course. It cannot grant institution membership, enrollment, staff authority, or cross-school access.</HelpTip></div>
      <form className="ac-search-form" onSubmit={onSearch}>
        <label>Search name, email, course title, or course code<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approved records" /></label>
        <label>Pathway<select value={pathway} onChange={(event) => setPathway(event.target.value)}><option value="">All pathways</option><option value="student">Student</option><option value="professor">Professor</option><option value="publisher">Publisher</option></select></label>
        <button className="ac-button ac-button--primary" disabled={busy}>{busy ? "Searching…" : "Search"}</button>
      </form>
      <div className="ac-results-grid">
        <section><h3>Accounts <span>{results.accounts.length}</span></h3><div className="ac-result-list">
          {results.accounts.map((account) => <article key={`${account.user_id}:${account.pathway || "none"}`}><div><strong>{account.full_name || "Name not provided"}</strong><span>{account.email}</span><small>{titleCase(account.pathway)} · {titleCase(account.affiliation_status || account.membership_status)}</small></div>{canUseFeatureScopes ? <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => chooseAccount(account)}>Open account feature scope</button> : <span className="ac-inline-status">Review only</span>}</article>)}
          {!results.accounts.length ? <p className="ac-empty">Search to find authorized account records.</p> : null}
        </div></section>
        <section><h3>Courses <span>{results.courses.length}</span></h3><div className="ac-result-list">
          {results.courses.map((course) => <article key={course.id}><div><strong>{course.title}</strong><span>{[course.course_code, course.section_code].filter(Boolean).join(" · ") || "No course code"}</span><small>{titleCase(course.status)} · {safeNumber(course.member_count)} members</small></div>{canUseFeatureScopes ? <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => chooseCourse(course)}>Open course feature scope</button> : <span className="ac-inline-status">Review only</span>}</article>)}
          {!results.courses.length ? <p className="ac-empty">Search to find authorized course records.</p> : null}
        </div></section>
      </div>
    </section>
  );
}

function InstitutionsPanel({ center, reviewNotes, setReviewNotes, requestReviewDecision, platformOwner, canReviewAffiliations, canReviewTransfers, actionBusy }) {
  const pendingApplications = (center?.applications || []).filter((item) => ["pending", "reviewing"].includes(item.status));
  const pendingAffiliations = (center?.onboarding_requests || []).filter((item) => item.verification_status === "pending");
  const pendingTransfers = (center?.transfers || []).filter((item) => ["pending", "reviewing"].includes(item.status));
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">{platformOwner ? "Platform-owner review" : "Institution review"}</p><h2>Institution authorization</h2><p>{platformOwner ? "Approve verified organizations, then assign institution administrators. A directory match or application alone never creates access." : "Review only the student and professor affiliation requests assigned to this institution boundary."}</p></div><HelpTip title="Institution approval">Approval creates an institution boundary and an accountable administrator relationship. Verify authority, domain, privacy, security, accessibility, LMS, and intended-use information before approval.</HelpTip></div>
      <section className="ac-subsection"><h3>Institution workspaces</h3><div className="ac-table-wrap"><table><thead><tr><th>Name</th><th>System</th><th>Code</th><th>Primary LMS</th><th>Status</th></tr></thead><tbody>{(center?.institutions || []).map((institution) => <tr key={institution.id}><td>{institution.name}</td><td>{institution.system_name || "Independent"}</td><td>{institution.institution_code || "Not set"}</td><td>{institution.primary_lms || "Not set"}</td><td><StatusPill status={institution.lifecycle_status} /></td></tr>)}</tbody></table></div></section>
      {platformOwner ? <section className="ac-subsection"><h3>Pending applications <span className="ac-count-badge">{pendingApplications.length}</span></h3>
        <div className="ac-review-list">{pendingApplications.map((application) => <article key={application.id}><div className="ac-review-heading"><div><strong>{application.display_name || application.legal_name}</strong><span>{application.application_number}</span></div><StatusPill status={application.status} /></div><dl className="ac-detail-grid"><div><dt>Applicant</dt><dd>{application.administrator_name} · {application.administrator_email}</dd></div><div><dt>Domain</dt><dd>{application.academic_domain || "Not provided"}</dd></div><div><dt>LMS</dt><dd>{application.primary_lms || "Not provided"}</dd></div><div><dt>Requested pathways</dt><dd>{application.requested_pathways?.join(", ") || "Not provided"}</dd></div><div><dt>Security contact</dt><dd>{application.security_contact_email || "Not provided"}</dd></div><div><dt>Privacy contact</dt><dd>{application.privacy_contact_email || "Not provided"}</dd></div></dl><p>{application.intended_use}</p><label>Review notes<textarea rows="2" value={reviewNotes[application.id] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [application.id]: event.target.value }))} placeholder="Record verification, limitations, or reason for the decision." /></label><div className="ac-form-actions"><button type="button" className="ac-button ac-button--primary" onClick={() => requestReviewDecision("application", application, "approved")} disabled={actionBusy === `application:${application.id}`}>Approve institution</button><button type="button" className="ac-button ac-button--danger" onClick={() => requestReviewDecision("application", application, "rejected")} disabled={actionBusy === `application:${application.id}`}>Reject</button></div></article>)}{!pendingApplications.length ? <div className="ac-empty">No applications are waiting for review.</div> : null}</div>
      </section> : null}
      <section className="ac-subsection"><h3>Pending student and professor affiliations <span className="ac-count-badge">{pendingAffiliations.length}</span></h3><p>Approve only after the account, institution, pathway, and protected identifier match are verified. The last four characters are shown for reconciliation; full identifiers stay protected.</p><div className="ac-review-list">
        {pendingAffiliations.map((request) => <article key={request.user_id}><div className="ac-review-heading"><div><strong>{request.full_name || "Name not provided"}</strong><span>{request.email}</span></div><StatusPill status={request.verification_status} /></div><dl className="ac-detail-grid"><div><dt>Institution</dt><dd>{request.institution_name}</dd></div><div><dt>Pathway</dt><dd>{titleCase(request.requested_role)}</dd></div><div><dt>Department</dt><dd>{request.department || "Not provided"}</dd></div><div><dt>Identifier</dt><dd>{request.identifier_last4 ? `Ending ${request.identifier_last4}` : "Not required for professor review"}</dd></div><div><dt>Division</dt><dd>{titleCase(request.education_division)}</dd></div><div><dt>Requested</dt><dd>{formatDate(request.created_at)}</dd></div></dl>{canReviewAffiliations ? <div className="ac-form-actions"><button type="button" className="ac-button ac-button--primary" onClick={() => requestReviewDecision("affiliation", request, "approved")} disabled={actionBusy === `affiliation:${request.user_id}`}>Approve affiliation</button><button type="button" className="ac-button ac-button--danger" onClick={() => requestReviewDecision("affiliation", request, "rejected")} disabled={actionBusy === `affiliation:${request.user_id}`}>Reject</button></div> : <div className="ac-callout ac-callout--warning">This role can review the request but cannot decide it.</div>}</article>)}
        {!pendingAffiliations.length ? <div className="ac-empty">No student or professor affiliations are waiting for review.</div> : null}
      </div></section>
      <section className="ac-subsection"><h3>Pending institution transfers <span className="ac-count-badge">{pendingTransfers.length}</span></h3><p>Transfers are reviewed changes, not an unrestricted school selector. A pending request preserves current access. Platform-owner approval ends inappropriate prior access while preserving required history.</p><div className="ac-review-list">{pendingTransfers.map((transfer) => <article key={transfer.id}><div className="ac-review-heading"><strong>Account {transfer.user_id}</strong><StatusPill status={transfer.status} /></div><dl className="ac-detail-grid"><div><dt>From</dt><dd>{transfer.from_institution_id || "Independent"}</dd></div><div><dt>To</dt><dd>{transfer.requested_institution_name || transfer.to_institution_id || "Destination awaiting review"}</dd></div><div><dt>Pathway</dt><dd>{titleCase(transfer.pathway)}</dd></div><div><dt>Requested</dt><dd>{formatDate(transfer.created_at)}</dd></div><div><dt>Effective date</dt><dd>{transfer.effective_on || "When approved"}</dd></div></dl><p><strong>Reason:</strong> {transfer.reason || "Not provided"}</p>{canReviewTransfers ? <><label>Review notes<textarea rows="2" value={reviewNotes[transfer.id] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [transfer.id]: event.target.value }))} placeholder="Record verification and the reason for this decision." /></label><div className="ac-form-actions"><button type="button" className="ac-button ac-button--primary" onClick={() => requestReviewDecision("transfer", transfer, "approved")} disabled={actionBusy === `transfer:${transfer.id}`}>Approve transfer</button><button type="button" className="ac-button ac-button--danger" onClick={() => requestReviewDecision("transfer", transfer, "rejected")} disabled={actionBusy === `transfer:${transfer.id}`}>Reject transfer</button></div></> : <div className="ac-callout ac-callout--warning">Only the platform owner can complete a cross-institution transfer. Institution administrators may review the status for their own school.</div>}</article>)}{!pendingTransfers.length ? <div className="ac-empty">No transfers are waiting for review.</div> : null}</div></section>
    </section>
  );
}

function PlatformAccessPanel({ center, query, setQuery, results, onSearch, draft, setDraft, selectAccount, onPreview, actionBusy }) {
  const authorizations = center?.platform_authorizations || [];
  const updateRole = (accessLevel) => setDraft((previous) => ({
    ...previous,
    accessLevel,
    capabilities: { ...(PLATFORM_ROLE_DEFAULTS[accessLevel] || {}) },
  }));
  const toggleCapability = (key) => setDraft((previous) => ({
    ...previous,
    capabilities: { ...previous.capabilities, [key]: !previous.capabilities?.[key] },
  }));
  return (
    <section className="ac-panel">
      <div className="ac-section-heading">
        <div>
          <p className="ac-eyebrow">Owner-only access assignment</p>
          <h2>Delegated platform access</h2>
          <p>Give an existing account a limited operator, auditor, or support assignment. A delegated account is never a platform owner.</p>
        </div>
        <HelpTip title="Delegated access">Every capability is checked separately, can expire, and can be suspended or revoked. Institution approval, affiliation decisions, transfers, feature changes, connection activation, report exports, team management, and platform ownership remain owner-only.</HelpTip>
      </div>

      <div className="ac-callout ac-callout--privacy"><strong>Owner-only actions cannot be delegated.</strong> These assignments permit only the selected review or integration-testing work. They do not grant student-record access by themselves, change institution membership, or expose connection secrets.</div>

      <section className="ac-subsection">
        <h3>1. Find an existing account</h3>
        <form className="ac-search-form" onSubmit={onSearch}>
          <label>Account name or email<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter at least two characters" /></label>
          <span className="ac-inline-status">Only an existing EdNotebook account can receive delegated access.</span>
          <button className="ac-button ac-button--primary" disabled={actionBusy === "platform-account-search"}>{actionBusy === "platform-account-search" ? "Searching…" : "Search accounts"}</button>
        </form>
        {results.length ? <div className="ac-result-list ac-platform-account-results">{results.map((account) => (
          <article key={account.user_id}>
            <div><strong>{account.full_name || "Name not provided"}</strong><span>{account.email || "Email not available"}</span><small>{titleCase(account.pathway || account.role || "account")} · {account.institution_name || "Institution not listed"}</small></div>
            {account.platform_owner || account.is_platform_owner
              ? <span className="ac-inline-status">Platform owner — managed separately</span>
              : <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => selectAccount(account)}>Review delegated access</button>}
          </article>
        ))}</div> : null}
      </section>

      {draft.userId ? (
        <section className="ac-subsection">
          <h3>2. Choose limited access</h3>
          <form className="ac-platform-access-form" onSubmit={onPreview}>
            <div className="ac-selected-account">
              <div><span>Selected account</span><strong>{draft.account?.full_name || "Name not provided"}</strong><small>{draft.account?.email || draft.userId}</small></div>
              <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => setDraft(DEFAULT_PLATFORM_AUTHORIZATION)}>Clear selection</button>
            </div>
            <div className="ac-form-grid">
              <label className="ac-field">Delegated role
                <select value={draft.accessLevel} onChange={(event) => updateRole(event.target.value)}>
                  <option value="operator">Operator — review and record tests</option>
                  <option value="auditor">Auditor — review controls, evidence, and reports</option>
                  <option value="support">Support — review accounts for support work</option>
                </select>
                <span className="ac-field-help">Changing the role loads a conservative starting set. Review every checkbox before continuing.</span>
              </label>
              <label className="ac-field">Authorization status
                <select value={draft.status} onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                </select>
                <span className="ac-field-help">Suspension can be restored. Revocation ends the authorization while keeping its audit history.</span>
              </label>
              <label className="ac-field">Automatic access end
                <input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((previous) => ({ ...previous, expiresAt: event.target.value }))} />
                <span className="ac-field-help">Recommended for temporary work. Leave blank only when continuing access is approved.</span>
              </label>
            </div>
            <label className="ac-field">Reason for this authorization change *
              <textarea rows="3" value={draft.reason} onChange={(event) => setDraft((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Explain the approved purpose, expected work, or why access is being suspended or revoked (at least 8 characters)." />
              <span className="ac-field-help">The reason is written to the authorization audit record. Do not include student records or credentials.</span>
            </label>
            <fieldset className="ac-permission-grid ac-platform-capabilities">
              <legend>Explicit capabilities</legend>
              {PLATFORM_CAPABILITIES.map(([key, label, explanation]) => (
                <label className="ac-check" key={key}>
                  <input type="checkbox" checked={Boolean(draft.capabilities?.[key])} onChange={() => toggleCapability(key)} />
                  <span><strong>{label}</strong><small>{explanation}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="ac-callout ac-callout--warning"><strong>Review required:</strong> Activating access can expose platform-wide administrative summaries within the selected capabilities. It does not make this account an owner or allow owner-only changes.</div>
            <div className="ac-form-actions"><button className="ac-button ac-button--primary">Preview access change</button></div>
          </form>
        </section>
      ) : null}

      <section className="ac-subsection">
        <h3>Current delegated authorizations <span className="ac-count-badge">{authorizations.length}</span></h3>
        <div className="ac-table-wrap"><table><thead><tr><th>Account</th><th>Delegated role</th><th>Capabilities</th><th>Status</th><th>Automatic end</th><th>Action</th></tr></thead><tbody>
          {authorizations.map((authorization) => {
            const account = {
              user_id: authorization.user_id,
              full_name: authorization.full_name || authorization.profile?.full_name,
              email: authorization.email || authorization.profile?.email,
            };
            const capabilityLabels = PLATFORM_CAPABILITIES.filter(([key]) => authorization.capabilities?.[key]).map(([, label]) => label);
            return <tr key={authorization.user_id}><td><strong>{account.full_name || "Name not provided"}</strong><small>{account.email || authorization.user_id}</small></td><td>Delegated {titleCase(authorization.access_level)}</td><td>{capabilityLabels.length ? capabilityLabels.join(", ") : "No active capabilities"}</td><td><StatusPill status={authorization.status} /></td><td>{authorization.expires_at ? formatDate(authorization.expires_at) : "No automatic end"}</td><td><button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => selectAccount(account, authorization)}>Review or change</button></td></tr>;
          })}
          {!authorizations.length ? <tr><td colSpan="6"><div className="ac-empty">No delegated platform authorizations are recorded.</div></td></tr> : null}
        </tbody></table></div>
      </section>
    </section>
  );
}

function TeamPanel({ center, canManage, currentUserId, platformOwner, invite, setInvite, onInvite, updateMember, actionBusy }) {
  function toggleInvitePermission(key) {
    setInvite((previous) => ({
      ...previous,
      permissions: { ...previous.permissions, [key]: !previous.permissions?.[key] },
    }));
  }
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">Institution access</p><h2>Administration team</h2><p>Add accountable team members and give each person only the role and capabilities needed for their work.</p></div><HelpTip title="Team permissions">Institution team access never extends to another institution. Suspending a member preserves the history of actions they previously completed.</HelpTip></div>
      {canManage ? <form className="ac-invite-form" onSubmit={onInvite}><label>Work email<input type="email" value={invite.email} onChange={(event) => setInvite((previous) => ({ ...previous, email: event.target.value }))} required /></label><label>Role<select value={invite.role} onChange={(event) => setInvite((previous) => ({ ...previous, role: event.target.value }))}><option value="admin">Administrator</option><option value="security">Security reviewer</option><option value="records">Records reviewer</option></select></label><button className="ac-button ac-button--primary" disabled={actionBusy === "team-invite"}>{actionBusy === "team-invite" ? "Creating invitation…" : "Invite team member"}</button><fieldset className="ac-permission-grid ac-span-all"><legend>Additional permissions</legend>{TEAM_CAPABILITIES.map(([key, label]) => <label className="ac-check" key={key}><input type="checkbox" checked={Boolean(invite.permissions?.[key])} onChange={() => toggleInvitePermission(key)} /><span>{label}</span></label>)}</fieldset></form> : <div className="ac-callout ac-callout--warning">This role can review the team but cannot change access.</div>}
      <div className="ac-table-wrap"><table><thead><tr><th>Team member</th><th>Role</th><th>Status</th><th>Last active</th><th>Action</th></tr></thead><tbody>{(center?.team || []).map((member) => {
        const self = member.user_id === currentUserId;
        const protectedOwner = member.role === "owner" && !platformOwner;
        const editable = canManage && !self && !protectedOwner;
        return <tr key={member.user_id}><td><strong>{member.full_name || "Name not provided"}</strong><small>{member.email}</small>{editable ? <MemberPermissions member={member} updateMember={updateMember} busy={actionBusy === `member:${member.user_id}`} /> : null}{self ? <small>Your own access must be changed by another authorized administrator.</small> : null}{protectedOwner ? <small>Institution ownership can be changed only by the platform owner.</small> : null}</td><td>{editable ? <select aria-label={`Role for ${member.full_name || member.email}`} value={member.role} onChange={(event) => updateMember(member, { role: event.target.value })}>{platformOwner ? <option value="owner">Institution owner</option> : null}<option value="admin">Administrator</option><option value="security">Security reviewer</option><option value="records">Records reviewer</option></select> : titleCase(member.role)}</td><td><StatusPill status={member.status} /></td><td>{formatDate(member.last_active_at)}</td><td>{editable ? <button type="button" className="ac-button ac-button--small ac-button--quiet" onClick={() => updateMember(member, { status: member.status === "active" ? "suspended" : "active" })} disabled={actionBusy === `member:${member.user_id}`}>{member.status === "active" ? "Suspend" : "Restore"}</button> : "View only"}</td></tr>;
      })}</tbody></table></div>
    </section>
  );
}

function MemberPermissions({ member, updateMember, busy }) {
  const [permissions, setPermissions] = useState(member.permissions || {});
  useEffect(() => { setPermissions(member.permissions || {}); }, [member.permissions]);
  return (
    <details className="ac-member-permissions">
      <summary>View or change permissions</summary>
      <div className="ac-permission-grid">
        {TEAM_CAPABILITIES.map(([key, label]) => <label className="ac-check" key={key}><input type="checkbox" checked={Boolean(permissions[key])} onChange={() => setPermissions((previous) => ({ ...previous, [key]: !previous[key] }))} /><span>{label}</span></label>)}
      </div>
      <button type="button" className="ac-button ac-button--small ac-button--quiet" disabled={busy} onClick={() => updateMember(member, { permissions })}>Save permissions</button>
    </details>
  );
}

function ChangesReportsPanel({ center, canExport, canViewAudit, canViewReports, report, setReport, generateReport, actionBusy }) {
  return (
    <section className="ac-panel">
      <div className="ac-section-heading"><div><p className="ac-eyebrow">Accountability</p><h2>Version log and reports</h2><p>Review what changed, when it changed, why it changed, and the bounded scope affected.</p></div><HelpTip title="Report privacy">Exports contain the minimum fields for the selected administrative report. Connection secret references are excluded, and CSV text is protected from spreadsheet formulas.</HelpTip></div>
      <section className="ac-report-builder"><h3>Download a current report</h3>{canExport ? <form onSubmit={generateReport}><label>Report<select value={report.type} onChange={(event) => setReport((previous) => ({ ...previous, type: event.target.value }))}><option value="feature_inventory">Feature inventory</option><option value="connection_status">Connection status</option><option value="change_log">Feature change log</option><option value="account_access">Account administration access</option><option value="course_access">Course access</option></select></label><label>Format<select value={report.format} onChange={(event) => setReport((previous) => ({ ...previous, format: event.target.value }))}><option value="csv">CSV spreadsheet</option><option value="json">JSON audit data</option></select></label><button className="ac-button ac-button--primary" disabled={actionBusy === "report"}>{actionBusy === "report" ? "Generating…" : "Generate and download"}</button></form> : <div className="ac-callout ac-callout--warning">This role cannot export reports.</div>}</section>
      {canViewAudit ? <section className="ac-subsection"><h3>Feature change log</h3><div className="ac-change-list">{(center?.changes || []).map((change) => <article key={change.id}><div><strong>{change.summary || change.reason || "Feature control change"}</strong><span>{formatDate(change.created_at)} · {titleCase(change.scope_type || "recorded")}</span></div><dl><div><dt>Reason</dt><dd>{change.reason || "Not provided"}</dd></div><div><dt>Pathway</dt><dd>{titleCase(change.pathway)}</dd></div><div><dt>Affected accounts</dt><dd>{safeNumber(change.affected_accounts)}</dd></div><div><dt>Affected courses</dt><dd>{safeNumber(change.affected_courses)}</dd></div></dl></article>)}{!center?.changes?.length ? <div className="ac-empty">No feature changes are recorded in this workspace.</div> : null}</div></section> : null}
      {canViewReports ? <section className="ac-subsection"><h3>Recent report records</h3><div className="ac-table-wrap"><table><thead><tr><th>Report</th><th>Rows</th><th>Status</th><th>Created</th><th>Expires</th></tr></thead><tbody>{(center?.reports || []).map((item) => <tr key={item.id}><td>{titleCase(item.report_type)}</td><td>{safeNumber(item.row_count)}</td><td><StatusPill status={item.status} /></td><td>{formatDate(item.created_at)}</td><td>{formatDate(item.expires_at)}</td></tr>)}</tbody></table></div></section> : null}
    </section>
  );
}

function useDialogFocus(onCancel, busy) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  useEffect(() => { cancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!dialog) return undefined;

    const focusableSelector = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
    const frameId = window.requestAnimationFrame(() => {
      (dialog.querySelector(focusableSelector) || dialog).focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();
          cancelRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return dialogRef;
}

function ReviewDecisionDialog({ review, busy, onCancel, onApply }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const dialogRef = useDialogFocus(onCancel, busy);
  const canApply = acknowledged && confirmation.trim().toUpperCase() === review.confirmationWord && !busy;
  return (
    <div className="ac-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} tabIndex="-1" className="ac-dialog" role="dialog" aria-modal="true" aria-labelledby="ac-review-decision-title" aria-describedby="ac-review-decision-impact">
        <div className="ac-dialog-heading"><div><p className="ac-eyebrow">Required decision preview</p><h2 id="ac-review-decision-title">Review {titleCase(review.decision)} decision</h2></div><button type="button" className="ac-icon-button" aria-label="Close decision preview" onClick={onCancel} disabled={busy}>×</button></div>
        <div className="ac-impact-summary">
          <strong>{review.subject}</strong>
          <p id="ac-review-decision-impact">{review.impact}</p>
          <dl><div><dt>Decision</dt><dd>{titleCase(review.decision)}</dd></div><div><dt>Record type</dt><dd>{titleCase(review.kind)}</dd></div></dl>
        </div>
        {review.reason ? <div className="ac-callout ac-callout--neutral"><strong>Recorded review reason:</strong> {review.reason}</div> : <div className="ac-callout ac-callout--neutral">The affiliation procedure records the reviewer, decision, pathway, and time. It does not accept a free-text note; verify the account, institution, pathway, and identifier match before continuing.</div>}
        <div className={`ac-warning ${review.decision === "approved" ? "ac-warning--warning" : "ac-warning--critical"}`}><strong>Access effect</strong><span>{review.impact}</span></div>
        <label className="ac-check ac-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I reviewed the identity, institution boundary, requested pathway, reason where supported, and access effect.</span></label>
        <label className="ac-field">Type {review.confirmationWord} to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
        <div className="ac-dialog-actions"><button type="button" className="ac-button ac-button--quiet" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className={review.decision === "approved" ? "ac-button ac-button--primary" : "ac-button ac-button--danger"} onClick={onApply} disabled={!canApply}>{busy ? "Saving and logging…" : `${titleCase(review.decision)} record`}</button></div>
      </section>
    </div>
  );
}

function PlatformAuthorizationDialog({ preview, busy, onCancel, onApply }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const dialogRef = useDialogFocus(onCancel, busy);
  const isActive = preview.status === "active";
  const canApply = acknowledged && confirmation.trim().toUpperCase() === preview.confirmationWord && !busy;
  return (
    <div className="ac-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} tabIndex="-1" className="ac-dialog" role="dialog" aria-modal="true" aria-labelledby="ac-platform-access-title">
        <div className="ac-dialog-heading"><div><p className="ac-eyebrow">Owner confirmation required</p><h2 id="ac-platform-access-title">Review delegated platform access</h2></div><button type="button" className="ac-icon-button" aria-label="Close platform access preview" onClick={onCancel} disabled={busy}>×</button></div>
        <div className="ac-impact-summary">
          <strong>{preview.account?.full_name || "Selected account"}</strong>
          <p>{isActive ? "This account will receive only the checked delegated capabilities." : preview.status === "suspended" ? "This account's delegated platform access will be suspended, while its audit history remains." : "This account's delegated platform authorization will be revoked, while its audit history remains."}</p>
          <dl><div><dt>Assignment</dt><dd>Delegated {titleCase(preview.accessLevel)}</dd></div><div><dt>Status</dt><dd>{titleCase(preview.status)}</dd></div><div><dt>Capabilities</dt><dd>{preview.enabledCapabilities.length}</dd></div><div><dt>Automatic end</dt><dd>{preview.expiresAtIso ? formatDate(preview.expiresAtIso) : "None"}</dd></div></dl>
        </div>
        <div className="ac-warning-stack">
          {isActive ? <div className="ac-warning ac-warning--warning"><strong>Platform-wide visibility</strong><span>The account may see administrative summaries across institutions only where a checked capability permits it.</span></div> : null}
          {isActive && !preview.expiresAtIso ? <div className="ac-warning ac-warning--warning"><strong>No automatic end</strong><span>This access continues until the platform owner suspends or revokes it. Confirm continuing access is appropriate.</span></div> : null}
          {preview.capabilities?.view_accounts ? <div className="ac-warning ac-warning--warning"><strong>Account search</strong><span>The account may search approved account and course summaries across institution boundaries. Row-level security still controls protected records.</span></div> : null}
          {preview.capabilities?.test_integrations ? <div className="ac-warning ac-warning--warning"><strong>Test evidence</strong><span>The account may add safe connection-test results. It cannot activate a connection or view its credentials.</span></div> : null}
          {!isActive ? <div className="ac-warning ac-warning--critical"><strong>Access interruption</strong><span>{preview.status === "suspended" ? "Current delegated work will be blocked until access is restored." : "The authorization will end and must be granted again for future access."}</span></div> : null}
        </div>
        <div className="ac-callout ac-callout--neutral"><strong>Recorded reason:</strong> {preview.reason}</div>
        {isActive ? <div className="ac-platform-capability-summary"><h3>Capabilities to allow</h3><ul className="ac-plain-list">{preview.enabledCapabilities.map((capability) => <li key={capability.key}>{capability.label}</li>)}</ul></div> : null}
        <div className="ac-callout ac-callout--privacy"><strong>This is not platform ownership.</strong> Institution approval, affiliations, transfers, feature changes, connection activation, report exports, team changes, and owner assignment remain unavailable.</div>
        <label className="ac-check ac-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I reviewed the account, status, expiry, capabilities, warnings, and owner-only limits.</span></label>
        <label className="ac-field">Type {preview.confirmationWord} to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
        <div className="ac-dialog-actions"><button type="button" className="ac-button ac-button--quiet" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className={preview.status === "revoked" ? "ac-button ac-button--danger" : "ac-button ac-button--primary"} onClick={onApply} disabled={!canApply}>{busy ? "Saving and logging…" : `${titleCase(preview.confirmationWord.toLowerCase())} delegated access`}</button></div>
      </section>
    </div>
  );
}

function ImpactDialog({ preview, reason, setReason, acknowledged, setAcknowledged, criticalConfirmation, setCriticalConfirmation, busy, onCancel, onApply }) {
  const warnings = (preview.warnings || []).map(normalizeWarning);
  const hasCritical = warnings.some((warning) => warning.severity === "critical");
  const dialogRef = useDialogFocus(onCancel, busy);
  const canApply = preview.serverVerified && preview.checksum && reason.trim().length >= 8 && (!warnings.length || acknowledged) && (!hasCritical || criticalConfirmation.trim().toUpperCase() === "APPLY") && !busy;
  return (
    <div className="ac-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} tabIndex="-1" className="ac-dialog" role="dialog" aria-modal="true" aria-labelledby="ac-impact-title">
        <div className="ac-dialog-heading"><div><p className="ac-eyebrow">Required impact preview</p><h2 id="ac-impact-title">Review before applying</h2></div><button type="button" className="ac-icon-button" aria-label="Close preview" onClick={onCancel} disabled={busy}>×</button></div>
        <div className="ac-impact-summary"><strong>{preview.display_name || preview.featureName || preview.feature?.name}</strong><p>{preview.summary}</p><dl><div><dt>Affected accounts</dt><dd>{safeNumber(preview.affected_accounts ?? preview.affected?.accounts)}</dd></div><div><dt>Affected courses</dt><dd>{safeNumber(preview.affected_courses ?? preview.affected?.courses)}</dd></div><div><dt>Scope</dt><dd>{titleCase(preview.scope_type || preview.scope)}</dd></div><div><dt>Schedule</dt><dd>{preview.starts_at || preview.ends_at ? `${formatDate(preview.starts_at)} to ${formatDate(preview.ends_at)}` : "Applies when confirmed"}</dd></div></dl></div>
        {preview.previewError ? <div className="ac-alert ac-alert--error" role="alert"><strong>Server preview not available.</strong> {preview.previewError} This local explanation is for review only; Apply remains disabled.</div> : null}
        <div className="ac-warning-stack">
          {warnings.map((warning) => <div key={warning.code} className={`ac-warning ac-warning--${warning.severity}`}><strong>{warning.severity === "critical" ? "Critical warning" : "Review warning"}</strong><span>{warning.message}</span></div>)}
          {!warnings.length ? <div className="ac-callout ac-callout--neutral">No additional warnings were returned. Confirm the summary and reason before applying.</div> : null}
        </div>
        <label className="ac-field">Reason for this change *<textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the purpose, approval, and expected result (at least 8 characters)." /></label>
        {warnings.length ? <label className="ac-check ac-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I reviewed every warning, the affected scope, and the expected access effect.</span></label> : null}
        {hasCritical ? <label className="ac-field">Type APPLY to confirm this critical change<input value={criticalConfirmation} onChange={(event) => setCriticalConfirmation(event.target.value)} autoComplete="off" /></label> : null}
        <div className="ac-callout ac-callout--privacy">Applying creates a versioned change record. It does not delete underlying records, expose secrets, bypass institution boundaries, or make an undeployed feature ready.</div>
        <div className="ac-dialog-actions"><button type="button" className="ac-button ac-button--quiet" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="ac-button ac-button--primary" onClick={onApply} disabled={!canApply}>{busy ? "Applying and logging…" : "Apply controlled change"}</button></div>
      </section>
    </div>
  );
}
