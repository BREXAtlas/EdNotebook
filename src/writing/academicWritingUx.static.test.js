import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studio = readFileSync(
  new URL("./AcademicWritingStudio.jsx", import.meta.url),
  "utf8",
);
const assignment = readFileSync(
  new URL("../portal/AssignmentTemplateWorkspace.jsx", import.meta.url),
  "utf8",
);
const learning = readFileSync(
  new URL("../learning/StudentLearningWorkspace.jsx", import.meta.url),
  "utf8",
);

test("shared studio keeps familiar tools organized in EdNotebook drawers", () => {
  for (const label of [
    "Designs",
    "Text",
    "Alignment",
    "Paragraph",
    "Pages + sources",
    "Review",
  ]) {
    assert.match(studio, new RegExp(`label="${label.replace("+", "\\+")}"`, "u"));
  }
  assert.match(studio, /Import \.docx/u);
  assert.match(studio, /Page numbers/u);
  assert.match(studio, /Add reference/u);
  assert.match(studio, /Writing review/u);
  assert.match(studio, /mammoth/u);
});

test("assignment and personal writing launch the same academic studio", () => {
  assert.match(assignment, /<AcademicWritingStudio/u);
  assert.match(assignment, /Open academic writing studio/u);
  assert.match(learning, /\["documents", "Writing studio"\]/u);
  assert.match(learning, /<AcademicWritingStudio/u);
  assert.match(learning, /kind: "document"/u);
});

test("professor review anchors feedback and publishes one student notification event", () => {
  assert.match(assignment, /STUDENT WRITING REVIEW/u);
  assert.match(assignment, /captureSelection/u);
  assert.match(assignment, /feedback_type/u);
  assert.match(assignment, /Publish grade \+ feedback/u);
  assert.match(assignment, /student notification is ready/u);
});
