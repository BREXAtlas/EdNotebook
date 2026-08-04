import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const syllabusSource = readFileSync(
  new URL("./WorkspaceSyllabus.jsx", import.meta.url),
  "utf8",
);
const demoSource = readFileSync(
  new URL("./DemoWorkspace.jsx", import.meta.url),
  "utf8",
);
const professorSource = readFileSync(
  new URL("../ai/ProfessorSemesterCalendar.jsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./syllabus-review.css", import.meta.url),
  "utf8",
);
const calendarSource = readFileSync(
  new URL("./WorkspaceCalendar.jsx", import.meta.url),
  "utf8",
);
const calendarStyles = readFileSync(
  new URL("./workspace-calendar.css", import.meta.url),
  "utf8",
);

test("real professor and student syllabus workspaces start without fixture text", () => {
  assert.match(syllabusSource, /return String\(persona\?\.syllabusText \|\| ""\)\.trim\(\);/);
  assert.doesNotMatch(professorSource, /syllabusText|demoMode/);
  assert.doesNotMatch(syllabusSource, /Sample syllabus text loaded/);
  assert.doesNotMatch(syllabusSource, /TRANSFORMATIVE TEACHING|PRINCIPLES OF MARKETING|ACCOUNTING I/);
});

test("sample syllabus content is limited to the labeled interactive demo", () => {
  assert.match(
    demoSource,
    /<SyllabusPanel[^>]+demoMode/,
  );
  assert.match(demoSource, /syllabusText: sampleSyllabus\?\.text/);
});

test("syllabus upload controls own their authenticated-dashboard styles", () => {
  assert.match(syllabusSource, /className="syllabus-file-input"/);
  assert.match(syllabusSource, /No syllabus loaded yet/);
  assert.match(styles, /\.syllabus-file-input\s*\{/);
  assert.match(styles, /\.syllabus-editor-grid\s*\{/);
  assert.match(styles, /\.syllabus-source-field textarea\s*\{/);
  assert.match(styles, /@media \(max-width: 900px\)/);
});

test("calendar exchange is visibly distinct from syllabus upload", () => {
  assert.match(calendarSource, /STEP 2 · COURSE CALENDAR/);
  assert.match(calendarSource, /they do not upload or extract\s+another syllabus/);
  assert.match(calendarSource, /Import an existing calendar \(\.ics\)/);
  assert.match(calendarSource, /className="calendar-import-input"/);
  assert.match(calendarStyles, /\.calendar-import-input\s*\{/);
});
