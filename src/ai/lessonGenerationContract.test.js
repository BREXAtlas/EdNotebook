import assert from "node:assert/strict";
import test from "node:test";

import {
  LESSON_AI_DRAFT_LABEL,
  acceptLessonDraftIntoManifest,
  assessLessonAlignment,
  createEditableLessonDraft,
  createLessonGenerationInput,
  validateLessonArtifact,
} from "./lessonGenerationContract.js";
import {
  DIGITAL_LITERACY_LESSON_ARTIFACT,
  DIGITAL_LITERACY_LESSON_INPUT,
  DIGITAL_LITERACY_PHASE5_FIXTURE,
} from "./digitalLiteracyPhase5Fixture.js";

const routerResult = {
  status: "human_review_required",
  humanReviewRequired: true,
  artifact: DIGITAL_LITERACY_LESSON_ARTIFACT,
  provenance: {
    provider: "gemini",
    model: "approved-staging-model",
    tier: 2,
    promptVersion: "lesson.1.0.0",
    policyVersion: "lesson-policy.1.0.0",
    fallbackCount: 0,
  },
};

function digitalLiteracyManifest() {
  return {
    format: "EdNotebookCourse/1.0",
    course: {
      id: DIGITAL_LITERACY_LESSON_INPUT.course.courseId,
      sourceEdNotebookCourseId: DIGITAL_LITERACY_LESSON_INPUT.course.courseId,
      courseCode: "UNIV 1101",
      title: "Digital Literacy",
      subtitle: "Learn, verify, act, and recover",
      subject: "Digital and information literacy",
      audience: "Undergraduate first year",
      contentVersion: "1.0.0",
    },
    template: { family: "ram-ready-digital-literacy", version: "1.0" },
    preset: { id: "guided-reader", version: "1.0" },
    paths: [
      {
        id: "foundations",
        groups: [
          {
            id: "unit-information-literacy",
            nodeIds: ["lesson-evaluating-online-information"],
          },
        ],
        nodes: [
          {
            id: "lesson-evaluating-online-information",
            groupId: "unit-information-literacy",
            title: "Evaluating Online Information",
            subtitle: "Existing professor lesson",
            estimatedMinutes: 60,
            learningObjectives: ["Evaluate one source."],
            openingNarrative: "Existing content remains until acceptance.",
            realWorldExample: "Existing example.",
            concept: {
              what: "Existing what.",
              why: "Existing why.",
              how: "Existing how.",
              cost: "Existing limitation.",
              risks: "Existing risk.",
              verifyNote: "Existing verification.",
            },
            knowledgeChecks: [],
            sourceIds: [],
          },
        ],
      },
    ],
    sources: [],
  };
}

test("Digital Literacy is the exact first Phase 5 selected-lesson fixture", () => {
  assert.equal(
    DIGITAL_LITERACY_PHASE5_FIXTURE.reference.repository,
    "BREXAtlas/Digital-Literacy-Course",
  );
  assert.equal(
    DIGITAL_LITERACY_PHASE5_FIXTURE.researchBoundary.status,
    "not_activated",
  );
  assert.equal(
    DIGITAL_LITERACY_PHASE5_FIXTURE.researchBoundary.collectsHumanSubjectData,
    false,
  );
  assert.equal(
    DIGITAL_LITERACY_LESSON_INPUT.qualityProfile.profileKey,
    "angelo_state_online_course_quality",
  );
  assert.equal(
    DIGITAL_LITERACY_LESSON_ARTIFACT.statusLabel,
    LESSON_AI_DRAFT_LABEL,
  );
  assert.equal(
    validateLessonArtifact(
      DIGITAL_LITERACY_LESSON_ARTIFACT,
      DIGITAL_LITERACY_LESSON_INPUT,
    ),
    DIGITAL_LITERACY_LESSON_ARTIFACT,
  );
});

test("router result becomes an editable unpublished lesson with provenance", () => {
  const draft = createEditableLessonDraft(
    routerResult,
    DIGITAL_LITERACY_LESSON_INPUT,
    null,
    "2026-07-28T23:00:00.000Z",
  );
  assert.equal(draft.reviewState, "ai_draft_not_published");
  assert.equal(draft.statusLabel, LESSON_AI_DRAFT_LABEL);
  assert.equal(draft.provenance.provider, "gemini");
  assert.equal(draft.revisionHistory[0].action, "whole_lesson_generated");
  assert.equal(draft.professorEdited, false);
});

