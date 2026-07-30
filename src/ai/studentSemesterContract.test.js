import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStudentSemesterInput,
  studentArtifactCalendarItems,
} from "./studentSemesterContract.js";

const extraction = {
  title: "Principles of Marketing",
  books: ["Principles of Marketing, 19th edition"],
  objectives: ["Analyze customer value"],
  assignments: [{
    title: "Reflection",
    course: "MKTG 2301",
    due: "2026-08-21T23:59:00-05:00",
    sourceLine: 8,
  }],
};

test("student AI input contains only unstructured passages and safe deterministic fields", () => {
  const input = buildStudentSemesterInput({
    text: "MKTG 2301\nOffice hours: Tuesday 2–4 PM\nReflection due August 21, 2026",
    analysis: [
      { line: "MKTG 2301", type: "title" },
      { line: "Office hours: Tuesday 2–4 PM", type: "" },
      { line: "Reflection due August 21, 2026", type: "assignment" },
    ],
    extraction,
    timeZone: "America/Chicago",
  });

  assert.deepEqual(input.uncertainSections, [
    "Office hours: Tuesday 2–4 PM",
  ]);
  assert.equal(input.deterministicFields.courseName, extraction.title);
  assert.equal(input.deterministicFields.assignments.length, 1);
  assert.equal(input.deterministicFields.calendarItemsStartUnapproved, true);
});

test("student AI review fails closed when private student content is present", () => {
  assert.throws(
    () =>
      buildStudentSemesterInput({
        text: "Student ID: A1234567\nOffice hours: Tuesday",
        analysis: [],
        extraction,
      }),
    /No AI request was sent/,
  );
});

test("governed dates remain unapproved calendar candidates", () => {
  const items = studentArtifactCalendarItems(
    {
      assignments: [{
        title: "Reflection",
        date: {
          value: "August 21, 2026 at 11:59 PM",
          confirmed: false,
          confidence: 0.74,
          sourceExcerpt: "Reflection due August 21, 2026 at 11:59 PM",
        },
        details: "Submit in the course site.",
      }],
      exams: [],
    },
    {
      course: "MKTG 2301",
      sourceId: "source-1",
      parseDate: () => "2026-08-21T23:59:00-05:00",
      defaultHours: 2,
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].origin, "governed-ai");
  assert.equal(items[0].dateConfirmed, false);
  assert.equal(items[0].confidence, 0.74);
});
