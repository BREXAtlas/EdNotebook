import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_PROGRESS,
  canonicalCourseRecord,
  canonicalGradeItemRecord,
  canonicalGradeResultRecord,
  canonicalIdentifiersFromCsv,
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
