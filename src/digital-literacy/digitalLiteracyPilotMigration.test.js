import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../supabase/migrations/20260801050000_digital_literacy_pilot_readiness.sql", import.meta.url), "utf8");
const researchGateSql = readFileSync(new URL("../../supabase/migrations/20260729042330_digital_literacy_research_gate.sql", import.meta.url), "utf8");
const integratedSql = `${researchGateSql}\n${sql}`;

test("migration anchors EdNotebook to one versioned canonical 40-unit catalog", () => {
  assert.match(sql, /2026\.08\.01\.1/u);
  assert.match(sql, /brexatlas\.digital-literacy-course/u);
  assert.match(sql, /https:\/\/github\.com\/BREXAtlas\/Digital-Literacy-Course/u);
  const seededUnits = [...sql.matchAll(/\('2026\.08\.01\.1','(ep\d{2}|q\d{2})','(foundations|ai-quest)'/gu)];
  assert.equal(seededUnits.length, 40);
  assert.equal(new Set(seededUnits.map((match) => match[1])).size, 40);
});

test("professor assignments reuse governed class, due-work, notification, and recipient records", () => {
  for (const token of [
    "create_digital_literacy_assignment",
    "digital_literacy_assignment_units",
    "digital_literacy_assignment_recipients",
    "digital_literacy_assignment_progress",
    "insert into public.assignments",
    "private.create_student_course_notification",
  ]) assert.ok(sql.includes(token), `missing ${token}`);
  assert.match(sql, /'research_participation_required',false/iu);
});

test("research collection fails closed and keeps pre/post phases tied to assigned completion", () => {
  for (const token of [
    "written_determination_missing_or_revoked",
    "explicit_activation_missing",
    "consent_configuration_mismatch",
    "enforce_digital_literacy_research_timing",
    "The pre-assessment window closed after course-unit completion began",
    "The post-course instrument opens only after the approved unit scope is complete",
  ]) assert.ok(integratedSql.includes(token), `missing ${token}`);
});

test("governed export is cohort-limited, pseudonymized, and manually reviews qualitative text", () => {
  for (const token of [
    "export_digital_literacy_research_dataset",
    "minimum_cohort_size",
    "extensions.hmac",
    "pseudonymized_with_manual_redaction",
    "Pseudonymized records are not anonymous",
    "manual_text_review_required",
  ]) assert.ok(sql.includes(token), `missing ${token}`);
  assert.match(sql, /drop policy if exists research_response_records_select/iu);
  assert.match(sql, /participant_id=\(select auth\.uid\(\)\)/u);
});

test("sensitive tables and mutation functions use RLS and restricted grants", () => {
  for (const table of [
    "digital_literacy_assignment_recipients",
    "digital_literacy_assignment_progress",
    "digital_literacy_research_instrument_scopes",
    "research_export_secrets",
  ]) assert.match(sql, new RegExp(`alter table (?:public|private)\\.${table} enable row level security`, "u"));
  assert.match(sql, /revoke all on function public\.export_digital_literacy_research_dataset/iu);
  for (const index of [
    "digital_literacy_assignment_units_release_idx",
    "digital_literacy_assignment_progress_assignment_unit_idx",
    "digital_literacy_research_scopes_release_idx",
  ]) assert.ok(sql.includes(index), `missing foreign-key index ${index}`);
});
