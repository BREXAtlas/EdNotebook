import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import {
  SECURITY_APPROVAL_CANDIDATE,
  buildSecurityApprovalRpcPayload,
  validateSecurityApprovalDecision,
} from "./securityApprovalDecision.js";

const workflowDirectory = new URL("../../.github/workflows/", import.meta.url);

test("every external GitHub Action is pinned to an immutable commit", async () => {
  const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/u.test(name));
  const references = [];

  for (const workflowName of workflowNames) {
    const workflow = await readFile(new URL(workflowName, workflowDirectory), "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(\S+))?\s*$/gmu)) {
      if (!match[1].startsWith("./")) references.push({ workflowName, reference: match[1], release: match[2] });
    }
  }

  assert.ok(references.length > 0);
  for (const { workflowName, reference, release } of references) {
    assert.match(reference, /^[^@]+@[0-9a-f]{40}$/u, `${workflowName}: ${reference}`);
    assert.match(release || "", /^v\d+(?:\.\d+){0,2}$/u, `${workflowName}: ${reference} needs a readable release comment`);
  }
});

test("the security packet remains a human-owned, fail-closed staging decision", async () => {
  const [packet, libraryGate] = await Promise.all([
    readFile(new URL("../../docs/SECURITY_APPROVAL_EVIDENCE_PACKET.md", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/tests/alex_morrison_library_gate.sql", import.meta.url), "utf8"),
  ]);

  assert.match(packet, /Status: \*\*AWAITING ACCOUNTABLE SECURITY REVIEW — HOLD\*\*/u);
  assert.match(packet, /gfalgonektwdylsxsgzc/u);
  assert.match(packet, /didwxihufueqbpfnfdmm/u);
  assert.match(packet, /production student intake remains disabled/iu);
  assert.match(packet, /103 `WARN` findings/u);
  assert.match(packet, /102 authenticated SECURITY DEFINER RPCs/u);
  assert.match(packet, /list_alex_morrison_catalog\(text\)/u);
  assert.match(packet, /0 of 161 dependencies/u);
  assert.match(packet, /securityApproval/u);
  assert.match(packet, /must not be inferred from a merge/u);
  assert.match(libraryGate, /Commercial review metadata leaked to another signed-in account/u);
  assert.match(libraryGate, /Commercial review preview was missing for its owner/u);
});

test("securityApproval decision validation fails closed and binds the exact candidate", () => {
  const now = new Date("2026-08-02T20:50:00.000Z");
  const incompletePass = validateSecurityApprovalDecision({
    decision: "passed",
    reviewerName: "Security Reviewer",
    reviewerAuthority: "Information Security Officer",
    evidenceReference: "institution-ticket:SEC-108",
    summary: "Reviewed the exact governed staging candidate and packet.",
    expiresOn: SECURITY_APPROVAL_CANDIDATE.expirationLatestDate,
    authorityAttestation: true,
  }, now);

  assert.equal(incompletePass.valid, false);
  assert.ok(incompletePass.issues.some((issue) => /independent review/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /residual risks/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /incident boundary/u.test(issue)));

  const payload = buildSecurityApprovalRpcPayload("22222222-2222-4222-8222-222222222222", {
    decision: "passed",
    reviewerName: "Security Reviewer",
    reviewerAuthority: "Information Security Officer, Security Office",
    evidenceReference: "institution-ticket:SEC-108",
    summary: "Reviewed the exact staging candidate and accepted the documented time-bounded security boundary.",
    expiresOn: SECURITY_APPROVAL_CANDIDATE.expirationLatestDate,
    authorityAttestation: true,
    independentReviewCompleted: true,
    residualRisksAccepted: true,
    incidentBoundaryAccepted: true,
  }, now);

  assert.equal(payload.p_gate_key, "securityApproval");
  assert.equal(payload.p_status, "passed");
  assert.equal(payload.p_tested_commit, "5f0296824ab884eaa022d02ac86ae9247d5f03ec");
  assert.equal(payload.p_migration_version, "20260802202056_scope_catalog_review_previews");
  assert.equal(payload.p_evidence_summary.environment_scope, "staging");
  assert.equal(payload.p_evidence_summary.staging_project_ref, "gfalgonektwdylsxsgzc");
  assert.equal(payload.p_evidence_summary.production_project_touched, false);
  assert.equal(payload.p_evidence_summary.production_student_intake_enabled, false);
  assert.equal(payload.p_attestation, true);
  assert.ok(new Date(payload.p_expires_at) <= new Date(SECURITY_APPROVAL_CANDIDATE.expirationCeiling));
});

test("the on-platform security decision path requires independent security membership", async () => {
  const [migration, service, controlCenter] = await Promise.all([
    readFile(new URL("../../supabase/migrations/20260802204824_govern_security_approval_decision.sql", import.meta.url), "utf8"),
    readFile(new URL("./adminControlService.js", import.meta.url), "utf8"),
    readFile(new URL("./AdminControlCenter.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /set search_path=''/u);
  assert.match(migration, /membership\.role='security'/u);
  assert.match(migration, /platform-owner[\s\S]+insufficient/iu);
  assert.match(migration, /Security decision expiry exceeds the underlying evidence ceiling/u);
  assert.match(migration, /production_student_intake_enabled/u);
  assert.match(migration, /grant execute[\s\S]+to authenticated/iu);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon/iu);
  assert.match(service, /recordSecurityApprovalDecision/u);
  assert.match(service, /record_student_data_intake_evidence/u);
  assert.match(controlCenter, /Accountable security decision/u);
  assert.match(controlCenter, /Platform ownership alone is not sufficient/u);
  assert.match(controlCenter, /Production intake remains disabled/u);
});
