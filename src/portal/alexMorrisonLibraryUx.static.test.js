import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publishingLanding = readFileSync(new URL("./PublishingLanding.jsx", import.meta.url), "utf8");
const professorDashboard = readFileSync(new URL("./ProfessorDashboard.jsx", import.meta.url), "utf8");
const studentDashboard = readFileSync(new URL("./StudentDashboard.jsx", import.meta.url), "utf8");
const interactiveReader = readFileSync(new URL("../studio/InteractiveReader.jsx", import.meta.url), "utf8");
const bookImporter = readFileSync(new URL("../studio/PublisherStudio.jsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const workflows = readFileSync(new URL("../../docs/PROFESSOR_STUDENT_ALEX_MORRISON_WORKFLOWS.md", import.meta.url), "utf8");

test("Alex B. Morrison shows one searchable course-and-book catalog", () => {
  assert.match(publishingLanding, /ALEX B\. MORRISON LIBRARY &amp; BOOKSTORE/u);
  assert.match(publishingLanding, /listAlexMorrisonCatalog/u);
  assert.match(publishingLanding, /All courses and books/u);
  assert.match(publishingLanding, /Start this free course/u);
  assert.match(publishingLanding, /Open this free book/u);
});

test("professors control Library placement separately from enrollment and universal assignment", () => {
  assert.match(professorDashboard, /Alex B\. Morrison listing/u);
  assert.match(professorDashboard, /Free Library course/u);
  assert.match(professorDashboard, /Assign to every eligible new student/u);
  assert.match(professorDashboard, /updateCourseLibraryListing/u);
});

test("one professor book can be read-only, interactive, open, or course-assigned", () => {
  assert.match(bookImporter, /Read-only book/u);
  assert.match(bookImporter, /Interactive EduBook/u);
  assert.match(interactiveReader, /Assign to one of my courses/u);
  assert.match(interactiveReader, /No duplicate book was created/u);
  assert.match(studentDashboard, /Assigned Library books/u);
  assert.match(router, /libraryBookRoute/u);
});

test("commercial previews remain explicitly gated", () => {
  assert.match(publishingLanding, /Catalog preview only/u);
  assert.match(publishingLanding, /Checkout is not active/u);
  assert.match(interactiveReader, /browser cannot grant paid access/u);
});

test("authenticated student and professor workspaces do not expose cross-role shortcuts", () => {
  assert.doesNotMatch(studentDashboard, />Educator portal</u);
  assert.doesNotMatch(professorDashboard, />View student portal</u);
  assert.doesNotMatch(router, /onProfessorPortal=/u);
  assert.doesNotMatch(router, /<ProfessorDashboard[^>]*onStudentPortal/u);
});

test("four workflow visuals cover professor, student, combined, and publishing paths", () => {
  assert.match(workflows, /## 1\. Professor teaching workflow/u);
  assert.match(workflows, /## 2\. Student experience workflow/u);
  assert.match(workflows, /## 3\. Combined professor-to-student lifecycle/u);
  assert.match(workflows, /## 4\. Professor to Alex B\. Morrison Library\/Bookstore/u);
  assert.equal((workflows.match(/```mermaid/gu) || []).length, 4);
});