test("whole-lesson regeneration appends revision history without publishing", () => {
  const first = createEditableLessonDraft(
    routerResult,
    DIGITAL_LITERACY_LESSON_INPUT,
    null,
    "2026-07-28T23:00:00.000Z",
  );
  const second = createEditableLessonDraft(
    {
      ...routerResult,
      provenance: { ...routerResult.provenance, provider: "groq" },
    },
    DIGITAL_LITERACY_LESSON_INPUT,
    first,
    "2026-07-28T23:05:00.000Z",
  );
  assert.deepEqual(
    second.revisionHistory.map((item) => item.action),
    ["whole_lesson_generated", "whole_lesson_regenerated"],
  );
  assert.equal(second.revisionHistory[1].provider, "groq");
  assert.equal(second.draftStatus, "ai_draft_not_published");
});

test("professor acceptance adapts the existing EdNotebookCourse lesson only", () => {
  const manifest = digitalLiteracyManifest();
  const draft = createEditableLessonDraft(
    routerResult,
    DIGITAL_LITERACY_LESSON_INPUT,
    null,
    "2026-07-28T23:00:00.000Z",
  );
  draft.discussionPrompts = [
    {
      discussionId: "discussion-credible-information",
      title: "Which evidence makes a source credible?",
      prompt: "Explain which approved evidence changed your judgment.",
      learnerDirections: "Post once and respond to one classmate.",
      initialPostRequirements: ["Use one approved source."],
      peerResponseRequirements: ["Compare evidence respectfully."],
      estimatedMinutes: 20,
      outcomeIds: ["outcome-evaluate-information"],
      sourceIds: ["source-evaluation-reading"],
      accessibilityNotes: ["Use descriptive links."],
      safetyGuidance: {
        privacy: "Do not disclose private personal information.",
        civility: "Respond to claims and evidence respectfully.",
        aiUse: "Follow the approved course AI-use policy.",
      },
      facilitatorGuidance: "Redirect unsupported claims to approved sources.",
    },
  ];
  draft.quizDrafts = [
    {
      quizId: "quiz-evaluating-sources",
      title: "Evaluate online information",
      instructions: "Answer each item, then submit the lesson quiz.",
      estimatedMinutes: 15,
      pointsPossible: 10,
      items: [
        {
          itemId: "quiz-evaluating-sources-item-1",
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
        feedbackGuidance: "Return to the source-check routine.",
        retryGuidance: "Review the approved reading before another attempt.",
        hints: [],
      },
      accessibilityNotes: ["Use text labels."],
      academicIntegrityGuidance: "Follow the approved AI-use policy.",
    },
  ];
  draft.rubricDrafts = [
    {
      rubricId: "assessment-source-check-rubric",
      gradingAuthority: "professor_only",
    },
  ];
  const accepted = acceptLessonDraftIntoManifest(
    manifest,
    "foundations",
    "lesson-evaluating-online-information",
    draft,
    "2026-07-28T23:10:00.000Z",
  );
  const lesson = accepted.paths[0].nodes[0];
  assert.equal(accepted.format, "EdNotebookCourse/1.0");
  assert.equal(accepted.paths.length, manifest.paths.length);
  assert.equal(lesson.title, "Evaluating Online Information");
  assert.equal(
    lesson.learningObjectives[0],
    "Evaluate an online claim using four source-check questions.",
  );
  assert.equal(
    lesson.knowledgeChecks[0].correctAnswer,
    "Independent evidence for comparison",
  );
  assert.equal(lesson.aiDraft.status, "professor_accepted_lesson");
  assert.equal(lesson.aiDraft.publicationState, "not_published");
  assert.equal(
    lesson.discussionPrompts[0].discussionId,
    "discussion-credible-information",
  );
  assert.equal(lesson.endQuiz[0].id, "quiz-evaluating-sources-item-1");
  assert.deepEqual(lesson.endQuiz[0].options, ["true", "false"]);
  assert.equal(lesson.endQuiz[0].correctAnswer, "false");
  assert.equal(lesson.rubricDrafts[0].gradingAuthority, "professor_only");
  assert.ok(lesson.sourceIds.includes("source-evaluation-reading"));
  assert.equal(accepted.phase5.publicationState, "draft");
});

test("alignment report covers syllabus, outline, outcomes, sources, and quality", () => {
  const report = assessLessonAlignment(
    DIGITAL_LITERACY_LESSON_ARTIFACT,
    DIGITAL_LITERACY_LESSON_INPUT,
  );
  assert.deepEqual(
    report.map((item) => item.key),
    ["syllabus", "outline", "outcomes", "sources", "quality"],
  );
  assert.ok(report.every((item) => item.status === "aligned"));
});

test("cross-course and invented-source drafts fail closed", () => {
  const wrongCourse = structuredClone(DIGITAL_LITERACY_LESSON_ARTIFACT);
  wrongCourse.courseId = "33333333-3333-4333-8333-333333333333";
  assert.throws(
    () => validateLessonArtifact(wrongCourse, DIGITAL_LITERACY_LESSON_INPUT),
    /different course/i,
  );

  const inventedSource = structuredClone(DIGITAL_LITERACY_LESSON_ARTIFACT);
  inventedSource.sections[0].sourceIds.push("invented-source");
  assert.throws(
    () => validateLessonArtifact(inventedSource, DIGITAL_LITERACY_LESSON_INPUT),
    /invented an unapproved source/i,
  );
});

test("professor edits remain inside the governed lesson bounds", () => {
  const longTitle = structuredClone(DIGITAL_LITERACY_LESSON_ARTIFACT);
  longTitle.title = "x".repeat(181);
  assert.throws(
    () => validateLessonArtifact(longTitle, DIGITAL_LITERACY_LESSON_INPUT),
    /1–180 characters/i,
  );

  const emptySection = structuredClone(DIGITAL_LITERACY_LESSON_ARTIFACT);
  emptySection.sections[0].body = "";
  assert.throws(
    () => validateLessonArtifact(emptySection, DIGITAL_LITERACY_LESSON_INPUT),
    /teaching-section text must contain/i,
  );
});

test("review blocks prevent acceptance into the course package", () => {
  const blockedResult = structuredClone(routerResult);
  blockedResult.artifact.reviewBlocks = [
    {
      code: "source_gap",
      message: "A required source is unresolved.",
      relatedIds: ["reading-source-evaluation-guide"],
    },
  ];
  blockedResult.artifact.sourceGaps = [
    {
      code: "missing-source",
      description: "A required source is unresolved.",
      relatedIds: ["reading-source-evaluation-guide"],
    },
  ];
  const draft = createEditableLessonDraft(
    blockedResult,
    DIGITAL_LITERACY_LESSON_INPUT,
  );
  assert.throws(
    () =>
      acceptLessonDraftIntoManifest(
        digitalLiteracyManifest(),
        "foundations",
        "lesson-evaluating-online-information",
        draft,
      ),
    /resolve every lesson review block/i,
  );
});

test("course context builder emits the exact governed input envelope", () => {
  const manifest = digitalLiteracyManifest();
  const lesson = manifest.paths[0].nodes[0];
  lesson.learningObjectives = ["Evaluate source credibility."];
  const syllabusRecord = {
    courseId: DIGITAL_LITERACY_LESSON_INPUT.course.courseId,
    version: "1.0.0",
    structuredContent: {
      creditHours: { value: "3" },
      deliveryModality: { value: "Online asynchronous" },
      courseDescription: {
        value: "A first-year digital and information literacy course.",
      },
      courseOutcomes: { value: ["Evaluate source credibility."] },
      outcomeAssessmentMethods: { value: ["Source evaluation activity"] },
      requiredReadings: { value: ["Digital source-evaluation guide"] },
      institutionalAcademicIntegrity: {
        value: "Submit your own source evaluation and disclose assistance.",
      },
      aiUsePolicy: {
        value: "AI use requires professor permission and disclosure.",
      },
      courseOutline: { value: ["Week 2: evaluating sources"] },
    },
    extraction: { conflictingInformation: [] },
  };
  const outlineRecord = {
    version: "1.0.0",
    course: {
      learningObjectives: ["Evaluate source credibility."],
      acts: [
        {
          title: "Information literacy",
          episodes: [
            {
              id: lesson.id,
              title: lesson.title,
              type: "Story",
              minutes: 60,
            },
          ],
        },
      ],
    },
  };
  const input = createLessonGenerationInput({
    manifest,
    pathId: "foundations",
    lessonId: lesson.id,
    course: {
      id: DIGITAL_LITERACY_LESSON_INPUT.course.courseId,
      title: "Digital Literacy",
      institution_id: "22222222-2222-4222-8222-222222222222",
    },
    syllabusRecord,
    outlineRecord,
    professorInstruction: "Keep the source check practical.",
  });
  assert.deepEqual(input.selectedLesson.requestedElements, [
    "teaching_sections",
    "examples",
    "readings",
    "activity",
    "knowledge_checks",
  ]);
  assert.equal(
    input.qualityProfile.profileKey,
    "angelo_state_online_course_quality",
  );
  assert.equal(input.course.totalWorkloadMinutes, 8_100);
  assert.ok(input.authoritativeSources.length >= 7);
  assert.equal(
    input.professorInstruction.sourceId,
    "source-professor-instruction",
  );
  assert.equal(
    input.professorInstruction.text,
    "Keep the source check practical.",
  );
  assert.equal(input.maximumWords, 1_500);
  assert.deepEqual(input.unresolvedAuthoritativeConflicts, []);
});
