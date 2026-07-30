import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentNotificationFeed,
  calendarReminderSettingsKey,
  DEFAULT_CALENDAR_REMINDERS,
  readCalendarReminderSettings,
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
