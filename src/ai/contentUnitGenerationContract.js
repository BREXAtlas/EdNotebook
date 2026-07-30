import { LESSON_AI_DRAFT_LABEL } from "./lessonGenerationContract.js";

export const CONTENT_UNIT_TASK_TYPES = Object.freeze([
  "lesson_section",
  "activity",
  "discussion_prompt",
  "knowledge_check",
  "quiz",
  "rubric_draft",
  "improve_selected_text",
]);

const LESSON_ARTIFACT_KEYS = Object.freeze([
  "artifactType",
  "draftStatus",
  "statusLabel",
  "humanReviewRequired",
  "courseId",
  "lessonId",
  "title",
  "subtitle",
  "purpose",
  "estimatedMinutes",
  "alignment",
  "objectives",
  "prerequisites",
  "vocabulary",
  "sections",
  "examples",
  "readings",
  "activity",
  "knowledgeChecks",
  "recovery",
  "connections",
  "workload",
  "accessibility",
  "academicIntegrity",
  "sourceGaps",
  "uncertainties",
  "conflicts",
  "reviewBlocks",
  "courseVersionProvenance",
]);

const clean = (value) => String(value ?? "").trim();
const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const unique = (items) => Array.from(new Set(items.filter(Boolean)));

function exactSet(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function requireTaskType(taskType) {
  if (!CONTENT_UNIT_TASK_TYPES.includes(taskType)) {
    throw new Error("Select an approved lesson content-unit task.");
  }
}

function currentLessonArtifact(editableDraft) {
  if (!editableDraft || typeof editableDraft !== "object") {
    throw new Error("Generate or open one unpublished lesson draft first.");
  }
  return Object.fromEntries(
    LESSON_ARTIFACT_KEYS.map((key) => [key, clone(editableDraft[key])]),
  );
}

function targetFor(taskType, currentLesson, targetId) {
  if (taskType === "lesson_section") {
    const selectedSectionId = clean(targetId);
    if (
      !selectedSectionId ||
      !currentLesson.sections.some(
        (section) => section.sectionId === selectedSectionId,
      )
    ) {
      throw new Error("Select an existing lesson section before regenerating.");
    }
    return { selectedSectionId };
  }
  if (taskType === "activity") {
    if (!currentLesson.activity) {
      throw new Error("The current lesson has no activity to regenerate.");
    }
    return {
      targetActivityId: `${clean(currentLesson.lessonId)}-activity`,
    };
  }
  if (taskType === "discussion_prompt") {
    const targetDiscussionId = clean(targetId);
    const discussionIds = currentLesson.connections?.discussionIds || [];
    if (!targetDiscussionId || !discussionIds.includes(targetDiscussionId)) {
      throw new Error(
        "Select an existing connected discussion before regenerating.",
      );
    }
    return { targetDiscussionId };
  }
  if (taskType === "quiz") {
    const targetQuizId = clean(targetId);
    const quizIds = currentLesson.connections?.quizIds || [];
    if (!targetQuizId || !quizIds.includes(targetQuizId)) {
      throw new Error(
        "Select an existing connected quiz before generating its draft.",
      );
    }
    return { targetQuizId };
  }
  if (taskType === "rubric_draft") {
    const targetAssessmentId = clean(targetId);
    const assessmentIds = currentLesson.alignment?.assessmentIds || [];
    if (!targetAssessmentId || !assessmentIds.includes(targetAssessmentId)) {
      throw new Error(
        "Select an existing aligned assessment before generating its rubric.",
      );
    }
    return {
      targetAssessmentId,
      targetRubricId: `${targetAssessmentId}-rubric`,
    };
  }
  if (taskType === "improve_selected_text") {
    const selectedSectionId = clean(targetId?.selectedSectionId);
    const selectedText = String(targetId?.selectedText ?? "");
    const section = currentLesson.sections.find(
      (item) => item.sectionId === selectedSectionId,
    );
    if (
      !section ||
      !selectedText ||
      section.body.split(selectedText).length - 1 !== 1
    ) {
      throw new Error(
        "Select text that occurs exactly once in the current lesson section.",
      );
    }
    return { selectedSectionId, selectedText };
  }
  const selectedCheckIds = unique(
    (Array.isArray(targetId) ? targetId : [targetId]).map(clean),
  );
  if (
    !selectedCheckIds.length ||
    selectedCheckIds.length > 3 ||
    selectedCheckIds.some(
      (checkId) =>
        !currentLesson.knowledgeChecks.some(
          (check) => check.checkId === checkId,
        ),
    )
  ) {
    throw new Error("Select one to three existing knowledge checks.");
  }
  return { selectedCheckIds };
}

export function createContentUnitGenerationInput({
  taskType,
  lessonContract,
  editableDraft,
  targetId,
  instruction = "",
}) {
  requireTaskType(taskType);
  if (
    !lessonContract ||
    clean(lessonContract?.course?.courseId) !==
      clean(editableDraft?.courseId) ||
    clean(lessonContract?.selectedLesson?.lessonId) !==
      clean(editableDraft?.lessonId)
  ) {
    throw new Error(
      "The current lesson draft no longer matches its approved generation contract.",
    );
  }
  const currentLesson = currentLessonArtifact(editableDraft);
  const boundedInstruction = clean(instruction).slice(0, 1_000);
  return {
    lessonContract: clone(lessonContract),
    currentLesson,
    ...targetFor(taskType, currentLesson, targetId),
    ...(boundedInstruction ? { instruction: boundedInstruction } : {}),
  };
}

function approvedIds(input) {
  return {
    sources: new Set(
      input.lessonContract.authoritativeSources.map(
        (source) => source.sourceId,
      ),
    ),
    outcomes: new Set(input.lessonContract.alignments.outcomeIds),
  };
}

function validateCommon(artifact, taskType, input) {
  if (
    artifact?.artifactType !== taskType ||
    artifact?.draftStatus !== "ai_draft_not_published" ||
    artifact?.statusLabel !== LESSON_AI_DRAFT_LABEL ||
    artifact?.humanReviewRequired !== true
  ) {
    throw new Error(
      "The content-unit response did not preserve its unpublished review state.",
    );
  }
  if (
    clean(artifact.courseId) !== clean(input.currentLesson.courseId) ||
    clean(artifact.lessonId) !== clean(input.currentLesson.lessonId)
  ) {
    throw new Error("The content-unit response belongs to a different lesson.");
  }
  if (
    JSON.stringify(artifact.courseVersionProvenance) !==
    JSON.stringify(input.currentLesson.courseVersionProvenance)
  ) {
    throw new Error(
      "The content-unit response changed course-version provenance.",
    );
  }
  ["sourceGaps", "uncertainties", "conflicts", "reviewBlocks"].forEach(
    (key) => {
      if (!Array.isArray(artifact[key])) {
        throw new Error(`The content-unit response is missing ${key}.`);
      }
    },
  );
  const requiredBlocks = [
    artifact.sourceGaps.length > 0 ||
    (taskType === "improve_selected_text" &&
      artifact.unsupportedClaims?.length > 0)
      ? "source_gap"
      : null,
    artifact.uncertainties.length > 0 ? "uncertainty" : null,
    artifact.conflicts.length > 0 ? "conflict" : null,
  ].filter(Boolean);
  if (
    requiredBlocks.some(
      (code) => !artifact.reviewBlocks.some((block) => block.code === code),
    )
  ) {
    throw new Error(
      "The content-unit response omitted a required professor review block.",
    );
  }
}

export function validateContentUnitArtifact(artifact, taskType, input) {
  requireTaskType(taskType);
  validateCommon(artifact, taskType, input);
  const approved = approvedIds(input);
  if (taskType === "lesson_section") {
    if (
      artifact.selectedSectionId !== input.selectedSectionId ||
      artifact.section?.sectionId !== input.selectedSectionId ||
      !clean(artifact.section?.heading) ||
      !clean(artifact.section?.body) ||
      ![2, 3].includes(artifact.section?.headingLevel) ||
      !Array.isArray(artifact.section?.sourceIds) ||
      !artifact.section.sourceIds.length ||
      artifact.section.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      )
    ) {
      throw new Error(
        "The returned lesson section failed its target or source gate.",
      );
    }
  } else if (taskType === "activity") {
    if (
      artifact.targetActivityId !== input.targetActivityId ||
      !clean(artifact.activity?.title) ||
      !clean(artifact.activity?.instructions) ||
      !Number.isInteger(artifact.activity?.estimatedMinutes) ||
      artifact.activity.estimatedMinutes >
        input.currentLesson.estimatedMinutes ||
      !Array.isArray(artifact.activity?.successCriteria) ||
      !artifact.activity.successCriteria.length ||
      !Array.isArray(artifact.activity?.materials) ||
      !Array.isArray(artifact.activity?.accessibilityNotes) ||
      !Array.isArray(artifact.activity?.sourceIds) ||
      !artifact.activity.sourceIds.length ||
      !Array.isArray(artifact.activity?.outcomeIds) ||
      !artifact.activity.outcomeIds.length ||
      artifact.activity.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      ) ||
      artifact.activity.outcomeIds.some(
        (outcomeId) => !approved.outcomes.has(outcomeId),
      )
    ) {
      throw new Error(
        "The returned activity failed its target, workload, or alignment gate.",
      );
    }
  } else if (taskType === "discussion_prompt") {
    const discussion = artifact.discussion;
    if (
      artifact.targetDiscussionId !== input.targetDiscussionId ||
      discussion?.discussionId !== input.targetDiscussionId ||
      !clean(discussion?.title) ||
      !clean(discussion?.prompt) ||
      !clean(discussion?.learnerDirections) ||
      !Number.isInteger(discussion?.estimatedMinutes) ||
      discussion.estimatedMinutes < 5 ||
      discussion.estimatedMinutes > input.currentLesson.estimatedMinutes ||
      !Array.isArray(discussion?.initialPostRequirements) ||
      discussion.initialPostRequirements.length < 1 ||
      discussion.initialPostRequirements.length > 10 ||
      discussion.initialPostRequirements.some((item) => !clean(item)) ||
      !Array.isArray(discussion?.peerResponseRequirements) ||
      discussion.peerResponseRequirements.length < 1 ||
      discussion.peerResponseRequirements.length > 10 ||
      discussion.peerResponseRequirements.some((item) => !clean(item)) ||
      !Array.isArray(discussion?.accessibilityNotes) ||
      discussion.accessibilityNotes.some((item) => !clean(item)) ||
      !Array.isArray(discussion?.sourceIds) ||
      !discussion.sourceIds.length ||
      discussion.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      ) ||
      !Array.isArray(discussion?.outcomeIds) ||
      !discussion.outcomeIds.length ||
      discussion.outcomeIds.some(
        (outcomeId) => !approved.outcomes.has(outcomeId),
      ) ||
      !clean(discussion?.safetyGuidance?.privacy) ||
      !clean(discussion?.safetyGuidance?.civility) ||
      !clean(discussion?.safetyGuidance?.aiUse) ||
      !clean(discussion?.facilitatorGuidance)
    ) {
      throw new Error(
        "The returned discussion failed its target, safety, workload, or alignment gate.",
      );
    }
  } else if (taskType === "quiz") {
    const quiz = artifact.quiz;
    const itemIds = (quiz?.items || []).map((item) => item.itemId);
    if (
      artifact.targetQuizId !== input.targetQuizId ||
      quiz?.quizId !== input.targetQuizId ||
      !clean(quiz?.title) ||
      !clean(quiz?.instructions) ||
      !Number.isInteger(quiz?.estimatedMinutes) ||
      quiz.estimatedMinutes < 5 ||
      quiz.estimatedMinutes > input.currentLesson.estimatedMinutes ||
      !Number.isInteger(quiz?.pointsPossible) ||
      !Array.isArray(quiz?.items) ||
      quiz.items.length < 2 ||
      quiz.items.length > 10 ||
      new Set(itemIds).size !== itemIds.length ||
      itemIds.some(
        (itemId) => !clean(itemId).startsWith(`${input.targetQuizId}-item-`),
      ) ||
      quiz.pointsPossible !==
        quiz.items.reduce((total, item) => total + item.points, 0) ||
      !clean(quiz?.recoveryGuidance?.feedbackGuidance) ||
      !clean(quiz?.recoveryGuidance?.retryGuidance) ||
      !Array.isArray(quiz?.recoveryGuidance?.hints) ||
      !Array.isArray(quiz?.accessibilityNotes) ||
      !clean(quiz?.academicIntegrityGuidance)
    ) {
      throw new Error(
        "The returned quiz failed its target, scoring, workload, or review gate.",
      );
    }
    quiz.items.forEach((item) => {
      const options = Array.isArray(item.options) ? item.options : [];
      if (
        !clean(item.question) ||
        !clean(item.answer) ||
        !clean(item.explanation) ||
        !Number.isInteger(item.points) ||
        item.points < 1 ||
        !Array.isArray(item.sourceIds) ||
        !item.sourceIds.length ||
        item.sourceIds.some((sourceId) => !approved.sources.has(sourceId)) ||
        !Array.isArray(item.outcomeIds) ||
        !item.outcomeIds.length ||
        item.outcomeIds.some(
          (outcomeId) => !approved.outcomes.has(outcomeId),
        ) ||
        !["multiple_choice", "short_answer", "true_false"].includes(
          item.type,
        ) ||
        (item.type === "multiple_choice" &&
          (options.length < 2 || !options.includes(item.answer))) ||
        (item.type === "true_false" &&
          (options.length !== 0 ||
            !["true", "false"].includes(clean(item.answer).toLowerCase()))) ||
        (item.type === "short_answer" && options.length !== 0)
      ) {
        throw new Error(
          "A returned quiz item failed its answer or alignment gate.",
        );
      }
    });
  } else if (taskType === "rubric_draft") {
    const rubric = artifact.rubric;
    const criteria = Array.isArray(rubric?.criteria) ? rubric.criteria : [];
    const criterionIds = criteria.map((criterion) => criterion.criterionId);
    const levelsAreScorable = criteria.every(
      (criterion) =>
        Array.isArray(criterion?.levels) &&
        criterion.levels.length >= 2 &&
        criterion.levels.every(
          (level) => Number.isInteger(level?.points) && level.points >= 0,
        ),
    );
    const totalPoints = levelsAreScorable
      ? criteria.reduce(
          (total, criterion) =>
            total + Math.max(...criterion.levels.map((level) => level.points)),
          0,
        )
      : Number.NaN;
    if (
      artifact.targetAssessmentId !== input.targetAssessmentId ||
      artifact.targetRubricId !== input.targetRubricId ||
      rubric?.assessmentId !== input.targetAssessmentId ||
      rubric?.rubricId !== input.targetRubricId ||
      !clean(rubric?.title) ||
      !clean(rubric?.learnerDirections) ||
      rubric?.gradingAuthority !== "professor_only" ||
      !Number.isInteger(rubric?.totalPoints) ||
      rubric.totalPoints !== totalPoints ||
      criteria.length < 2 ||
      criteria.length > 10 ||
      !levelsAreScorable ||
      new Set(criterionIds).size !== criterionIds.length ||
      criterionIds.some(
        (criterionId) =>
          !clean(criterionId).startsWith(`${input.targetRubricId}-criterion-`),
      ) ||
      !Array.isArray(rubric?.sourceIds) ||
      !rubric.sourceIds.length ||
      rubric.sourceIds.some((sourceId) => !approved.sources.has(sourceId)) ||
      !Array.isArray(rubric?.outcomeIds) ||
      !rubric.outcomeIds.length ||
      rubric.outcomeIds.some(
        (outcomeId) => !approved.outcomes.has(outcomeId),
      ) ||
      !Array.isArray(rubric?.accessibilityNotes) ||
      !clean(rubric?.academicIntegrityGuidance)
    ) {
      throw new Error(
        "The returned rubric failed its target, scoring, alignment, or authority gate.",
      );
    }
    criteria.forEach((criterion) => {
      if (
        !clean(criterion.title) ||
        !clean(criterion.description) ||
        !clean(criterion.feedbackGuidance) ||
        !Array.isArray(criterion.outcomeIds) ||
        !criterion.outcomeIds.length ||
        criterion.outcomeIds.some(
          (outcomeId) => !approved.outcomes.has(outcomeId),
        ) ||
        !Array.isArray(criterion.levels) ||
        criterion.levels.length < 2 ||
        criterion.levels.some(
          (level) =>
            !clean(level.label) ||
            !clean(level.description) ||
            !Number.isInteger(level.points) ||
            level.points < 0,
        )
      ) {
        throw new Error(
          "A returned rubric criterion failed its observable-level gate.",
        );
      }
    });
  } else if (taskType === "improve_selected_text") {
    if (
      artifact.selectedSectionId !== input.selectedSectionId ||
      artifact.originalText !== input.selectedText ||
      !clean(artifact.improvedText) ||
      artifact.improvedText === input.selectedText ||
      !Array.isArray(artifact.changes) ||
      !artifact.changes.length ||
      !Array.isArray(artifact.sourceIds) ||
      !artifact.sourceIds.length ||
      artifact.sourceIds.some((sourceId) => !approved.sources.has(sourceId)) ||
      !Array.isArray(artifact.unsupportedClaims)
    ) {
      throw new Error(
        "The returned text revision failed its exact selection or source gate.",
      );
    }
  } else {
    const returnedIds = (artifact.items || []).map((item) => item.checkId);
    if (
      !Array.isArray(artifact.items) ||
      !artifact.items.length ||
      !exactSet(artifact.selectedCheckIds || [], input.selectedCheckIds) ||
      !exactSet(returnedIds, input.selectedCheckIds) ||
      !clean(artifact.recoveryGuidance?.feedbackGuidance) ||
      !clean(artifact.recoveryGuidance?.retryGuidance) ||
      !Array.isArray(artifact.recoveryGuidance?.hints)
    ) {
      throw new Error(
        "The returned knowledge checks changed the selected IDs.",
      );
    }
    artifact.items.forEach((item) => {
      const options = Array.isArray(item.options) ? item.options : [];
      if (
        !clean(item.question) ||
        !clean(item.answer) ||
        !clean(item.explanation) ||
        !Array.isArray(item.sourceIds) ||
        !item.sourceIds.length ||
        item.sourceIds.some((sourceId) => !approved.sources.has(sourceId)) ||
        !Array.isArray(item.outcomeIds) ||
        !item.outcomeIds.length ||
        item.outcomeIds.some(
          (outcomeId) => !approved.outcomes.has(outcomeId),
        ) ||
        !["multiple_choice", "short_answer", "true_false"].includes(
          item.type,
        ) ||
        (item.type === "multiple_choice" &&
          (options.length < 2 || !options.includes(item.answer))) ||
        (item.type === "true_false" &&
          !["true", "false"].includes(clean(item.answer).toLowerCase())) ||
        (item.type !== "multiple_choice" && options.length !== 0)
      ) {
        throw new Error(
          "A returned knowledge check failed its answer or alignment gate.",
        );
      }
    });
  }
  return artifact;
}

