import assert from "node:assert/strict";
import test from "node:test";
import {
  ONEROSTER_12_RESOURCES,
  authorizeEarlyPrepGradeExport,
  powerSchoolCsvPreview,
  prepareEarlyPrepGradeExport,
  schoologyLtiContract,
} from "./earlyPrepLearningAdapters.js";

test("OneRoster 1.2 foundation names the complete roster and grade exchange surface", () => {
  assert.deepEqual(ONEROSTER_12_RESOURCES, ["orgs", "academicSessions", "courses", "classes", "users", "enrollments", "lineItems", "results"]);
});

test("PowerSchool synthetic imports normalize to the shared contract and remain previews", () => {
  const preview = powerSchoolCsvPreview({
    courses: [{ course_number: "ENG10", section_id: "SEC-7", section_number: "07", course_name: "English II", term_name: "2026-27" }],
    people: [{ first_name: "Maya", last_name: "Rivera", student_number: "S-42", dcid: "9001", email: "MAYA@example.edu" }],
    enrollments: [{ enrollment_id: "E-1", section_id: "SEC-7", dcid: "9001", student_number: "S-42", role: "student" }],
  });
  assert.equal(preview.educationDivision, "k12");
  assert.equal(preview.writeAuthorized, false);
  assert.equal(preview.people[0].email, "maya@example.edu");
  assert.equal(preview.people[0].identifiers.student_id, "S-42");
  assert.equal(preview.enrollments[0].role, "learner");
});

test("Schoology reuses LTI 1.3 and keeps credentials server-only", () => {
  const contract = schoologyLtiContract();
  assert.deepEqual(contract.capabilities, ["oidc-login", "resource-link", "deep-linking", "nrps", "ags"]);
  assert.equal(contract.credentials, "server-only");
});

test("grade export requires a reviewed, clean preview and matching idempotency key", () => {
  const preview = prepareEarlyPrepGradeExport({
    provider: "powerschool",
    courseId: "course-1",
    idempotencyKey: "export-2026-08-03-1",
    rows: [{ student_id: "student-1", grade_item_id: "item-1", score: 9, max_points: 10 }],
  });
  assert.equal(preview.writeAuthorized, false);
  assert.throws(() => authorizeEarlyPrepGradeExport(preview, { idempotencyKey: preview.idempotencyKey }), /reviewer_required/u);
  const approved = authorizeEarlyPrepGradeExport(preview, { reviewedBy: "teacher-1", idempotencyKey: preview.idempotencyKey });
  assert.equal(approved.writeAuthorized, true);
  assert.equal(approved.reviewStatus, "approved");
});
