import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_PROGRESS,
  canonicalCourseRecord,
  canonicalConnectionRecord,
  canonicalEnrollmentRecord,
  canonicalGradeItemRecord,
  canonicalGradeResultRecord,
  canonicalIdentifiersFromCsv,
  canonicalInstitutionRecord,
  GRADING_PROGRESS,
  LEARNING_RECORD_CONTRACT_VERSION,
  validateCanonicalGradeResult,
} from "./learningRecordContract.js";

test("normalizes familiar institutional course fields without requiring unavailable identifiers", () => {
  const course = canonicalCourseRecord({
    id: "course-1",
    institution_id: "institution-1",
    course_code: "BIO 1301-010",
    title: "Principles of Biology",
    teaching_window: "Fall 2026",
    provenance: { provider: "ednotebook", mode: "database" },
  });
  assert.equal(course.courseCode, "BIO 1301-010");
  assert.equal(course.academicSessionLabel, "Fall 2026");
  assert.equal(course.externalContextId, null);
  assert.equal(course.provenance.contractVersion, LEARNING_RECORD_CONTRACT_VERSION);
});

test("keeps Blackboard and SIS learner identifiers separate", () => {
  assert.deepEqual(canonicalIdentifiersFromCsv({
    username: "student01",
    sis_user_id: "SIS-008",
    student_id: "A01234567",
    email: "student@example.edu",
  }), {
    username: "student01",
    sis_user_id: "SIS-008",
    student_id: "A01234567",
    email: "student@example.edu",
  });
});

test("normalizes institution, connection, and per-course enrollment fields without credentials", () => {
  const institution = canonicalInstitutionRecord({ id: "institution-1", institution_code: "ASU", sis_sourced_id: "org-100", primary_lms: "blackboard", academic_domain: "ANGELO.EDU", timezone_name: "America/Chicago" });
  const connection = canonicalConnectionRecord({ institution_id: institution.ednotebookInstitutionId, provider: "blackboard", integration_mode: "lti_1_3", issuer: "https://lms.example.edu", client_id: "client-1", deployment_id: "deployment-1", enabled_scopes: ["scope-a", "scope-a"], status: "testing" });
  const enrollment = canonicalEnrollmentRecord({ institution_id: institution.ednotebookInstitutionId, course_id: "course-1", user_id: "user-1", context_id: "context-1", lti_subject: "subject-1", enrollment_sourced_id: "enrollment-1", role: "learner", status: "active", identifiers: { oneroster_sourced_id: "user-100" } });
  assert.equal(institution.academicDomain, "angelo.edu");
  assert.deepEqual(connection.approvedScopes, ["scope-a"]);
  assert.equal(enrollment.externalContextId, "context-1");
  assert.equal(enrollment.externalUserId, "subject-1");
  assert.equal(enrollment.identifiers.oneroster_sourced_id, "user-100");
  assert.equal("privateKey" in connection, false);
});

test("uses the same line-item and result vocabulary for CSV and LTI adapters", () => {
  const item = canonicalGradeItemRecord({
    id: "grade-item-1",
    title: "Evidence paragraph",
    max_points: 50,
    due_at: "2026-10-01T22:00:00Z",
    provenance: { provider: "blackboard", mode: "csv", sourceRecordId: "Evidence paragraph" },
  });
  const result = canonicalGradeResultRecord({
    course_id: "course-1",
    grade_item_id: item.ednotebookGradeItemId,
    student_id: "student-1",
    score: 46,
    max_points: item.scoreMaximum,
    status: "finalized",
    activity_progress: ACTIVITY_PROGRESS.COMPLETED,
    grading_progress: GRADING_PROGRESS.FULLY_GRADED,
    finalized_at: "2026-10-02T12:00:00Z",
    provenance: { provider: "ednotebook", mode: "database" },
  });
  assert.equal(item.scoreMaximum, 50);
  assert.equal(result.scoreGiven, 46);
  assert.deepEqual(validateCanonicalGradeResult(result), []);
});

test("rejects a result above its declared maximum", () => {
  const result = canonicalGradeResultRecord({
    course_id: "course-1",
    grade_item_id: "grade-item-1",
    student_id: "student-1",
    score: 101,
    max_points: 100,
  });
  assert.deepEqual(validateCanonicalGradeResult(result), ["score_above_maximum"]);
});
