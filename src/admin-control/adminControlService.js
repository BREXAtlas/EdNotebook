import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { buildSecurityApprovalRpcPayload } from "./securityApprovalDecision.js";
import { buildAccessibilityApprovalRpcPayload } from "./accessibilityApprovalDecision.js";

const ADMIN_MIGRATION_MESSAGE =
  "The administration database setup is not available yet. Apply the latest institution admin control-center migration, including its Data API grants, and refresh the Supabase schema cache.";
const ADMIN_GRANT_MESSAGE =
  "The administration database permissions are incomplete. Apply the migration's explicit Data API grants and row-level access policies, then try again.";
const CONNECTION_MESSAGE =
  "The administration service could not be reached. Check the connection and try again.";
const ADMIN_RPC_TIMEOUT_MS = 15_000;
const ADMIN_AUTH_TIMEOUT_MS = 12_000;

const DIRECTORY_FIELDS = [
  "directory_key",
  "canonical_name",
  "parent_directory_key",
  "institution_id",
  "entity_type",
  "education_division",
  "system_name",
  "city",
  "region_code",
  "country_code",
  "website_url",
  "academic_domain",
  "directory_status",
  "is_selectable",
  "is_public",
].join(",");

const APPLICATION_FIELDS = Object.freeze([
  "directory_key",
  "legal_name",
  "display_name",
  "parent_system_name",
  "institution_type",
  "website_url",
  "academic_domain",
  "country_code",
  "region_code",
  "city",
  "primary_lms",
  "student_information_system",
  "expected_accounts",
  "requested_pathways",
  "administrator_name",
  "administrator_title",
  "administrator_email",
  "administrator_phone",
  "security_contact_email",
  "privacy_contact_email",
  "accessibility_contact_email",
  "intended_use",
  "attested_authority",
  "attested_terms",
]);

const APPLICATION_TYPE_ALIASES = Object.freeze({
  public_university: "university",
  private_university: "university",
  school_system: "school_district",
  library: "other",
});

const MIGRATION_CODES = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);
const AUTH_SESSION_CODES = new Set(["refresh_token_not_found", "refresh_token_already_used", "session_not_found"]);
const PLATFORM_ACCESS_LEVELS = new Set(["operator", "auditor", "support"]);
const PLATFORM_AUTHORIZATION_STATUSES = new Set(["active", "suspended", "revoked"]);
const PLATFORM_AUTHORIZATION_CAPABILITIES = new Set([
  "view_control_center",
  "view_accounts",
  "view_feature_controls",
  "view_integrations",
  "test_integrations",
  "view_audit",
  "view_reports",
]);

export class AdminControlError extends Error {
  constructor(message, { code = "admin_control_error", kind = "request", retryable = false } = {}) {
    super(message);
    this.name = "AdminControlError";
    this.code = code;
    this.kind = kind;
    this.retryable = retryable;
  }
}

export function isAdminControlConfigured() {
  return Boolean(isSupabaseConfigured && supabase);
}

function requireClient() {
  if (!isAdminControlConfigured()) {
    throw new AdminControlError(
      "The administration service is not connected. Configure the Supabase project URL and publishable key, then restart EdNotebook.",
      { code: "admin_control_not_configured", kind: "configuration" },
    );
  }
  return supabase;
}

