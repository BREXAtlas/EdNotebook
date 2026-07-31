import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const studentDashboard = readFileSync(new URL("./StudentDashboard.jsx", import.meta.url), "utf8");
const professorDashboard = readFileSync(new URL("./ProfessorDashboard.jsx", import.meta.url), "utf8");
const classDirectory = readFileSync(new URL("./ClassDirectory.jsx", import.meta.url), "utf8");
const studentLanding = readFileSync(new URL("./StudentLanding.jsx", import.meta.url), "utf8");
const portalService = readFileSync(new URL("./portalService.js", import.meta.url), "utf8");

test("student notifications clear persistently and route into the triggering course area", () => {
  assert.match(studentDashboard, /StudentNotificationCenter/u);
  assert.match(studentDashboard, /markStudentAccountNotificationRead/u);
  assert.match(studentDashboard, /notification\.route === "rewards" \? "rewards" : "classes"/u);
  assert.match(studentDashboard, /setNotificationCourseId\(notification\.course_id \|\| null\)/u);
  assert.match(studentDashboard, /if \(focusCourseId\) setOpenClass\(focusCourseId\)/u);
  assert.match(studentDashboard, /Completed course badges/u);
  assert.match(portalService, /student_account_notifications/u);
  assert.match(portalService, /course_completion_badges/u);
});

test("professors control approval, open enrollment, universal assignment, and badges together", () => {
  assert.match(professorDashboard, /Professor approval required/u);
  assert.match(professorDashboard, /Open · students join immediately/u);
  assert.match(professorDashboard, /Assign to every eligible new student/u);
  assert.match(professorDashboard, /Completion badge/u);
  assert.match(portalService, /set_published_course_enrollment/u);
});

test("public discovery explains the enrollment handoff before sign in", () => {
  assert.match(classDirectory, /Professor approval required/u);
  assert.match(classDirectory, /Open · join immediately/u);
  assert.match(studentLanding, /Sign in and join this class/u);
  assert.match(studentLanding, /Sign in to request this class/u);
});
