import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260808230030_early_prep_financial_literacy.sql", import.meta.url),
  "utf8",
);
const hardeningSql = readFileSync(
  new URL("../../supabase/migrations/20260808230221_harden_early_prep_financial_literacy.sql", import.meta.url),
  "utf8",
);

test("migration anchors one validated 40-unit canonical Financial Literacy release", () => {
  assert.match(sql, /brexatlas\.financial-literacy-course/u);
  assert.match(sql, /237301955de36d335d3d15858258b57fbc63f1b9/u);
  assert.match(sql, /https:\/\/github\.com\/BREXAtlas\/Financial-Literacy-Course/u);
  const units = [...sql.matchAll(/\('2026\.08\.08\.1','(ep\d{2}|q\d{2})','(foundations|wealth-quest)'/gu)];
  assert.equal(units.length, 40);
  assert.equal(new Set(units.map((match) => match[1])).size, 40);
});

test("automatic enrollment and progress are restricted to the current K12 path", () => {
  for (const token of [
    "financial_literacy_standard_enrollments",
    "financial_literacy_standard_progress",
    "student_path_assign_financial_literacy",
    "path.current_division='k12'",
    "Early Prep student access required",
  ]) assert.ok(sql.includes(token), `missing ${token}`);
  assert.match(sql, /primary key \(student_id,release_id,unit_id\)/u);
  assert.match(sql, /evidence_source='learner_confirmed_canonical_course'/u);
});

test("teacher progress is both managed-course and K12 scoped", () => {
  assert.match(sql, /get_financial_literacy_teacher_progress/u);
  assert.match(sql, /private\.can_manage_course\(p_course_id\)/u);
  assert.match(sql, /course\.education_division='k12'/u);
  assert.match(sql, /private\.course_membership_is_current/u);
});

test("private progress and milestones are not exposed as direct Data API tables", () => {
  for (const table of [
    "financial_literacy_standard_enrollments",
    "financial_literacy_standard_progress",
    "financial_literacy_standard_badges",
  ]) {
    assert.match(sql, new RegExp(`alter table private\\.${table} enable row level security`, "u"));
    assert.match(sql, new RegExp(`revoke all on private\\.${table} from public,anon,authenticated`, "u"));
  }
  assert.match(sql, /set search_path = ''/u);
  assert.match(sql, /revoke all on function private\.issue_early_prep_financial_literacy_badges\(\) from public,anon,authenticated/u);
  for (const token of [
    "financial_literacy_enrollments_explicit_deny",
    "financial_literacy_progress_explicit_deny",
    "financial_literacy_badges_explicit_deny",
  ]) assert.ok(hardeningSql.includes(token), `missing ${token}`);
});

test("every Financial Literacy foreign key has a covering index", () => {
  assert.match(hardeningSql, /financial_literacy_enrollment_started_release_idx/u);
  assert.match(hardeningSql, /financial_literacy_badges_release_idx/u);
  assert.match(hardeningSql, /get_financial_literacy_catalog\(\) security invoker/u);
});

test("Financial Literacy remains separate from commerce, University badges, and publisher records", () => {
  assert.match(sql, /never a marketplace listing/u);
  assert.doesNotMatch(sql, /insert into public\.marketplace_/iu);
  assert.doesNotMatch(sql, /insert into public\.course_completion_badges/iu);
  assert.doesNotMatch(sql, /insert into public\.published_course_directory/iu);
  assert.doesNotMatch(sql, /stripe|checkout|payment_intent|seller|payout/iu);
});

test("the learner completion RPC records only bounded unit evidence", () => {
  assert.match(sql, /record_my_financial_literacy_completion/u);
  assert.match(sql, /p_catalog_release\|\|':'\|\|p_unit_id/u);
  assert.match(sql, /jsonb_build_object\('release_id',p_catalog_release,'unit_id',p_unit_id,'education_division','k12'\)/u);
  assert.doesNotMatch(sql, /account_number|bank_credentials|tax_document|exact_balance/iu);
});
