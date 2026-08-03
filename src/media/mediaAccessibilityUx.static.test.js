import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), "utf8");
const reader = read("./EdNotebookMediaReader.jsx");
const youtubePlayer = read("./YouTubeEvidencePlayer.jsx");
const materials = read("../studio/MaterialsWorkspace.jsx");
const courseService = read("../course-runtime/courseService.js");
const storageService = read("../studio/storageService.js");
const migration = read("../../supabase/migrations/20260801030000_govern_media_accessibility_evidence.sql");
const gate = read("../../supabase/tests/media_accessibility_evidence_gate.sql");

test("student media reader keeps captions, transcripts, and progress in platform", () => {
  assert.match(reader, /Play with captions/);
  assert.match(reader, /Read searchable transcript/);
  assert.match(reader, /mediaProgressLabel\(progress\)/);
  assert.match(reader, /onTimeUpdate/);
  assert.match(youtubePlayer, /youtube-nocookie\.com/);
  assert.match(youtubePlayer, /recordEvidence|evidenceRef/);
  assert.match(youtubePlayer, /not proof of attention or learning/i);
});

test("professor workflow makes accessibility and replacement explicit", () => {
  assert.match(materials, /Accessibility, captions, and transcript/);
  assert.match(materials, /Replace an earlier media version/);
  assert.match(materials, /The existing published version stays intact/);
  assert.match(materials, /cannot replace an assessment/);
  assert.match(storageService, /get_course_media_evidence/);
  assert.match(storageService, /retire_learning_resource/);
});

test("database evidence is version-bound, aggregate, and directly inaccessible", () => {
  assert.match(migration, /create table public\.media_viewing_progress/);
  assert.match(migration, /media_viewing_progress_no_direct_browser_access/);
  assert.match(migration, /private\.can_access_course/);
  assert.match(migration, /private\.can_manage_course/);
  assert.match(migration, /membership\.role='learner'/);
  assert.match(migration, /individualPlaybackLogExposed/);
  assert.doesNotMatch(migration, /ip_address|user_agent|device_fingerprint/i);
  assert.match(courseService, /record_course_media_progress/);
  assert.match(gate, /Replacing a draft resource rewrote the published version-one snapshot/);
  assert.match(gate, /Learner changed evidence for a superseded publication version/);
});
