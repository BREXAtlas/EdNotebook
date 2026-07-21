import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260721143000_blackboard_grade_export.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

test("enables RLS on every Blackboard reconciliation table", () => {
  for (const table of ["blackboard_identity_mappings", "blackboard_grade_column_mappings", "blackboard_grade_exports"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`create policy ${table.replace("grade_column_", "column_").replace("grade_exports", "grade_exports")}`, "i"));
  }
});

test("does not grant direct Blackboard table writes to browser roles", () => {
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]+blackboard_(?:identity_mappings|grade_column_mappings|grade_exports)[^;]+authenticated/i);
  assert.match(sql, /grant select on public\.blackboard_identity_mappings to authenticated/i);
});

test("security-definer functions recheck authentication and course authority", () => {
  const requiredFunctions = [
    "get_blackboard_export_context",
    "save_blackboard_identity_mappings",
    "save_blackboard_column_mappings",
    "confirm_blackboard_grade_export",
    "record_blackboard_export_download",
  ];
  for (const name of requiredFunctions) {
    const start = sql.indexOf(`function public.${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const body = sql.slice(start, sql.indexOf("$$;", start) + 3);
    assert.match(body, /security definer/i);
    assert.match(body, /auth\.uid\(\)/i);
    assert.match(body, /private\.can_manage_course/i);
  }
});

test("stores canonical identifiers, line items, provenance mode, and contract version", () => {
  for (const field of [
    "provider",
    "integration_mode",
    "external_identifiers",
    "external_line_item_id",
    "canonical_line_item",
    "last_reconciled_at",
    "data_contract_version",
    "academic_session_label",
  ]) assert.match(sql, new RegExp(`\\b${field}\\b`, "i"));
});

test("records hashes and does not store the uploaded or generated CSV body", () => {
  assert.match(sql, /source_file_hash/i);
  assert.match(sql, /grade_snapshot_hash/i);
  assert.doesNotMatch(sql, /(?:source|export)_file_(?:body|contents|bytes)/i);
});
