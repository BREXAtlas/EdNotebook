import assert from "node:assert/strict";
import test from "node:test";

import { extractDeterministicSyllabus, mergeSyllabusExtraction } from "./syllabusExtractionContract.js";

const COMPLETE_SAMPLE = `
Course Title: Introduction to Media Studies
Course Code: COMM 1307
Section: 010
Term: Fall 2026
Credit Hours: 3

Course Description
This course examines media institutions, visual communication, audiences, and the social effects of media. The description matches the approved catalog description.
Prerequisite: None.
Technical skills: Students must be able to use a web browser and upload files.

Contact Information
Instructor Title: Professor
Instructor: Avery Morgan
Phone: 325-555-1212
ASU Email: avery.morgan@angelo.edu
Office Location: Library 210
Office Hours: Monday and Wednesday 2:00-4:00 p.m.

Course Delivery
Modality: Hybrid with in-person meetings and asynchronous Blackboard activities.
Meeting Times: Tuesday and Thursday 9:30-10:45 a.m.
Meeting Location: Academic Building 101
Blackboard is the learning management system for announcements, assignments, and grades.

Texts and Materials
Required Reading: Media and Culture, 13th edition
Recommended Reading: The Associated Press Stylebook
Required hardware: Laptop or desktop computer
Required software: Current browser and word processor
Required subscription: None
Materials are available through the ASU Bookstore and the library.

Outcomes
Explain how media industries shape culture.
Analyze visual and audio messages using evidence.
Assessment methods include scene analyses, discussions, and the final project.

Objectives
Identify major media forms.
Compare competing interpretations of media effects.

Grading Criteria
A = 90-100; B = 80-89; C = 70-79; D = 60-69; F = below 60
Scene analyses 25%
Discussion boards 20%
Midterm examination 20%
Final project 35%
Late work receives a deduction unless an accommodation applies.
Final Assessment: Culminating media-analysis project.

Course Expectations
Attendance is required for scheduled in-person meetings.
Participation includes weekly discussion and peer response.
Communication: Use ASU email; the instructor responds within two business days.
Academic behavior follows the Honor Code.
Online conduct must remain respectful and evidence-based.
Generative AI may be used only when an assignment explicitly permits it and must be disclosed.
Students seeking accommodations should contact the appropriate ASU office and notify the instructor.

Institutional Policies and Procedures
Academic Integrity and Honor Code information is provided through the Student Handbook.
Students with Disabilities and reasonable accommodation information is included.
Title IX and sexual misconduct reporting information is included.
Student absence for observance of a religious holy day is included.

Course Outline
Week 1: Introduction to media studies and course expectations
Week 2: Visual language; Scene Analysis 1 assigned
Week 3: Media industries and ownership
Week 4: Audience theories; Midterm examination
Week 5: Representation and identity
Week 6: Digital platforms and algorithms
Week 7: Final project workshop
Week 8: Culminating project presentations
`;

test("extracts the ASU syllabus checklist fields before AI", () => {
  const result = extractDeterministicSyllabus(COMPLETE_SAMPLE);

  assert.equal(result.profile.profileKey, "angelo-state-2026");
  assert.equal(result.fields.courseCode.value, "COMM 1307");
  assert.equal(result.fields.instructorEmail.value, "avery.morgan@angelo.edu");
  assert.match(String(result.fields.lmsUse.value), /Blackboard/i);
  assert.ok(result.fields.courseOutcomes.value.length >= 2);
  assert.ok(result.fields.gradingBreakdown.value.length >= 3);
  assert.match(String(result.fields.aiUsePolicy.value), /Generative AI/i);
  assert.ok(result.fields.institutionalTitleIX);
  assert.ok(result.fields.courseOutline.value.length >= 8);
  assert.ok(result.requirementReview.requiredTotal > 20);
});

test("reports missing required professor-managed sections while separating institution-managed blocks", () => {
  const result = extractDeterministicSyllabus("Course Title: Test Course\nCourse Code: TEST 1000");

  assert.ok(result.requirementReview.missingRequired.some((item) => item.key === "courseDescription"));
  assert.ok(result.requirementReview.institutionManaged.some((item) => item.key === "institutionalAcademicIntegrity"));
  assert.ok(result.requirementReview.optional.some((item) => item.key === "programInformation"));
  assert.ok(result.missingInformation.includes("Aligned course description"));
});

test("AI merging accepts only known syllabus fields and recalculates requirements", () => {
  const deterministic = extractDeterministicSyllabus("Course Title: Test Course\nCourse Code: TEST 1000");
  const merged = mergeSyllabusExtraction(deterministic, {
    fields: {
      courseDescription: {
        value: "An approved course description.",
        confidence: 0.91,
        sourceExcerpt: "An approved course description.",
      },
      unsupportedInventedField: {
        value: "must not be stored",
        confidence: 1,
        sourceExcerpt: "none",
      },
    },
    missingInformation: [],
    conflictingInformation: [],
    proposedCourseOutline: null,
  });

  assert.equal(merged.fields.courseDescription.method, "ai_uncertainty_resolution");
  assert.equal(merged.fields.unsupportedInventedField, undefined);
  assert.ok(!merged.requirementReview.missingRequired.some((item) => item.key === "courseDescription"));
});
