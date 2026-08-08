export const LEARNING_RECORD_CONTRACT_VERSION = "1.0";

export const LEARNING_SYSTEMS = Object.freeze({
  EDNOTEBOOK: "ednotebook",
  BLACKBOARD: "blackboard",
  INSTITUTION_SIS: "institution_sis",
  ONEROSTER: "oneroster",
  POWERSCHOOL: "powerschool",
  SCHOOLOGY: "schoology",
});

export const INTEGRATION_MODES = Object.freeze({
  CSV: "csv",
  LTI_1_3: "lti_1_3",
  REST: "rest",
  ONEROSTER_CSV: "oneroster_csv",
  ONEROSTER_REST: "oneroster_rest",
});

export const CANONICAL_ROLES = Object.freeze({
  ADMINISTRATOR: "administrator",
  INSTRUCTOR: "instructor",
  TEACHING_ASSISTANT: "teaching_assistant",
  LEARNER: "learner",
  OBSERVER: "observer",
  CONTENT_DEVELOPER: "content_developer",
  UNKNOWN: "unknown",
});

export const ACTIVITY_PROGRESS = Object.freeze({
  INITIALIZED: "Initialized",
  STARTED: "Started",
  IN_PROGRESS: "InProgress",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
});

export const GRADING_PROGRESS = Object.freeze({
  NOT_READY: "NotReady",
  FAILED: "Failed",
  PENDING: "Pending",
  PENDING_MANUAL: "PendingManual",
  FULLY_GRADED: "FullyGraded",
});

export const RESULT_STATUS = Object.freeze({
  PENDING: "pending",
  MISSING: "missing",
  FINALIZED: "finalized",
  RELEASED: "released",
  EXEMPT: "exempt",
  VOIDED: "voided",
});

export const EXTERNAL_IDENTIFIER_TYPES = Object.freeze({
  LTI_SUBJECT: "lti_subject",
  ONEROSTER_SOURCED_ID: "oneroster_sourced_id",
  LMS_USER_ID: "lms_user_id",
  SIS_USER_ID: "sis_user_id",
  INSTITUTION_USER_ID: "institution_user_id",
  STUDENT_ID: "student_id",
  USERNAME: "username",
  EMAIL: "email",
});

const cleanText = (value, max = 500) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

const cleanNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function canonicalProvenance({ provider, mode, sourceRecordId = null, receivedAt = null, payloadHash = null } = {}) {
  return {
    provider: cleanText(provider, 80),
    mode: cleanText(mode, 80),
    sourceRecordId: cleanText(sourceRecordId),
    receivedAt: cleanDateTime(receivedAt) || new Date().toISOString(),
    payloadHash: cleanText(payloadHash, 128),
    contractVersion: LEARNING_RECORD_CONTRACT_VERSION,
  };
}

