import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("./DigitalLiteracyPilotWorkspace.jsx", import.meta.url),
  "utf8",
);
const professor = readFileSync(
  new URL("../portal/ProfessorDashboard.jsx", import.meta.url),
  "utf8",
);
const student = readFileSync(
  new URL("../portal/StudentDashboard.jsx", import.meta.url),
  "utf8",
);
const main = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("./digital-literacy.css", import.meta.url),
  "utf8",
);

test("professor and student dashboards share the same Digital Literacy evidence surface", () => {
  assert.match(professor, /ProfessorDigitalLiteracyPilot/u);
  assert.match(student, /StudentDigitalLiteracyAssignments/u);
  assert.match(student, /!demoMode && <StudentDigitalLiteracyAssignments/u);
  assert.match(workspace, /Assignments and student completion/u);
  assert.match(workspace, /Digital Literacy is ready when you are/u);
});

test("Digital Literacy is a platform standard with one professor-scoped progress view", () => {
  assert.match(workspace, /PLATFORM STANDARD · CANONICAL COURSE/u);
  assert.match(workspace, /Your students' canonical course progress/u);
  assert.match(workspace, /YOUR PLATFORM-STANDARD COURSE/u);
  assert.match(workspace, /assignment\.catalog_release/u);
});

test("assignment notifications focus the exact Digital Literacy assignment", () => {
  assert.match(workspace, /focusAssignmentId/u);
  assert.match(workspace, /scrollIntoView/u);
  assert.match(workspace, /digital-literacy-assignment-/u);
  assert.match(styles, /\.dl-student-assignments article\.is-notification-focus/u);
});

test("unit and recipient selectors keep native controls bounded and aligned", () => {
  assert.match(styles, /grid-template-columns: 18px minmax\(0, 1fr\)/u);
  assert.match(styles, /\.dl-unit-group input\[type="checkbox"\]/u);
  assert.match(styles, /\.dl-recipient-picker input\[type="radio"\]/u);
});

test("the canonical course opens in-platform and validates its progress bridge", () => {
  assert.match(workspace, /<iframe/u);
  assert.match(workspace, /isCanonicalProgressMessage/u);
  assert.match(workspace, /Progress recorded for student and professor/u);
  assert.match(main, /digital-literacy\//u);
  assert.doesNotMatch(workspace, /Open (?:course|chapter).*_blank/iu);
});

test("research participation is visibly optional and unavailable until activated", () => {
  assert.match(workspace, /OPTIONAL RESEARCH · SEPARATE FROM COURSE WORK/u);
  assert.match(workspace, /Research is not activated/u);
  assert.match(workspace, /No · continue course only/u);
  assert.match(workspace, /Your course access and grades are unchanged/u);
});

test("the professor launch gate separates ready course work from blocked research", () => {
  assert.match(workspace, /FINAL PILOT EVIDENCE GATE/u);
  assert.match(workspace, /Course delivery is ready\. Research remains independently governed/u);
  assert.match(workspace, /Enrollment and course completion never count as research consent/u);
  assert.match(workspace, /pseudonymized, not anonymous/u);
  assert.match(workspace, /reads the database's live launch blockers/iu);
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(240px, 1fr\)\)/u);
});
