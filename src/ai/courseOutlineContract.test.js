import assert from "node:assert/strict";
import test from "node:test";

import {
  createEditableOutline,
  outlineToBuilderCourse,
  splitProfessorList,
  validateCourseOutlineArtifact,
} from "./courseOutlineContract.js";

const routerResult = {
  status: "human_review_required",
  humanReviewRequired: true,
  artifact: {
    courseTitle: "Transformative Leadership",
    subtitle: "Systems, change, and practice",
    templateKey: "seminar",
    learningObjectives: ["Analyze leadership systems", "Apply change principles"],
    units: [
      {
        title: "Leadership as a system",
        lessons: [
          { title: "Seeing the whole system", lessonType: "seminar", estimatedMinutes: 35 },
          { title: "Seeing the whole system", lessonType: "story", estimatedMinutes: 30 },
        ],
      },
    ],
    assessmentPlan: ["Human-reviewed project"],
    sourceGaps: ["Add the professor-approved course reader"],
  },
  provenance: {
    provider: "9router",
    model: "approved-free-model",
    tier: 2,
    promptVersion: "1.0.0",
    policyVersion: "1.0.0",
  },
};

const requestInput = {
  subject: "Leadership",
  templateKey: "seminar",
};

test("router outline becomes an editable unpublished draft with provenance", () => {
  const draft = createEditableOutline(routerResult, requestInput);
  assert.equal(draft.reviewState, "ai_draft_not_published");
  assert.equal(draft.provenance.provider, "9router");
  assert.equal(draft.units[0].lessons.length, 2);
});

test("professor-accepted outline maps to the existing Builder course shape", () => {
  const draft = createEditableOutline(routerResult, requestInput);
  const course = outlineToBuilderCourse(draft, "2026-07-25T12:00:00.000Z");
  assert.equal(course.acts[0].episodes[0].type, "Seminar");
  assert.equal(course.acts[0].episodes[1].type, "Story");
  assert.notEqual(course.acts[0].episodes[0].id, course.acts[0].episodes[1].id);
  assert.equal(course.aiDraft.status, "professor_accepted_outline");
  assert.equal(course.aiDraft.humanReviewRequired, true);
});

test("invalid outlines fail before they can be accepted", () => {
  assert.throws(
    () => validateCourseOutlineArtifact({ courseTitle: "Course", learningObjectives: [], units: [] }),
    /learning objective/i,
  );
});

test("professor lists are bounded and empty lines are removed", () => {
  assert.deepEqual(splitProfessorList("One\n\nTwo\nThree", 2, 10), ["One", "Two"]);
});
