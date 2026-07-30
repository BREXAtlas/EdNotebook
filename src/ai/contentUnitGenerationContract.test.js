import assert from "node:assert/strict";
import test from "node:test";

import {
  applyContentUnitDraft,
  createContentUnitGenerationInput,
  createEditableContentUnitDraft,
  validateContentUnitArtifact,
} from "./contentUnitGenerationContract.js";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";

function lessonContract() {
  return {
    course: { courseId: COURSE_ID },
    selectedLesson: { lessonId: "lesson-source-check" },
    alignments: { outcomeIds: ["outcome-evaluate"] },
    authoritativeSources: [
      { sourceId: "source-reading" },
      { sourceId: "source-outline" },
    ],
  };
}

function lessonDraft() {
  return {
    artifactType: "lesson",
    draftStatus: "ai_draft_not_published",
    statusLabel: "AI Draft — Not Published",
    humanReviewRequired: true,
    courseId: COURSE_ID,
    lessonId: "lesson-source-check",
    title: "Evaluate online information",
    subtitle: "A practical routine",
    purpose: "Evaluate one claim.",
    estimatedMinutes: 60,
    alignment: { outcomeIds: ["outcome-evaluate"] },
    objectives: [],
    prerequisites: [],
    vocabulary: [],
    sections: [{
      sectionId: "section-routine",
      heading: "Use the routine",
      headingLevel: 2,
      body: "Check the source.",
      sourceIds: ["source-reading"],
    }],
    examples: [],
    readings: [],
    activity: {
      title: "Compare claims",
      instructions: "Compare two claims.",
      estimatedMinutes: 15,
      successCriteria: ["Explains the decision."],
      outcomeIds: ["outcome-evaluate"],
      sourceIds: ["source-reading"],
    },
    knowledgeChecks: [{
      checkId: "check-corroboration",
      question: "What is corroboration?",
      type: "multiple_choice",
      options: ["Independent comparison", "Page color"],
      answer: "Independent comparison",
      explanation: "It compares independent evidence.",
      outcomeIds: ["outcome-evaluate"],
      sourceIds: ["source-reading"],
    }],
    recovery: {
      feedbackGuidance: "Review the evidence.",
      retryGuidance: "Compare again.",
      hints: [],
      nextAction: "Complete the assignment.",
    },
    connections: {
      discussionIds: ["discussion-credible-information"],
    },
    discussionPrompts: [{
      discussionId: "discussion-credible-information",
      title: "Existing discussion prompt",
    }],
    workload: {},
    accessibility: {},
    academicIntegrity: {},
    sourceGaps: [],
    uncertainties: [],
    conflicts: [],
    reviewBlocks: [],
    courseVersionProvenance: {
      syllabusVersion: "1.0.0",
      outlineVersion: "1.0.0",
      manifestVersion: "1.0.0",
      qualityProfileKey: "asu-pilot",
      qualityProfileVersion: "1.0.0",
      templateKey: "digital-literacy",
      displayPreset: "guided-reader",
    },
    provenance: { provider: "gemini" },
    requestInput: { shouldNotBeNested: true },
    revisionHistory: [],
  };
}

function commonArtifact(artifactType) {
  const draft = lessonDraft();
  return {
    artifactType,
    draftStatus: "ai_draft_not_published",
    statusLabel: "AI Draft — Not Published",
    humanReviewRequired: true,
    courseId: COURSE_ID,
    lessonId: "lesson-source-check",
    sourceGaps: [],
    uncertainties: [],
    conflicts: [],
    reviewBlocks: [],
    courseVersionProvenance: draft.courseVersionProvenance,
  };
}

function routerResult(artifact) {
  return {
    artifact,
    provenance: {
      provider: "groq",
      model: "openai/gpt-oss-20b",
      tier: 2,
      promptVersion: "2.0.0",
      policyVersion: "1.1.0",
      fallbackCount: 1,
    },
  };
}

