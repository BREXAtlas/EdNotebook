import assert from "node:assert/strict";
import test from "node:test";

import {
  applyContentUnitDraft,
  createContentUnitGenerationInput,
  createEditableContentUnitDraft,
  validateContentUnitArtifact,
} from "./contentUnitGenerationContract.js";
import {
  DIGITAL_LITERACY_LESSON_ARTIFACT,
  DIGITAL_LITERACY_LESSON_INPUT,
} from "./digitalLiteracyPhase5Fixture.js";

const clone = (value) => structuredClone(value);

function draft() {
  return {
    ...clone(DIGITAL_LITERACY_LESSON_ARTIFACT),
    revisionHistory: [],
  };
}

function common(artifactType) {
  const current = draft();
  return {
    artifactType,
    draftStatus: "ai_draft_not_published",
    statusLabel: "AI Draft — Not Published",
    humanReviewRequired: true,
    courseId: current.courseId,
    lessonId: current.lessonId,
    sourceGaps: [],
    uncertainties: [],
    conflicts: [],
    reviewBlocks: [],
    courseVersionProvenance: clone(current.courseVersionProvenance),
  };
}

function result(artifact) {
  return {
    artifact,
    provenance: {
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      tier: 2,
      promptVersion: "2.0.0",
      policyVersion: "1.1.0",
      fallbackCount: 0,
    },
  };
}

function quizArtifact() {
  return {
    ...common("quiz"),
    targetQuizId: "quiz-evaluating-sources",
    quiz: {
      quizId: "quiz-evaluating-sources",
      title: "Evaluate online information",
      instructions: "Answer each item, then review the explanation.",
      estimatedMinutes: 15,
      pointsPossible: 20,
      items: [
        {
          itemId: "quiz-evaluating-sources-item-1",
          question: "What does corroboration add?",
          type: "multiple_choice",
          options: ["Independent evidence", "More page color"],
          answer: "Independent evidence",
          explanation: "It compares an independent source.",
          points: 10,
          outcomeIds: ["outcome-evaluate-information"],
          sourceIds: ["source-evaluation-reading"],
        },
        {
          itemId: "quiz-evaluating-sources-item-2",
          question: "Does page appearance establish authority?",
          type: "true_false",
          options: [],
          answer: "false",
          explanation: "Authority requires evidence and context.",
          points: 10,
          outcomeIds: ["outcome-evaluate-information"],
          sourceIds: ["source-evaluation-reading"],
        },
      ],
      recoveryGuidance: {
        feedbackGuidance: "Return to the matching source-check step.",
        retryGuidance: "Review the approved reading, then retry.",
        hints: [],
      },
      accessibilityNotes: ["Do not depend on color."],
      academicIntegrityGuidance: "Follow the approved course AI-use policy.",
    },
  };
}

function rubricArtifact() {
  return {
    ...common("rubric_draft"),
    targetAssessmentId: "assessment-source-check",
    targetRubricId: "assessment-source-check-rubric",
    rubric: {
      rubricId: "assessment-source-check-rubric",
      assessmentId: "assessment-source-check",
      title: "Source-check rubric",
      learnerDirections: "Explain how evidence affected your judgment.",
      totalPoints: 20,
      outcomeIds: ["outcome-evaluate-information"],
      sourceIds: ["source-evaluation-reading"],
      criteria: [
        {
          criterionId: "assessment-source-check-rubric-criterion-evidence",
          title: "Evidence",
          description: "Evaluates evidence supporting the claim.",
          outcomeIds: ["outcome-evaluate-information"],
          levels: [
            {
              label: "Meets",
              description: "Explains relevant evidence.",
              points: 10,
            },
            {
              label: "Developing",
              description: "Names evidence with a partial explanation.",
              points: 5,
            },
          ],
          feedbackGuidance: "Name the evidence used.",
        },
        {
          criterionId: "assessment-source-check-rubric-criterion-corroboration",
          title: "Corroboration",
          description: "Compares an independent source.",
          outcomeIds: ["outcome-evaluate-information"],
          levels: [
            {
              label: "Meets",
              description: "Explains an independent comparison.",
              points: 10,
            },
            {
              label: "Developing",
              description: "Names a second source.",
              points: 5,
            },
          ],
          feedbackGuidance: "Explain what the second source changes.",
        },
      ],
      accessibilityNotes: ["Use text labels for every level."],
      academicIntegrityGuidance: "The professor evaluates submitted work.",
      gradingAuthority: "professor_only",
    },
  };
}

