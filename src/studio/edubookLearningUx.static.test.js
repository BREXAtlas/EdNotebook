import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("the professor edits a versioned teaching layer instead of the source text", async () => {
  const [editor, service, migration] = await Promise.all([
    source("src/studio/EduBookTeachingLayerEditor.jsx"),
    source("src/studio/publishingService.js"),
    source("supabase/migrations/20260731221940_govern_edubook_learning_experience.sql"),
  ]);
  assert.match(editor, /Add learning without rewriting the book/u);
  assert.match(editor, /Correct answers remain server-side/u);
  assert.match(service, /save_publication_learning_layer/u);
  assert.match(migration, /publication_learning_versions/u);
  assert.match(migration, /private\.publication_learning_author_versions/u);
  assert.match(migration, /sanitize_edubook_learning_layer/u);
  assert.match(migration, /v_question-'correctAnswer'-'explanation'/u);
});

test("the student reader persists access-scoped progress and interactive responses", async () => {
  const [reader, service, migration] = await Promise.all([
    source("src/studio/InteractiveReader.jsx"),
    source("src/studio/publishingService.js"),
    source("supabase/migrations/20260731221940_govern_edubook_learning_experience.sql"),
  ]);
  assert.match(reader, /KNOWLEDGE CHECK/u);
  assert.match(reader, /REFLECT &amp; DISCUSS/u);
  assert.match(reader, /FINAL QUIZ/u);
  assert.match(reader, /Save my place/u);
  assert.match(service, /save_publication_reading_progress/u);
  assert.match(migration, /private\.can_access_publication\(p_publication_id,v_user_id\)/u);
  assert.match(migration, /Complete every knowledge check and final quiz question first/u);
  assert.match(migration, /reading_annotations_insert[\s\S]*private\.can_access_publication/u);
});

test("professor progress summaries never expose student answers or reflection drafts", async () => {
  const migration = await source("supabase/migrations/20260731221940_govern_edubook_learning_experience.sql");
  const summaryStart = migration.indexOf("create or replace function public.get_publication_reading_progress_summary");
  const summaryEnd = migration.indexOf("drop policy if exists reading_annotations_insert", summaryStart);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart);
  const summaryFunction = migration.slice(summaryStart, summaryEnd);
  assert.match(summaryFunction, /private\.can_manage_course/u);
  assert.doesNotMatch(summaryFunction, /interaction_state/u);
  assert.doesNotMatch(summaryFunction, /discussionResponses/u);
});
