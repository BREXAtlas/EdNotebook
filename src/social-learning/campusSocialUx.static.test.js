import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const feed = readFileSync(new URL("./CampusSocialFeed.jsx", import.meta.url), "utf8");
const student = readFileSync(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");
const professor = readFileSync(new URL("../portal/ProfessorDashboard.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./campusSocialService.js", import.meta.url), "utf8");

test("students and professors render one governed campus feed", () => {
  assert.match(student, /<CampusSocialFeed/u);
  assert.match(professor, /<CampusSocialFeed/u);
  assert.match(feed, /All universities/u);
  assert.match(feed, /My campus/u);
  assert.match(feed, /Private page/u);
  assert.match(feed, /Course messages/u);
});

test("campus feed supports profiles, picture posts, reactions, follows, and comments", () => {
  assert.match(feed, /Profile picture URL/u);
  assert.match(feed, /Picture URL/u);
  assert.match(feed, /setCampusSocialReaction/u);
  assert.match(feed, /setCampusSocialFollow/u);
  assert.match(feed, /addCampusSocialComment/u);
  assert.match(service, /\.from\("campus_social_posts"\)/u);
  assert.match(service, /\.from\("campus_social_comments"\)/u);
});

test("published course request flows into student and professor libraries", () => {
  assert.match(student, /ednotebook-requested-course/u);
  assert.match(student, /requestClassLink/u);
  assert.match(student, /enrollmentRequests/u);
  assert.match(professor, /listProfessorCourseLibrary/u);
  assert.match(professor, /approveClassLink/u);
  assert.match(professor, /Course Builder controls the live state/u);
});

