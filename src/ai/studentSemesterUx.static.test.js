import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const syllabusSource = readFileSync(
  new URL("../demo/WorkspaceSyllabus.jsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("../portal/StudentDashboard.jsx", import.meta.url),
  "utf8",
);
const ownSemesterSource = readFileSync(
  new URL("./OwnYourSemester.jsx", import.meta.url),
  "utf8",
);
const calendarSource = readFileSync(
  new URL("../demo/WorkspaceCalendar.jsx", import.meta.url),
  "utf8",
);
const demoWorkspaceSource = readFileSync(
  new URL("../demo/DemoWorkspace.jsx", import.meta.url),
  "utf8",
);
const professorDashboardSource = readFileSync(
  new URL("../portal/ProfessorDashboard.jsx", import.meta.url),
  "utf8",
);
const professorSemesterSource = readFileSync(
  new URL("./ProfessorSemesterCalendar.jsx", import.meta.url),
  "utf8",
);

test("student syllabus output uses the required visible draft warning", () => {
  assert.match(
    syllabusSource,
    /Draft extracted from syllabus — verify before saving/,
  );
});

test("extracted calendar rows begin without approval", () => {
  assert.match(syllabusSource, /setApproved\(\[\]\)/);
  assert.doesNotMatch(
    syllabusSource,
    /setApproved\(next\.assignments\.map/,
  );
});

test("authenticated students receive an Own Your Semester dashboard tab", () => {
  assert.match(dashboardSource, /Own your semester/);
  assert.match(dashboardSource, /<OwnYourSemester/);
});

test("professor and student screens render the same editable calendar", () => {
  assert.match(ownSemesterSource, /<CalendarPanel/);
  assert.match(demoWorkspaceSource, /<CalendarPanel/);
  assert.match(demoWorkspaceSource, /setAssignments=\{setAssignments\}/);
  assert.match(professorDashboardSource, /Syllabus & Calendar/i);
  assert.match(professorDashboardSource, /<ProfessorSemesterCalendar/);
  assert.match(professorSemesterSource, /<SyllabusPanel/);
  assert.match(professorSemesterSource, /<CalendarPanel/);
  assert.match(calendarSource, /applyPersonalCalendarEdit/);
  assert.match(calendarSource, /resetPersonalCalendarEdit/);
});

test("calendar export, reviewed import, and alert boundaries are visible", () => {
  assert.match(calendarSource, /Download \.ics calendar/);
  assert.match(calendarSource, /Import \.ics for review/);
  assert.match(calendarSource, /Imported dates start unchecked/);
  assert.match(calendarSource, /Browser alerts run while EdNotebook is open/);
  assert.match(calendarSource, /Time remaining determines/);
});
