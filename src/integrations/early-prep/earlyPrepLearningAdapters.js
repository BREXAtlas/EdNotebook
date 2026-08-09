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
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => key !== "receivedAt").sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
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
  const preview = {
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
  return {
    ...preview,
    previewHash: stablePreviewHash(preview),
    summary: {
      courses: preview.courses.length,
      people: preview.people.length,
      enrollments: preview.enrollments.length,
    },
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
  if (!canonicalRows.length) issues.push({ row: null, issue: "rows_required" });
  const changedRowCount = rows.reduce((count, row, index) => {
    const hasCurrentScore = Object.hasOwn(row, "current_score") || Object.hasOwn(row, "currentScore");
    const hasCurrentMaximum = Object.hasOwn(row, "current_max_points") || Object.hasOwn(row, "currentMaxPoints");
    if (!hasCurrentScore || !hasCurrentMaximum) return count + 1;
    const currentScore = Number(row.current_score ?? row.currentScore);
    const currentMaximum = Number(row.current_max_points ?? row.currentMaxPoints);
    return count + (currentScore === canonicalRows[index].scoreGiven && currentMaximum === canonicalRows[index].scoreMaximum ? 0 : 1);
  }, 0);
  const preview = {
    educationDivision: "k12",
    provider,
    courseId,
    rows: canonicalRows,
    rowCount: canonicalRows.length,
    changedRowCount,
    noOp: canonicalRows.length > 0 && changedRowCount === 0,
  };
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
  return { ...preview, reviewedBy, reviewStatus: "approved", writeAuthorized: !preview.noOp };
}

export function reconcileEarlyPrepNoopGradeExport(approvedPreview, { reconciledBy, actualWriteCount = 0 } = {}) {
  if (approvedPreview?.reviewStatus !== "approved") throw new Error("approved_preview_required");
  if (!approvedPreview?.noOp) throw new Error("noop_preview_required");
  if (!reconciledBy) throw new Error("reconciler_required");
  if (actualWriteCount !== 0) throw new Error("noop_export_must_not_write");
  return {
    ...approvedPreview,
    reviewStatus: "reconciled",
    writeAuthorized: false,
    reconciliation: {
      expectedWriteCount: 0,
      actualWriteCount: 0,
      reconciledBy,
      providerReceipt: null,
    },
  };
}