export function canonicalInstitutionRecord(input = {}) {
  return {
    ednotebookInstitutionId: cleanText(input.ednotebookInstitutionId || input.id),
    institutionCode: cleanText(input.institutionCode || input.institution_code, 180),
    name: cleanText(input.name, 300),
    sisSourcedId: cleanText(input.sisSourcedId || input.sis_sourced_id),
    primaryLms: cleanText(input.primaryLms || input.primary_lms, 120),
    academicDomain: cleanText(input.academicDomain || input.academic_domain, 320)?.toLowerCase() || null,
    timezoneName: cleanText(input.timezoneName || input.timezone_name, 120),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalConnectionRecord(input = {}) {
  return {
    institutionId: cleanText(input.institutionId || input.institution_id),
    provider: cleanText(input.provider, 80),
    mode: cleanText(input.mode || input.integration_mode, 80),
    issuer: cleanText(input.issuer, 1_000),
    clientId: cleanText(input.clientId || input.client_id, 500),
    deploymentId: cleanText(input.deploymentId || input.deployment_id, 500),
    oidcAuthorizationUrl: cleanText(input.oidcAuthorizationUrl || input.oidc_authorization_url, 2_000),
    jwksUrl: cleanText(input.jwksUrl || input.jwks_url, 2_000),
    oauthTokenUrl: cleanText(input.oauthTokenUrl || input.oauth_token_url, 2_000),
    approvedScopes: Array.from(new Set((input.approvedScopes || input.enabled_scopes || []).map((value) => cleanText(value, 500)).filter(Boolean))),
    status: cleanText(input.status, 80) || "setup",
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalCourseRecord(input = {}) {
  return {
    ednotebookCourseId: cleanText(input.ednotebookCourseId || input.id),
    institutionId: cleanText(input.institutionId || input.institution_id),
    externalContextId: cleanText(input.externalContextId || input.context_id),
    externalCourseId: cleanText(input.externalCourseId || input.course_sourced_id),
    externalSectionId: cleanText(input.externalSectionId || input.class_sourced_id),
    courseCode: cleanText(input.courseCode || input.course_code, 180),
    sectionCode: cleanText(input.sectionCode || input.section_code, 180),
    title: cleanText(input.title, 300),
    subject: cleanText(input.subject, 180),
    academicSessionId: cleanText(input.academicSessionId || input.academic_session_id),
    academicSessionLabel: cleanText(input.academicSessionLabel || input.teaching_window, 180),
    startAt: cleanDateTime(input.startAt || input.start_at),
    endAt: cleanDateTime(input.endAt || input.end_at),
    status: cleanText(input.status, 80),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalPersonRecord(input = {}) {
  const identifiers = input.identifiers || {};
  return {
    ednotebookUserId: cleanText(input.ednotebookUserId || input.id),
    institutionId: cleanText(input.institutionId || input.institution_id),
    givenName: cleanText(input.givenName || input.first_name, 180),
    familyName: cleanText(input.familyName || input.last_name, 180),
    displayName: cleanText(input.displayName || input.full_name, 300),
    email: cleanText(input.email, 320)?.toLowerCase() || null,
    identifiers: Object.fromEntries(Object.entries(identifiers)
      .map(([key, value]) => [cleanText(key, 80), cleanText(value)])
      .filter(([key, value]) => key && value)),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalEnrollmentRecord(input = {}) {
  return {
    institutionId: cleanText(input.institutionId || input.institution_id),
    ednotebookCourseId: cleanText(input.ednotebookCourseId || input.course_id),
    ednotebookUserId: cleanText(input.ednotebookUserId || input.user_id),
    externalContextId: cleanText(input.externalContextId || input.context_id),
    externalUserId: cleanText(input.externalUserId || input.lti_subject || input.lms_user_id),
    externalEnrollmentId: cleanText(input.externalEnrollmentId || input.enrollment_sourced_id),
    role: cleanText(input.role, 120) || CANONICAL_ROLES.UNKNOWN,
    status: cleanText(input.status, 80),
    isPrimary: Boolean(input.isPrimary || input.is_primary),
    beginAt: cleanDateTime(input.beginAt || input.begin_at),
    endAt: cleanDateTime(input.endAt || input.end_at),
    identifiers: Object.fromEntries(Object.entries(input.identifiers || {}).map(([key, value]) => [cleanText(key, 80), cleanText(value)]).filter(([key, value]) => key && value)),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalGradeItemRecord(input = {}) {
  return {
    ednotebookGradeItemId: cleanText(input.ednotebookGradeItemId || input.id),
    ednotebookCourseId: cleanText(input.ednotebookCourseId || input.course_id),
    externalLineItemId: cleanText(input.externalLineItemId || input.line_item_id),
    externalResourceLinkId: cleanText(input.externalResourceLinkId || input.resource_link_id),
    externalCategoryId: cleanText(input.externalCategoryId || input.category_sourced_id),
    title: cleanText(input.title, 500),
    description: cleanText(input.description, 2_000),
    categoryTitle: cleanText(input.categoryTitle || input.category_name, 300),
    scoreMaximum: cleanNumber(input.scoreMaximum ?? input.max_points),
    weightPercent: cleanNumber(input.weightPercent ?? input.weight_percent),
    startAt: cleanDateTime(input.startAt || input.start_at),
    dueAt: cleanDateTime(input.dueAt || input.due_at),
    endAt: cleanDateTime(input.endAt || input.end_at),
    releaseAt: cleanDateTime(input.releaseAt || input.release_at),
    status: cleanText(input.status || input.publish_state, 80),
    tag: cleanText(input.tag, 180),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalGradeResultRecord(input = {}) {
  return {
    ednotebookCourseId: cleanText(input.ednotebookCourseId || input.course_id),
    ednotebookGradeItemId: cleanText(input.ednotebookGradeItemId || input.grade_item_id),
    ednotebookUserId: cleanText(input.ednotebookUserId || input.student_id || input.user_id),
    externalLineItemId: cleanText(input.externalLineItemId || input.line_item_id),
    externalUserId: cleanText(input.externalUserId || input.lms_user_id),
    scoreGiven: cleanNumber(input.scoreGiven ?? input.score),
    scoreMaximum: cleanNumber(input.scoreMaximum ?? input.max_points),
    status: cleanText(input.status, 80) || RESULT_STATUS.PENDING,
    activityProgress: cleanText(input.activityProgress || input.activity_progress, 80),
    gradingProgress: cleanText(input.gradingProgress || input.grading_progress, 80),
    attemptNumber: cleanNumber(input.attemptNumber ?? input.attempt_number),
    comment: cleanText(input.comment, 4_000),
    submittedAt: cleanDateTime(input.submittedAt || input.submitted_at),
    gradedAt: cleanDateTime(input.gradedAt || input.graded_at || input.finalized_at),
    releasedAt: cleanDateTime(input.releasedAt || input.released_at || input.published_at),
    provenance: canonicalProvenance(input.provenance || {}),
  };
}

export function canonicalIdentifiersFromCsv(identity = {}) {
  return Object.fromEntries([
    [EXTERNAL_IDENTIFIER_TYPES.USERNAME, identity.username],
    [EXTERNAL_IDENTIFIER_TYPES.SIS_USER_ID, identity.sis_user_id],
    [EXTERNAL_IDENTIFIER_TYPES.STUDENT_ID, identity.student_id],
    [EXTERNAL_IDENTIFIER_TYPES.EMAIL, identity.email],
  ].map(([key, value]) => [key, cleanText(value)]).filter(([, value]) => value));
}

export function validateCanonicalGradeResult(result) {
  const issues = [];
  if (!result?.ednotebookCourseId) issues.push("course_id_required");
  if (!result?.ednotebookUserId && !result?.externalUserId) issues.push("user_id_required");
  if (!result?.ednotebookGradeItemId && !result?.externalLineItemId) issues.push("line_item_id_required");
  if (result?.scoreGiven !== null && result?.scoreMaximum !== null && result.scoreGiven > result.scoreMaximum) issues.push("score_above_maximum");
  if (result?.scoreGiven !== null && result.scoreGiven < 0) issues.push("negative_score");
  return issues;
}
