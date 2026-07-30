import {
  SYLLABUS_CALENDAR_CONTRACT_VERSION,
  synchronizeCalendarSourceItem,
} from "../ai/syllabusCalendarContract.js";

export const STUDENT_EXPERIENCE_CONTRACT_VERSION = 1;
export const PUBLISHED_COURSE_CALENDAR_SOURCE = "professor-published-course";

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

export function publishedDueWorkRows(dueWork) {
  const assignments = Array.isArray(dueWork?.assignments)
    ? dueWork.assignments
    : [];
  const gradeItems = Array.isArray(dueWork?.gradeItems)
    ? dueWork.gradeItems
    : [];
  const assignmentsById = new Map(
    assignments
      .filter((item) => item?.id)
      .map((item) => [item.id, { ...item, workType: "assignment" }]),
  );
  const rows = [...assignmentsById.values()];

  for (const gradeItem of gradeItems) {
    const assignment = gradeItem?.assignment_id
      ? assignmentsById.get(gradeItem.assignment_id)
      : null;
    if (assignment) {
      const index = rows.findIndex((item) => item.id === assignment.id);
      rows[index] = {
        ...assignment,
        grade_item_id: gradeItem.id,
        max_points: gradeItem.max_points,
        due_at: gradeItem.due_at || assignment.due_at,
      };
      continue;
    }
    const semanticKey = `${clean(gradeItem?.title).toLowerCase()}\u0000${clean(
      gradeItem?.due_at,
    )}`;
    const duplicate = rows.some(
      (item) =>
        `${clean(item?.title).toLowerCase()}\u0000${clean(item?.due_at)}` ===
        semanticKey,
    );
    if (!duplicate) rows.push({ ...gradeItem, workType: "grade_item" });
  }

  return rows;
}

export function publishedCourseCalendarItems(
  dueWork,
  { courseCode = "COURSE", courseId = "" } = {},
) {
  const normalizedCourseCode = clean(courseCode) || "COURSE";
  const sourceScope = clean(courseId) || normalizedCourseCode;
  return publishedDueWorkRows(dueWork)
    .filter((item) => item?.due_at && Number.isFinite(Date.parse(item.due_at)))
    .map((item) => ({
      id: `published-course-${item.workType}-${item.id}`,
      importSourceId: `${PUBLISHED_COURSE_CALENDAR_SOURCE}:${sourceScope}`,
      importItemKey: `${item.workType}-${item.id}`,
      sourceAuthority: PUBLISHED_COURSE_CALENDAR_SOURCE,
      sourceScope,
      sourceWorkId: item.id,
      workType: item.workType,
      course: normalizedCourseCode,
      title: clean(item.title) || "Published course work",
      sourceTitle: clean(item.title) || "Published course work",
      due: item.due_at,
      sourceDue: item.due_at,
      hours: Math.max(0.5, Number(item?.settings?.estimated_hours) || 1),
      status: "not-started",
      description:
        clean(item.instructions) || "Professor-published course deadline.",
      dateConfirmed: true,
      calendarContractVersion: SYLLABUS_CALENDAR_CONTRACT_VERSION,
    }));
}

export function reconcilePublishedCourseCalendarItems(
  currentItems,
  publishedItems,
  synchronizedAt = new Date(),
  sourceScope = "",
) {
  const current = Array.isArray(currentItems) ? currentItems : [];
  const incoming = Array.isArray(publishedItems) ? publishedItems : [];
  const targetScopes = new Set(
    [
      clean(sourceScope),
      ...incoming.map((item) => clean(item?.sourceScope)),
    ].filter(Boolean),
  );
  if (!targetScopes.size) return current;
  const priorPublished = new Map(
    current
      .filter(
        (item) =>
          item?.sourceAuthority === PUBLISHED_COURSE_CALENDAR_SOURCE &&
          targetScopes.has(clean(item?.sourceScope)),
      )
      .map((item) => [item.importItemKey || item.id, item]),
  );
  const personalItems = current.filter(
    (item) =>
      item?.sourceAuthority !== PUBLISHED_COURSE_CALENDAR_SOURCE ||
      !targetScopes.has(clean(item?.sourceScope)),
  );
  const synchronized = incoming.map((item) =>
    synchronizeCalendarSourceItem(
      priorPublished.get(item.importItemKey || item.id),
      item,
      synchronizedAt,
    ),
  );
  return [...personalItems, ...synchronized];
}

function syllabusDate(value, timeZone) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return clean(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(parsed);
}

export function publishedCourseSyllabusText(
  dueWork,
  {
    courseCode = "COURSE",
    courseTitle = "Published course",
    timeZone = "America/Chicago",
  } = {},
) {
  const datedWork = publishedDueWorkRows(dueWork).filter(
    (item) => item?.due_at && Number.isFinite(Date.parse(item.due_at)),
  );
  const heading = `${(clean(courseTitle) || "Published course").toUpperCase()} — ${
    clean(courseCode) || "COURSE"
  }`;
  if (!datedWork.length) {
    return `${heading}\nAssignments:\nNo professor-published dates are available yet.`;
  }
  return [
    heading,
    "Assignments:",
    ...datedWork.map(
      (item) =>
        `${clean(item.title) || "Course work"} due ${syllabusDate(
          item.due_at,
          timeZone,
        )}`,
    ),
  ].join("\n");
}

export function nextDueWork(dueWork, now = new Date()) {
  const rows = publishedDueWorkRows(dueWork)
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
