import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_LITERACY_REWARD_EVENTS,
  SOCIAL_LEARNING_MILESTONES,
  hasRewardReversal,
  rewardSemanticFingerprint,
  summarizeRewardLedger,
} from "./socialLearningModel.js";

test("Digital Literacy fixture produces deterministic net progress", () => {
  const summary = summarizeRewardLedger(DIGITAL_LITERACY_REWARD_EVENTS);
  assert.equal(summary.totalPoints, 115);
  assert.equal(summary.currentBadge, "Source Scout");
  assert.equal(summary.nextMilestone.badge_name, "Digital Citizen");
  assert.equal(summary.pointsToNext, 135);
  assert.equal(Math.round(summary.progressPercent), 10);
});

test("semantic fingerprint treats cosmetic text changes as the same award", () => {
  const first = rewardSemanticFingerprint({
    courseId: "course-1",
    studentId: "student-1",
    rewardName: "Source   Scout",
    category: "SOURCE_LITERACY",
    activityReference: "Lesson 2 · Source Check",
  });
  const retry = rewardSemanticFingerprint({
    courseId: "course-1",
    studentId: "student-1",
    rewardName: " source scout ",
    category: "source_literacy",
    activityReference: " lesson 2 · source check ",
  });
  assert.equal(first, retry);
});

test("reversals remain visible and are recognized without deleting the award", () => {
  const events = [
    { id: "award-1", event_type: "award", source_event_id: null, points_delta: 40 },
    { id: "reverse-1", event_type: "reversal", source_event_id: "award-1", points_delta: -40 },
  ];
  assert.equal(hasRewardReversal("award-1", events), true);
  assert.equal(summarizeRewardLedger(events).totalPoints, 0);
  assert.equal(events.length, 2);
});

test("all milestone unlocks are optional low-stakes experience choices", () => {
  assert.ok(SOCIAL_LEARNING_MILESTONES.every((milestone) => milestone.is_optional === true));
  assert.ok(SOCIAL_LEARNING_MILESTONES.every((milestone) => ["theme", "study_aid", "profile_option"].includes(milestone.unlock_kind)));
  assert.ok(SOCIAL_LEARNING_MILESTONES.every((milestone) => !/grade|assignment access|course access/iu.test(milestone.unlock_description)));
});

test("reward fixtures do not carry grade fields", () => {
  for (const event of DIGITAL_LITERACY_REWARD_EVENTS) {
    assert.equal("grade" in event, false);
    assert.equal("score" in event, false);
    assert.equal("grade_item_id" in event, false);
  }
});
