import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260729041110_social_education_learning_rewards.sql", import.meta.url),
  "utf8"
);

test("reward ledger is RLS protected and browser writes are RPC-only", () => {
  assert.match(migration, /alter table public\.social_learning_reward_events enable row level security/iu);
  assert.match(migration, /student_id = \(select auth\.uid\(\)\)\s+or private\.can_manage_course\(course_id\)/iu);
  assert.match(migration, /revoke all on table public\.social_learning_reward_events from anon, authenticated/iu);
  assert.match(migration, /grant select on table public\.social_learning_reward_events to authenticated/iu);
  assert.match(migration, /grant select, insert on table public\.social_learning_reward_events to service_role/iu);
  assert.doesNotMatch(migration, /create policy social_learning_reward_events_(?:insert|update|delete)/iu);
  assert.doesNotMatch(migration, /grant all on table public\.social_learning_reward_events/iu);
});

test("issuing a reward checks course management and active enrollment", () => {
  assert.match(migration, /create or replace function public\.issue_social_learning_reward/iu);
  assert.match(migration, /not private\.can_manage_course\(p_course_id\)/iu);
  assert.match(migration, /cm\.role = 'learner'/iu);
  assert.match(migration, /private\.course_membership_is_current\(cm\.course_id, cm\.user_id, cm\.role\)/iu);
});

test("semantic uniqueness and retry idempotency are both enforced", () => {
  assert.match(migration, /social_learning_reward_events_semantic_award_idx/iu);
  assert.match(migration, /social_learning_reward_events_idempotency_idx/iu);
  assert.match(migration, /This named reward already exists for the same student and learning activity/iu);
});

test("corrections append adjustment or reversal records", () => {
  assert.match(migration, /event_type in \('award', 'adjustment', 'reversal'\)/iu);
  assert.match(migration, /create or replace function public\.correct_social_learning_reward/iu);
  assert.match(migration, /where e\.id = v_source\.id\s+or e\.source_event_id = v_source\.id/iu);
  assert.match(migration, /social_learning_reward_events_single_reversal_idx/iu);
  assert.doesNotMatch(migration, /update public\.social_learning_reward_events/iu);
  assert.doesNotMatch(migration, /delete from public\.social_learning_reward_events/iu);
});

test("schema stays separate from grade storage", () => {
  const tableBody = migration.match(/create table public\.social_learning_reward_events \(([\s\S]*?)\n\);/iu)?.[1] || "";
  assert.doesNotMatch(tableBody, /grade_item|student_grades|score|official_grade/iu);
  assert.match(migration, /It never calculates or changes official grades/iu);
});
