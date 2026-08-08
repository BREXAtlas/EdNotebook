import {
  CANONICAL_ROLES,
  INTEGRATION_MODES,
  LEARNING_SYSTEMS,
  RESULT_STATUS,
  canonicalCourseRecord,
  canonicalEnrollmentRecord,
  canonicalGradeResultRecord,
  canonicalIdentifiersFromCsv,
  canonicalPersonRecord,
  validateCanonicalGradeResult,
} from "../learningRecordContract.js";

export const ONEROSTER_12_RESOURCES = Object.freeze([
  "orgs",
  "academicSessions",
  "courses",
  "classes",
  "users",
  "enrollments",
  "lineItems",
  "results",
]);

export const EARLY_PREP_PROVIDERS = Object.freeze({
  ONEROSTER: { id: LEARNING_SYSTEMS.ONEROSTER, modes: [INTEGRATION_MODES.ONEROSTER_CSV, INTEGRATION_MODES.ONEROSTER_REST] },
  POWERSCHOOL: { id: LEARNING_SYSTEMS.POWERSCHOOL, modes: [INTEGRATION_MODES.CSV, INTEGRATION_MODES.ONEROSTER_REST] },
  SCHOOLOGY: { id: LEARNING_SYSTEMS.SCHOOLOGY, modes: [INTEGRATION_MODES.LTI_1_3, INTEGRATION_MODES.REST] },
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function stablePreviewHash(value) {
  const input = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function powerSchoolCsvPreview({ courses = [], people = [], enrollments = [] } = {}) {
  const provider = LEARNING_SYSTEMS.POWERSCHOOL;
  const mode = INTEGRATION_MODES.CSV;
  return {
    educationDivision: "k12",
    provider,
    mode,
    courses: courses.map((row) => canonicalCourseRecord({
      course_sourced_id: row.course_number,
      class_sourced_id: row.section_id,
      course_code: row.course_number,
      section_code: row.section_number,
      title: row.course_name,
      teaching_window: row.term_name,
      provenance: { provider, mode, sourceRecordId: row.section_id },
    })),
    people: people.map((row) => canonicalPersonRecord({
      full_name: [row.first_name, row.last_name].filter(Boolean).join(" "),
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      identifiers: canonicalIdentifiersFromCsv({ student_id: row.student_number, sis_user_id: row.dcid, username: row.username, email: row.email }),
      provenance: { provider, mode, sourceRecordId: row.dcid || row.student_number },
    })),
    enrollments: enrollments.map((row) => canonicalEnrollmentRecord({
      class_sourced_id: row.section_id,
      sis_user_id: row.dcid,
      enrollment_sourced_id: row.enrollment_id,
      role: row.role === "teacher" ? CANONICAL_ROLES.INSTRUCTOR : CANONICAL_ROLES.LEARNER,
      status: row.status || "active",
      identifiers: canonicalIdentifiersFromCsv({ student_id: row.student_number, sis_user_id: row.dcid }),
      provenance: { provider, mode, sourceRecordId: row.enrollment_id },
    })),
    reviewStatus: "pending_review",
    writeAuthorized: false,
  };
}

export function schoologyLtiContract() {
  return {
    provider: LEARNING_SYSTEMS.SCHOOLOGY,
    mode: INTEGRATION_MODES.LTI_1_3,
    capabilities: ["oidc-login", "resource-link", "deep-linking", "nrps", "ags"],
    credentials: "server-only",
    gradeExport: "preview-review-idempotent-write",
  };
}

export function prepareEarlyPrepGradeExport({ provider, courseId, rows = [], idempotencyKey = null } = {}) {
  const canonicalRows = rows.map((row) => canonicalGradeResultRecord({ ...row, course_id: courseId, status: row.status || RESULT_STATUS.FINALIZED }));
  const issues = canonicalRows.flatMap((row, index) => validateCanonicalGradeResult(row).map((issue) => ({ row: index, issue })));
  const preview = { educationDivision: "k12", provider, courseId, rows: canonicalRows };
  return {
    ...preview,
    idempotencyKey,
    previewHash: stablePreviewHash(preview),
    issues,
    reviewStatus: "pending_review",
    writeAuthorized: false,
  };
}

export function authorizeEarlyPrepGradeExport(preview, { reviewedBy, idempotencyKey } = {}) {
  if (!reviewedBy) throw new Error("reviewer_required");
  if (!idempotencyKey || idempotencyKey !== preview?.idempotencyKey) throw new Error("idempotency_key_mismatch");
  if (preview?.issues?.length) throw new Error("preview_issues_unresolved");
  return { ...preview, reviewedBy, reviewStatus: "approved", writeAuthorized: true };
}
