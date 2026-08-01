import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const materials = read("../studio/MaterialsWorkspace.jsx");
const storageService = read("../studio/storageService.js");
const reader = read("./EdNotebookMediaReader.jsx");
const youtubePlayer = read("./YouTubeEvidencePlayer.jsx");
const lessonPlayer = read("../course-runtime/StudentLessonPlayer.jsx");
const runtime = read("../course-runtime/CourseRuntimePage.jsx");
const migration = read("../../supabase/migrations/20260801040000_govern_media_learning_workflow.sql");
const indexMigration = read("../../supabase/migrations/20260801041000_index_media_learning_progress.sql");
const gate = read("../../supabase/tests/media_learning_workflow_gate.sql");

test("professor can bind required media to one exact governed learning activity", () => {
  assert.match(materials, /Required learning step/);
  assert.match(materials, /Exact knowledge check/);
  assert.match(materials, /Due date and time/);
  assert.match(materials, /never completes this learning step or determines a grade/i);
  assert.match(materials, /Required media must use governed cloud storage/i);
  assert.match(materials, /setPublishedLessonTargets\(targets\.lessons \|\| \[\]\)/);
  assert.match(storageService, /from\("course_publications"\)/);
  assert.match(storageService, /from\("course_publication_versions"\)/);
  assert.match(storageService, /lessonTargetsFromManifest\(version\?\.manifest\)/);
});

test("student resumes media and reaches its exact linked learning activity", () => {
  assert.match(reader, /aria-label="Required media learning step"/);
  assert.match(reader, /<strong>\{learning\.label\}<\/strong>/);
  assert.match(reader, /onOpenLearningActivity\(resource\)/);
  assert.match(reader, /last_position_seconds/);
  assert.match(youtubePlayer, /seekTo\?\.\(resumeAt, true\)/);
  assert.match(runtime, /focusResourceId: resource\.id/);
  assert.match(lessonPlayer, /onLearningProgress\?\.\(\)/);
});

test("database completion is exact, server governed, and separate from playback", () => {
  assert.match(migration, /create table public\.media_learning_progress/);
  assert.match(migration, /media_learning_progress_no_direct_browser_access/);
  assert.match(migration, /using \(false\)[\s\S]*with check \(false\)/);
  assert.match(migration, /knowledge_check_submitted/);
  assert.match(migration, /assignment_submitted/);
  assert.match(migration, /'playbackCompletesLearning',false/);
  assert.match(migration, /'playbackProvesLearning',false/);
  assert.match(indexMigration, /media_learning_progress_publication_idx/);
  assert.match(gate, /Playback incorrectly completed a required learning step/);
  assert.match(gate, /Publishing replacement media erased original completion history/);
});
