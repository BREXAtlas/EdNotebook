import {
  ONEROSTER_12_RESOURCES,
  authorizeEarlyPrepGradeExport,
  powerSchoolCsvPreview,
  prepareEarlyPrepGradeExport,
  reconcileEarlyPrepNoopGradeExport,
} from "./earlyPrepLearningAdapters.js";

export const EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE = Object.freeze({
  fixtureId: "early-prep-west-texas-2026-08",
  classification: "synthetic_test_data_only",
  institution: { sourcedId: "SYN-DISTRICT-001", name: "Early Prep Synthetic District" },
  oneRoster: {
    orgs: [{ sourcedId: "SYN-DISTRICT-001", name: "Early Prep Synthetic District", type: "district" }],
    academicSessions: [{ sourcedId: "SYN-TERM-2026", title: "2026–27", type: "schoolYear" }],
    courses: [{ sourcedId: "SYN-ALG1", title: "Algebra I", courseCode: "ALG I" }],
    classes: [{ sourcedId: "SYN-SECTION-04", title: "Algebra I · Period 4", courseSourcedId: "SYN-ALG1" }],
    users: [
      { sourcedId: "SYN-TEACHER-01", role: "teacher", email: "teacher@early-prep-synthetic.invalid" },
      { sourcedId: "SYN-STUDENT-01", role: "student", email: "student@early-prep-synthetic.invalid" },
    ],
    enrollments: [
      { sourcedId: "SYN-ENROLL-TEACHER", classSourcedId: "SYN-SECTION-04", userSourcedId: "SYN-TEACHER-01", role: "teacher" },
      { sourcedId: "SYN-ENROLL-STUDENT", classSourcedId: "SYN-SECTION-04", userSourcedId: "SYN-STUDENT-01", role: "student" },
    ],
    lineItems: [{ sourcedId: "SYN-LINE-01", classSourcedId: "SYN-SECTION-04", title: "Linear equations check", scoreMaximum: 10 }],
    results: [{ sourcedId: "SYN-RESULT-01", lineItemSourcedId: "SYN-LINE-01", userSourcedId: "SYN-STUDENT-01", score: 9, scoreMaximum: 10 }],
  },
  powerSchool: {
    courses: [{ course_number: "ALG1", section_id: "SYN-SECTION-04", section_number: "04", course_name: "Algebra I", term_name: "2026–27" }],
    people: [
      { first_name: "Taylor", last_name: "Teacher", dcid: "SYN-TEACHER-01", username: "synthetic.teacher", email: "teacher@early-prep-synthetic.invalid" },
      { first_name: "Jordan", last_name: "Student", student_number: "SYN-STUDENT-NUMBER-01", dcid: "SYN-STUDENT-01", username: "synthetic.student", email: "student@early-prep-synthetic.invalid" },
    ],
    enrollments: [
      { enrollment_id: "SYN-ENROLL-TEACHER", section_id: "SYN-SECTION-04", dcid: "SYN-TEACHER-01", role: "teacher" },
      { enrollment_id: "SYN-ENROLL-STUDENT", section_id: "SYN-SECTION-04", dcid: "SYN-STUDENT-01", student_number: "SYN-STUDENT-NUMBER-01", role: "student" },
    ],
  },
  gradeExport: {
    provider: "powerschool",
    courseId: "33000000-0000-4000-8000-000000000020",
    idempotencyKey: "early-prep-synthetic-noop-2026-08",
    rows: [{
      student_id: "33000000-0000-4000-8000-000000000003",
      grade_item_id: "synthetic-linear-equations-check",
      current_score: 9,
      current_max_points: 10,
      score: 9,
      max_points: 10,
      status: "finalized",
    }],
  },
});

export function runEarlyPrepSyntheticDistrictPilot(fixture = EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE) {
  const missingResources = ONEROSTER_12_RESOURCES.filter((resource) => !Array.isArray(fixture.oneRoster?.[resource]));
  if (fixture.classification !== "synthetic_test_data_only" || missingResources.length) {
    throw new Error("complete_synthetic_oneroster_fixture_required");
  }
  const importPreview = powerSchoolCsvPreview(fixture.powerSchool);
  const gradePreview = prepareEarlyPrepGradeExport(fixture.gradeExport);
  const approvedNoop = authorizeEarlyPrepGradeExport(gradePreview, {
    reviewedBy: "33000000-0000-4000-8000-000000000001",
    idempotencyKey: gradePreview.idempotencyKey,
  });
  const reconciledNoop = reconcileEarlyPrepNoopGradeExport(approvedNoop, {
    reconciledBy: "33000000-0000-4000-8000-000000000001",
    actualWriteCount: 0,
  });
  return {
    fixtureId: fixture.fixtureId,
    classification: fixture.classification,
    educationDivision: "k12",
    oneRosterResourceCounts: Object.fromEntries(ONEROSTER_12_RESOURCES.map((resource) => [resource, fixture.oneRoster[resource].length])),
    importPreviewHash: importPreview.previewHash,
    importSummary: importPreview.summary,
    importWriteAuthorized: importPreview.writeAuthorized,
    gradePreviewHash: reconciledNoop.previewHash,
    gradeReviewStatus: reconciledNoop.reviewStatus,
    gradeWriteAuthorized: reconciledNoop.writeAuthorized,
    reconciliation: reconciledNoop.reconciliation,
  };
}
