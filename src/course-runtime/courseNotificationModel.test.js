import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentNotificationFeed,
  calendarReminderSettingsKey,
  DEFAULT_CALENDAR_REMINDERS,
  filterUnreadStudentNotifications,
  markStudentNotificationRead,
  notificationReadStateKey,
  readCalendarReminderSettings,
  readStudentNotificationIds,
} from "./courseNotificationModel.js";

const assignment = {
  id: "published-course-assignment-assignment-1",
  sourceWorkId: "assignment-1",
  course: "UNIV 1101",
  title: "Source evaluation check",
  description: "Apply the four-question source check.",
  due: "2026-08-06T04:59:00.000Z",
  status: "not-started",
};

test("calendar reminder settings keep defaults and scoped overrides", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
  };
  const scope = "student-calendar";

  assert.deepEqual(
    readCalendarReminderSettings(scope, storage).reminders,
    DEFAULT_CALENDAR_REMINDERS,
  );
  values.set(
    calendarReminderSettingsKey(scope),
    JSON.stringify({ version: 1, reminders: { twoHours: false } }),
  );
  assert.deepEqual(readCalendarReminderSettings(scope, storage).reminders, {
    ...DEFAULT_CALENDAR_REMINDERS,
    twoHours: false,
  });
});

test("active calendar reminders use the assignment detail route", () => {
  const notifications = buildStudentNotificationFeed({
    items: [assignment],
    reminders: DEFAULT_CALENDAR_REMINDERS,
    now: new Date("2026-08-04T04:59:00.000Z"),
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "calendar-reminder");
  assert.equal(notifications[0].phase, "twoDays");
  assert.equal(notifications[0].description, assignment.description);
  assert.deepEqual(notifications[0].route, {
    view: "assignments",
    workId: "assignment-1",
  });
});

test("future assignments remain visible before their reminder window", () => {
  const notifications = buildStudentNotificationFeed({
    items: [assignment],
    reminders: DEFAULT_CALENDAR_REMINDERS,
    now: new Date("2026-07-29T04:59:00.000Z"),
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "upcoming-assignment");
  assert.equal(notifications[0].label, "Upcoming assignment");
  assert.equal(notifications[0].route.workId, "assignment-1");
});

test("completed work is removed from the active notification feed", () => {
  assert.deepEqual(
    buildStudentNotificationFeed({
      items: [{ ...assignment, status: "complete" }],
      now: new Date("2026-08-04T04:59:00.000Z"),
    }),
    [],
  );
});

test("required media reminders use the same notification route as the calendar", () => {
  const media = {
    ...assignment,
    id: "published-course-media_requirement-media-1",
    sourceWorkId: "media-1",
    workType: "media_requirement",
    title: "Evaluate an algorithm explainer",
    route: {
      view: "lesson",
      lessonId: "lesson-1",
      resourceId: "media-1",
      workId: "media-1",
    },
  };
  const notifications = buildStudentNotificationFeed({
    items: [media],
    reminders: DEFAULT_CALENDAR_REMINDERS,
    now: new Date("2026-08-04T04:59:00.000Z"),
  });

  assert.equal(notifications[0].label, "Required media reminder");
  assert.deepEqual(notifications[0].route, media.route);
});

test("opening a notification persists read state and removes it from the badge feed", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const notifications = buildStudentNotificationFeed({
    items: [assignment],
    reminders: DEFAULT_CALENDAR_REMINDERS,
    now: new Date("2026-08-01T05:00:00.000Z"),
  });
  const scope = "student-1-course-1";

  const ids = markStudentNotificationRead(scope, notifications[0].id, storage);

  assert.deepEqual(ids, [notifications[0].id]);
  assert.deepEqual(readStudentNotificationIds(scope, storage), ids);
  assert.deepEqual(filterUnreadStudentNotifications(notifications, ids), []);
  assert.match(notificationReadStateKey(scope), /notifications-read-v1$/u);
});

test("published professor feedback and grades share the notification feed", () => {
  const notifications = buildStudentNotificationFeed({
    items: [],
    activityItems: [
      {
        id: "feedback-submission-1-2026-08-02",
        templateId: "template-1",
        title: "Source Analysis Response",
        kind: "assignment-feedback",
        createdAt: "2026-08-02T18:00:00.000Z",
      },
      {
        id: "graded-submission-2-2026-08-03",
        templateId: "template-2",
        title: "Research Paper",
        kind: "assignment-graded",
        createdAt: "2026-08-03T18:00:00.000Z",
      },
    ],
  });

  assert.equal(notifications[0].kind, "assignment-graded");
  assert.equal(notifications[0].label, "Assignment graded");
  assert.deepEqual(notifications[0].route, {
    view: "assignments",
    templateId: "template-2",
  });
  assert.equal(notifications[1].label, "Feedback ready");
});
