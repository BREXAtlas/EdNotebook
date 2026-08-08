import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCIAL_LITERACY_COURSE_KEY,
  FINANCIAL_LITERACY_RELEASE_ID,
  buildFinancialLiteracyUnitUrl,
  financialLiteracyProgressSummary,
  groupFinancialLiteracyUnits,
  isCanonicalFinancialLiteracyUrl,
  nextFinancialLiteracyUnit,
} from "./financialLiteracyModel.js";

const units = [
  { unit_id: "ep01", path: "foundations", group_number: 1, group_title: "Act I", title: "First", relative_url: "foundations.html?ep=ep01", completed: true },
  { unit_id: "ep02", path: "foundations", group_number: 1, group_title: "Act I", title: "Second", relative_url: "foundations.html?ep=ep02", completed: false },
  { unit_id: "q01", path: "wealth-quest", group_number: 1, group_title: "Tier I", title: "Quest", relative_url: "wealth-quest.html?q=q01", completed: false },
];

test("Financial Literacy release identity is explicit and repository-specific", () => {
  assert.equal(FINANCIAL_LITERACY_RELEASE_ID, "2026.08.08.1");
  assert.equal(FINANCIAL_LITERACY_COURSE_KEY, "brexatlas.financial-literacy-course");
});

test("course units group by path and curriculum act or tier", () => {
  const groups = groupFinancialLiteracyUnits(units);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.key), ["foundations:1", "wealth-quest:1"]);
});

test("student progress uses one ordered course record", () => {
  const course = { units };
  assert.deepEqual(financialLiteracyProgressSummary(course), { completed: 1, total: 3, percent: 33 });
  assert.equal(nextFinancialLiteracyUnit(course).unit_id, "ep02");
});

test("canonical URLs stay on the approved GitHub Pages origin", () => {
  const url = buildFinancialLiteracyUnitUrl(
    { source_home: "https://brexatlas.github.io/Financial-Literacy-Course/" },
    units[0],
  );
  assert.equal(isCanonicalFinancialLiteracyUrl(url), true);
  assert.match(url, /foundations\.html\?ep=ep01&embedded=1&source=ednotebook-early-prep/u);
  assert.equal(isCanonicalFinancialLiteracyUrl("https://example.com/foundations.html"), false);
});
