import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const runtime = read("../course-runtime/CourseRuntimePage.jsx");
const player = read("../course-runtime/StudentLessonPlayer.jsx");
const resources = read("../course-runtime/CourseResourcesPanel.jsx");
const reader = read("./EdNotebookMediaReader.jsx");
const model = read("./courseMediaModel.js");
const studio = read("../course-runtime/CoursePackageStudio.jsx");
const materials = read("../studio/MaterialsWorkspace.jsx");
const migration = read("../../supabase/migrations/20260801020000_govern_in_platform_media_resources.sql");
const deleteGuard = read("../../supabase/migrations/20260801022000_restrict_media_publication_delete.sql");

test("professor media authoring is part of the connected course output workflow", () => {
  assert.match(studio, /Media & resources/);
  assert.match(studio, /courseOverride=\{activeCourse\}/);
  assert.match(materials, /Exact lesson/);
  assert.match(materials, /Exact assignment/);
  assert.match(materials, /Draft until next publish/);
});

test("learner media stays in the course and in the selected lesson", () => {
  assert.match(runtime, /CourseResourcesPanel/);
  assert.match(runtime, /Media &amp; resources/);
  assert.match(runtime, /target_kind === "assignment"/);
  assert.match(player, /PROFESSOR-PUBLISHED MEDIA/);
  assert.match(reader, /Play here in EdNotebook/);
  assert.match(reader, /youtubePrivacyEmbedUrl/);
  assert.match(model, /youtube-nocookie\.com/);
  assert.doesNotMatch(reader, /window\.open/);
});

test("student-added resources are private and server governed", () => {
  assert.match(resources, /MY PRIVATE RESOURCE|private/i);
  assert.match(resources, /saveMyCourseLink/);
  assert.match(migration, /target_kind='personal'/);
  assert.match(migration, /visibility='private'/);
  assert.match(migration, /private\.can_manage_course\(course_id\)/);
});

test("publication produces an immutable versioned resource snapshot", () => {
  assert.match(migration, /create table public\.course_publication_resources/);
  assert.match(migration, /after insert on public\.course_publication_versions/);
  assert.match(migration, /get_published_course_resources/);
  assert.match(migration, /externalPagesEmbedded',false/);
  assert.match(deleteGuard, /on delete restrict/);
});
