import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260721190000_lti_1_3_foundation.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");
const protectedTables = ["lti_platform_registrations", "lti_deployments", "lti_launch_states", "lti_context_mappings", "lti_user_mappings", "lti_context_memberships", "lti_resource_links", "lti_service_endpoints", "lti_launch_sessions", "lti_grade_item_mappings", "lti_grade_sync_events", "lti_roster_sync_events"];

test("enables RLS across every LTI registration, identity, launch, and service table", () => {
  for (const table of protectedTables) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
});

test("never grants browser access to state, launch session, or service endpoints", () => {
  for (const table of ["lti_launch_states", "lti_launch_sessions", "lti_service_endpoints"]) {
    assert.doesNotMatch(sql, new RegExp(`grant[^;]+${table}[^;]+(?:anon|authenticated)`, "i"));
  }
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]+lti_[^;]+authenticated/i);
});

test("stores only hashes for browser launch state, nonce, and session handles", () => {
  assert.match(sql, /state_hash text not null unique/i);
  assert.match(sql, /nonce_hash text not null unique/i);
  assert.match(sql, /token_hash text not null unique/i);
  assert.doesNotMatch(sql, /\b(?:raw_jwt|id_token|access_token|private_key)\b/i);
});

test("uses exact LTI Advantage grade states and idempotent sync evidence", () => {
  for (const value of ["Initialized", "Started", "InProgress", "Submitted", "Completed", "NotReady", "Failed", "Pending", "PendingManual", "FullyGraded"]) assert.match(sql, new RegExp(`'${value}'`));
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /status text not null default 'held'/i);
  assert.match(sql, /function public\.claim_lti_grade_sync_event/i);
  assert.match(sql, /and attempt_count=p_expected_attempt/i);
});

test("adds interoperable identifiers without replacing core courses or grades", () => {
  for (const field of ["sis_sourced_id", "academic_session_sourced_id", "external_course_sourced_id", "lti_subject", "lti_context_id", "lti_resource_link_id", "lti_line_item_url", "one_roster_sourced_id"]) assert.match(sql, new RegExp(`\\b${field}\\b`, "i"));
  assert.doesNotMatch(sql, /drop table|drop column/i);
});

test("prevents owner setup RPCs from falsely activating a registration", () => {
  const functionStart = sql.indexOf("function public.save_lti_platform_registration");
  const functionBody = sql.slice(functionStart, sql.indexOf("$$;", functionStart));
  assert.match(functionBody, /'setup','testing','suspended'/i);
  assert.doesNotMatch(functionBody, /'setup','testing','active','suspended'/i);
});

test("allows activation only after real instructor, learner, context, roster, line-item, and grade evidence", () => {
  const functionStart = sql.indexOf("function public.activate_tested_lti_deployment");
  const body = sql.slice(functionStart, sql.indexOf("$$;", functionStart));
  for (const evidence of ["last_instructor_launch_at", "last_learner_launch_at", "lti_context_mappings", "lti_grade_sync_events", "lti_roster_sync_events", "lti_grade_item_mappings"]) assert.match(body, new RegExp(evidence, "i"));
  assert.match(body, /status='active'/i);
});