test("content-unit inputs retain the full lesson contract but strip editor metadata", () => {
  const input = createContentUnitGenerationInput({
    taskType: "lesson_section",
    lessonContract: lessonContract(),
    editableDraft: lessonDraft(),
    targetId: "section-routine",
    instruction: "  Make this easier to scan.  ",
  });
  assert.equal(input.selectedSectionId, "section-routine");
  assert.equal(input.instruction, "Make this easier to scan.");
  assert.equal(input.currentLesson.courseId, COURSE_ID);
  assert.equal(input.currentLesson.provenance, undefined);
  assert.equal(input.currentLesson.requestInput, undefined);
  assert.equal(input.currentLesson.revisionHistory, undefined);
});

test("a professor can apply only the selected validated section", () => {
  const current = lessonDraft();
  const input = createContentUnitGenerationInput({
    taskType: "lesson_section",
    lessonContract: lessonContract(),
    editableDraft: current,
    targetId: "section-routine",
  });
  const artifact = {
    ...commonArtifact("lesson_section"),
    selectedSectionId: "section-routine",
    section: {
      sectionId: "section-routine",
      heading: "Use four source checks",
      headingLevel: 2,
      body: "Check authority, evidence, context, and corroboration.",
      sourceIds: ["source-reading"],
    },
  };
  const unit = createEditableContentUnitDraft(
    routerResult(artifact),
    "lesson_section",
    input,
    "2026-07-29T19:00:00.000Z",
  );
  const next = applyContentUnitDraft(
    current,
    unit,
    "2026-07-29T19:01:00.000Z",
  );
  assert.equal(next.sections[0].heading, "Use four source checks");
  assert.equal(next.activity.title, current.activity.title);
  assert.equal(next.professorEdited, true);
  assert.equal(
    next.revisionHistory.at(-1).action,
    "lesson_section_regenerated_and_professor_applied",
  );
});

test("activity application preserves the whole-lesson schema and review metadata", () => {
  const current = lessonDraft();
  const input = createContentUnitGenerationInput({
    taskType: "activity",
    lessonContract: lessonContract(),
    editableDraft: current,
  });
  const artifact = {
    ...commonArtifact("activity"),
    targetActivityId: "lesson-source-check-activity",
    activity: {
      title: "Compare two versions",
      instructions: "Explain which evidence changed your judgment.",
      estimatedMinutes: 20,
      materials: ["Two text-readable sources"],
      successCriteria: ["Uses all four checks."],
      outcomeIds: ["outcome-evaluate"],
      sourceIds: ["source-reading"],
      accessibilityNotes: ["Provide text-readable sources."],
    },
  };
  const unit = createEditableContentUnitDraft(
    routerResult(artifact),
    "activity",
    input,
  );
  const next = applyContentUnitDraft(current, unit);
  assert.equal(next.activity.title, "Compare two versions");
  assert.equal("materials" in next.activity, false);
  assert.deepEqual(
    next.contentUnitReviews.at(-1).materials,
    ["Two text-readable sources"],
  );
});

