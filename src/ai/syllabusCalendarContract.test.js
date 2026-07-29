import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPersonalCalendarEdit,
  approveCalendarCandidate,
  buildCalendarIcs,
  buildDueNotificationCandidates,
  deriveCalendarWorkflow,
  parseCalendarIcs,
  resetPersonalCalendarEdit,
  synchronizeCalendarSourceItem,
} from "./syllabusCalendarContract.js";

const syllabusCandidate = {
  id: "professor-row-1",
  importSourceId: "ethics-syllabus",
  importItemKey: "reflection-1",
  course: "ETHC 1301",
  title: "Reflection",
  due: "2026-09-18T23:59:00-05:00",
  hours: 2,
  status: "not-started",
  description: "Reviewed from the professor syllabus.",
  dateConfirmed: false,
};

test("personal calendar edits never overwrite the syllabus source deadline", () => {
  const approved = approveCalendarCandidate(
    syllabusCandidate,
    new Date("2026-08-01T12:00:00Z"),
  );
  const edited = applyPersonalCalendarEdit(
    approved,
    {
      title: "Draft reflection",
      due: "2026-09-17T20:00:00-05:00",
      hours: 3,
    },
    new Date("2026-08-02T12:00:00Z"),
  );

  assert.equal(edited.sourceTitle, "Reflection");
  assert.equal(edited.sourceDue, "2026-09-18T23:59:00-05:00");
  assert.equal(edited.title, "Draft reflection");
  assert.equal(edited.due, "2026-09-17T20:00:00-05:00");
  assert.equal(edited.personalDueOverride, "2026-09-17T20:00:00-05:00");

  const reset = resetPersonalCalendarEdit(edited);
  assert.equal(reset.title, "Reflection");
  assert.equal(reset.due, "2026-09-18T23:59:00-05:00");
  assert.equal(reset.personalDueOverride, null);
});

test("syllabus resync updates the source while preserving a personal plan", () => {
  const approved = approveCalendarCandidate(syllabusCandidate);
  const edited = applyPersonalCalendarEdit(approved, {
    title: approved.title,
    due: "2026-09-17T20:00:00-05:00",
    hours: 2,
  });
  const synchronized = synchronizeCalendarSourceItem(edited, {
    ...syllabusCandidate,
    due: "2026-09-19T23:59:00-05:00",
  });

  assert.equal(synchronized.sourceDue, "2026-09-19T23:59:00-05:00");
  assert.equal(synchronized.due, "2026-09-17T20:00:00-05:00");
  assert.equal(
    synchronized.personalDueOverride,
    "2026-09-17T20:00:00-05:00",
  );
});

test("time remaining deterministically drives workflow and alerts", () => {
  const now = new Date("2026-09-17T22:00:00-05:00");
  const approved = approveCalendarCandidate(syllabusCandidate);
  const workflow = deriveCalendarWorkflow(approved, now);
  assert.equal(workflow.stage, "focus");
  assert.match(workflow.label, /26 hours left/);

  const notifications = buildDueNotificationCandidates(
    [approved],
    { week: true, twoDays: true, twoHours: true, rescue: true },
    now,
  );
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].phase, "twoDays");
});

test("professor export becomes an unapproved student import in the same format", () => {
  const professorItem = approveCalendarCandidate(
    syllabusCandidate,
    new Date("2026-08-01T12:00:00Z"),
  );
  const calendar = buildCalendarIcs([professorItem], {
    calendarName: "Professor ethics calendar",
    reminders: { week: true, twoDays: true, twoHours: true },
    now: new Date("2026-08-01T12:00:00Z"),
  });
  const [studentCandidate] = parseCalendarIcs(calendar, {
    sourceId: "professor-calendar-export",
  });

  assert.match(calendar, /TRIGGER:-P7D/);
  assert.match(calendar, /TRIGGER:-P2D/);
  assert.match(calendar, /TRIGGER:-PT2H/);
  assert.equal(studentCandidate.course, professorItem.course);
  assert.equal(studentCandidate.title, professorItem.sourceTitle);
  assert.equal(studentCandidate.due, professorItem.sourceDue);
  assert.equal(studentCandidate.dateConfirmed, false);
  assert.equal(studentCandidate.origin, "calendar-import");
});
