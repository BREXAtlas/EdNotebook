import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDENT_EXPERIENCE_CONTRACT_VERSION,
  answerIsCorrect,
  lessonQuizExperience,
  lessonRecoveryKey,
  nextDueWork,
  publishedCourseCalendarItems,
  publishedCourseSyllabusText,
  publishedDueWorkRows,
  publishedPackageIdentity,
  reconcilePublishedCourseCalendarItems,
  restoreLessonSession,
  stagePhase,
} from "./studentExperienceContract.js";

const publication = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  course_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  current_version: 4,
  status: "published",
};
const version = { version_number: 4 };
const manifest = {
  course: {
    sourceEdNotebookCourseId: publication.course_id,
    contentVersion: "2.1.0",
  },
  paths: [
    {
      nodes: [
        {
          id: "lesson-1",
          aiDraft: { status: "professor_accepted_lesson" },
        },
      ],
    },
  ],
};

test("student identity is pinned to the exact professor-published package", () => {
  const identity = publishedPackageIdentity({ publication, version, manifest });
  assert.deepEqual(identity, {
    publicationId: publication.id,
    courseId: publication.course_id,
    version: 4,
    contentVersion: "2.1.0",
    label: "Professor-published package · v4",
  });
  assert.throws(
    () =>
      publishedPackageIdentity({
        publication,
        version: { version_number: 3 },
        manifest,
      }),
    /version could not be verified/u,
  );
  const unsafe = structuredClone(manifest);
  unsafe.paths[0].nodes[0].aiDraft.status = "ai_draft_not_published";
  assert.throws(
    () => publishedPackageIdentity({ publication, version, manifest: unsafe }),
    /professor review/u,
  );
});

test("device recovery resumes only the same learner lesson and publication version", () => {
  const key = lessonRecoveryKey({
    publicationId: publication.id,
    publicationVersion: 4,
    lessonId: "lesson-1",
    userId: "student-1",
  });
  assert.match(key, new RegExp(`v${STUDENT_EXPERIENCE_CONTRACT_VERSION}`));
  assert.match(key, /p4-lesson-1-student-1$/u);
  const cloudProgress = {
    version_number: 4,
    section_index: 1,
    interaction_state: { choiceId: "cloud" },
    updated_at: "2026-07-29T15:00:00.000Z",
  };
  const localRecovery = {
    contractVersion: STUDENT_EXPERIENCE_CONTRACT_VERSION,
    publicationVersion: 4,
    lessonId: "lesson-1",
    sectionIndex: 3,
    interactionState: {
      choiceId: "device",
      knowledgeAnswers: { check: "A" },
    },
    savedAt: "2026-07-29T15:01:00.000Z",
  };
  const restored = restoreLessonSession({
    cloudProgress,
    localRecovery,
    publicationVersion: 4,
    lessonId: "lesson-1",
  });
  assert.equal(restored.recoveredFromDevice, true);
  assert.equal(restored.stage, 3);
  assert.equal(restored.interactionState.choiceId, "device");

  const stale = restoreLessonSession({
    cloudProgress,
    localRecovery: { ...localRecovery, publicationVersion: 3 },
    publicationVersion: 4,
    lessonId: "lesson-1",
  });
  assert.equal(stale.recoveredFromDevice, false);
  assert.equal(stale.stage, 1);

  const republished = restoreLessonSession({
    cloudProgress: { ...cloudProgress, version_number: 3 },
    localRecovery: null,
    publicationVersion: 4,
    lessonId: "lesson-1",
  });
  assert.equal(republished.stage, 0);
  assert.equal(republished.interactionState.choiceId, "");
});

test("published quiz drafts normalize without exposing professor-only rubrics", () => {
  const experience = lessonQuizExperience({
    rubricDrafts: [{ gradingAuthority: "professor_only" }],
    quizDrafts: [
      {
        quizId: "quiz-source-check",
        title: "Source check",
        instructions: "Answer, then submit.",
        items: [
          {
            itemId: "quiz-source-check-item-1",
            question: "Does appearance prove authority?",
            type: "true_false",
            answer: "false",
            explanation: "Authority needs evidence.",
            points: 10,
          },
        ],
      },
    ],
  });
  assert.equal(experience.title, "Source check");
  assert.deepEqual(experience.questions[0].options, ["true", "false"]);
  assert.equal(answerIsCorrect(experience.questions[0], "FALSE"), true);
  assert.equal("rubricDrafts" in experience, false);
});

test("workflow phases and next due work are deterministic", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(stagePhase), [
    "lesson",
    "lesson",
    "scenario",
    "knowledge",
    "quiz",
    "complete",
  ]);
  const due = nextDueWork(
    {
      assignments: [
        { id: "later", title: "Later", due_at: "2026-07-31T12:00:00.000Z" },
        { id: "next", title: "Next", due_at: "2026-07-30T12:00:00.000Z" },
      ],
      gradeItems: [],
    },
    new Date("2026-07-29T12:00:00.000Z"),
  );
  assert.equal(due.id, "next");
  assert.equal(due.timeRemaining, "1 day left");
});

