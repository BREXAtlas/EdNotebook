import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_LITERACY_COMMUNICATION_FIXTURE,
  audienceLabel,
  communicationModeAfterKey,
  countUnreadCommunication,
  courseDeviceNotesKey,
  groupCourseThreads,
  isUuid,
  validateCommunicationBody,
  validateCourseAnnouncement,
  validateCourseMessage,
  visibleReadTargets,
} from "./courseCommunicationModel.js";

test("Digital Literacy fixture models one course announcement and a professor-student thread", () => {
  const fixture = DIGITAL_LITERACY_COMMUNICATION_FIXTURE;
  assert.equal(fixture.course.title, "Digital Literacy: Evaluating Online Information");
  assert.equal(audienceLabel(fixture.course), "Entire university course · current enrolled students and course educators");
  assert.equal(validateCourseAnnouncement(fixture.announcements[0]).ok, true);
  fixture.messages.forEach((message) => {
    assert.equal(validateCourseMessage({
      body: message.body,
      kind: message.kind,
      parentMessageId: message.parentMessageId,
    }).ok, true);
  });
  const grouped = groupCourseThreads(fixture.messages);
  assert.equal(grouped.threads.length, 1);
  assert.equal(grouped.threads[0].replies.length, 1);
  assert.equal(grouped.notes.length, 0);
});

test("message contract rejects sensitive education records, identity fields, and secrets", () => {
  [
    "Contact learner@example.invalid",
    "student ID: A10492",
    "grade: 92",
    "score=18",
    "reward: gold badge",
    "points=500",
    "password: do-not-share",
    "api_key=do-not-share",
    "Account d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c01",
  ].forEach((body) => assert.equal(validateCommunicationBody(body).ok, false, body));

  assert.equal(validateCommunicationBody("How is this source evaluated in the lesson?").ok, true);
  assert.equal(validateCommunicationBody("Can we discuss the grading policy without sharing a grade?").ok, true);
});

test("reply shape is bound to a root question", () => {
  const rootId = DIGITAL_LITERACY_COMMUNICATION_FIXTURE.messages[0].id;
  assert.equal(validateCourseMessage({ body: "A valid course question.", kind: "question" }).ok, true);
  assert.equal(validateCourseMessage({ body: "A valid reply.", kind: "reply", parentMessageId: rootId }).ok, true);
  assert.equal(validateCourseMessage({ body: "Missing root.", kind: "reply" }).ok, false);
  assert.equal(validateCourseMessage({ body: "Wrong shape.", kind: "question", parentMessageId: rootId }).ok, false);
  assert.equal(isUuid(rootId), true);
  assert.equal(isUuid(`${rootId}-suffix`), false);
});

test("unread count follows per-course preferences without hiding readable records", () => {
  const messages = DIGITAL_LITERACY_COMMUNICATION_FIXTURE.messages.map((message, index) => ({
    ...message,
    own: index === 0,
  }));
  const announcements = DIGITAL_LITERACY_COMMUNICATION_FIXTURE.announcements.map((announcement) => ({
    ...announcement,
    own: false,
  }));
  assert.equal(countUnreadCommunication({ messages, announcements, reads: [] }), 2);
  assert.equal(countUnreadCommunication({
    messages,
    announcements,
    reads: [{ announcementId: announcements[0].id }],
  }), 1);
  assert.equal(countUnreadCommunication({
    messages,
    announcements,
    reads: [],
    preferences: { notifyAnnouncements: false, notifyReplies: true },
  }), 1);
  assert.deepEqual(visibleReadTargets({ messages, announcements }), {
    messageIds: [messages[1].id],
    announcementIds: [announcements[0].id],
  });
});

test("communication view navigation and device notes remain course scoped", () => {
  const firstCourseId = DIGITAL_LITERACY_COMMUNICATION_FIXTURE.course.id;
  const secondCourseId = "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c05";
  const firstKey = courseDeviceNotesKey({
    educationDivision: "university",
    role: "student",
    userId: "learner-1",
    courseId: firstCourseId,
  });
  const secondKey = courseDeviceNotesKey({
    educationDivision: "university",
    role: "student",
    userId: "learner-1",
    courseId: secondCourseId,
  });

  assert.match(firstKey, new RegExp(firstCourseId, "u"));
  assert.notEqual(firstKey, secondKey);
  assert.equal(communicationModeAfterKey("cloud", "ArrowRight"), "device");
  assert.equal(communicationModeAfterKey("device", "ArrowRight"), "cloud");
  assert.equal(communicationModeAfterKey("cloud", "End"), "device");
  assert.equal(communicationModeAfterKey("device", "Home"), "cloud");
  assert.equal(communicationModeAfterKey("cloud", "Enter"), null);
});