function redactMessage(value) {
  return String(value || "")
    .replace(/\b(?:sb_secret_|sb_service_role_)[A-Za-z0-9._-]+\b/giu, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+\b/giu, "$1[redacted]")
    .replace(/\b(password|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted database address]")
    .trim()
    .slice(0, 700);
}

function friendlyError(error, fallback) {
  if (error instanceof AdminControlError) return error;

  const code = String(error?.code || error?.status || "admin_control_error");
  const message = redactMessage(error?.message);
  const normalized = message.toLowerCase();

  if (
    MIGRATION_CODES.has(code)
    || /schema cache|could not find (?:the )?function|function .+ does not exist|relation .+ does not exist|column .+ does not exist/iu.test(message)
  ) {
    return new AdminControlError(ADMIN_MIGRATION_MESSAGE, {
      code: "admin_control_migration_required",
      kind: "configuration",
    });
  }

  if (code === "42501" || /permission denied for (?:table|function|schema|sequence)/iu.test(message)) {
    return new AdminControlError(ADMIN_GRANT_MESSAGE, {
      code: "admin_control_grant_required",
      kind: "configuration",
    });
  }

  if (/invalid login credentials/iu.test(message)) {
    return new AdminControlError("The email or password did not match an account. Check both fields and try again.", {
      code: "invalid_credentials",
      kind: "authentication",
    });
  }

  if (/email not confirmed/iu.test(message)) {
    return new AdminControlError("Confirm this account's email address before signing in.", {
      code: "email_not_confirmed",
      kind: "authentication",
    });
  }

  if (
    AUTH_SESSION_CODES.has(code)
    || /auth session missing|jwt expired|invalid jwt|refresh token/iu.test(message)
  ) {
    return new AdminControlError("This sign-in session is no longer valid. Sign in again to continue.", {
      code: "admin_session_expired",
      kind: "authentication",
    });
  }

  if (/user already registered|already been registered/iu.test(message)) {
    return new AdminControlError("An account may already use this email address. Try signing in or resetting the password.", {
      code: "account_may_exist",
      kind: "authentication",
    });
  }

  if (code === "23505" || /duplicate key|already has an active|already exists/iu.test(message)) {
    return new AdminControlError("A matching active request already exists. Refresh the page and review the existing record.", {
      code: "admin_control_conflict",
      kind: "conflict",
    });
  }

  if (code === "23503" || /foreign key constraint/iu.test(message)) {
    return new AdminControlError("A related account, institution, course, or connection is no longer available. Refresh the page and try again.", {
      code: "admin_control_related_record_missing",
      kind: "conflict",
    });
  }

  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/iu.test(message)) {
    return new AdminControlError(CONNECTION_MESSAGE, {
      code: "admin_control_unreachable",
      kind: "network",
      retryable: true,
    });
  }

  if (/row-level security|not authorized|access required|only the platform owner|sign in before|authentication required/iu.test(message)) {
    return new AdminControlError(message || "This account is not authorized for that administration action.", {
      code,
      kind: "authorization",
    });
  }

  return new AdminControlError(message || fallback || "The administration request could not be completed.", { code });
}

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new AdminControlError(`${label} is required.`, {
      code: "admin_control_invalid_input",
      kind: "validation",
    });
  }
  return text;
}

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function inputObject(value, label = "Input") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminControlError(`${label} must be provided.`, {
      code: "admin_control_invalid_input",
      kind: "validation",
    });
  }
  return value;
}

function emailAddress(value) {
  const email = requiredText(value, "Email address").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/u.test(email)) {
    throw new AdminControlError("Enter a valid email address.", {
      code: "admin_control_invalid_email",
      kind: "validation",
    });
  }
  return email;
}

function accountPassword(value) {
  const password = String(value ?? "");
  if (password.length < 8) {
    throw new AdminControlError("Use a password with at least 8 characters.", {
      code: "admin_control_invalid_password",
      kind: "validation",
    });
  }
  return password;
}

