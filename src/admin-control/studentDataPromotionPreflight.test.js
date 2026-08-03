import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE,
  buildStudentDataPromotionPreflightRpcPayload,
  validateStudentDataPromotionPreflight,
} from "./studentDataPromotionPreflight.js";

const NOW = new Date("2026-08-03T00:00:00.000Z");
const SOURCE_COMMIT = "2ccfdccc6b6f0ec7939541ccf437879bba492310";
const SNAPSHOT_SHA256 = "a".repeat(64);

function fixture(overrides = {}) {
  return {
    current: {
      snapshot_sha256: SNAPSHOT_SHA256,
      valid_until: "2026-10-30T23:59:59.000Z",
      snapshot: {
        schema_version: "1.0",
        decision: "hold",
        ready_for_promotion_review: false,
        hold_scope: "production_promotion_only",
        staging_beta_testing_allowed: true,
        staging_pilot_testing_allowed: true,
        testing_data_scope: "beta_demo_or_authorized_pilot_data",
        production_student_intake_enabled: false,
        production_action_executed: false,
        automatic_lifecycle_execution_enabled: false,
        lifecycle_domain_count: 61,
        recorded_lifecycle_domain_count: 61,
        approved_lifecycle_domain_count: 33,
        blocked_lifecycle_domain_count: 28,
        required_evidence_gate_count: 13,
        passed_evidence_gate_count: 9,
        missing_evidence_gates: [
          "accessibilityApproval",
          "blackboardRoundTrip",
          "privacyRecordsApproval",
          "securityApproval",
        ],
        ...overrides,
      },
    },
  };
}

function input(overrides = {}) {
  return {
    sourceCommit: SOURCE_COMMIT,
    evidenceReference: "github:BREXAtlas/EdNotebook;pr:next-controlled-unit",
    summary: "The consolidated staging preflight remains HOLD for production only.",
    authorityAttestation: true,
    ...overrides,
  };
}

test("a production HOLD preserves bounded live Beta and Pilot testing", () => {
  const validation = validateStudentDataPromotionPreflight(fixture(), input(), NOW);
  assert.equal(validation.valid, true);
});

test("production activation and lifecycle execution fail the preflight", () => {
  for (const field of [
    "production_student_intake_enabled",
    "production_action_executed",
    "automatic_lifecycle_execution_enabled",
  ]) {
    const validation = validateStudentDataPromotionPreflight(fixture({ [field]: true }), input(), NOW);
    assert.equal(validation.valid, false);
    assert.match(validation.issues.join(" "), /must remain disabled/u);
  }
});

test("a HOLD cannot disable live Beta or Pilot testing", () => {
  const beta = validateStudentDataPromotionPreflight(fixture({ staging_beta_testing_allowed: false }), input(), NOW);
  const pilot = validateStudentDataPromotionPreflight(fixture({ staging_pilot_testing_allowed: false }), input(), NOW);
  assert.equal(beta.valid, false);
  assert.equal(pilot.valid, false);
  assert.match(beta.issues.join(" "), /must remain allowed/u);
});

test("ready-for-review cannot be fabricated while blockers remain", () => {
  const validation = validateStudentDataPromotionPreflight(fixture({
    decision: "ready_for_human_promotion_review",
    ready_for_promotion_review: true,
  }), input(), NOW);
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join(" "), /does not match its blockers/u);
});

test("the RPC payload is checksum-bound and contains no readiness bodies", () => {
  const payload = buildStudentDataPromotionPreflightRpcPayload(
    STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.institutionId,
    fixture(),
    input(),
    NOW,
  );
  assert.deepEqual(payload, {
    p_institution_id: STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.institutionId,
    p_source_commit: SOURCE_COMMIT,
    p_evidence_reference: "github:BREXAtlas/EdNotebook;pr:next-controlled-unit",
    p_summary: "The consolidated staging preflight remains HOLD for production only.",
    p_expected_snapshot_sha256: SNAPSHOT_SHA256,
    p_attestation: true,
  });
  assert.equal(JSON.stringify(payload).includes("missing_evidence_gates"), false);
});

test("the migration keeps direct data access closed and records only metadata", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260802233000_govern_student_data_promotion_preflight.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /alter table public\.student_data_promotion_preflight_versions enable row level security/u);
  assert.match(migration, /revoke all on table public\.student_data_promotion_preflight_versions from public,anon,authenticated/u);
  assert.match(migration, /create policy student_data_promotion_preflight_versions_api_deny_all/u);
  assert.match(migration, /as restrictive for all to anon,authenticated\s+using \(false\) with check \(false\)/u);
  assert.match(migration, /set search_path=''/u);
  assert.match(migration, /private\.is_platform_owner\(v_actor\)/u);
  assert.match(migration, /p_expected_snapshot_sha256/u);
  assert.match(migration, /staging_beta_testing_allowed',true/u);
  assert.match(migration, /staging_pilot_testing_allowed',true/u);
  assert.match(migration, /testing_data_scope','beta_demo_or_authorized_pilot_data'/u);
  assert.match(migration, /production_student_intake_enabled',false/u);
  assert.match(migration, /production_action_executed',false/u);
  assert.doesNotMatch(migration, /didwxihufueqbpfnfdmm/u);
});

test("CI rehearses Beta to Pilot carry-over against every fresh migration", async () => {
  const [workflow, gate] = await Promise.all([
    readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/tests/student_data_environment_lanes.sql", import.meta.url), "utf8"),
  ]);
  assert.match(workflow, /student_data_environment_lanes\.sql/u);
  assert.match(gate, /update public\.institution_affiliations/u);
  assert.match(gate, /and pathway='student'/u);
  assert.match(gate, /v_beta\.carried_account_ids<>v_pilot\.carried_account_ids/u);
  assert.match(gate, /v_pilot\.previous_data_lane<>'beta'/u);
  assert.match(gate, /'production','active'/u);
  assert.match(gate, /rollback;/u);
});
