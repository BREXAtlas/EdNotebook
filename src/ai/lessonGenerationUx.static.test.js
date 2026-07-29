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

test("selected-section regeneration remains visibly deferred behind its own gate", () => {
  assert.match(
    reviewSource,
    /Regenerate selected section[\s\S]*Deferred until the separate/,
  );
  assert.match(reviewSource, /lesson_section/);
  assert.doesNotMatch(serviceSource, /generateProfessorLessonSection/);
});

test("lesson review reuses Course Output Studio and keeps preview in the app", () => {
  assert.match(studioSource, /<LessonDraftReview/);
  assert.match(studioSource, /key=\{`\$\{activeCourse\.id\}:\$\{selectedLesson\.id\}`\}/);
  assert.match(studioSource, /setManifest\(nextManifest\)/);
  assert.match(reviewSource, /In-platform student preview/);
  assert.match(reviewSource, /Standalone course-package preview/);
  assert.doesNotMatch(reviewSource, /window\.open/);
  assert.doesNotMatch(reviewSource, /target="_blank"/);
  assert.match(outlineBuilderSource, /courseId:[\s\S]*existingCourse\.id/);
});

test("the Phase 5 slice explicitly avoids research activation and duplicate infrastructure", () => {
  assert.match(
    reviewSource,
    /cannot publish, change the syllabus, collect student[\s\S]*research data, or create a second course\/site/,
  );
});
