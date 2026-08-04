import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareProfessorCourseBuilder } from "./courseBuilderHandoff.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("a professor course card opens that exact course at the governed builder step", () => {
  const storage = memoryStorage();
  const route = prepareProfessorCourseBuilder(storage, {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Digital Literacy",
    course_code: "UNIV 1101",
    subject: "Digital and information literacy",
    audience: "First-year university students",
    teaching_window: "Fall 2026 pilot",
    status: "published",
  });

  assert.equal(route, "#/app/builder");
  assert.equal(storage.getItem("ednotebook-course-id"), "11111111-1111-4111-8111-111111111111");
  assert.equal(storage.getItem("ednotebook-course-step"), "2");
  assert.deepEqual(JSON.parse(storage.getItem("ednotebook-course-draft")), {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Digital Literacy",
    code: "UNIV 1101",
    subject: "Digital and information literacy",
    audience: "First-year university students",
    length: "Fall 2026 pilot",
    status: "published",
    createdAt: null,
    updatedAt: null,
  });
});

test("creating another course clears the prior course while the global builder resumes it", () => {
  const storage = memoryStorage({
    "ednotebook-course-id": "11111111-1111-4111-8111-111111111111",
    "ednotebook-course-draft": "saved-draft",
    "ednotebook-course-step": "4",
  });

  assert.equal(prepareProfessorCourseBuilder(storage), "#/app/builder");
  assert.equal(prepareProfessorCourseBuilder(storage, null), "#/app");
  assert.equal(storage.getItem("ednotebook-course-id"), null);
  assert.equal(storage.getItem("ednotebook-course-draft"), null);
  assert.equal(storage.getItem("ednotebook-course-step"), null);
});

test("the professor library passes the selected course and keeps new-course creation explicit", () => {
  const dashboard = readFileSync(new URL("./ProfessorDashboard.jsx", import.meta.url), "utf8");
  const router = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

  assert.match(dashboard, /onClick=\{\(\) => onBuild\(course\)\}>Open in Course Builder/u);
  assert.match(dashboard, /onClick=\{\(\) => onBuild\(null\)\}>Create Course/u);
  assert.match(router, /onBuild=\{openProfessorCourseBuilder\}/u);
  assert.match(router, /prepareProfessorCourseBuilder\(window\.localStorage, course\)/u);
});
