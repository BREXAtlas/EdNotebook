import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("./FinancialLiteracyWorkspace.jsx");
const service = read("./financialLiteracyService.js");
const main = read("../main.jsx");
const student = read("../portal/StudentDashboard.jsx");
const professor = read("../portal/ProfessorDashboard.jsx");

test("student route is K12-only and does not add a University Financial Literacy route", () => {
  assert.match(main, /#\\\/student\\\/k12\\\/financial-literacy/u);
  assert.doesNotMatch(main, /student\\\/\(university\|k12\)\\\/financial-literacy/u);
  assert.match(student, /track === "k12" && <StudentFinancialLiteracyClass/u);
});

test("University professor navigation is unchanged by filtering the Early Prep-only tab", () => {
  assert.match(professor, /id !== "financial-literacy" \|\| divisionScope === "k12"/u);
  assert.match(professor, /tab === "financial-literacy" && earlyPrep/u);
  assert.match(professor, /separate from marketplace, checkout, and all University publishing work/u);
});

test("student completion is explicit and stores no financial details", () => {
  assert.match(workspace, /I finished this unit/u);
  assert.match(workspace, /stores only the unit ID and completion time/u);
  assert.match(workspace, /Educational information—not individualized financial advice/u);
  assert.match(service, /record_my_financial_literacy_completion/u);
  assert.doesNotMatch(service, /marketplace|checkout|stripe|payment|seller|payout/iu);
});

test("teacher UI states the free and privacy-bounded class contract", () => {
  assert.match(workspace, /No payment processing/u);
  assert.match(workspace, /never bank credentials, account numbers, tax documents, balances/u);
  assert.match(workspace, /CLASS-SCOPED PROGRESS/u);
  assert.match(workspace, /EdNotebook references this governed release; it does not duplicate or silently rewrite the curriculum/u);
});
