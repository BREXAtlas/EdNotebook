import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../supabase/migrations/20260727010000_course_syllabus_management.sql", import.meta.url);

test("syllabus migration creates versioned course-owned records with RLS", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of ["course_syllabi", "course_syllabus_versions", "course_syllabus_lms_links"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon`));
  }

  assert.match(sql, /private\.can_manage_course\(course_id\)/);
  assert.match(sql, /private\.can_access_course\(course_id\)/);
  assert.match(sql, /create or replace function public\.save_course_syllabus_draft/);
  assert.match(sql, /EdNotebookStructuredSyllabus\/1\.0/);
  assert.match(sql, /course_syllabus_versions/);
  assert.match(sql, /institution approval and publication require the governed approval workflow/);
});
