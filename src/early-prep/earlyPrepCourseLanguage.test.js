import assert from "node:assert/strict";
import test from "node:test";

import { applyEducationDivisionLanguage, createStarterManifest } from "../course-runtime/courseManifest.js";

test("K12 starter packages use class and teacher language without changing University defaults", () => {
  const earlyPrep = createStarterManifest({
    id: "synthetic-k12-course",
    title: "Synthetic Mathematics Lab",
    education_division: "k12",
  });
  const university = createStarterManifest({
    id: "synthetic-university-course",
    title: "Synthetic University Seminar",
    education_division: "university",
  });

  const earlyPrepText = JSON.stringify(earlyPrep);
  const universityText = JSON.stringify(university);

  assert.equal(earlyPrep.course.educationDivision, "k12");
  assert.equal(earlyPrep.grading.title, "Class completion · Synthetic Mathematics Lab");
  assert.match(earlyPrepText, /teacher-approved class material/u);
  assert.match(earlyPrepText, /Teacher feedback/u);
  assert.doesNotMatch(earlyPrepText, /professor/u);

  assert.equal(university.course.educationDivision, "university");
  assert.equal(university.grading.title, "Course completion · Synthetic University Seminar");
  assert.match(universityText, /professor-approved course material/u);
  assert.match(universityText, /Professor feedback/u);
});

test("legacy generated K12 package copy is corrected in memory while University packages remain unchanged", () => {
  const legacy = createStarterManifest({
    id: "legacy-course",
    title: "Legacy Synthetic Course",
    education_division: "university",
  });

  const earlyPrep = applyEducationDivisionLanguage(legacy, "k12");
  const university = applyEducationDivisionLanguage(legacy, "university");

  assert.match(JSON.stringify(earlyPrep), /teacher-approved class material/u);
  assert.match(JSON.stringify(earlyPrep), /ask the teacher/u);
  assert.doesNotMatch(JSON.stringify(earlyPrep), /professor/u);
  assert.deepEqual(university, legacy);
});
