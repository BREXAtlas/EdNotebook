import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260729043032_student_learning_workspace.sql", import.meta.url),
  "utf8"
).toLowerCase();
const safetyModel = readFileSync(new URL("../admin-control/studentDataSafetyModel.js", import.meta.url), "utf8");
const safetyHarness = readFileSync(new URL("../../supabase/tests/institution_student_data_safety.sql", import.meta.url), "utf8");

test("student learning records are append-only and own-student scoped", () => {
  assert.match(migration, /create table if not exists public\.student_learning_records/u);
  assert.match(migration, /enable row level security/u);
  assert.match(migration, /for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = student_id\)/u);
  assert.match(migration, /for insert\s+to authenticated\s+with check/u);
  assert.match(migration, /private\.can_access_course\(course_id\)/u);
  assert.match(migration, /grant select, insert on table public\.student_learning_records to authenticated/u);
  assert.doesNotMatch(migration, /grant [^;]*(update|delete)[^;]* to authenticated/u);
  assert.doesNotMatch(migration, /for (update|delete)\s+to authenticated/u);
});

test("cloud content is bounded and version collisions are rejected", () => {
  assert.match(migration, /octet_length\(content::text\) <= 1048576/u);
  assert.match(migration, /unique \(student_id, root_id, version\)/u);
  assert.match(migration, /record_kind in \('note', 'source', 'feedback'\)/u);
});

test("cloud learning records join the fail-closed student-data inventory", () => {
  assert.match(safetyModel, /STUDENT_DATA_SNAPSHOT_VERSION = "2\.4"/u);
  assert.match(safetyModel, /"studentLearningRecords"/u);
  assert.match(safetyHarness, /select 'studentLearningRecords'[\s\S]*public\.student_learning_records where student_id=p_student/u);
  assert.match(safetyHarness, /canonical 48-domain capture inventory/u);
  assert.match(safetyHarness, /safety_backup_student_learning_records/u);
});
