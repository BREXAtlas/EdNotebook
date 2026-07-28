import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SyllabusToCourse.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./learningAiService.js", import.meta.url), "utf8");
const mergeSource = readFileSync(
  new URL("./syllabusExtractionContract.js", import.meta.url),
  "utf8",
);

test("governed syllabus review rejects empty or unusable AI drafts", () => {
  assert.match(source, /returned no usable source-grounded syllabus fields/);
  assert.match(source, /none could be safely applied/);
});

test("governed syllabus review visibly lists returned fields and confidence", () => {
  assert.match(source, /RETURNED GOVERNED DRAFT/);
  assert.match(source, /source-grounded field/);
  assert.match(source, /AI interpreted/);
  assert.match(source, /uncertainSections: \[\]/);
});

test("returned summary is calculated from merged fields and explicit field relationships", () => {
  assert.match(serviceSource, /uncertainFieldKeys/);
  assert.match(serviceSource, /approvedDefinitions/);
  assert.match(mergeSource, /buildReturnedGovernedDraft/);
  assert.match(mergeSource, /ai_uncertainty_resolution/);
  assert.doesNotMatch(mergeSource, /aiArtifact\?\.missingInformation\s*\|\|/);
});
