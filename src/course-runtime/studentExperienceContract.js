export const STUDENT_EXPERIENCE_CONTRACT_VERSION = 1;

export const STUDENT_LESSON_STAGES = Object.freeze([
  { id: "orient", label: "Orient" },
  { id: "read", label: "Read" },
  { id: "act", label: "Act" },
  { id: "check", label: "Check" },
  { id: "review", label: "Review" },
  { id: "continue", label: "Continue" },
]);

const clean = (value, fallback = "") => String(value ?? fallback).trim();
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const boundedStage = (value) =>
  Math.min(STUDENT_LESSON_STAGES.length - 1, Math.max(0, Number(value) || 0));

export function stagePhase(index) {
  return ["lesson", "lesson", "scenario", "knowledge", "quiz", "complete"][
    boundedStage(index)
  ];
}

export function publishedPackageIdentity({ publication, version, manifest }) {
  if (publication?.status !== "published") {
    throw new Error("This course package is not published.");
  }
  if (
    !Number.isInteger(publication?.current_version) ||
    version?.version_number !== publication.current_version
  ) {
    throw new Error("The published course version could not be verified.");
  }
  if (
    clean(manifest?.course?.sourceEdNotebookCourseId) &&
    clean(manifest.course.sourceEdNotebookCourseId) !==
      clean(publication.course_id)
  ) {
    throw new Error("The published package belongs to a different course.");
  }
  const unsafeDraft = (manifest?.paths || [])
    .flatMap((path) => path?.nodes || [])
    .find(
      (lesson) =>
        lesson?.aiDraft &&
        lesson.aiDraft.status !== "professor_accepted_lesson",
    );
  if (unsafeDraft) {
    throw new Error("A lesson has not completed professor review.");
  }
  return Object.freeze({
    publicationId: publication.id,
    courseId: publication.course_id,
    version: publication.current_version,
    contentVersion: clean(manifest?.course?.contentVersion, "1.0.0"),
    label: `Professor-published package · v${publication.current_version}`,
  });
}

export function lessonRecoveryKey({
  publicationId,
  publicationVersion,
  lessonId,
  userId,
}) {
  return [
    "ednotebook-course-recovery",
    `v${STUDENT_EXPERIENCE_CONTRACT_VERSION}`,
    clean(publicationId),
    `p${Number(publicationVersion) || 0}`,
    clean(lessonId),
    clean(userId, "student"),
  ].join("-");
}

export function normalizeInteractionState(value) {
  const state = object(value);
  return {
    choiceId: clean(state.choiceId),
    knowledgeAnswers: object(state.knowledgeAnswers),
    knowledgeChecked: object(state.knowledgeChecked),
    knowledgeAttempts: object(state.knowledgeAttempts),
    quizAnswers: object(state.quizAnswers),
  };
}

export function restoreLessonSession({
  cloudProgress,
  localRecovery,
  publicationVersion,
  lessonId,
}) {
  const cloud = object(cloudProgress);
  const local = object(localRecovery);
  const localMatches =
    local.contractVersion === STUDENT_EXPERIENCE_CONTRACT_VERSION &&
    local.publicationVersion === publicationVersion &&
    local.lessonId === lessonId;
  const cloudMatches =
    cloud.version_number === undefined ||
    cloud.version_number === publicationVersion;
  const cloudUpdatedAt = Date.parse(cloud.updated_at || "") || 0;
  const localUpdatedAt = Date.parse(local.savedAt || "") || 0;
  const source =
    localMatches && localUpdatedAt > cloudUpdatedAt
      ? local
      : cloudMatches
        ? cloud
        : {};
  return {
    recoveredFromDevice: source === local,
    stage: boundedStage(source.sectionIndex ?? source.section_index),
    interactionState: normalizeInteractionState(
      source.interactionState ?? source.interaction_state,
    ),
  };
}

export function answerIsCorrect(question, answer) {
  return (
    clean(answer).toLocaleLowerCase() ===
    clean(question?.correctAnswer).toLocaleLowerCase()
  );
}

function normalizedQuizQuestion(item, quiz, index) {
  const type = clean(item?.type, "multiple_choice");
  const options =
    type === "true_false"
      ? ["true", "false"]
      : Array.isArray(item?.options)
        ? item.options
        : [];
  return {
    id: clean(
      item?.id || item?.itemId,
      `${quiz?.quizId || "quiz"}-item-${index + 1}`,
    ),
    quizId: clean(quiz?.quizId),
    title: clean(quiz?.title, "Lesson quiz"),
    instructions: clean(quiz?.instructions),
    question: clean(item?.question),
    type,
    options,
    correctAnswer: clean(item?.correctAnswer ?? item?.answer),
    explanation: clean(item?.explanation),
    points: Number(item?.points) || 0,
    recoveryGuidance: object(quiz?.recoveryGuidance),
  };
}

export function lessonQuizExperience(lesson) {
  const legacy = Array.isArray(lesson?.endQuiz) ? lesson.endQuiz : [];
  if (legacy.length) {
    return {
      title: "Lesson quiz",
      instructions: "Answer every item before submitting the lesson quiz.",
      questions: legacy.map((item, index) =>
        normalizedQuizQuestion(
          item,
          { quizId: "lesson-quiz", title: "Lesson quiz" },
          index,
        ),
      ),
    };
  }
  const quizzes = Array.isArray(lesson?.quizDrafts) ? lesson.quizDrafts : [];
  return {
    title: clean(quizzes[0]?.title, "Lesson review"),
    instructions: clean(
      quizzes[0]?.instructions,
      "Review your lesson interactions before continuing.",
    ),
    questions: quizzes.flatMap((quiz) =>
      Array.isArray(quiz?.items)
        ? quiz.items.map((item, index) =>
            normalizedQuizQuestion(item, quiz, index),
          )
        : [],
    ),
  };
}

export function nextDueWork(dueWork, now = new Date()) {
  const rows = [...(dueWork?.assignments || []), ...(dueWork?.gradeItems || [])]
    .filter((item) => item?.due_at)
    .map((item) => ({ ...item, dueTime: Date.parse(item.due_at) }))
    .filter(
      (item) => Number.isFinite(item.dueTime) && item.dueTime >= now.getTime(),
    )
    .sort((left, right) => left.dueTime - right.dueTime);
  const next = rows[0];
  if (!next) return null;
  const minutes = Math.max(
    0,
    Math.ceil((next.dueTime - now.getTime()) / 60_000),
  );
  const timeRemaining =
    minutes < 60
      ? `${minutes} min left`
      : minutes < 1_440
        ? `${Math.ceil(minutes / 60)} hr left`
        : `${Math.ceil(minutes / 1_440)} day${Math.ceil(minutes / 1_440) === 1 ? "" : "s"} left`;
  return { ...next, timeRemaining };
}