function safeRedirectUrl(value) {
  if (!value) {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${window.location.pathname}${window.location.hash.split("?")[0] || "#/admin"}`;
  }

  let redirect;
  try {
    const base = typeof window === "undefined" ? undefined : window.location.origin;
    redirect = base ? new URL(value, base) : new URL(value);
    if (base && redirect.origin !== base) throw new Error("cross-origin");
    if (!base && redirect.protocol !== "https:") throw new Error("insecure");
  } catch {
    throw new AdminControlError("The email confirmation return address is not allowed.", {
      code: "admin_control_invalid_redirect",
      kind: "validation",
    });
  }
  return redirect.href;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id || null,
    email: user.email || null,
    phone: user.phone || null,
    email_confirmed_at: user.email_confirmed_at || null,
    phone_confirmed_at: user.phone_confirmed_at || null,
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
    is_anonymous: Boolean(user.is_anonymous),
  };
}

function publicSession(session, verifiedUser = session?.user) {
  if (!session || !verifiedUser) return null;
  return {
    user: publicUser(verifiedUser),
    expires_at: session.expires_at || null,
    expires_in: session.expires_in || null,
    token_type: session.token_type || null,
  };
}

function assertSafeEvidence(value, path = "evidence") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:^|_)(?:password|secret|token|private_key|client_secret|api_key|credential)(?:_|$)/iu.test(key)) {
      throw new AdminControlError(`Do not include credentials or secrets in ${path}.`, {
        code: "admin_control_sensitive_input",
        kind: "validation",
      });
    }
    if (child && typeof child === "object") assertSafeEvidence(child, path);
  }
}

function normalizeApplicationInput(value) {
  const input = inputObject(value, "Institution application");
  const output = {};
  for (const field of APPLICATION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  }

  output.institution_type = APPLICATION_TYPE_ALIASES[output.institution_type] || output.institution_type || "university";
  if (output.expected_accounts !== null && output.expected_accounts !== undefined && output.expected_accounts !== "") {
    const expected = Number(output.expected_accounts);
    output.expected_accounts = Number.isFinite(expected) && expected > 0 ? Math.floor(expected) : null;
  } else {
    output.expected_accounts = null;
  }
  if (Array.isArray(output.requested_pathways)) {
    output.requested_pathways = output.requested_pathways.filter((pathway) => ["student", "professor", "publisher"].includes(pathway));
  }
  return output;
}

function withAdminTimeout(request, {
  timeoutMs,
  message,
  code = "admin_control_timeout",
} = {}) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new AdminControlError(
      message || "The administration request took too long. No result was confirmed; refresh before retrying a change.",
      { code, kind: "network", retryable: true },
    )), timeoutMs || ADMIN_RPC_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(request), timeout])
    .finally(() => globalThis.clearTimeout(timeoutId));
}

async function callRpc(functionName, args, fallback) {
  const client = requireClient();
  try {
    const request = args === undefined ? client.rpc(functionName) : client.rpc(functionName, args);
    const response = await withAdminTimeout(request, {
      timeoutMs: ADMIN_RPC_TIMEOUT_MS,
      message: "The administration request took too long. No result was confirmed; refresh before retrying a change.",
    });
    if (response?.error) throw response.error;
    return response?.data;
  } catch (error) {
    throw friendlyError(error, fallback);
  }
}

export async function adminSignIn({ email, password } = {}) {
  const client = requireClient();
  try {
    const { data, error } = await withAdminTimeout(
      client.auth.signInWithPassword({
        email: emailAddress(email),
        password: accountPassword(password),
      }),
      { timeoutMs: ADMIN_AUTH_TIMEOUT_MS, message: "Sign-in took too long. Check the connection and try again.", code: "admin_auth_timeout" },
    );
    if (error) throw error;
    return {
      user: publicUser(data?.user),
      session: publicSession(data?.session, data?.user),
    };
  } catch (error) {
    throw friendlyError(error, "Sign-in could not be completed.");
  }
}

export async function adminSignUp({ email, password, fullName, emailRedirectTo } = {}) {
  const client = requireClient();
  const safeEmail = emailAddress(email);
  const safePassword = accountPassword(password);
  const safeName = requiredText(fullName, "Full name").slice(0, 160);
  const redirectTo = safeRedirectUrl(emailRedirectTo);

  try {
    const { data, error } = await withAdminTimeout(
      client.auth.signUp({
        email: safeEmail,
        password: safePassword,
        options: {
          data: {
            full_name: safeName,
            requested_role: "institution_applicant",
            affiliation_choice: "independent",
          },
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      }),
      { timeoutMs: ADMIN_AUTH_TIMEOUT_MS, message: "Account creation took too long. Check the connection before trying again.", code: "admin_auth_timeout" },
    );
    if (error) throw error;
    return {
      user: publicUser(data?.user),
      session: publicSession(data?.session, data?.user),
      emailConfirmationRequired: Boolean(data?.user && !data?.session),
    };
  } catch (error) {
    throw friendlyError(error, "The institution applicant account could not be created.");
  }
}

export async function adminSignOut({ scope = "local" } = {}) {
  const client = requireClient();
  const safeScope = ["local", "global", "others"].includes(scope) ? scope : "local";
  try {
    const { error } = await withAdminTimeout(
      client.auth.signOut({ scope: safeScope }),
      { timeoutMs: ADMIN_AUTH_TIMEOUT_MS, message: "Sign-out took too long. Refresh before using another account.", code: "admin_auth_timeout" },
    );
    if (error) throw error;
    return { signedOut: true, scope: safeScope };
  } catch (error) {
    throw friendlyError(error, "Sign-out could not be completed.");
  }
}

export async function getAdminSession() {
  const client = requireClient();
  try {
    const { data: sessionData, error: sessionError } = await withAdminTimeout(
      client.auth.getSession(),
      { timeoutMs: ADMIN_AUTH_TIMEOUT_MS, message: "The administration session took too long to load.", code: "admin_auth_timeout" },
    );
    if (sessionError) throw sessionError;
    if (!sessionData?.session) return { user: null, session: null };

    // getSession reads browser storage. getUser verifies the identity with Auth
    // before this helper reports the session as usable.
    const { data: userData, error: userError } = await withAdminTimeout(
      client.auth.getUser(),
      { timeoutMs: ADMIN_AUTH_TIMEOUT_MS, message: "The administration session could not be verified in time.", code: "admin_auth_timeout" },
    );
    if (userError) throw userError;
    if (!userData?.user || userData.user.id !== sessionData.session.user?.id) {
      throw new AdminControlError("This sign-in session could not be verified. Sign in again to continue.", {
        code: "admin_session_unverified",
        kind: "authentication",
      });
    }

    return {
      user: publicUser(userData.user),
      session: publicSession(sessionData.session, userData.user),
    };
  } catch (error) {
    throw friendlyError(error, "The administration session could not be verified.");
  }
}

export function onAdminAuthStateChange(callback) {
  const client = requireClient();
  if (typeof callback !== "function") {
    throw new AdminControlError("An authentication change callback is required.", {
      code: "admin_control_invalid_callback",
      kind: "validation",
    });
  }
  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback(event, publicSession(session));
  });
  return data?.subscription || null;
}

export async function searchInstitutionDirectory(query = "", options = {}) {
  const client = requireClient();
  const resolvedOptions = typeof options === "string" ? { educationDivision: options } : options || {};
  const cleanQuery = String(query ?? "")
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .trim()
    .slice(0, 120);
  const limit = Math.min(100, Math.max(1, Number(resolvedOptions.limit) || 60));

  try {
    let request = client
      .from("institution_directory_entries")
      .select(DIRECTORY_FIELDS)
      .eq("is_public", true)
      .neq("directory_status", "inactive");

    if (resolvedOptions.selectableOnly !== false) request = request.eq("is_selectable", true);
    if (resolvedOptions.educationDivision) request = request.eq("education_division", resolvedOptions.educationDivision);
    if (resolvedOptions.countryCode) request = request.eq("country_code", String(resolvedOptions.countryCode).toUpperCase());
    if (resolvedOptions.regionCode) request = request.eq("region_code", String(resolvedOptions.regionCode).toUpperCase());
    if (cleanQuery) {
      request = request.or([
        `canonical_name.ilike.%${cleanQuery}%`,
        `system_name.ilike.%${cleanQuery}%`,
        `city.ilike.%${cleanQuery}%`,
        `academic_domain.ilike.%${cleanQuery}%`,
      ].join(","));
    }

    const { data, error } = await request.order("sort_name", { ascending: true }).limit(limit);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw friendlyError(error, "The institution directory could not be searched.");
  }
}

export async function getMyAdminWorkspaces() {
  const data = await callRpc("get_my_admin_workspaces", undefined, "Administration workspaces could not be loaded.");
  return data || { platform_access: false, platform_owner: false, institutions: [] };
}

export async function getAdminControlCenter(institutionId = null) {
  return callRpc(
    "get_admin_control_center",
    { p_institution_id: optionalText(institutionId) },
    "The administration control center could not be loaded.",
  );
}

export async function getStudentDataIntakeReadiness(institutionId) {
  return callRpc(
    "get_student_data_intake_readiness",
    { p_institution_id: requiredText(institutionId, "Institution") },
    "Student-data intake readiness could not be loaded.",
  );
}

export function recordSecurityApprovalDecision(institutionId, input) {
  return callRpc(
    "record_student_data_intake_evidence",
    buildSecurityApprovalRpcPayload(institutionId, input),
    "The accountable security decision could not be recorded.",
  );
}

export function recordAccessibilityApprovalDecision(institutionId, input) {
  return callRpc(
    "record_student_data_intake_evidence",
    buildAccessibilityApprovalRpcPayload(institutionId, input),
    "The accountable accessibility decision could not be recorded.",
  );
}

export async function searchAdminAccountsCourses(query = "", institutionId = null, pathway = null) {
  const data = await callRpc(
    "admin_search_accounts_courses",
    {
      p_query: String(query ?? "").trim().slice(0, 200),
      p_institution_id: optionalText(institutionId),
      p_pathway: optionalText(pathway),
    },
    "Accounts and courses could not be searched.",
  );
  return data || { accounts: [], courses: [] };
}

export function previewFeatureControlChange(input) {
  return callRpc(
    "preview_feature_control_change",
    { p_input: inputObject(input, "Feature control change") },
    "The effect of this feature change could not be previewed.",
  );
}

export function applyFeatureControlChange(input, expectedChecksum) {
  return callRpc(
    "apply_feature_control_change",
    {
      p_input: inputObject(input, "Feature control change"),
      p_expected_checksum: requiredText(expectedChecksum, "Preview checksum"),
    },
    "The feature control change could not be applied.",
  );
}

export function submitInstitutionAccessApplication(input) {
  return callRpc(
    "submit_institution_access_application",
    { p_input: normalizeApplicationInput(input) },
    "The institution access application could not be submitted.",
  );
}

export function reviewInstitutionAccessApplication(applicationId, decision, reviewNotes = null) {
  return callRpc(
    "review_institution_access_application",
    {
      p_application_id: requiredText(applicationId, "Application"),
      p_decision: requiredText(decision, "Decision").toLowerCase(),
      p_review_notes: optionalText(reviewNotes),
    },
    "The institution application decision could not be saved.",
  );
}

export function reviewIdentityOnboarding(userId, decision) {
  return callRpc("review_identity_onboarding", {
    p_user_id: requiredText(userId, "Account"),
    p_decision: requiredText(decision, "Decision").toLowerCase(),
  }, "The institution affiliation decision could not be saved.");
}

export function inviteInstitutionTeamMember(institutionId, email, role, permissions = {}) {
  return callRpc(
    "invite_institution_team_member",
    {
      p_institution_id: requiredText(institutionId, "Institution"),
      p_email: emailAddress(email),
      p_role: requiredText(role, "Institution role").toLowerCase(),
      p_permissions: inputObject(permissions, "Permissions"),
    },
    "The institution team invitation could not be created.",
  );
}

export function setPlatformAdminAuthorization({ userId, accessLevel, capabilities = {}, status = "active", expiresAt = null, reason, expectedUpdatedAt = null } = {}) {
  const normalizedAccessLevel = requiredText(accessLevel, "Delegated platform role").toLowerCase();
  const normalizedStatus = requiredText(status, "Authorization status").toLowerCase();
  if (!PLATFORM_ACCESS_LEVELS.has(normalizedAccessLevel)) {
    throw new AdminControlError("Choose operator, auditor, or support for the delegated platform role.", {
      code: "admin_control_invalid_platform_role",
      kind: "validation",
    });
  }
  if (!PLATFORM_AUTHORIZATION_STATUSES.has(normalizedStatus)) {
    throw new AdminControlError("Choose active, suspended, or revoked for the authorization status.", {
      code: "admin_control_invalid_authorization_status",
      kind: "validation",
    });
  }
  const submittedCapabilities = inputObject(capabilities, "Platform capabilities");
  const unsupported = Object.keys(submittedCapabilities).filter((key) => !PLATFORM_AUTHORIZATION_CAPABILITIES.has(key));
  if (unsupported.length) {
    throw new AdminControlError("The request included a platform capability that cannot be delegated.", {
      code: "admin_control_owner_capability_not_delegable",
      kind: "validation",
    });
  }
  const safeCapabilities = Object.fromEntries(
    [...PLATFORM_AUTHORIZATION_CAPABILITIES].map((key) => [key, Boolean(submittedCapabilities[key])]),
  );
  if (normalizedStatus === "active" && !Object.values(safeCapabilities).some(Boolean)) {
    throw new AdminControlError("Choose at least one capability before activating delegated platform access.", {
      code: "admin_control_platform_capability_required",
      kind: "validation",
    });
  }
  let normalizedExpiry = null;
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || (normalizedStatus === "active" && expiry <= new Date())) {
      throw new AdminControlError("The automatic access end must be a valid future date and time.", {
        code: "admin_control_invalid_authorization_expiry",
        kind: "validation",
      });
    }
    normalizedExpiry = expiry.toISOString();
  }
  const normalizedReason = requiredText(reason, "Authorization change reason");
  if (normalizedReason.length < 8) {
    throw new AdminControlError("Explain the reason for this access change using at least eight characters.", {
      code: "admin_control_authorization_reason_required",
      kind: "validation",
    });
  }
  return callRpc(
    "set_platform_admin_authorization",
    {
      p_user_id: requiredText(userId, "Account"),
      p_access_level: normalizedAccessLevel,
      p_capabilities: safeCapabilities,
      p_status: normalizedStatus,
      p_expires_at: normalizedExpiry,
      p_reason: normalizedReason.slice(0, 1000),
      p_expected_updated_at: optionalText(expectedUpdatedAt),
    },
    "The delegated platform authorization could not be saved.",
  );
}

export function setInstitutionTeamMember(institutionId, userId, role, permissions = {}, status = "active") {
  return callRpc(
    "set_institution_team_member",
    {
      p_institution_id: requiredText(institutionId, "Institution"),
      p_user_id: requiredText(userId, "Team member"),
      p_role: requiredText(role, "Institution role").toLowerCase(),
      p_permissions: inputObject(permissions, "Permissions"),
      p_status: requiredText(status, "Membership status").toLowerCase(),
    },
    "The institution team member could not be updated.",
  );
}

export function reviewInstitutionTransfer(requestId, decision, reviewNotes = null) {
  return callRpc(
    "review_institution_transfer",
    {
      p_request_id: requiredText(requestId, "Transfer request"),
      p_decision: requiredText(decision, "Decision").toLowerCase(),
      p_review_notes: optionalText(reviewNotes),
    },
    "The institution transfer decision could not be saved.",
  );
}

export function requestInstitutionTransfer({ pathway, institutionChoice, reason, effectiveOn = null } = {}) {
  const choice = inputObject(institutionChoice, "Destination institution");
  if (!["student", "professor", "publisher"].includes(pathway)) {
    throw new AdminControlError("Choose a valid account pathway for the transfer request.", {
      code: "admin_control_invalid_pathway",
      kind: "validation",
    });
  }
  if (choice.choice === "independent") {
    throw new AdminControlError("Choose an institution or request review for an unlisted institution.", {
      code: "admin_control_transfer_destination_required",
      kind: "validation",
    });
  }
  return callRpc("request_institution_transfer", {
    p_input: {
      pathway,
      to_directory_key: optionalText(choice.directoryKey),
      requested_institution_name: optionalText(choice.name),
      reason: requiredText(reason, "Transfer reason").slice(0, 2000),
      effective_on: optionalText(effectiveOn),
    },
  }, "The institution transfer request could not be submitted.");
}

export function recordIntegrationTest(connectionId, capabilityKey, status, safeSummary, evidence = {}) {
  const safeEvidence = inputObject(evidence, "Test evidence");
  assertSafeEvidence(safeEvidence);
  return callRpc(
    "record_integration_test",
    {
      p_connection_id: requiredText(connectionId, "Connection"),
      p_capability_key: String(capabilityKey ?? "").trim(),
      p_status: requiredText(status, "Test result").toLowerCase(),
      p_safe_summary: requiredText(safeSummary, "Plain-language test summary").slice(0, 1000),
      p_evidence: safeEvidence,
    },
    "The connection test result could not be recorded.",
  );
}

export function setIntegrationConnectionStatus(connectionId, status, reason) {
  return callRpc(
    "set_integration_connection_status",
    {
      p_connection_id: requiredText(connectionId, "Connection"),
      p_status: requiredText(status, "Connection status").toLowerCase(),
      p_reason: requiredText(reason, "Reason").slice(0, 500),
    },
    "The connection status could not be changed.",
  );
}

export function generateAdminControlReport(institutionId, reportType, filters = {}) {
  return callRpc(
    "generate_admin_control_report",
    {
      p_institution_id: optionalText(institutionId),
      p_report_type: requiredText(reportType, "Report type"),
      p_filters: inputObject(filters, "Report filters"),
    },
    "The administration report could not be generated.",
  );
}

export async function getMarketplaceControlCenter() {
  const [marketplace, launch] = await Promise.all([
    callRpc(
      "get_marketplace_control_center",
      undefined,
      "Commercial publishing controls could not be loaded.",
    ),
    callRpc(
      "get_marketplace_launch_control_center",
      undefined,
      "Marketplace production launch controls could not be loaded.",
    ),
  ]);
  return {
    ...(marketplace || {}),
    launch_state: launch?.state || null,
    launch_controls: launch?.controls || [],
    launch_readiness: launch?.readiness || {},
  };
}

export function reviewMarketplaceCase(caseType, caseId, decision, reviewNotes) {
  return callRpc(
    "review_marketplace_case",
    {
      p_case_type: requiredText(caseType, "Marketplace case type"),
      p_case_id: requiredText(caseId, "Marketplace case"),
      p_decision: requiredText(decision, "Decision"),
      p_review_notes: requiredText(reviewNotes, "Review notes"),
    },
    "The commercial publishing decision could not be saved.",
  );
}

export function configureMarketplaceTaxControl(taxControlId, registrationReference, liability, reviewNotes) {
  return callRpc(
    "configure_marketplace_tax_control",
    {
      p_tax_control_id: requiredText(taxControlId, "Tax control"),
      p_registration_reference: requiredText(registrationReference, "Stripe Tax registration reference"),
      p_liability: requiredText(liability, "Tax liability"),
      p_review_notes: requiredText(reviewNotes, "Tax configuration notes"),
    },
    "Marketplace tax responsibility could not be configured.",
  );
}

export function reviewMarketplaceLaunchControl({
  controlKey,
  decision,
  evidenceReference,
  reviewNotes,
  expiresAt = null,
  attestation = false,
}) {
  return callRpc(
    "review_marketplace_launch_control",
    {
      p_control_key: requiredText(controlKey, "Launch control"),
      p_decision: requiredText(decision, "Launch-control decision"),
      p_evidence_reference: String(evidenceReference || "").trim(),
      p_review_notes: requiredText(reviewNotes, "Launch-control review notes"),
      p_expires_at: optionalText(expiresAt),
      p_attestation: Boolean(attestation),
    },
    "Marketplace launch-control review could not be saved.",
  );
}

export function setMarketplaceLiveCharging({ enable, expectedUpdatedAt, reason, attestation = false }) {
  return callRpc(
    "set_marketplace_live_charging",
    {
      p_enable: Boolean(enable),
      p_expected_updated_at: requiredText(expectedUpdatedAt, "Current launch-state version"),
      p_reason: requiredText(reason, "Live-charging decision reason"),
      p_attestation: Boolean(attestation),
    },
    "The live-charging decision could not be saved.",
  );
}

export async function processMarketplaceRefund(refundRequestId) {
  const client = requireClient();
  try {
    const { data, error } = await client.functions.invoke("marketplace-refund", {
      body: { refundRequestId: requiredText(refundRequestId, "Refund request") },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw friendlyError(error, "The approved refund could not be sent to Stripe.");
  }
}

// Compatibility names used by the administration screens.
export const signInInstitutionAdmin = (email, password) => adminSignIn({ email, password });
export const signUpInstitutionApplicant = adminSignUp;
export const signOutAdmin = adminSignOut;
export const getCurrentSession = getAdminSession;
export const submitInstitutionApplication = submitInstitutionAccessApplication;
export const getAdminWorkspaces = getMyAdminWorkspaces;
export const reviewInstitutionApplication = reviewInstitutionAccessApplication;
export const reviewInstitutionAffiliation = reviewIdentityOnboarding;
export const submitInstitutionTransferRequest = requestInstitutionTransfer;
export const recordConnectionTest = recordIntegrationTest;
export const setConnectionStatus = setIntegrationConnectionStatus;

// Exact RPC-name aliases are useful for narrow integration tests and scripts.
export const get_my_admin_workspaces = getMyAdminWorkspaces;
export const get_admin_control_center = getAdminControlCenter;
export const get_student_data_intake_readiness = getStudentDataIntakeReadiness;
export const record_student_data_security_decision = recordSecurityApprovalDecision;
export const record_student_data_accessibility_decision = recordAccessibilityApprovalDecision;
export const admin_search_accounts_courses = searchAdminAccountsCourses;
export const preview_feature_control_change = previewFeatureControlChange;
export const apply_feature_control_change = applyFeatureControlChange;
export const submit_institution_access_application = submitInstitutionAccessApplication;
export const review_institution_access_application = reviewInstitutionAccessApplication;
export const review_identity_onboarding = reviewIdentityOnboarding;
export const invite_institution_team_member = inviteInstitutionTeamMember;
export const set_institution_team_member = setInstitutionTeamMember;
export const review_institution_transfer = reviewInstitutionTransfer;
export const request_institution_transfer = requestInstitutionTransfer;
export const set_platform_admin_authorization = setPlatformAdminAuthorization;
export const record_integration_test = recordIntegrationTest;
export const set_integration_connection_status = setIntegrationConnectionStatus;
export const generate_admin_control_report = generateAdminControlReport;
export const get_marketplace_control_center = getMarketplaceControlCenter;
export const review_marketplace_case = reviewMarketplaceCase;
export const configure_marketplace_tax_control = configureMarketplaceTaxControl;
export const review_marketplace_launch_control = reviewMarketplaceLaunchControl;
export const set_marketplace_live_charging = setMarketplaceLiveCharging;

const adminControlService = Object.freeze({
  AdminControlError,
  isAdminControlConfigured,
  adminSignIn,
  adminSignUp,
  adminSignOut,
  getAdminSession,
  onAdminAuthStateChange,
  searchInstitutionDirectory,
  getMyAdminWorkspaces,
  getAdminControlCenter,
  getStudentDataIntakeReadiness,
  recordSecurityApprovalDecision,
  recordAccessibilityApprovalDecision,
  searchAdminAccountsCourses,
  previewFeatureControlChange,
  applyFeatureControlChange,
  submitInstitutionAccessApplication,
  reviewInstitutionAccessApplication,
  reviewIdentityOnboarding,
  inviteInstitutionTeamMember,
  setPlatformAdminAuthorization,
  setInstitutionTeamMember,
  reviewInstitutionTransfer,
  requestInstitutionTransfer,
  recordIntegrationTest,
  setIntegrationConnectionStatus,
  generateAdminControlReport,
  getMarketplaceControlCenter,
  reviewMarketplaceCase,
  configureMarketplaceTaxControl,
  reviewMarketplaceLaunchControl,
  setMarketplaceLiveCharging,
  processMarketplaceRefund,
  signInInstitutionAdmin,
  signUpInstitutionApplicant,
  signOutAdmin,
  getCurrentSession,
  submitInstitutionApplication,
  getAdminWorkspaces,
  reviewInstitutionApplication,
  reviewInstitutionAffiliation,
  recordConnectionTest,
  setConnectionStatus,
});

export default adminControlService;
