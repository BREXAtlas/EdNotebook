import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260731021000_govern_course_enrollment_access.sql", import.meta.url),
  "utf8",
);
const databaseGate = readFileSync(
  new URL("../../supabase/tests/course_enrollment_access_gate.sql", import.meta.url),
  "utf8",
);

test("published courses keep approval and open enrollment as explicit governed choices", () => {
  assert.match(migration, /enrollment_policy in \('approval_required','open_self_enroll'\)/u);
  assert.match(migration, /not universal_assignment or enrollment_policy='open_self_enroll'/u);
  assert.match(migration, /request_or_join_published_course/u);
  assert.match(migration, /set_published_course_enrollment/u);
});

test("institutional enrollment requires the student's active matching affiliation", () => {
  assert.match(
    migration,
    /private\.has_active_institution_affiliation\(\s*\(select auth\.uid\(\)\),v_course\.institution_id,'student'/u,
  );
  assert.match(databaseGate, /Expected another-school enrollment to be rejected/u);
  assert.match(databaseGate, /Universal assignment crossed an institution boundary/u);
});

test("approval, universal assignment, and completion create durable student records", () => {
  assert.match(migration, /create table public\.student_account_notifications/u);
  assert.match(migration, /create table public\.course_completion_badges/u);
  assert.match(migration, /course_completion_badge_award/u);
  assert.match(migration, /mark_student_account_notification_read/u);
  assert.match(databaseGate, /Course completion badge was not recorded/u);
  assert.match(databaseGate, /Opening a notification did not persist read state/u);
});

test("the requested Texas public and private universities are available for signup", () => {
  for (const university of [
    "Angelo State University",
    "University of Houston",
    "Texas Southern University",
    "Baylor University",
    "Prairie View A&M University",
    "The University of Texas at Austin",
    "Texas A&M University",
    "Texas Tech University",
    "Rice University",
    "Southern Methodist University",
    "Texas Christian University",
    "University of North Texas",
    "Texas State University",
    "Sam Houston State University",
    "The University of Texas at San Antonio",
  ]) {
    assert.ok(
      migration.includes(university)
        || readFileSync(new URL("../admin-control/InstitutionPicker.jsx", import.meta.url), "utf8").includes(university),
      `${university} should be available in the governed directory or safe fallback`,
    );
  }
});
