import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_PREP_READINESS_MODULES,
  buildPracticeResume,
  buildTeacherReadinessAssignment,
  createStudentReadinessPlan,
  interviewPractice,
} from "./readinessCatalog.js";

test("the Early Prep readiness catalog has six stable, immutable practice modules", () => {
  assert.deepEqual(EARLY_PREP_READINESS_MODULES.map(({ id }) => id), [
    "career-exploration",
    "trade-pathway",
    "resume-practice",
    "interview-practice",
    "summer-job-readiness",
    "college-readiness",
  ]);
  assert.ok(Object.isFrozen(EARLY_PREP_READINESS_MODULES));
  assert.ok(EARLY_PREP_READINESS_MODULES.every((module) => Object.isFrozen(module) && Object.isFrozen(module.prompts)));
});

test("student plans preserve explicit choices without matching, predictions, applications, or payments", () => {
  const plan = createStudentReadinessPlan({
    selectedModuleIds: ["trade-pathway", "college-readiness", "trade-pathway"],
    goalText: "Compare two paths and write down questions.",
  });
  assert.deepEqual(plan.selectedModules.map(({ id }) => id), ["trade-pathway", "college-readiness"]);
  assert.equal(plan.automatedRecommendation, false);
  assert.equal(plan.eligibilityDecision, false);
  assert.equal(plan.admissionsPrediction, false);
  assert.equal(plan.employerMatch, false);
  assert.equal(plan.applicationSubmitted, false);
  assert.equal(plan.sharingAuthorized, false);
  assert.equal(plan.paymentRequired, false);
});

test("readiness plans fail closed outside Early Prep and for unknown modules", () => {
  assert.throws(() => createStudentReadinessPlan({ educationDivision: "university", selectedModuleIds: ["career-exploration"] }), /requires_k12/u);
  assert.throws(() => createStudentReadinessPlan({ selectedModuleIds: ["secret-employer-match"] }), /known_readiness_module_required/u);
});

test("practice resumes escape student text and reject sensitive identity fields", () => {
  const resume = buildPracticeResume({
    displayName: "Student <script>alert(1)</script>",
    summary: "Reliable & curious",
    experience: "Built a class project.",
  });
  assert.match(resume.html, /Student &lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(resume.html, /<script>/u);
  assert.match(resume.html, /contact details intentionally omitted/u);
  assert.equal(resume.storage, "memory_only");
  assert.equal(resume.sharingAuthorized, false);
  assert.throws(() => buildPracticeResume({ socialSecurityNumber: "000-00-0000" }), /restricted_resume_field/u);
});

test("interview practice coaches without recording, matching, or scoring", () => {
  const practice = interviewPractice({ questionIndex: 8 });
  assert.equal(practice.questionIndex, 2);
  assert.equal(practice.questionCount, 6);
  assert.equal(practice.automatedScore, null);
  assert.equal(practice.recordingEnabled, false);
  assert.equal(practice.employerMatch, false);
});

test("teacher assignments reuse the CTE adapter and remain review-only drafts", () => {
  const assignment = buildTeacherReadinessAssignment("summer-job-readiness");
  assert.equal(assignment.subjectId, "career-technical-education");
  assert.equal(assignment.adapterKey, "cte");
  assert.equal(assignment.sections.length, 3);
  assert.equal(assignment.automatedScoring, false);
  assert.equal(assignment.publishAuthorized, false);
  assert.equal(assignment.requiresTeacherReview, true);
  assert.equal(assignment.studentDataRequired, false);
});
