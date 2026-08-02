const SECURITY_DECISIONS = new Set(["passed", "hold", "failed"]);

export const SECURITY_APPROVAL_CANDIDATE = Object.freeze({
  testedCommit: "5f0296824ab884eaa022d02ac86ae9247d5f03ec",
  evidencePacketCommit: "55a1484122ff50aeefdb1e9cfecad3237d09bcb4",
  migrationVersion: "20260802202056_scope_catalog_review_previews",
  stagingProjectRef: "gfalgonektwdylsxsgzc",
  region: "us-east-1",
  evidencePacket: "github:BREXAtlas/EdNotebook#108;path:docs/SECURITY_APPROVAL_EVIDENCE_PACKET.md",
  protectedValidationRunId: "30765343447",
  evidencePacketValidationRunId: "30765996088",
  evidencePacketDeploymentRunId: "30766071070",
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

export function validateSecurityApprovalDecision(input = {}, now = new Date()) {
  const decision = normalizedText(input.decision).toLowerCase();
  const expiration = expirationFromDate(input.expiresOn);
  const ceiling = new Date(SECURITY_APPROVAL_CANDIDATE.expirationCeiling);
  const issues = [];

  if (!SECURITY_DECISIONS.has(decision)) issues.push("Choose PASS, HOLD, or FAIL.");
  if (normalizedText(input.reviewerName).length < 2) issues.push("Enter the accountable reviewer name.");
  if (normalizedText(input.reviewerAuthority).length < 8) issues.push("Enter the reviewer title, unit, and security authority.");
  if (normalizedText(input.evidenceReference).length < 8) issues.push("Enter a durable evidence reference.");
  if (normalizedText(input.summary).length < 20) issues.push("Summarize the review and its limitations using at least twenty characters.");
  if (!expiration || expiration <= now) issues.push("Choose a future evidence expiration date.");
  if (expiration && expiration > ceiling) issues.push(`The decision must expire on or before ${SECURITY_APPROVAL_CANDIDATE.expirationLatestDate}.`);
  if (!input.authorityAttestation) issues.push("The reviewer must attest to their security authority.");

  if (decision === "passed") {
    if (!input.independentReviewCompleted) issues.push("PASS requires an independent review confirmation.");
    if (!input.residualRisksAccepted) issues.push("PASS requires acceptance of the documented residual risks.");
    if (!input.incidentBoundaryAccepted) issues.push("PASS requires acceptance of the rollback and incident boundary.");
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildSecurityApprovalRpcPayload(institutionId, input = {}, now = new Date()) {
  const validation = validateSecurityApprovalDecision(input, now);
  if (!validation.valid) throw new Error(validation.issues[0]);

  const decision = normalizedText(input.decision).toLowerCase();
  const reviewerName = normalizedText(input.reviewerName);
  const reviewerAuthority = normalizedText(input.reviewerAuthority);
  const evidenceReference = normalizedText(input.evidenceReference);
  const summary = normalizedText(input.summary);
  const expiresAt = expirationFromDate(input.expiresOn).toISOString();
  const candidate = SECURITY_APPROVAL_CANDIDATE;

  return {
    p_institution_id: normalizedText(institutionId),
    p_gate_key: "securityApproval",
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
      reviewer_title_and_security_authority: reviewerAuthority,
      reviewer_authority_attested: true,
      independent_review_completed: Boolean(input.independentReviewCompleted),
      residual_risks_accepted: Boolean(input.residualRisksAccepted),
      incident_boundary_accepted: Boolean(input.incidentBoundaryAccepted),
      candidate_merge_commit: candidate.testedCommit,
      evidence_packet_merge_commit: candidate.evidencePacketCommit,
      hosted_migration: candidate.migrationVersion,
      technical_evidence_packet: candidate.evidencePacket,
      protected_validation_run_id: candidate.protectedValidationRunId,
      evidence_packet_validation_run_id: candidate.evidencePacketValidationRunId,
      evidence_packet_deployment_run_id: candidate.evidencePacketDeploymentRunId,
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
