import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ACCESSIBILITY_APPROVAL_CANDIDATE,
  buildAccessibilityApprovalRpcPayload,
  validateAccessibilityApprovalDecision,
} from "./accessibilityApprovalDecision.js";

test("the accessibility packet remains a human-owned, fail-closed staging decision", async () => {
  const packet = await readFile(new URL("../../docs/ACCESSIBILITY_APPROVAL_EVIDENCE_PACKET.md", import.meta.url), "utf8");

  assert.match(packet, /Status: \*\*AWAITING ACCOUNTABLE ACCESSIBILITY REVIEW — HOLD\*\*/u);
  assert.match(packet, /accessibilityApproval/u);
  assert.match(packet, /04927a1a6a286aeee0c0c6b273325521f1754727/u);
  assert.match(packet, /gfalgonektwdylsxsgzc/u);
  assert.match(packet, /didwxihufueqbpfnfdmm/u);
  assert.match(packet, /WCAG 2\.2 Level A and AA/u);
  assert.match(packet, /combination of manual and automated methods/iu);
  assert.match(packet, /high-contrast appearance as only `built_in_part`/u);
  assert.match(packet, /accessibility reporting as `planned`/u);
  assert.match(packet, /Production student intake remains disabled/u);
  assert.match(packet, /does not yet support a complete-product conformance claim/u);
});

test("accessibilityApproval validation rejects automated-only or incomplete PASS decisions", () => {
  const now = new Date("2026-08-02T21:20:00.000Z");
  const incompletePass = validateAccessibilityApprovalDecision({
    decision: "passed",
    reviewerName: "Accessibility Reviewer",
    reviewerAuthority: "Accessibility Coordinator, Academic Affairs",
    evidenceReference: "institution-ticket:A11Y-110",
    summary: "Reviewed the exact governed staging candidate and packet.",
    expiresOn: ACCESSIBILITY_APPROVAL_CANDIDATE.expirationLatestDate,
    authorityAttestation: true,
  }, now);

  assert.equal(incompletePass.valid, false);
  assert.ok(incompletePass.issues.some((issue) => /complete-process/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /assistive-technology/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /visual/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /media/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /remediation/u.test(issue)));
  assert.ok(incompletePass.issues.some((issue) => /third-party/u.test(issue)));
});

test("accessibilityApproval payload binds the exact staging candidate and cannot claim conformance", () => {
  const now = new Date("2026-08-02T21:20:00.000Z");
  const payload = buildAccessibilityApprovalRpcPayload("22222222-2222-4222-8222-222222222222", {
    decision: "passed",
    reviewerName: "Accessibility Reviewer",
    reviewerAuthority: "Accessibility Coordinator, Academic Affairs",
    evidenceReference: "institution-ticket:A11Y-110",
    summary: "Completed the required manual reviews and accepted the documented remediation and content boundaries.",
    expiresOn: ACCESSIBILITY_APPROVAL_CANDIDATE.expirationLatestDate,
    authorityAttestation: true,
    completeProcessReviewCompleted: true,
    keyboardAndAssistiveTechnologyReviewed: true,
    visualAndResponsiveReviewed: true,
    mediaAndContentReviewed: true,
    remediationOwnershipAccepted: true,
    thirdPartyBoundaryAccepted: true,
  }, now);

  assert.equal(payload.p_gate_key, "accessibilityApproval");
  assert.equal(payload.p_status, "passed");
  assert.equal(payload.p_tested_commit, "04927a1a6a286aeee0c0c6b273325521f1754727");
  assert.equal(payload.p_migration_version, "20260802210945_govern_security_approval_decision");
  assert.equal(payload.p_evidence_summary.evidence_packet_commit, "e5ca08749a7621ce6cc59df0530d4ef7e13f5e53");
  assert.equal(payload.p_evidence_summary.environment_scope, "staging");
  assert.equal(payload.p_evidence_summary.automated_checks_only, false);
  assert.equal(payload.p_evidence_summary.conformance_claim_made, false);
  assert.equal(payload.p_evidence_summary.production_project_touched, false);
  assert.equal(payload.p_evidence_summary.production_student_intake_enabled, false);
  assert.equal(payload.p_attestation, true);
  assert.ok(new Date(payload.p_expires_at) <= new Date(ACCESSIBILITY_APPROVAL_CANDIDATE.expirationCeiling));
});

test("the on-platform accessibility decision path requires oversight membership and manual evidence", async () => {
  const [migration, service, controlCenter] = await Promise.all([
    readFile(new URL("../../supabase/migrations/20260802213547_govern_accessibility_approval_decision.sql", import.meta.url), "utf8"),
    readFile(new URL("./adminControlService.js", import.meta.url), "utf8"),
    readFile(new URL("./AdminControlCenter.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /set search_path=''/u);
  assert.match(migration, /membership\.role in \('owner','admin','security','records'\)/u);
  assert.match(migration, /Platform ownership alone is insufficient/iu);
  assert.match(migration, /Accessibility decision expiry exceeds the underlying evidence ceiling/u);
  assert.match(migration, /PASS requires complete-process, assistive-technology, visual, media, remediation, and third-party review/u);
  assert.match(migration, /production_student_intake_enabled/u);
  assert.match(migration, /grant execute[\s\S]+to authenticated/iu);
  assert.doesNotMatch(migration, /grant execute[\s\S]+to anon/iu);
  assert.match(service, /recordAccessibilityApprovalDecision/u);
  assert.match(service, /record_student_data_intake_evidence/u);
  assert.match(controlCenter, /Accountable accessibility decision/u);
  assert.match(controlCenter, /Automated checks alone are insufficient/u);
  assert.match(controlCenter, /Production intake remains disabled/u);
});
