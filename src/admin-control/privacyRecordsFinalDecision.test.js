import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  PRIVACY_RECORDS_APPROVAL_CANDIDATE,
  buildLifecycleDecisionBatchRpcPayload,
  buildPrivacyRecordsApprovalRpcPayload,
  validateLifecycleDecisionBatch,
  validatePrivacyRecordsApprovalDecision,
} from "./privacyRecordsApprovalDecision.js";

const completeReview = Object.freeze({
  reviewerName: "TOS Records Reviewer",
  reviewerAuthority: "TOS Platform Owner and Records Reviewer",
  evidenceReference: "governance:privacy-records-final",
  summary: "Reviewed all 61 decisions and preserved the blocked domains, institutional boundary, and production HOLD.",
  authorityAttestation: true,
  lifecycleReconciliationCompleted: true,
  calendarGuardrailsAccepted: true,
  ferpaOverridesAccepted: true,
  providerResidualsReviewed: true,
  researchBoundaryAccepted: true,
  asuAdoptionParked: true,
});

test("the signed TOS staging manifest decides all 61 domains as 33 approved and 28 blocked", async () => {
  const source = await readFile(new URL("../../public/governance/tos-staging-lifecycle-final-decisions.json", import.meta.url), "utf8");
  const manifest = JSON.parse(source);
  const hash = createHash("sha256").update(source).digest("hex");
  const keys = manifest.policies.map((policy) => policy.domain_key);

  assert.equal(hash, PRIVACY_RECORDS_APPROVAL_CANDIDATE.manifestSha256);
  assert.equal(manifest.scope, "tos_synthetic_staging_baseline");
  assert.equal(manifest.decision_status, "all_domains_decided_privacy_records_hold");
  assert.equal(manifest.policies.length, 61);
  assert.equal(new Set(keys).size, 61);
  assert.equal(manifest.policies.filter((policy) => policy.status === "approved").length, 33);
  assert.equal(manifest.policies.filter((policy) => policy.status === "blocked").length, 28);
  assert.deepEqual(manifest.calendar_guardrail_days, {
    365: 366, 730: 731, 1095: 1096, 1460: 1461, 1825: 1827, 3650: 3653,
  });
  assert.ok(manifest.policies.filter((policy) => policy.status === "approved").every((policy) => policy.disposition !== "block"));
  assert.ok(manifest.policies.filter((policy) => policy.status === "blocked").every((policy) => policy.disposition === "block" && policy.retention_days === null));
  assert.ok(manifest.policies.every((policy) => policy.automatic_execution_enabled === false));
  assert.equal(manifest.asu_institutional_adoption, "parked_pending_authorized_review");
  assert.equal(manifest.production_student_intake_enabled, false);
  assert.equal(manifest.production_project_touched, false);
  assert.equal(manifest.contains_student_data, false);
});

test("the lifecycle batch requires every human review boundary and binds the raw signed manifest", async () => {
  const source = await readFile(new URL("../../public/governance/tos-staging-lifecycle-final-decisions.json", import.meta.url), "utf8");
  const incomplete = validateLifecycleDecisionBatch({ ...completeReview, asuAdoptionParked: false });
  assert.equal(incomplete.valid, false);
  assert.match(incomplete.issues[0], /Angelo State/u);

  const payload = buildLifecycleDecisionBatchRpcPayload("22222222-2222-4222-8222-222222222222", source, completeReview);
  assert.equal(payload.p_manifest_text, source);
  assert.equal(payload.p_manifest_sha256, PRIVACY_RECORDS_APPROVAL_CANDIDATE.manifestSha256);
  assert.equal(payload.p_attestation, true);
});

test("privacyRecordsApproval remains HOLD and cannot falsely pass with 28 blocked domains", () => {
  const now = new Date("2026-08-02T20:00:00.000Z");
  const hold = {
    ...completeReview,
    decision: "hold",
    expiresOn: PRIVACY_RECORDS_APPROVAL_CANDIDATE.expirationLatestDate,
  };
  assert.equal(validatePrivacyRecordsApprovalDecision(hold, now).valid, true);
  const pass = validatePrivacyRecordsApprovalDecision({ ...hold, decision: "passed" }, now);
  assert.equal(pass.valid, false);
  assert.ok(pass.issues.some((issue) => /28 lifecycle domains/u.test(issue)));

  const payload = buildPrivacyRecordsApprovalRpcPayload("22222222-2222-4222-8222-222222222222", hold, now);
  assert.equal(payload.p_gate_key, "privacyRecordsApproval");
  assert.equal(payload.p_status, "hold");
  assert.equal(payload.p_tested_commit, "3076110661a30f970f0e3eec7e53413aa69e548b");
  assert.equal(payload.p_migration_version, "20260802230000_govern_privacy_records_lifecycle_decisions");
  assert.equal(payload.p_evidence_summary.recorded_lifecycle_domain_count, 61);
  assert.equal(payload.p_evidence_summary.approved_lifecycle_domain_count, 33);
  assert.equal(payload.p_evidence_summary.blocked_lifecycle_domain_count, 28);
  assert.equal(payload.p_evidence_summary.asu_institutional_adoption_parked, true);
  assert.equal(payload.p_evidence_summary.automatic_lifecycle_execution_enabled, false);
  assert.equal(payload.p_evidence_summary.production_student_intake_enabled, false);
});

test("database and control-center paths enforce the exact fail-closed staging contract", async () => {
  const [migration, service, controlCenter, packet, sqlGate] = await Promise.all([
    readFile(new URL("../../supabase/migrations/20260802230000_govern_privacy_records_lifecycle_decisions.sql", import.meta.url), "utf8"),
    readFile(new URL("./adminControlService.js", import.meta.url), "utf8"),
    readFile(new URL("./AdminControlCenter.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../docs/PRIVACY_RECORDS_TOS_STAGING_DECISION_PACKET.md", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/tests/privacy_records_lifecycle_decisions.sql", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /set search_path=''/u);
  assert.match(migration, /extensions\.digest/u);
  assert.match(migration, /exactly 33 approved and 28 blocked/u);
  assert.match(migration, /An approved lifecycle policy cannot use the block disposition/u);
  assert.match(migration, /Privacy\/records PASS requires all 61 lifecycle domains approved and none blocked/u);
  assert.match(migration, /revoke all[\s\S]+from public,anon/iu);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon/iu);
  assert.match(service, /recordTosStagingLifecycleDecisionBatch/u);
  assert.match(service, /recordPrivacyRecordsApprovalDecision/u);
  assert.match(controlCenter, /Record all 61 lifecycle decisions/u);
  assert.match(controlCenter, /PASS — unavailable while domains are blocked/u);
  assert.match(packet, /61 OF 61 DOMAINS DECIDED — PRIVACY\/RECORDS HOLD/u);
  assert.match(packet, /not legal advice/u);
  assert.match(sqlGate, /Idempotent replay created duplicate lifecycle versions/u);
  assert.match(sqlGate, /Privacy\/records PASS was accepted with blocked domains/u);
});
