import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./StudentLearningWorkspace.jsx", import.meta.url), "utf8");

test("signed-in student dashboard uses the production learning workspace", () => {
  assert.match(dashboard, /import StudentLearningWorkspace from "\.\.\/learning\/StudentLearningWorkspace\.jsx"/u);
  assert.match(dashboard, /\["notes", "Learning workspace"\]/u);
  assert.match(dashboard, /<StudentLearningWorkspace[^>]*session=\{session\}/u);
  assert.doesNotMatch(dashboard, /function NotesPanel/u);
});

test("workspace exposes device, cloud, portable export, citations, and restore without validator claims", () => {
  assert.match(workspace, /This browser/u);
  assert.match(workspace, /Private cloud \+ browser/u);
  assert.match(workspace, /Portable packet/u);
  assert.match(workspace, /PASTED-CITATION FORMAT CHECK/u);
  assert.match(workspace, /cannot verify that names, dates, titles/u);
  assert.match(workspace, /Restore from JSON manifest/u);
  assert.match(workspace, /synthetic practice—not a real ASU course or library record/u);
  assert.doesNotMatch(workspace, /citation validator|certified citation/iu);
});
