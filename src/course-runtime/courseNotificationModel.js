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

  return [...dueCandidates, ...upcoming]
    .sort(
      (first, second) =>
        Number(first.phase === "upcoming") -
          Number(second.phase === "upcoming") ||
        new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime() ||
        first.title.localeCompare(second.title),
    )
    .slice(0, Math.max(0, limit));
}
