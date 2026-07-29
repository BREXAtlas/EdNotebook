export const STUDENT_DATA_SNAPSHOT_VERSION = "2.3";

export const STUDENT_DATA_DOMAINS = Object.freeze([
  "profile",
  "identityOnboardingRequests",
  "institutionAccessApplications",
  "institutionAffiliations",
  "institutionMemberships",
  "institutionTransferRequests",
  "courseMemberships",
  "studentEnrollmentRequests",
  "studentRosterEntries",
  "assignmentDrafts",
  "assignmentFormSubmissions",
  "courseLessonProgress",
  "courseProgress",
  "studentGrades",
  "gradeShareLinks",
  "learningMessages",
  "courseCommunicationReads",
  "courseCommunicationPreferences",
  "learningResources",
  "studentLearningRecords",
  "studentPublicProfile",
  "studentGroups",
  "studentGroupMemberships",
  "studentPosts",
  "readingAnnotations",
  "studentEducationPath",
  "educatorVerificationRequests",
  "secureFiles",
  "filePreviews",
  "processingJobs",
  "linkPreviews",
  "uploadQuotaReservations",
  "fileDeletionRequests",
  "legalHoldFiles",
  "publicationEntitlements",
  "billingCustomers",
  "billingSubscriptions",
  "userEntitlements",
  "blackboardIdentityMappings",
  "blackboardGradeExportSnapshots",
  "learningSystemIdentifiers",
  "ltiUserMappings",
  "ltiContextMemberships",
  "ltiLaunchSessions",
  "ltiGradeSyncEvents",
  "userFeaturePolicies",
  "auditEvents",
]);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function comparisonFingerprint(value) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function rowsForDomain(domains, domain) {
  const capture = domains?.[domain];
  if (!capture || capture.status !== "succeeded") {
    throw new TypeError(`${domain} must have an explicit succeeded capture result.`);
  }
  if (!Array.isArray(capture.rows)) throw new TypeError(`${domain}.rows must be an array.`);
  return capture.rows;
}

function snapshotPayload({ studentId, domains }) {
  return canonicalize({
    version: STUDENT_DATA_SNAPSHOT_VERSION,
    studentId: String(studentId),
    domains,
  });
}

function validateSnapshot(snapshot, label) {
  if (!snapshot || snapshot.version !== STUDENT_DATA_SNAPSHOT_VERSION) {
    throw new RangeError(`${label} snapshot version is not supported.`);
  }
  if (!String(snapshot.studentId || "").trim()) throw new TypeError(`${label} snapshot has no student ID.`);

  for (const domain of STUDENT_DATA_DOMAINS) {
    const rows = snapshot.domains?.[domain];
    if (!Array.isArray(rows)) throw new TypeError(`${label} snapshot is missing ${domain}.`);
    if (snapshot.rowCounts?.[domain] !== rows.length) {
      throw new RangeError(`${label} snapshot row count does not match ${domain}.`);
    }
  }

  const expectedFingerprint = comparisonFingerprint(snapshotPayload({
    studentId: snapshot.studentId,
    domains: snapshot.domains,
  }));
  if (snapshot.fingerprint !== expectedFingerprint) {
    throw new RangeError(`${label} snapshot fingerprint is invalid.`);
  }
}

export function createStudentDataSnapshot({ studentId, domains } = {}) {
  if (!String(studentId || "").trim()) throw new TypeError("A student ID is required for a safety snapshot.");
  if (!domains || typeof domains !== "object" || Array.isArray(domains)) {
    throw new TypeError("Explicit capture results are required for every student-data domain.");
  }

  const canonicalDomains = Object.fromEntries(
    STUDENT_DATA_DOMAINS.map((domain) => [domain, canonicalize(rowsForDomain(domains, domain))]),
  );
  const rowCounts = Object.fromEntries(
    STUDENT_DATA_DOMAINS.map((domain) => [domain, canonicalDomains[domain].length]),
  );
  const payload = snapshotPayload({ studentId, domains: canonicalDomains });

  return Object.freeze({
    version: STUDENT_DATA_SNAPSHOT_VERSION,
    studentId: String(studentId),
    rowCounts: Object.freeze(rowCounts),
    domains: Object.freeze(canonicalDomains),
    fingerprint: comparisonFingerprint(payload),
  });
}

