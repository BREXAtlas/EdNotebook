import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE,
  buildStudentDataProductionPromotionDecisionRpcPayload,
  validateStudentDataProductionPromotionDecision,
} from "./studentDataProductionPromotionDecision.js";

const NOW = new Date("2026-08-03T01:30:00.000Z");
const SOURCE_COMMIT = "bdc916792804df46c965595436ecff4bcc77312b";
const SNAPSHOT_SHA256 = "b".repeat(64);
const PREFLIGHT_SHA256 = "a".repeat(64);

function fixture(overrides = {}) {
  return {
    current: {
      snapshot_sha256: SNAPSHOT_SHA256,
      valid_until: "2026-10-30T23:59:59.000Z",
      snapshot: {
        schema_version: "1.0",
        candidate_decision: "hold",
        eligible_for_manual_promotion: false,
        preflight_snapshot_sha256: PREFLIGHT_SHA256,
        target_environment: "production",
        target_project_ref_sha256: STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.productionProjectRefSha256,
        staging_beta_testing_allowed: true,
        staging_pilot_testing_allowed: true,
        testing_data_scope: STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.testingDataScope,
        production_student_intake_enabled: false,
        production_action_executed: false,
        automatic_lifecycle_execution_enabled: false,
        blockers: ["securityApproval", "privacyRecordsApproval"],
        ...overrides,
      },
    },
  };
}

function input(overrides = {}) {
  return {
    decision: "hold",
    sourceCommit: SOURCE_COMMIT,
    evidenceReference: "github:BREXAtlas/EdNotebook;pr:phase-5",
    rollbackReference: "docs:staging-deployment-rollback",
    summary: "Production remains on HOLD while Beta and Pilot remain available in staging.",
    authorityAttestation: true,
    ...overrides,
  };
}

test("the accountable owner can record a production HOLD without disabling Beta or Pilot", () => {
  assert.equal(validateStudentDataProductionPromotionDecision(fixture(), input(), NOW).valid, true);
});

test("manual promotion approval fails while blockers remain", () => {
  const result = validateStudentDataProductionPromotionDecision(
    fixture(),
    input({ decision: "approved_for_manual_promotion" }),
    NOW,
  );
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /cannot be approved/u);
});

test("the record cannot activate production or disable staging testing", () => {
  for (const field of [
    "production_student_intake_enabled",
    "production_action_executed",
    "automatic_lifecycle_execution_enabled",
  ]) {
    const result = validateStudentDataProductionPromotionDecision(fixture({ [field]: true }), input(), NOW);
    assert.equal(result.valid, false);
    assert.match(result.issues.join(" "), /cannot activate production/u);
  }
  const beta = validateStudentDataProductionPromotionDecision(fixture({ staging_beta_testing_allowed: false }), input(), NOW);
  assert.equal(beta.valid, false);
  assert.match(beta.issues.join(" "), /must remain available/u);
});

test("an eligible snapshot may authorize only a separate manual promotion", () => {
  const result = validateStudentDataProductionPromotionDecision(
    fixture({ candidate_decision: "eligible_for_human_decision", eligible_for_manual_promotion: true, blockers: [] }),
    input({ decision: "approved_for_manual_promotion" }),
    NOW,
  );
  assert.equal(result.valid, true);
});

test("the RPC payload is checksum-bound and excludes blocker bodies", () => {
  const payload = buildStudentDataProductionPromotionDecisionRpcPayload(
    STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.institutionId,
    fixture(),
    input(),
    NOW,
  );
  assert.deepEqual(payload, {
    p_institution_id: STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.institutionId,
    p_decision: "hold",
    p_source_commit: SOURCE_COMMIT,
    p_evidence_reference: "github:BREXAtlas/EdNotebook;pr:phase-5",
    p_rollback_reference: "docs:staging-deployment-rollback",
    p_summary: "Production remains on HOLD while Beta and Pilot remain available in staging.",
    p_expected_snapshot_sha256: SNAPSHOT_SHA256,
    p_attestation: true,
  });
  assert.equal(JSON.stringify(payload).includes("blockers"), false);
});

test("the migration is append-only, browser-closed, and cannot deploy production", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260803010000_govern_student_data_production_promotion_decision.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /alter table public\.student_data_production_promotion_decision_versions enable row level security/u);
  assert.match(migration, /revoke all on table public\.student_data_production_promotion_decision_versions from public,anon,authenticated/u);
  assert.match(migration, /as restrictive for all to anon,authenticated\s+using \(false\) with check \(false\)/u);
  assert.match(migration, /private\.reject_student_data_governance_mutation/u);
  assert.match(migration, /p_expected_snapshot_sha256/u);
  assert.match(migration, /approved_for_manual_promotion/u);
  assert.match(migration, /production_student_intake_enabled',false/u);
  assert.match(migration, /production_action_executed',false/u);
  assert.match(migration, /staging_beta_testing_allowed',true/u);
  assert.match(migration, /staging_pilot_testing_allowed',true/u);
  assert.doesNotMatch(migration, /alter\s+project|supabase\s+link|db\s+push|create\s+database/iu);
});
