import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewSource = readFileSync(
  new URL("./LessonDraftReview.jsx", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("./learningAiService.js", import.meta.url),
  "utf8",
);
const contentUnitSource = readFileSync(
  new URL("./ContentUnitReviewPanel.jsx", import.meta.url),
  "utf8",
);
const outlineBuilderSource = readFileSync(
  new URL("./CourseOutlineBuilder.jsx", import.meta.url),
  "utf8",
);
const studioSource = readFileSync(
  new URL("../course-runtime/CoursePackageStudio.jsx", import.meta.url),
  "utf8",
);

test("selected-lesson generation is gated to staging and uses the canonical task", () => {
  assert.match(reviewSource, /VITE_APP_ENVIRONMENT === "staging"/);
  assert.match(reviewSource, /VITE_LESSON_AI_ENABLED/);
  assert.match(reviewSource, /if \(!IS_STAGING\) return null/);
  assert.doesNotMatch(reviewSource, /user_metadata/);
  assert.match(serviceSource, /invokeGovernedTask\("lesson", input, options\)/);
  assert.match(serviceSource, /Lesson generation requires an approved institution/);
  assert.match(serviceSource, /options\.courseId !== input\?\.course\?\.courseId/);
  assert.doesNotMatch(serviceSource, /invokeGovernedTask\("lesson_generation"/);
});

test("professor review exposes the required unpublished controls", () => {
  assert.match(reviewSource, /Generate selected lesson/);
  assert.match(reviewSource, /LESSON_AI_DRAFT_LABEL/);
  assert.match(reviewSource, /Preview lesson/);
  assert.match(reviewSource, /Reject draft/);
  assert.match(reviewSource, /Regenerate whole lesson/);
  assert.match(reviewSource, /Accept into course-package draft/);
  assert.match(reviewSource, /Compare before accepting/);
  assert.match(reviewSource, /does not infer missing course-level requirements/);
});

test("controlled content units require separate governed calls and professor apply", () => {
  assert.match(reviewSource, /<ContentUnitReviewPanel/);
  assert.match(contentUnitSource, /Regenerate selected section/);
  assert.match(contentUnitSource, /Regenerate activity/);
  assert.match(contentUnitSource, /Regenerate discussion prompt/);
  assert.match(contentUnitSource, /Professor facilitation/);
  assert.match(contentUnitSource, /Regenerate selected check/);
  assert.match(contentUnitSource, /Apply to unpublished lesson draft/);
  assert.match(contentUnitSource, /reviewConfirmed/);
  assert.match(contentUnitSource, /reviewBlockCount > 0/);
  assert.match(serviceSource, /generateProfessorContentUnit/);
  assert.match(
    serviceSource,
    /"lesson_section",[\s\S]*"activity",[\s\S]*"discussion_prompt",[\s\S]*"knowledge_check"/,
  );
  assert.match(serviceSource, /invokeGovernedTask\(taskType, input, options\)/);
  assert.doesNotMatch(contentUnitSource, /window\.open/);
});

test("lesson review reuses Course Output Studio and keeps preview in the app", () => {
  assert.match(studioSource, /lazy\(\(\) => import\("\.\.\/ai\/LessonDraftReview\.jsx"\)\)/);
  assert.match(studioSource, /IS_STAGING && LessonDraftReview/);
  assert.match(studioSource, /<Suspense/);
  assert.match(studioSource, /<LessonDraftReview/);
  assert.match(studioSource, /key=\{`\$\{activeCourse\.id\}:\$\{selectedLesson\.id\}`\}/);
  assert.match(studioSource, /setManifest\(nextManifest\)/);
  assert.match(reviewSource, /In-platform student preview/);
  assert.match(reviewSource, /Standalone course-package preview/);
  assert.doesNotMatch(reviewSource, /window\.open/);
  assert.doesNotMatch(reviewSource, /target="_blank"/);
  assert.match(reviewSource, /event\.key === "Escape"/);
  assert.match(reviewSource, /dialog\.querySelectorAll/);
  assert.match(reviewSource, /previouslyFocused instanceof HTMLElement/);
  assert.match(outlineBuilderSource, /courseId:[\s\S]*existingCourse\.id/);
});

test("the Phase 5 slice explicitly avoids research activation and duplicate infrastructure", () => {
  assert.match(
    reviewSource,
    /cannot publish, change the syllabus, collect student[\s\S]*research data, or create a second course\/site/,
  );
});