test("professor-published due work reaches one synchronized student calendar", () => {
  const dueWork = {
    assignments: [
      {
        id: "assignment-1",
        title: "Source evaluation check",
        due_at: "2026-08-06T04:59:00.000Z",
        instructions: "Apply the four-question source check.",
        settings: { estimated_hours: 2 },
      },
    ],
    gradeItems: [
      {
        id: "grade-1",
        assignment_id: "assignment-1",
        title: "Source evaluation check",
        due_at: "2026-08-06T04:59:00.000Z",
        max_points: 20,
      },
      {
        id: "semantic-duplicate",
        title: "Source evaluation check",
        due_at: "2026-08-06T04:59:00.000Z",
        max_points: 20,
      },
    ],
  };

  const rows = publishedDueWorkRows(dueWork);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].grade_item_id, "grade-1");
  assert.equal(rows[0].max_points, 20);

  const calendarItems = publishedCourseCalendarItems(dueWork, {
    courseCode: "UNIV 1101",
  });
  assert.equal(calendarItems.length, 1);
  assert.equal(calendarItems[0].course, "UNIV 1101");
  assert.equal(calendarItems[0].sourceWorkId, "assignment-1");
  assert.equal(calendarItems[0].workType, "assignment");
  assert.equal(calendarItems[0].dateConfirmed, true);
  assert.equal(
    calendarItems[0].sourceDue,
    "2026-08-06T04:59:00.000Z",
  );

  const syllabusText = publishedCourseSyllabusText(dueWork, {
    courseCode: "UNIV 1101",
    courseTitle: "Digital Literacy",
  });
  assert.match(syllabusText, /DIGITAL LITERACY — UNIV 1101/u);
  assert.match(
    syllabusText,
    /Source evaluation check due August 5, 2026 at 11:59 PM/u,
  );
});

test("required media joins due work, calendar, and syllabus without treating playback as completion", () => {
  const requiredMedia = {
    id: "media-snapshot-1",
    title: "Evaluate an algorithm explainer",
    description: "Watch the media, then submit the exact knowledge check.",
    target_kind: "lesson",
    target_key: "lesson-1",
    learning_requirement: "required",
    completion_rule: "knowledge_check",
    completion_target_key: "check-1",
    learning_due_at: "2026-08-08T04:59:00.000Z",
    estimated_minutes: 20,
    viewing_progress: { status: "completed", percent_complete: 100 },
    learning_progress: { status: "pending" },
  };
  const dueWork = {
    assignments: [],
    gradeItems: [],
    mediaRequirements: [requiredMedia],
  };

  const rows = publishedDueWorkRows(dueWork);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "not-started");
  assert.equal(rows[0].workType, "media_requirement");

  const calendarItems = publishedCourseCalendarItems(dueWork, {
    courseCode: "UNIV 1101",
  });
  assert.deepEqual(calendarItems[0].route, {
    view: "lesson",
    lessonId: "lesson-1",
    resourceId: "media-snapshot-1",
    workId: "media-snapshot-1",
  });
  assert.match(
    publishedCourseSyllabusText(dueWork, {
      courseCode: "UNIV 1101",
      courseTitle: "Digital Literacy",
    }),
    /Evaluate an algorithm explainer due August 7, 2026 at 11:59 PM/u,
  );

  const completed = {
    ...dueWork,
    mediaRequirements: [{
      ...requiredMedia,
      learning_progress: { status: "completed" },
    }],
  };
  assert.equal(nextDueWork(completed, new Date("2026-08-01T00:00:00.000Z")), null);
  assert.equal(
    publishedCourseCalendarItems(completed, { courseCode: "UNIV 1101" })[0].status,
    "complete",
  );
});

test("published deadline refresh preserves personal planning without duplicates", () => {
  const initial = publishedCourseCalendarItems(
    {
      assignments: [],
      gradeItems: [
        {
          id: "grade-1",
          title: "Source evaluation check",
          due_at: "2026-08-06T04:59:00.000Z",
        },
      ],
    },
    { courseCode: "UNIV 1101" },
  );
  const current = [
    {
      ...initial[0],
      due: "2026-08-05T23:00:00.000Z",
      personalDueOverride: "2026-08-05T23:00:00.000Z",
    },
    {
      id: "personal-plan",
      title: "Study block",
      due: "2026-08-04T20:00:00.000Z",
    },
    {
      ...initial[0],
      id: "other-course-deadline",
      importItemKey: "grade_item-other",
      sourceScope: "OTHER 2000",
      course: "OTHER 2000",
    },
  ];
  const updated = publishedCourseCalendarItems(
    {
      assignments: [],
      gradeItems: [
        {
          id: "grade-1",
          title: "Source evaluation check",
          due_at: "2026-08-07T04:59:00.000Z",
        },
      ],
    },
    { courseCode: "UNIV 1101" },
  );
  const reconciled = reconcilePublishedCourseCalendarItems(
    current,
    updated,
    new Date("2026-07-30T00:00:00.000Z"),
  );

  assert.equal(reconciled.length, 3);
  assert.equal(reconciled[0].id, "personal-plan");
  assert.equal(reconciled[1].id, "other-course-deadline");
  assert.equal(reconciled[2].sourceDue, "2026-08-07T04:59:00.000Z");
  assert.equal(reconciled[2].due, "2026-08-05T23:00:00.000Z");

  const courseRemoved = reconcilePublishedCourseCalendarItems(
    reconciled,
    [],
    new Date("2026-07-31T00:00:00.000Z"),
    "UNIV 1101",
  );
  assert.deepEqual(
    courseRemoved.map((item) => item.id),
    ["personal-plan", "other-course-deadline"],
  );

  const generalDashboard = reconcilePublishedCourseCalendarItems(
    reconciled,
    [],
  );
  assert.equal(generalDashboard, reconciled);
});
