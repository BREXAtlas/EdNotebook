const ACCESSIBILITY_DECISIONS = new Set(["passed", "hold", "failed"]);

export const ACCESSIBILITY_APPROVAL_CANDIDATE = Object.freeze({
  testedCommit: "04927a1a6a286aeee0c0c6b273325521f1754727",
  evidencePacketCommit: "e5ca08749a7621ce6cc59df0530d4ef7e13f5e53",
  migrationVersion: "20260802210945_govern_security_approval_decision",
  stagingProjectRef: "gfalgonektwdylsxsgzc",
  region: "us-east-1",
  evidencePacket: "github:BREXAtlas/EdNotebook;commit:e5ca08749a7621ce6cc59df0530d4ef7e13f5e53;path:docs/ACCESSIBILITY_APPROVAL_EVIDENCE_PACKET.md",
  protectedValidationRunId: "30767094365",
  deploymentRunId: "30767158381",
  expirationCeiling: "2026-10-31T06:03:42.411698Z",
  expirationLatestDate: "2026-10-30",
});

function normalizedText(value) {
  return String(value ?? "").trim();
}

function expirationFromDate(value) {
  const normalized = normalizedText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return null;
  const expiration = new Date(`${normalized}T23:59:59.000Z`);
  return Number.isNaN(expiration.getTime()) ? null : expiration;
}

export function validateAccessibilityApprovalDecision(input = {}, now = new Date()) {
  const decision = normalizedText(input.decision).toLowerCase();
  const expiration = expirationFromDate(input.expiresOn);
  const ceiling = new Date(ACCESSIBILITY_APPROVAL_CANDIDATE.expirationCeiling);
  const issues = [];

  if (!ACCESSIBILITY_DECISIONS.has(decision)) issues.push("Choose PASS, HOLD, or FAIL.");
  if (normalizedText(input.reviewerName).length < 2) issues.push("Enter the accountable reviewer name.");
  if (normalizedText(input.reviewerAuthority).length < 8) issues.push("Enter the reviewer title, unit, and accessibility authority.");
  if (normalizedText(input.evidenceReference).length < 8) issues.push("Enter a durable evidence reference.");
  if (normalizedText(input.summary).length < 20) issues.push("Summarize the review and its limitations using at least twenty characters.");
  if (!expiration || expiration <= now) issues.push("Choose a future evidence expiration date.");
  if (expiration && expiration > ceiling) issues.push(`The decision must expire on or before ${ACCESSIBILITY_APPROVAL_CANDIDATE.expirationLatestDate}.`);
  if (!input.authorityAttestation) issues.push("The reviewer must attest to their accessibility authority.");

  if (decision === "passed") {
    if (!input.completeProcessReviewCompleted) issues.push("PASS requires complete-process manual review.");
    if (!input.keyboardAndAssistiveTechnologyReviewed) issues.push("PASS requires keyboard and assistive-technology review.");
    if (!input.visualAndResponsiveReviewed) issues.push("PASS requires visual, zoom, reflow, and responsive review.");
    if (!input.mediaAndContentReviewed) issues.push("PASS requires media and content-alternative review.");
    if (!input.remediationOwnershipAccepted) issues.push("PASS requires named remediation ownership and retest dates.");
    if (!input.thirdPartyBoundaryAccepted) issues.push("PASS requires acceptance of the content-authoring and third-party boundary.");
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildAccessibilityApprovalRpcPayload(institutionId, input = {}, now = new Date()) {
  const validation = validateAccessibilityApprovalDecision(input, now);
  if (!validation.valid) throw new Error(validation.issues[0]);

  const decision = normalizedText(input.decision).toLowerCase();
  const reviewerName = normalizedText(input.reviewerName);
  const reviewerAuthority = normalizedText(input.reviewerAuthority);
  const evidenceReference = normalizedText(input.evidenceReference);
  const summary = normalizedText(input.summary);
  const expiresAt = expirationFromDate(input.expiresOn).toISOString();
  const candidate = ACCESSIBILITY_APPROVAL_CANDIDATE;

  return {
    p_institution_id: normalizedText(institutionId),
    p_gate_key: "accessibilityApproval",
    p_status: decision,
    p_evidence_reference: evidenceReference,
    p_summary: summary,
    p_tested_commit: candidate.testedCommit,
    p_migration_version: candidate.migrationVersion,
    p_environment_reference: `supabase:${candidate.stagingProjectRef};github:BREXAtlas/EdNotebook;branch:staging`,
    p_region: candidate.region,
    p_evidence_summary: {
      decision,
      reviewer_name: reviewerName,
      reviewer_title_and_accessibility_authority: reviewerAuthority,
      reviewer_authority_attested: true,
      complete_process_review_completed: Boolean(input.completeProcessReviewCompleted),
      keyboard_and_assistive_technology_reviewed: Boolean(input.keyboardAndAssistiveTechnologyReviewed),
      visual_and_responsive_reviewed: Boolean(input.visualAndResponsiveReviewed),
      media_and_content_reviewed: Boolean(input.mediaAndContentReviewed),
      remediation_ownership_accepted: Boolean(input.remediationOwnershipAccepted),
      third_party_boundary_accepted: Boolean(input.thirdPartyBoundaryAccepted),
      automated_checks_only: false,
      conformance_claim_made: false,
      accessibility_target: "WCAG 2.2 Level A and AA internal target; applicable institutional requirements reviewed separately",
      candidate_merge_commit: candidate.testedCommit,
      evidence_packet_commit: candidate.evidencePacketCommit,
      hosted_migration: candidate.migrationVersion,
      technical_evidence_packet: candidate.evidencePacket,
      protected_validation_run_id: candidate.protectedValidationRunId,
      deployment_run_id: candidate.deploymentRunId,
      staging_project_ref: candidate.stagingProjectRef,
      environment_scope: "staging",
      synthetic_only: true,
      production_project_touched: false,
      production_student_intake_enabled: false,
      production_action_executed: false,
      asu_blackboard_items_parked: true,
    },
    p_expires_at: expiresAt,
    p_attestation: true,
  };
}
