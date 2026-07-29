import { LESSON_AI_DRAFT_LABEL } from "./lessonGenerationContract.js";

export const CONTENT_UNIT_TASK_TYPES = Object.freeze([
  "lesson_section",
  "activity",
  "discussion_prompt",
  "knowledge_check",
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
    left.length === right.length
    && new Set(left).size === left.length
    && left.every((value) => right.includes(value))
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
      !selectedSectionId
      || !currentLesson.sections.some(
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
  const selectedCheckIds = unique(
    (Array.isArray(targetId) ? targetId : [targetId]).map(clean),
  );
  if (
    !selectedCheckIds.length
    || selectedCheckIds.length > 3
    || selectedCheckIds.some(
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
    !lessonContract
    || clean(lessonContract?.course?.courseId) !== clean(editableDraft?.courseId)
    || clean(lessonContract?.selectedLesson?.lessonId)
      !== clean(editableDraft?.lessonId)
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
      input.lessonContract.authoritativeSources.map((source) => source.sourceId),
    ),
    outcomes: new Set(input.lessonContract.alignments.outcomeIds),
  };
}

function validateCommon(artifact, taskType, input) {
  if (
    artifact?.artifactType !== taskType
    || artifact?.draftStatus !== "ai_draft_not_published"
    || artifact?.statusLabel !== LESSON_AI_DRAFT_LABEL
    || artifact?.humanReviewRequired !== true
  ) {
    throw new Error(
      "The content-unit response did not preserve its unpublished review state.",
    );
  }
  if (
    clean(artifact.courseId) !== clean(input.currentLesson.courseId)
    || clean(artifact.lessonId) !== clean(input.currentLesson.lessonId)
  ) {
    throw new Error("The content-unit response belongs to a different lesson.");
  }
  if (
    JSON.stringify(artifact.courseVersionProvenance)
    !== JSON.stringify(input.currentLesson.courseVersionProvenance)
  ) {
    throw new Error("The content-unit response changed course-version provenance.");
  }
  ["sourceGaps", "uncertainties", "conflicts", "reviewBlocks"].forEach((key) => {
    if (!Array.isArray(artifact[key])) {
      throw new Error(`The content-unit response is missing ${key}.`);
    }
  });
}

export function validateContentUnitArtifact(artifact, taskType, input) {
  requireTaskType(taskType);
  validateCommon(artifact, taskType, input);
  const approved = approvedIds(input);
  if (taskType === "lesson_section") {
    if (
      artifact.selectedSectionId !== input.selectedSectionId
      || artifact.section?.sectionId !== input.selectedSectionId
      || !clean(artifact.section?.heading)
      || !clean(artifact.section?.body)
      || ![2, 3].includes(artifact.section?.headingLevel)
      || !Array.isArray(artifact.section?.sourceIds)
      || !artifact.section.sourceIds.length
      || artifact.section.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      )
    ) {
      throw new Error("The returned lesson section failed its target or source gate.");
    }
  } else if (taskType === "activity") {
    if (
      artifact.targetActivityId !== input.targetActivityId
      || !clean(artifact.activity?.title)
      || !clean(artifact.activity?.instructions)
      || !Number.isInteger(artifact.activity?.estimatedMinutes)
      || artifact.activity.estimatedMinutes > input.currentLesson.estimatedMinutes
      || !Array.isArray(artifact.activity?.successCriteria)
      || !artifact.activity.successCriteria.length
      || !Array.isArray(artifact.activity?.materials)
      || !Array.isArray(artifact.activity?.accessibilityNotes)
      || !Array.isArray(artifact.activity?.sourceIds)
      || !artifact.activity.sourceIds.length
      || !Array.isArray(artifact.activity?.outcomeIds)
      || !artifact.activity.outcomeIds.length
      || artifact.activity.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      )
      || artifact.activity.outcomeIds.some(
        (outcomeId) => !approved.outcomes.has(outcomeId),
      )
    ) {
      throw new Error("The returned activity failed its target, workload, or alignment gate.");
    }
  } else if (taskType === "discussion_prompt") {
    const discussion = artifact.discussion;
    if (
      artifact.targetDiscussionId !== input.targetDiscussionId
      || discussion?.discussionId !== input.targetDiscussionId
      || !clean(discussion?.title)
      || !clean(discussion?.prompt)
      || !clean(discussion?.learnerDirections)
      || !Number.isInteger(discussion?.estimatedMinutes)
      || discussion.estimatedMinutes < 5
      || discussion.estimatedMinutes > input.currentLesson.estimatedMinutes
      || !Array.isArray(discussion?.initialPostRequirements)
      || discussion.initialPostRequirements.length < 1
      || discussion.initialPostRequirements.length > 10
      || discussion.initialPostRequirements.some((item) => !clean(item))
      || !Array.isArray(discussion?.peerResponseRequirements)
      || discussion.peerResponseRequirements.length < 1
      || discussion.peerResponseRequirements.length > 10
      || discussion.peerResponseRequirements.some((item) => !clean(item))
      || !Array.isArray(discussion?.accessibilityNotes)
      || discussion.accessibilityNotes.some((item) => !clean(item))
      || !Array.isArray(discussion?.sourceIds)
      || !discussion.sourceIds.length
      || discussion.sourceIds.some(
        (sourceId) => !approved.sources.has(sourceId),
      )
      || !Array.isArray(discussion?.outcomeIds)
      || !discussion.outcomeIds.length
      || discussion.outcomeIds.some(
        (outcomeId) => !approved.outcomes.has(outcomeId),
      )
      || !clean(discussion?.safetyGuidance?.privacy)
      || !clean(discussion?.safetyGuidance?.civility)
      || !clean(discussion?.safetyGuidance?.aiUse)
      || !clean(discussion?.facilitatorGuidance)
    ) {
      throw new Error(
        "The returned discussion failed its target, safety, workload, or alignment gate.",
      );
    }
  } else {
    const returnedIds = (artifact.items || []).map((item) => item.checkId);
    if (
      !Array.isArray(artifact.items)
      || !artifact.items.length
      || !exactSet(artifact.selectedCheckIds || [], input.selectedCheckIds)
      || !exactSet(returnedIds, input.selectedCheckIds)
      || !clean(artifact.recoveryGuidance?.feedbackGuidance)
      || !clean(artifact.recoveryGuidance?.retryGuidance)
      || !Array.isArray(artifact.recoveryGuidance?.hints)
    ) {
      throw new Error("The returned knowledge checks changed the selected IDs.");
    }
    artifact.items.forEach((item) => {
      const options = Array.isArray(item.options) ? item.options : [];
      if (
        !clean(item.question)
        || !clean(item.answer)
        || !clean(item.explanation)
        || !Array.isArray(item.sourceIds)
        || !item.sourceIds.length
        || item.sourceIds.some((sourceId) => !approved.sources.has(sourceId))
        || !Array.isArray(item.outcomeIds)
        || !item.outcomeIds.length
        || item.outcomeIds.some((outcomeId) => !approved.outcomes.has(outcomeId))
        || !["multiple_choice", "short_answer", "true_false"].includes(item.type)
        || (
          item.type === "multiple_choice"
          && (options.length < 2 || !options.includes(item.answer))
        )
        || (
          item.type === "true_false"
          && !["true", "false"].includes(clean(item.answer).toLowerCase())
        )
        || (item.type !== "multiple_choice" && options.length !== 0)
      ) {
        throw new Error("A returned knowledge check failed its answer or alignment gate.");
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
        : section);
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
        item.discussionId === discussion.discussionId ? discussion : item)
      : [...existing, discussion];
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
        contentUnitDraft.selectedSectionId
        || contentUnitDraft.targetActivityId
        || contentUnitDraft.targetDiscussionId
        || clone(contentUnitDraft.selectedCheckIds),
      acceptedAt,
      provider: contentUnitDraft.provenance.provider,
      model: contentUnitDraft.provenance.model,
      promptVersion: contentUnitDraft.provenance.promptVersion,
      policyVersion: contentUnitDraft.provenance.policyVersion,
      materials: taskType === "activity"
        ? clone(contentUnitDraft.activity.materials || [])
        : [],
      accessibilityNotes:
        taskType === "activity"
          ? clone(contentUnitDraft.activity.accessibilityNotes || [])
          : taskType === "discussion_prompt"
            ? clone(contentUnitDraft.discussion.accessibilityNotes || [])
            : [],
      safetyGuidance: taskType === "discussion_prompt"
        ? clone(contentUnitDraft.discussion.safetyGuidance)
        : null,
      facilitatorGuidance: taskType === "discussion_prompt"
        ? contentUnitDraft.discussion.facilitatorGuidance
        : null,
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
