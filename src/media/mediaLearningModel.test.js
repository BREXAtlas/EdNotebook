import assert from "node:assert/strict";
import test from "node:test";
import {
  mediaCompletionRuleLabel,
  mediaLearningRoute,
  mediaLearningStatus,
  requiredMediaWorkRows,
} from "./mediaLearningModel.js";

const required = {
  id: "snapshot-1",
  title: "Evaluate recommendation systems",
  description: "Watch, compare, then answer the lesson check.",
  target_kind: "lesson",
  target_key: "lesson-1",
  learning_requirement: "required",
  completion_rule: "knowledge_check",
  completion_target_key: "check-1",
  learning_due_at: "2026-08-20T22:00:00.000Z",
  estimated_minutes: 18,
  viewing_progress: { status: "completed", percent_complete: 100 },
  learning_progress: { status: "pending" },
};

test("required media routes to its exact linked lesson", () => {
  assert.deepEqual(mediaLearningRoute(required), {
    view: "lesson",
    lessonId: "lesson-1",
    resourceId: "snapshot-1",
    workId: "snapshot-1",
  });
});

test("playback completion never completes the linked learning step", () => {
  assert.deepEqual(mediaLearningStatus(required), {
    status: "pending",
    label: "Submit the linked knowledge check",
  });
  assert.equal(requiredMediaWorkRows([required])[0].status, "not-started");
});

test("the linked activity completion controls the required-media state", () => {
  const completed = {
    ...required,
    learning_progress: { status: "completed", completion_basis: "knowledge_check_submitted" },
  };
  assert.equal(mediaLearningStatus(completed).status, "completed");
  assert.equal(requiredMediaWorkRows([completed])[0].status, "complete");
});

test("assignment media routes to the assignment and optional media stays off the due-work list", () => {
  assert.deepEqual(mediaLearningRoute({ id: "r2", target_kind: "assignment", target_key: "a1" }), {
    view: "assignments",
    workId: "a1",
    resourceId: "r2",
  });
  assert.equal(requiredMediaWorkRows([{ ...required, learning_requirement: "optional" }]).length, 0);
  assert.equal(mediaCompletionRuleLabel("assignment"), "Submit the linked assignment");
});