export function reconcileStudentDataSnapshots(before, after) {
  if (!before || !after) throw new TypeError("Both student-data snapshots are required.");
  if (before.version !== after.version) throw new RangeError("Snapshot versions do not match.");
  validateSnapshot(before, "Before");
  validateSnapshot(after, "After");
  if (before.studentId !== after.studentId) throw new RangeError("Snapshots belong to different students.");

  const differences = STUDENT_DATA_DOMAINS.flatMap((domain) => {
    const beforeRows = before.domains[domain];
    const afterRows = after.domains[domain];
    if (JSON.stringify(beforeRows) === JSON.stringify(afterRows)) return [];
    return [{
      domain,
      beforeCount: beforeRows.length,
      afterCount: afterRows.length,
      changed: true,
    }];
  });

  return Object.freeze({
    ok: differences.length === 0 && before.fingerprint === after.fingerprint,
    beforeFingerprint: before.fingerprint,
    afterFingerprint: after.fingerprint,
    differences: Object.freeze(differences),
  });
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

const CAPABILITY_BY_RECORD_KIND = Object.freeze({
  profile: "view_accounts",
  affiliation: "view_accounts",
  membership: "view_accounts",
  grade: "view_records",
  enrollment: "manage_courses",
  file: "manage_files",
});

/**
 * Mirrors the intended authorization order used by database policies.
 * A matching institution is necessary for delegated access but never enough
 * on its own: the actor also needs the record-specific capability or course
 * management authority.
 */
export function evaluateStudentDataAccess({
  actorId,
  studentId,
  actorInstitutionIds = [],
  recordInstitutionId = null,
  recordKind = "profile",
  capabilities = [],
  platformOwner = false,
  managesCourse = false,
  explicitShare = false,
} = {}) {
  if (!actorId || !studentId) return Object.freeze({ allowed: false, reason: "missing_identity" });
  if (platformOwner) return Object.freeze({ allowed: true, reason: "platform_owner" });
  if (sameId(actorId, studentId)) return Object.freeze({ allowed: true, reason: "self" });

  const tenantMatch = recordInstitutionId
    ? actorInstitutionIds.some((institutionId) => sameId(institutionId, recordInstitutionId))
    : false;
  if (!tenantMatch) return Object.freeze({ allowed: false, reason: "institution_mismatch" });

  if (recordKind === "grade" && explicitShare) return Object.freeze({ allowed: true, reason: "active_grade_share" });
  if (["grade", "enrollment"].includes(recordKind) && managesCourse) {
    return Object.freeze({ allowed: true, reason: "course_manager" });
  }

  const requiredCapability = CAPABILITY_BY_RECORD_KIND[recordKind];
  if (requiredCapability && capabilities.includes(requiredCapability)) {
    return Object.freeze({ allowed: true, reason: requiredCapability });
  }
  return Object.freeze({ allowed: false, reason: "insufficient_capability" });
}

function normalizedIdentifier(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function requiredNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

export function reconcileBlackboardGradeRecord({ identity, column, grade, gradeItem } = {}) {
  const issues = [];
  if (!identity || !column || !grade || !gradeItem) throw new TypeError("Identity, column, grade, and grade-item records are required.");

  if (!sameId(identity.courseId, grade.courseId) || !sameId(column.courseId, grade.courseId)) issues.push("course_mismatch");
  if (!sameId(identity.ednotebookUserId, grade.studentId)) issues.push("student_mismatch");
  if (!sameId(column.ednotebookGradeItemId, grade.gradeItemId) || !sameId(gradeItem.id, grade.gradeItemId)) issues.push("grade_item_mismatch");

  const institutionIds = [identity.institutionId, column.institutionId, grade.institutionId]
    .filter(Boolean)
    .map(String);
  if (institutionIds.length !== 3) issues.push("missing_institution");
  if (new Set(institutionIds).size > 1) issues.push("institution_mismatch");

  const score = requiredNumber(grade.score);
  const maximumPoints = requiredNumber(gradeItem.maxPoints);
  if (!Number.isFinite(score)) issues.push("invalid_score");
  if (!Number.isFinite(maximumPoints) || maximumPoints <= 0) issues.push("invalid_maximum_points");
  if (Number.isFinite(score) && Number.isFinite(maximumPoints) && (score < 0 || score > maximumPoints)) issues.push("score_out_of_range");
  if (grade.status !== "finalized") issues.push("grade_not_finalized");
  if (column.scalingMode === "raw" && Number(column.blackboardPointsPossible) !== maximumPoints) issues.push("maximum_points_mismatch");

  const username = normalizedIdentifier(identity.blackboardUsername);
  const studentIdentifier = normalizedIdentifier(identity.blackboardStudentId);
  const sisIdentifier = normalizedIdentifier(identity.blackboardSisUserId);
  if (!username && !studentIdentifier && !sisIdentifier) issues.push("missing_blackboard_identifier");
  const columnKey = normalizedIdentifier(column.blackboardColumnKey);
  const lineItemId = normalizedIdentifier(column.externalLineItemId);
  if (!columnKey && !lineItemId) issues.push("missing_blackboard_grade_target");

  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues),
    record: issues.length ? null : Object.freeze({
      blackboardUsername: username,
      blackboardStudentId: studentIdentifier,
      blackboardSisUserId: sisIdentifier,
      blackboardColumnKey: columnKey,
      externalLineItemId: lineItemId,
      score,
      maximumPoints,
      status: grade.status,
    }),
  });
}

export function evaluateDeletionRequest({
  now = new Date(),
  retentionUntil = null,
  legalHoldActive = false,
  availabilityStatus = "released",
} = {}) {
  const evaluatedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(evaluatedAt.getTime())) throw new TypeError("Deletion evaluation time is invalid.");
  if (availabilityStatus === "deleted") {
    return Object.freeze({ status: "completed", eligibleAt: null, nextAvailabilityStatus: "deleted" });
  }
  if (legalHoldActive) {
    return Object.freeze({ status: "blocked_legal_hold", eligibleAt: null, nextAvailabilityStatus: availabilityStatus });
  }

  const retentionDate = retentionUntil ? new Date(retentionUntil) : null;
  if (retentionDate && Number.isNaN(retentionDate.getTime())) throw new TypeError("Retention date is invalid.");
  if (retentionDate && retentionDate > evaluatedAt) {
    return Object.freeze({
      status: "deferred_retention",
      eligibleAt: retentionDate.toISOString(),
      nextAvailabilityStatus: availabilityStatus,
    });
  }
  return Object.freeze({
    status: "eligible",
    eligibleAt: evaluatedAt.toISOString(),
    nextAvailabilityStatus: "pending_delete",
  });
}
