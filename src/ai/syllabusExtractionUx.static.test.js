import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SyllabusToCourse.jsx", import.meta.url), "utf8");

test("syllabus extraction gives visible progress and scrolls to review", () => {
  assert.match(source, /Extraction in progress/);
  assert.match(source, /Extraction complete/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /ref=\{reviewRef\}/);
});

test("staging exposes governed uncertainty review without enabling production", () => {
  assert.match(source, /VITE_APP_ENVIRONMENT === "staging"/);
  assert.match(source, /Interpret uncertain sections/);
  assert.match(source, /Human review required/);
  assert.match(source, /AI review unavailable outside staging/);
});