test("quiz generation targets and replaces exactly one connected quiz draft", () => {
  const current = draft();
  const input = createContentUnitGenerationInput({
    taskType: "quiz",
    lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
    editableDraft: current,
    targetId: "quiz-evaluating-sources",
  });
  const unit = createEditableContentUnitDraft(
    result(quizArtifact()),
    "quiz",
    input,
  );
  const next = applyContentUnitDraft(current, unit);
  assert.equal(next.quizDrafts.length, 1);
  assert.equal(next.quizDrafts[0].pointsPossible, 20);
  assert.equal(next.activity.title, current.activity.title);

  const regenerated = quizArtifact();
  regenerated.quiz.title = "Revised source-evaluation quiz";
  const replacement = createEditableContentUnitDraft(
    result(regenerated),
    "quiz",
    createContentUnitGenerationInput({
      taskType: "quiz",
      lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
      editableDraft: next,
      targetId: "quiz-evaluating-sources",
    }),
  );
  const replaced = applyContentUnitDraft(next, replacement);
  assert.equal(replaced.quizDrafts.length, 1);
  assert.equal(replaced.quizDrafts[0].title, "Revised source-evaluation quiz");
});

test("rubric generation stays professor-only and replaces its exact assessment rubric", () => {
  const current = draft();
  const input = createContentUnitGenerationInput({
    taskType: "rubric_draft",
    lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
    editableDraft: current,
    targetId: "assessment-source-check",
  });
  assert.equal(input.targetRubricId, "assessment-source-check-rubric");
  const unit = createEditableContentUnitDraft(
    result(rubricArtifact()),
    "rubric_draft",
    input,
  );
  const next = applyContentUnitDraft(current, unit);
  assert.equal(next.rubricDrafts.length, 1);
  assert.equal(next.rubricDrafts[0].gradingAuthority, "professor_only");
  assert.equal(next.rubricDrafts[0].assessmentId, "assessment-source-check");
});

test("lesson-text improvement replaces only the exact selected text", () => {
  const current = draft();
  const originalText = current.sections[0].body;
  const input = createContentUnitGenerationInput({
    taskType: "improve_selected_text",
    lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
    editableDraft: current,
    targetId: {
      selectedSectionId: "section-source-check",
      selectedText: originalText,
    },
  });
  const artifact = {
    ...common("improve_selected_text"),
    selectedSectionId: "section-source-check",
    originalText,
    improvedText:
      "Use four checks: identify the creator, inspect the evidence, consider the context, and corroborate the claim.",
    changes: ["Converted the routine to a concise four-step sequence."],
    sourceIds: ["source-evaluation-reading"],
    unsupportedClaims: [],
  };
  const unit = createEditableContentUnitDraft(
    result(artifact),
    "improve_selected_text",
    input,
  );
  const next = applyContentUnitDraft(current, unit);
  assert.equal(next.sections[0].body, artifact.improvedText);
  assert.equal(next.sections[1].body, current.sections[1].body);
  assert.equal(
    next.revisionHistory.at(-1).action,
    "improve_selected_text_regenerated_and_professor_applied",
  );
});

test("final content units fail closed on invented IDs, scoring, and sources", () => {
  const current = draft();
  assert.throws(
    () =>
      createContentUnitGenerationInput({
        taskType: "quiz",
        lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
        editableDraft: current,
        targetId: "quiz-invented",
      }),
    /existing connected quiz/,
  );

  const quizInput = createContentUnitGenerationInput({
    taskType: "quiz",
    lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
    editableDraft: current,
    targetId: "quiz-evaluating-sources",
  });
  const badQuiz = quizArtifact();
  badQuiz.quiz.pointsPossible = 99;
  assert.throws(
    () => validateContentUnitArtifact(badQuiz, "quiz", quizInput),
    /target, scoring, workload, or review gate/,
  );

  const rubricInput = createContentUnitGenerationInput({
    taskType: "rubric_draft",
    lessonContract: DIGITAL_LITERACY_LESSON_INPUT,
    editableDraft: current,
    targetId: "assessment-source-check",
  });
  const badRubric = rubricArtifact();
  badRubric.rubric.sourceIds = ["source-invented"];
  assert.throws(
    () => validateContentUnitArtifact(badRubric, "rubric_draft", rubricInput),
    /alignment, or authority gate/,
  );

  const malformedRubric = rubricArtifact();
  malformedRubric.rubric.criteria[0].levels = null;
  assert.throws(
    () =>
      validateContentUnitArtifact(malformedRubric, "rubric_draft", rubricInput),
    /target, scoring, alignment, or authority gate/,
  );
});
