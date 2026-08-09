import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authGate = await readFile(new URL("../AuthGate.jsx", import.meta.url), "utf8");
const main = await readFile(new URL("../main.jsx", import.meta.url), "utf8");
const courseStart = await readFile(new URL("../CourseStart.jsx", import.meta.url), "utf8");
const courseJourney = await readFile(new URL("../CourseJourneyShell.jsx", import.meta.url), "utf8");
const coursePackage = await readFile(new URL("../course-runtime/CoursePackageStudio.jsx", import.meta.url), "utf8");
const syllabus = await readFile(new URL("../ai/SyllabusToCourse.jsx", import.meta.url), "utf8");
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
const learningStudio = await readFile(new URL("../studio/LearningStudio.jsx", import.meta.url), "utf8");
const courseManifest = await readFile(new URL("../course-runtime/courseManifest.js", import.meta.url), "utf8");
const builderCourseAdapter = await readFile(new URL("../course-runtime/builderCourseAdapter.js", import.meta.url), "utf8");

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

test("Early Prep teacher context survives every shared class-building route", () => {
  assert.match(main, /function readCourseBuilderEducationTrack\(\)/u);
  assert.match(main, /accountType="professor" educationTrack=\{courseBuilderTrack\} returnTo="#\/app\/course-output"/u);
  assert.match(main, /accountType="professor" educationTrack=\{courseBuilderTrack\} returnTo="#\/app\/syllabus"/u);
  assert.match(main, /accountType="professor" educationTrack=\{courseBuilderTrack\} returnTo="#\/app\/builder"/u);
  assert.match(main, /#\/student\/\$\{educationDivision === "k12" \? "k12" : "university"\}\/course/u);

  assert.match(courseStart, /earlyPrep \? "Teacher workspace" : "Professor workspace"/u);
  assert.match(courseStart, /earlyPrep \? "class" : "course"/u);
  assert.match(courseJourney, /educationDivision === "k12"/u);
  assert.match(courseJourney, /earlyPrep \? "CLASS" : "COURSE"/u);
  assert.match(coursePackage, /const educatorLabel = earlyPrep \? "Teacher" : "Professor"/u);
  assert.match(coursePackage, /onOpenStudentCourse\(publication\.id, activeCourse\.education_division\)/u);
  assert.match(syllabus, /function educatorCopy\(value, earlyPrep\)/u);
  assert.match(syllabus, /educationDivision = "university"/u);
});

test("Early Prep class materials cannot enter University publisher or marketplace tools", () => {
  assert.match(main, /courseBuilderTrack !== "k12" && route\.includes\("tab=reader"\)/u);
  assert.match(main, /<LearningStudio educationTrack=\{courseBuilderTrack\}/u);
  assert.match(learningStudio, /const EARLY_PREP_TABS = TABS\.filter\(\(\[value\]\) => value !== "reader"\)/u);
  assert.match(learningStudio, /const tabs = earlyPrep \? EARLY_PREP_TABS : TABS/u);
  assert.match(learningStudio, /tabFromHash\(tabs\)/u);
});

test("Early Prep starter and generated lessons keep teacher language while University keeps professor language", () => {
  assert.match(courseManifest, /const educatorLabel = earlyPrep \? "teacher" : "professor"/u);
  assert.match(courseManifest, /Compare the lesson with \$\{educatorLabel\}-approved \$\{learningContainer\} material/u);
  assert.match(courseManifest, /ask the \$\{educatorLabel\} one specific question/u);
  assert.match(courseManifest, /educationDivision, language: "en"/u);
  assert.match(builderCourseAdapter, /educationDivision === "k12" \? "teacher" : "professor"/u);
  assert.match(builderCourseAdapter, /generated from the \$\{educatorLabel\}-approved lesson structure/u);
  assert.match(builderCourseAdapter, /The \$\{educatorLabel\}-approved learning pathway generated in Course Forge/u);
  assert.match(builderCourseAdapter, /\$\{learningContainerTitle\} completion · \$\{title\}/u);
  assert.match(coursePackage, /\$\{entityTitle\} completion · \$\{value\}/u);
});