export function createEditableContentUnitDraft(
  routerResult,
  taskType,
  input,
  generatedAt = new Date().toISOString(),
) {
  const artifact = clone(
    validateContentUnitArtifact(routerResult?.artifact, taskType, input),
  );
  return {
    ...artifact,
    taskType,
    generatedAt,
    requestInput: clone(input),
    provenance: {
      provider: clean(routerResult?.provenance?.provider),
      model: clean(routerResult?.provenance?.model),
      tier: Number(routerResult?.provenance?.tier) || null,
      promptVersion: clean(routerResult?.provenance?.promptVersion),
      policyVersion: clean(routerResult?.provenance?.policyVersion),
      fallbackCount: Number(routerResult?.provenance?.fallbackCount) || 0,
    },
  };
}

function mergeEvidence(current, returned) {
  const seen = new Set();
  return [...(current || []), ...(returned || [])].filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function applyContentUnitDraft(
  editableDraft,
  contentUnitDraft,
  acceptedAt = new Date().toISOString(),
) {
  const taskType = contentUnitDraft?.taskType;
  const input = contentUnitDraft?.requestInput;
  validateContentUnitArtifact(contentUnitDraft, taskType, input);
  if ((contentUnitDraft.reviewBlocks || []).length) {
    throw new Error(
      "Resolve the returned content-unit review blocks by regenerating or rejecting it.",
    );
  }

  const next = clone(editableDraft);
  if (taskType === "lesson_section") {
    next.sections = next.sections.map((section) =>
      section.sectionId === contentUnitDraft.selectedSectionId
        ? clone(contentUnitDraft.section)
        : section,
    );
  } else if (taskType === "activity") {
    const activity = contentUnitDraft.activity;
    next.activity = {
      title: activity.title,
      instructions: activity.instructions,
      estimatedMinutes: activity.estimatedMinutes,
      successCriteria: clone(activity.successCriteria),
      outcomeIds: clone(activity.outcomeIds),
      sourceIds: clone(activity.sourceIds),
    };
  } else if (taskType === "discussion_prompt") {
    const discussion = clone(contentUnitDraft.discussion);
    const existing = Array.isArray(next.discussionPrompts)
      ? next.discussionPrompts
      : [];
    const hasTarget = existing.some(
      (item) => item.discussionId === discussion.discussionId,
    );
    next.discussionPrompts = hasTarget
      ? existing.map((item) =>
          item.discussionId === discussion.discussionId ? discussion : item,
        )
      : [...existing, discussion];
  } else if (taskType === "quiz") {
    const quiz = clone(contentUnitDraft.quiz);
    const existing = Array.isArray(next.quizDrafts) ? next.quizDrafts : [];
    next.quizDrafts = existing.some((item) => item.quizId === quiz.quizId)
      ? existing.map((item) => (item.quizId === quiz.quizId ? quiz : item))
      : [...existing, quiz];
  } else if (taskType === "rubric_draft") {
    const rubric = clone(contentUnitDraft.rubric);
    const existing = Array.isArray(next.rubricDrafts) ? next.rubricDrafts : [];
    next.rubricDrafts = existing.some(
      (item) => item.rubricId === rubric.rubricId,
    )
      ? existing.map((item) =>
          item.rubricId === rubric.rubricId ? rubric : item,
        )
      : [...existing, rubric];
  } else if (taskType === "improve_selected_text") {
    next.sections = next.sections.map((section) => {
      if (section.sectionId !== contentUnitDraft.selectedSectionId) {
        return section;
      }
      if (section.body.split(contentUnitDraft.originalText).length - 1 !== 1) {
        throw new Error(
          "The selected lesson text changed before professor apply.",
        );
      }
      return {
        ...section,
        body: section.body.replace(
          contentUnitDraft.originalText,
          contentUnitDraft.improvedText,
        ),
      };
    });
  } else {
    const replacements = new Map(
      contentUnitDraft.items.map((item) => [item.checkId, clone(item)]),
    );
    next.knowledgeChecks = next.knowledgeChecks.map(
      (check) => replacements.get(check.checkId) || check,
    );
    next.recovery = {
      ...next.recovery,
      ...clone(contentUnitDraft.recoveryGuidance),
    };
  }
  ["sourceGaps", "uncertainties", "conflicts"].forEach((key) => {
    next[key] = mergeEvidence(next[key], contentUnitDraft[key]);
  });
  next.contentUnitReviews = [
    ...(next.contentUnitReviews || []),
    {
      taskType,
      target:
        contentUnitDraft.selectedSectionId ||
        contentUnitDraft.targetActivityId ||
        contentUnitDraft.targetDiscussionId ||
        contentUnitDraft.targetQuizId ||
        contentUnitDraft.targetRubricId ||
        clone(contentUnitDraft.selectedCheckIds),
      acceptedAt,
      provider: contentUnitDraft.provenance.provider,
      model: contentUnitDraft.provenance.model,
      promptVersion: contentUnitDraft.provenance.promptVersion,
      policyVersion: contentUnitDraft.provenance.policyVersion,
      materials:
        taskType === "activity"
          ? clone(contentUnitDraft.activity.materials || [])
          : [],
      accessibilityNotes:
        taskType === "activity"
          ? clone(contentUnitDraft.activity.accessibilityNotes || [])
          : taskType === "discussion_prompt"
            ? clone(contentUnitDraft.discussion.accessibilityNotes || [])
            : [],
      safetyGuidance:
        taskType === "discussion_prompt"
          ? clone(contentUnitDraft.discussion.safetyGuidance)
          : null,
      facilitatorGuidance:
        taskType === "discussion_prompt"
          ? contentUnitDraft.discussion.facilitatorGuidance
          : null,
      changes:
        taskType === "improve_selected_text"
          ? clone(contentUnitDraft.changes)
          : [],
      unsupportedClaims:
        taskType === "improve_selected_text"
          ? clone(contentUnitDraft.unsupportedClaims)
          : [],
    },
  ];
  next.revisionHistory = [
    ...(next.revisionHistory || []),
    {
      action: `${taskType}_regenerated_and_professor_applied`,
      at: acceptedAt,
      provider: contentUnitDraft.provenance.provider,
      model: contentUnitDraft.provenance.model,
      promptVersion: contentUnitDraft.provenance.promptVersion,
      policyVersion: contentUnitDraft.provenance.policyVersion,
    },
  ];
  next.professorEdited = true;
  return next;
}
