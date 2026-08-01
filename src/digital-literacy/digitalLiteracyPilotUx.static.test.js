import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("./DigitalLiteracyPilotWorkspace.jsx", import.meta.url), "utf8");
const professor = readFileSync(new URL("../portal/ProfessorDashboard.jsx", import.meta.url), "utf8");
const student = readFileSync(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

test("professor and student dashboards share the same Digital Literacy evidence surface", () => {
  assert.match(professor, /ProfessorDigitalLiteracyPilot/u);
  assert.match(student, /StudentDigitalLiteracyAssignments/u);
  assert.match(student, /!demoMode && <StudentDigitalLiteracyAssignments/u);
  assert.match(workspace, /Assignments and student completion/u);
  assert.match(workspace, /Your assigned chapters and quests/u);
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
