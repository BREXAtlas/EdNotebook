import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_PREP_DIVISION,
  EARLY_PREP_SUBJECTS,
  earlyPrepAdapterConfig,
  earlyPrepSubjectLabel,
  isEarlyPrepSubject,
} from "./subjectCatalog.js";

test("Early Prep keeps the existing internal k12 identifier and exactly eleven stable subjects", () => {
  assert.equal(EARLY_PREP_DIVISION, "k12");
  assert.equal(EARLY_PREP_SUBJECTS.length, 11);
  assert.equal(new Set(EARLY_PREP_SUBJECTS.map(({ id }) => id)).size, 11);
  assert.equal(earlyPrepSubjectLabel("financial-literacy-personal-finance"), "Financial Literacy / Personal Finance");
});

test("subject adapters are metadata-only configuration for later controlled units", () => {
  const config = earlyPrepAdapterConfig("mathematics");
  assert.deepEqual(config, {
    adapterKey: "math",
    subjectId: "mathematics",
    standardsAuthority: "Texas Education Agency",
    standardsLabel: "TEKS: Mathematics",
    status: "configuration-ready",
  });
  assert.equal(isEarlyPrepSubject("general"), false);
});
