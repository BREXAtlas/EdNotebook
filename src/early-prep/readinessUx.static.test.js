import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("./EarlyPrepReadinessWorkspace.jsx", import.meta.url), "utf8");
const model = await readFile(new URL("./readinessCatalog.js", import.meta.url), "utf8");
const studentDashboard = await readFile(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const professorDashboard = await readFile(new URL("../portal/ProfessorDashboard.jsx", import.meta.url), "utf8");

test("student readiness replaces only the Early Prep opportunity surface", () => {
  assert.match(studentDashboard, /lazy\(\(\) => import\("\.\.\/early-prep\/EarlyPrepReadinessWorkspace\.jsx"\)\)/u);
  assert.match(studentDashboard, /tab === "opportunities" && track === "k12"/u);
  assert.match(studentDashboard, /tab === "opportunities" && track !== "k12" && <OpportunitiesPanel track=\{track\}/u);
  assert.match(studentDashboard, /track === "k12" && id === "opportunities" \? "College & Career" : label/u);
});

test("teacher readiness is lazy, Early Prep-only, and returns to existing assignments", () => {
  assert.match(professorDashboard, /import\("\.\.\/early-prep\/EarlyPrepReadinessWorkspace\.jsx"\)/u);
  assert.match(professorDashboard, /EARLY_PREP_ONLY_NAV_ITEMS = new Set\(\["financial-literacy", "readiness", "learning-systems"\]\)/u);
  assert.match(professorDashboard, /tab === "readiness" && earlyPrep/u);
  assert.match(professorDashboard, /mode="teacher" onOpenAssignments=\{\(\) => setTab\("templates"\)\}/u);
});

test("the workspace uses the existing writing studio and CTE assignment adapter", () => {
  assert.match(workspace, /lazy\(\(\) => import\("\.\.\/writing\/AcademicWritingStudio\.jsx"\)\)/u);
  assert.match(model, /earlyPrepAssignmentStarter\("career-technical-education"\)/u);
  assert.match(workspace, /Open in Academic Writing Studio/u);
  assert.match(workspace, /Open Assignments/u);
  assert.match(workspace, /PRIVATE PRACTICE CHECKLIST/u);
  assert.match(workspace, /not a readiness score/u);
});

test("visible boundaries prohibit decisions, matching, submissions, recordings, and charges", () => {
  assert.match(workspace, /does not rank careers, predict admission, score employability, match students to employers, submit applications/u);
  assert.match(workspace, /No camera, microphone, personality analysis, or automated interview score/u);
  assert.match(workspace, /charge for these Grades 9–12 tools/u);
  assert.doesNotMatch(workspace, /supabaseClient|functions\.invoke|\.rpc\(|fetch\(/u);
  assert.doesNotMatch(model, /marketplace|checkout|stripe|seller|payout/iu);
});
