import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authGate = await readFile(new URL("../AuthGate.jsx", import.meta.url), "utf8");
const outline = await readFile(new URL("../ai/CourseOutlineBuilder.jsx", import.meta.url), "utf8");
const communication = await readFile(new URL("../communication/CourseCommunicationPanel.jsx", import.meta.url), "utf8");
const assignment = await readFile(new URL("../portal/AssignmentTemplateWorkspace.jsx", import.meta.url), "utf8");
const directory = await readFile(new URL("../portal/ClassDirectory.jsx", import.meta.url), "utf8");
const studentDashboard = await readFile(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const socialFeed = await readFile(new URL("../social-learning/CampusSocialFeed.jsx", import.meta.url), "utf8");
const socialLearning = await readFile(new URL("../social-learning/SocialLearningPanels.jsx", import.meta.url), "utf8");
const courseRuntime = await readFile(new URL("../course-runtime/CourseRuntimePage.jsx", import.meta.url), "utf8");
const lessonPlayer = await readFile(new URL("../course-runtime/StudentLessonPlayer.jsx", import.meta.url), "utf8");
const digitalLiteracy = await readFile(new URL("../digital-literacy/DigitalLiteracyPilotWorkspace.jsx", import.meta.url), "utf8");

test("Early Prep educator language stays teacher-specific while University professor language remains intact", () => {
  assert.match(authGate, /earlyPrepEducator/u);
  assert.match(authGate, /Your teacher workspace is active/u);
  assert.match(authGate, /#\/early-prep\/teacher/u);
  assert.match(authGate, /accountType === "professor" && educationTrack === "k12"\s*\? "teacher"/u);
  assert.match(authGate, /\{displayRole\} ·/u);
  assert.match(authGate, /educationTrack === "k12" \? "teacher" : "professor"\} enrollment/u);
  assert.match(authGate, /Your professor workspace is active/u);

  assert.match(communication, /"Teacher updates" : "Professor updates"/u);
  assert.match(directory, /track === "k12" \? "Teacher" : "Professor"/u);
  assert.match(studentDashboard, /track === "k12" \? "teacher" : "professor"/u);
  assert.match(socialFeed, /Students and teachers share the same school community/u);
  assert.match(socialFeed, /!university && value === "professor" \? "teacher" : value/u);
  assert.match(socialFeed, /socialRoleLabel\(feed\.profile\?\.account_type \|\| role, university\)/u);
  assert.match(socialLearning, /earlyPrep \? "TEACHER RECOGNITION" : "PROFESSOR RECOGNITION"/u);
});

test("Early Prep course creation and student workspaces default to Grades 9–12 teacher context", () => {
  assert.match(outline, /academicLevel: earlyPrep \? "Grades 9–12" : "Undergraduate"/u);
  assert.match(outline, /Teacher-directed learning/u);
  assert.match(outline, /Keep the \{educatorLabel\} in control/u);
  assert.match(assignment, /const educatorLabel = earlyPrepReview \? "Teacher" : "Professor"/u);
  assert.match(assignment, /track=\{track\}/u);
  assert.match(courseRuntime, /const educatorLabel = track === "k12" \? "teacher" : "professor"/u);
  assert.match(courseRuntime, /track === "k12" \? state\.packageIdentity\.label\.replace\(\/\^Professor-\/u, "Teacher-"\)/u);
  assert.match(lessonPlayer, /educationDivision === "k12" \? "teacher" : "professor"/u);
  assert.match(digitalLiteracy, /earlyPrepEducatorCopy\(assignment\.instructions, earlyPrep\)/u);
});
