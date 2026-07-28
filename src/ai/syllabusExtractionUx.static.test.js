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


test("keeps operation feedback beside its source action and prevents duplicate AI calls", () => {
  assert.match(source, /operationNotice\?\.scope === "input"/);
  assert.match(source, /operationNotice\?\.scope === "review"/);
  assert.match(source, /aiRequestInFlightRef/);
  assert.match(source, /Governed AI review already running/);
  assert.match(source, /Retry governed review/);
  assert.doesNotMatch(source, /\.\.\.result\.fields/);
});
