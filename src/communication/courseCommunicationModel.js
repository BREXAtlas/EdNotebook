export const COURSE_COMMUNICATION_LIMITS = Object.freeze({
  messageCharacters: 5000,
  announcementTitleCharacters: 160,
  visibleMessages: 100,
  visibleAnnouncements: 30,
  refreshMilliseconds: 30_000,
});

export const COURSE_MESSAGE_KINDS = Object.freeze(["question", "reply", "course_note"]);

const EMAIL_PATTERN = /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/iu;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu;
const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SECRET_PATTERN = /(api[ _-]?key|access[ _-]?token|password|secret)\s*[:=]/iu;
const EDUCATION_RECORD_PATTERN = /(student[ _-]?id|grade|score|reward|points)\s*[:=]/iu;

export const DIGITAL_LITERACY_COMMUNICATION_FIXTURE = Object.freeze({
  course: {
    id: "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c01",
    code: "DLIT 101",
    title: "Digital Literacy: Evaluating Online Information",
    educationDivision: "university",
  },
  announcements: [{
    id: "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c02",
    title: "Source-check practice is ready",
    body: "Open the source-check lesson, compare the evidence, and bring one question to the course room.",
    audienceLabel: "Entire course",
    publishedAt: "2026-08-24T14:00:00.000Z",
  }],
  messages: [{
    id: "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c03",
    kind: "question",
    body: "How can I tell whether an article is reporting evidence or repeating another page?",
    senderLabel: "Pilot learner",
    createdAt: "2026-08-24T14:15:00.000Z",
    parentMessageId: null,
  }, {
    id: "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c04",
    kind: "reply",
    body: "Trace the claim to its earliest cited source, then compare the wording and publication dates.",
    senderLabel: "Course professor",
    createdAt: "2026-08-24T14:20:00.000Z",
    parentMessageId: "d1817a90-b3cf-4c2d-a7b0-cf3f5cf91c03",
  }],
});

export function isUuid(value) {
  return UUID_VALUE_PATTERN.test(String(value || ""));
}

export function validateCommunicationBody(value, { label = "Message", maximum = COURSE_COMMUNICATION_LIMITS.messageCharacters } = {}) {
  const body = String(value || "").trim();
  if (!body) return { ok: false, reason: `${label} is required.` };
  if (body.length > maximum) return { ok: false, reason: `${label} must be ${maximum.toLocaleString()} characters or fewer.` };
  if (EMAIL_PATTERN.test(body)) return { ok: false, reason: `${label} cannot include an email address. Use the signed-in course directory instead.` };
  if (UUID_PATTERN.test(body)) return { ok: false, reason: `${label} cannot include a private account or record identifier.` };
  if (SECRET_PATTERN.test(body)) return { ok: false, reason: `${label} cannot include a password, API key, access token, or secret.` };
  if (EDUCATION_RECORD_PATTERN.test(body)) return { ok: false, reason: `${label} cannot carry grade, student ID, reward, score, or points details.` };
  return { ok: true, value: body };
}

export function validateCourseMessage({ body, kind = "question", parentMessageId = null }) {
  const bodyResult = validateCommunicationBody(body);
  if (!bodyResult.ok) return bodyResult;
  if (!COURSE_MESSAGE_KINDS.includes(kind)) return { ok: false, reason: "Choose a supported course message type." };
  if (kind === "reply" && !isUuid(parentMessageId)) return { ok: false, reason: "A reply must belong to a visible course question." };
  if (kind !== "reply" && parentMessageId) return { ok: false, reason: "Only replies can reference a course question." };
  return { ok: true, value: { body: bodyResult.value, kind, parentMessageId: kind === "reply" ? parentMessageId : null } };
}

export function validateCourseAnnouncement({ title, body }) {
  const titleResult = validateCommunicationBody(title, {
    label: "Announcement title",
    maximum: COURSE_COMMUNICATION_LIMITS.announcementTitleCharacters,
  });
  if (!titleResult.ok) return titleResult;
  const bodyResult = validateCommunicationBody(body, { label: "Announcement" });
  if (!bodyResult.ok) return bodyResult;
  return { ok: true, value: { title: titleResult.value, body: bodyResult.value } };
}

export function audienceLabel(course) {
  const division = course?.education_division === "k12" || course?.educationDivision === "k12"
    ? "K–12"
    : "university";
  return `Entire ${division} course · current enrolled students and course educators`;
}

export function groupCourseThreads(messages = []) {
  const questions = messages.filter((message) => message.kind === "question");
  const repliesByQuestion = new Map();
  messages.filter((message) => message.kind === "reply").forEach((reply) => {
    const replies = repliesByQuestion.get(reply.parentMessageId) || [];
    replies.push(reply);
    repliesByQuestion.set(reply.parentMessageId, replies);
  });
  const threads = questions.map((question) => ({
    question,
    replies: repliesByQuestion.get(question.id) || [],
  }));
  const notes = messages.filter((message) => message.kind === "course_note");
  return { threads, notes };
}

export function countUnreadCommunication({ messages = [], announcements = [], reads = [], preferences = {} }) {
  const readMessages = new Set(reads.filter((item) => item.messageId).map((item) => item.messageId));
  const readAnnouncements = new Set(reads.filter((item) => item.announcementId).map((item) => item.announcementId));
  const unreadMessages = preferences.notifyReplies === false
    ? 0
    : messages.filter((message) => !message.own && !readMessages.has(message.id)).length;
  const unreadAnnouncements = preferences.notifyAnnouncements === false
    ? 0
    : announcements.filter((announcement) => !announcement.own && !readAnnouncements.has(announcement.id)).length;
  return unreadMessages + unreadAnnouncements;
}

export function visibleReadTargets({ messages = [], announcements = [] }) {
  return {
    messageIds: messages.filter((message) => !message.own).map((message) => message.id),
    announcementIds: announcements.filter((announcement) => !announcement.own).map((announcement) => announcement.id),
  };
}