test("discussion application replaces only the exact connected prompt", () => {
  const current = lessonDraft();
  const input = createContentUnitGenerationInput({
    taskType: "discussion_prompt",
    lessonContract: lessonContract(),
    editableDraft: current,
    targetId: "discussion-credible-information",
  });
  const artifact = {
    ...commonArtifact("discussion_prompt"),
    targetDiscussionId: "discussion-credible-information",
    discussion: {
      discussionId: "discussion-credible-information",
      title: "Which evidence makes a source credible?",
      prompt:
        "Explain which approved evidence strengthens or weakens one claim.",
      learnerDirections:
        "Post an evidence-based response and reply to one classmate.",
      initialPostRequirements: [
        "State the claim and identify evidence from the approved source.",
      ],
      peerResponseRequirements: [
        "Compare one piece of evidence and ask one source-grounded question.",
      ],
      estimatedMinutes: 20,
      outcomeIds: ["outcome-evaluate"],
      sourceIds: ["source-reading"],
      accessibilityNotes: ["Use descriptive links and text-readable sources."],
      safetyGuidance: {
        privacy: "Do not disclose private personal information.",
        civility: "Respond to claims and evidence respectfully.",
        aiUse: "Follow the approved course AI-use policy.",
      },
      facilitatorGuidance:
        "Redirect unsupported claims to the approved source.",
    },
  };
  const inventedSource = structuredClone(artifact);
  inventedSource.discussion.sourceIds = ["invented-source"];
  assert.throws(
    () => validateContentUnitArtifact(
      inventedSource,
      "discussion_prompt",
      input,
    ),
    /target, safety, workload, or alignment gate/,
  );

  const unit = createEditableContentUnitDraft(
    routerResult(artifact),
    "discussion_prompt",
    input,
  );
  const next = applyContentUnitDraft(
    current,
    unit,
    "2026-07-29T20:00:00.000Z",
  );

  assert.equal(next.discussionPrompts.length, 1);
  assert.equal(
    next.discussionPrompts[0].title,
    "Which evidence makes a source credible?",
  );
  assert.equal(next.activity.title, current.activity.title);
  assert.equal(
    next.knowledgeChecks[0].question,
    current.knowledgeChecks[0].question,
  );
  assert.equal(
    next.contentUnitReviews.at(-1).target,
    "discussion-credible-information",
  );
  assert.equal(
    next.contentUnitReviews.at(-1).safetyGuidance.privacy,
    "Do not disclose private personal information.",
  );
  assert.equal(
    next.revisionHistory.at(-1).action,
    "discussion_prompt_regenerated_and_professor_applied",
  );
});

test("knowledge-check application replaces exact IDs and updates recovery guidance", () => {
  const current = lessonDraft();
  const input = createContentUnitGenerationInput({
    taskType: "knowledge_check",
    lessonContract: lessonContract(),
    editableDraft: current,
    targetId: "check-corroboration",
  });
  const artifact = {
    ...commonArtifact("knowledge_check"),
    selectedCheckIds: ["check-corroboration"],
    items: [{
      checkId: "check-corroboration",
      question: "Why corroborate a claim?",
      type: "multiple_choice",
      options: ["To compare independent evidence", "To change page color"],
      answer: "To compare independent evidence",
      explanation: "Independent comparison tests the claim.",
      outcomeIds: ["outcome-evaluate"],
      sourceIds: ["source-reading"],
    }],
    recoveryGuidance: {
      feedbackGuidance: "Review independent evidence.",
      retryGuidance: "Compare a second source.",
      hints: ["Look beyond the first publisher."],
    },
  };
  const unit = createEditableContentUnitDraft(
    routerResult(artifact),
    "knowledge_check",
    input,
  );
  const next = applyContentUnitDraft(current, unit);
  assert.equal(next.knowledgeChecks[0].question, "Why corroborate a claim?");
  assert.equal(next.recovery.nextAction, "Complete the assignment.");
  assert.equal(next.recovery.retryGuidance, "Compare a second source.");
});

test("invented sources, changed IDs, and router review blocks fail closed", () => {
  const current = lessonDraft();
  const input = createContentUnitGenerationInput({
    taskType: "lesson_section",
    lessonContract: lessonContract(),
    editableDraft: current,
    targetId: "section-routine",
  });
  const artifact = {
    ...commonArtifact("lesson_section"),
    selectedSectionId: "section-routine",
    section: {
      sectionId: "section-routine",
      heading: "Invented source",
      headingLevel: 2,
      body: "Unsupported.",
      sourceIds: ["invented-source"],
    },
  };
  assert.throws(
    () => validateContentUnitArtifact(artifact, "lesson_section", input),
    /target or source gate/,
  );

  artifact.section.sourceIds = ["source-reading"];
  artifact.reviewBlocks = [{
    code: "source_gap",
    message: "Resolve the source gap.",
    relatedIds: ["section-routine"],
  }];
  const unit = createEditableContentUnitDraft(
    routerResult(artifact),
    "lesson_section",
    input,
  );
  assert.throws(
    () => applyContentUnitDraft(current, unit),
    /review blocks/,
  );

  assert.throws(
    () => createContentUnitGenerationInput({
      taskType: "discussion_prompt",
      lessonContract: lessonContract(),
      editableDraft: current,
      targetId: "invented-discussion",
    }),
    /existing connected discussion/,
  );
});
