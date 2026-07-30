import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260730161129_academic_writing_feedback.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

test("student learning records accept append-only academic documents", () => {
  assert.match(
    migration,
    /record_kind in \('note', 'source', 'feedback', 'document'\)/u,
  );
  assert.doesNotMatch(
    migration,
    /grant [^;]*(update|delete)[^;]*student_learning_records/u,
  );
});

test("assignment feedback is RLS protected and hidden until professor publish", () => {
  assert.match(
    migration,
    /create table if not exists public\.assignment_document_feedback/u,
  );
  assert.match(
    migration,
    /alter table public\.assignment_document_feedback enable row level security/u,
  );
  assert.match(
    migration,
    /student_id = \(select auth\.uid\(\)\)[\s\S]*published_at is not null/u,
  );
  assert.match(
    migration,
    /professor_id = \(select auth\.uid\(\)\)[\s\S]*private\.can_manage_course\(course_id\)/u,
  );
  assert.match(
    migration,
    /revoke all on table public\.assignment_document_feedback from anon, authenticated/u,
  );
});

test("students cannot forge professor review state or grades", () => {
  assert.match(
    migration,
    /if not manages_course then[\s\S]*new\.review_state := old\.review_state[\s\S]*new\.grade_label := old\.grade_label/u,
  );
  assert.match(
    migration,
    /new\.feedback_published_at := old\.feedback_published_at/u,
  );
  assert.match(migration, /new\.graded_at := old\.graded_at/u);
});

test("publishing feedback and the notification state is one authorized transaction", () => {
  assert.match(
    migration,
    /create or replace function public\.publish_assignment_document_review/u,
  );
  assert.match(
    migration,
    /if not private\.can_manage_course\(submission_course_id\) then/u,
  );
  assert.match(
    migration,
    /update public\.assignment_document_feedback[\s\S]*update public\.assignment_form_submissions/u,
  );
  assert.match(
    migration,
    /revoke all on function public\.publish_assignment_document_review\([\s\S]*from public, anon/u,
  );
  assert.match(
    migration,
    /grant execute on function public\.publish_assignment_document_review\([\s\S]*to authenticated/u,
  );
});
