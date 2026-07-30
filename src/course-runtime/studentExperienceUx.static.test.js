import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(
  new URL("./CourseRuntimePage.jsx", import.meta.url),
  "utf8",
);
const player = readFileSync(
  new URL("./StudentLessonPlayer.jsx", import.meta.url),
  "utf8",
);
const lessonContract = readFileSync(
  new URL("../ai/lessonGenerationContract.js", import.meta.url),
  "utf8",
);
const environmentBanner = readFileSync(
  new URL("../EnvironmentBanner.jsx", import.meta.url),
  "utf8",
);
const environmentBannerCss = readFileSync(
  new URL("../environment-banner.css", import.meta.url),
  "utf8",
);
const runtimeCss = readFileSync(
  new URL("./course-runtime.css", import.meta.url),
  "utf8",
);
const ownSemester = readFileSync(
  new URL("../ai/OwnYourSemester.jsx", import.meta.url),
  "utf8",
);
const syllabusWorkspace = readFileSync(
  new URL("../demo/WorkspaceSyllabus.jsx", import.meta.url),
  "utf8",
);
const calendarWorkspace = readFileSync(
  new URL("../demo/WorkspaceCalendar.jsx", import.meta.url),
  "utf8",
);

test("student course stays in the signed-in course shell and reuses existing tools", () => {
  assert.match(runtime, /state\.packageIdentity\.label/u);
  assert.match(runtime, /Calendar &amp; syllabus/u);
  assert.match(runtime, /Notes &amp; sources/u);
  assert.match(runtime, /Course messages/u);
  assert.match(runtime, /<OwnYourSemester/u);
  assert.match(runtime, /<StudentLearningWorkspace/u);
  assert.match(runtime, /<CourseCommunicationPanel/u);
  assert.match(runtime, /initialCourseId=\{course\.id\}/u);
  assert.doesNotMatch(runtime, /window\.open|target="_blank"/u);
});

test("lesson follows orient, read, act, check, recover, and continue acceptance flow", () => {
  assert.match(player, /ORIENT/u);
  assert.match(player, /READ · PROFESSOR-APPROVED LESSON/u);
  assert.match(player, /ACT · APPLY THE LESSON/u);
  assert.match(player, /CHECK · FEEDBACK AND RECOVERY/u);
  assert.match(player, /Not yet—this is recoverable/u);
  assert.match(player, /Try again/u);
  assert.match(player, /Review the lesson/u);
  assert.match(player, /Submit lesson quiz/u);
  assert.match(
    player,
    /Quiz correctness and explanations appear only after you submit/u,
  );
  assert.match(player, /aria-live="polite"/u);
  assert.match(player, /role="progressbar"/u);
});

test("accepted quiz reaches the student scoring contract without leaking professor rubric", () => {
  assert.match(lessonContract, /endQuiz:[\s\S]*draft\.quizDrafts/u);
  assert.match(player, /lessonQuizExperience\(lesson\)/u);
  assert.doesNotMatch(player, /rubricDrafts/u);
});

test("staging and account controls cannot cover student lesson actions", () => {
  assert.match(environmentBanner, /className="environment-banner"/u);
  assert.match(
    environmentBannerCss,
    /\.environment-banner[\s\S]*position:\s*relative[\s\S]*pointer-events:\s*none/u,
  );
  assert.match(
    runtimeCss,
    /\.course-account-shell\{[^}]*padding-bottom:calc\(88px \+ env\(safe-area-inset-bottom\)\)/u,
  );
});

test("published course work feeds the in-course calendar and syllabus surfaces", () => {
  assert.match(runtime, /publishedCourseCalendarItems/u);
  assert.match(runtime, /publishedCourseSyllabusText/u);
  assert.match(runtime, /officialAssignments=\{publishedCalendarItems\}/u);
  assert.match(runtime, /officialCalendarScope=\{course\.id\}/u);
  assert.match(runtime, /initialSyllabusText=\{publishedSyllabusText\}/u);
  assert.match(runtime, /Course work and official dates/u);
  assert.match(ownSemester, /reconcilePublishedCourseCalendarItems/u);
  assert.match(ownSemester, /syllabusText:\s*initialSyllabusText/u);
  assert.match(syllabusWorkspace, /persona\?\.syllabusText/u);
  assert.match(
    calendarWorkspace,
    /sourceAuthority !== "professor-published-course"/u,
  );
});
