import {
  buildDueNotificationCandidates,
  deriveCalendarWorkflow,
} from "../ai/syllabusCalendarContract.js";

export const CALENDAR_REMINDER_SETTINGS_EVENT =
  "ednotebook:calendar-reminder-settings";

export const DEFAULT_CALENDAR_REMINDERS = Object.freeze({
  week: true,
  twoDays: true,
  twoHours: true,
  rescue: true,
});

export function calendarReminderSettingsKey(scope) {
  return `${scope}-settings`;
}

export function notificationReadStateKey(scope) {
  return `${scope || "student-course"}-notifications-read-v1`;
}

export function readStudentNotificationIds(
  scope,
  storage = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(
      storage.getItem(notificationReadStateKey(scope)) || "{}",
    );
    return parsed.version === 1 && Array.isArray(parsed.ids)
      ? [...new Set(parsed.ids.map(String))].slice(-200)
      : [];
  } catch {
    return [];
  }
}

export function markStudentNotificationRead(
  scope,
  notificationId,
  storage = typeof window === "undefined" ? null : window.localStorage,
) {
  const current = readStudentNotificationIds(scope, storage);
  const next = [
    ...current.filter((id) => id !== String(notificationId)),
    String(notificationId),
  ].slice(-200);
  storage?.setItem(
    notificationReadStateKey(scope),
    JSON.stringify({
      version: 1,
      ids: next,
      updatedAt: new Date().toISOString(),
    }),
  );
  return next;
}

export function filterUnreadStudentNotifications(notifications, readIds = []) {
  const read = new Set((Array.isArray(readIds) ? readIds : []).map(String));
  return (Array.isArray(notifications) ? notifications : []).filter(
    (notification) => !read.has(String(notification?.id)),
  );
}

export function readCalendarReminderSettings(
  scope,
  storage = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) {
    return { version: 1, reminders: { ...DEFAULT_CALENDAR_REMINDERS } };
  }
  try {
    const parsed = JSON.parse(
      storage.getItem(calendarReminderSettingsKey(scope)) || "{}",
    );
    return {
      version: 1,
      reminders: {
        ...DEFAULT_CALENDAR_REMINDERS,
        ...(parsed.version === 1 ? parsed.reminders : parsed),
      },
    };
  } catch {
    return { version: 1, reminders: { ...DEFAULT_CALENDAR_REMINDERS } };
  }
}

export function buildStudentNotificationFeed({
  items,
  activityItems = [],
  reminders = DEFAULT_CALENDAR_REMINDERS,
  now = new Date(),
  limit = 6,
}) {
  const calendarItems = Array.isArray(items) ? items : [];
  const dueCandidates = buildDueNotificationCandidates(
    calendarItems,
    reminders,
    now,
  ).map((candidate) => ({
    ...candidate,
    kind: "calendar-reminder",
    label: candidate.phase === "rescue"
      ? "Calendar recovery"
      : "Calendar reminder",
  }));
  const candidateCalendarIds = new Set(
    dueCandidates.map((candidate) => candidate.calendarItemId),
  );
  const upcoming = calendarItems.flatMap((item) => {
    if (
      item?.status === "complete" ||
      candidateCalendarIds.has(item?.id) ||
      !Number.isFinite(Date.parse(item?.due))
    ) {
      return [];
    }
    const due = new Date(item.due);
    if (due.getTime() < now.getTime()) return [];
    const workflow = deriveCalendarWorkflow(item, now);
    return [{
      id: `${item.id}:upcoming:${due.toISOString()}`,
      calendarItemId: item.id,
      dueAt: due.toISOString(),
      title: `${item.course || "Course"} · ${item.title}`,
      body: `${workflow.label}. ${workflow.nextAction}`,
      description:
        item.description ||
        "Open the assignment for its professor-published details.",
      phase: "upcoming",
      kind: "upcoming-assignment",
      label: "Upcoming assignment",
      route: {
        view: "assignments",
        workId: item.sourceWorkId || item.id,
      },
    }];
  });

  const assignmentActivity = (Array.isArray(activityItems) ? activityItems : [])
    .filter((item) => item?.id && item?.templateId && item?.createdAt)
    .map((item) => ({
      id: String(item.id),
      title: item.title || "Assignment update",
      body: item.body || (
        item.kind === "assignment-graded"
          ? "Your professor finished grading this assignment."
          : "Your professor published feedback on this assignment."
      ),
      description: item.description || "",
      dueAt: item.createdAt,
      phase: "activity",
      kind: item.kind === "assignment-graded"
        ? "assignment-graded"
        : "assignment-feedback",
      label: item.kind === "assignment-graded"
        ? "Assignment graded"
        : "Feedback ready",
      route: {
        view: "assignments",
        templateId: item.templateId,
      },
    }));

  return [...assignmentActivity, ...dueCandidates, ...upcoming]
    .sort(
      (first, second) =>
        Number(second.phase === "activity") -
          Number(first.phase === "activity") ||
        (first.phase === "activity" && second.phase === "activity"
          ? new Date(second.dueAt).getTime() - new Date(first.dueAt).getTime()
          : 0) ||
        Number(first.phase === "upcoming") -
          Number(second.phase === "upcoming") ||
        new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime() ||
        first.title.localeCompare(second.title),
    )
    .slice(0, Math.max(0, limit));
}
