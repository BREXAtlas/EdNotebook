const PRIVACY_RECORDS_DECISIONS = new Set(["hold", "failed", "passed"]);

export const PRIVACY_RECORDS_APPROVAL_CANDIDATE = Object.freeze({
  testedCommit: "3076110661a30f970f0e3eec7e53413aa69e548b",
  migrationVersion: "20260802230000_govern_privacy_records_lifecycle_decisions",
  stagingProjectRef: "gfalgonektwdylsxsgzc",
  region: "us-east-1",
  manifestPath: "governance/tos-staging-lifecycle-final-decisions.json",
  manifestSha256: "977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5",
  requiredDomainCount: 61,
  approvedDomainCount: 33,
  blockedDomainCount: 28,
  expirationCeiling: "2026-10-30T23:59:59.000Z",
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

function validateReviewerInput(input, issues) {
  if (normalizedText(input.reviewerName).length < 2) issues.push("Enter the accountable reviewer name.");
  if (normalizedText(input.reviewerAuthority).length < 8) issues.push("Enter the reviewer title, unit, and privacy or records authority.");
  if (normalizedText(input.evidenceReference).length < 8) issues.push("Enter a durable evidence reference.");
  if (normalizedText(input.summary).length < 20) issues.push("Summarize the decision and limitations using at least twenty characters.");
  if (!input.authorityAttestation) issues.push("The reviewer must attest to their authority for this TOS staging decision.");
}

export function validateLifecycleDecisionBatch(input = {}) {
  const issues = [];
  validateReviewerInput(input, issues);
  if (!input.lifecycleReconciliationCompleted) issues.push("Confirm that all 61 domain decisions were reconciled.");
  if (!input.calendarGuardrailsAccepted) issues.push("Accept the conservative calendar-year guardrails.");
  if (!input.ferpaOverridesAccepted) issues.push("Accept the access-request, dispute, audit, and legal-hold overrides.");
  if (!input.providerResidualsReviewed) issues.push("Confirm the provider residual-copy boundaries were reviewed.");
  if (!input.researchBoundaryAccepted) issues.push("Accept the separate consent, IRB, and research-data boundary.");
  if (!input.asuAdoptionParked) issues.push("Confirm that Angelo State adoption remains parked for authorized institutional review.");
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildLifecycleDecisionBatchRpcPayload(institutionId, manifestText, input = {}) {
  const validation = validateLifecycleDecisionBatch(input);
  if (!validation.valid) throw new Error(validation.issues[0]);
  if (normalizedText(manifestText).length < 1000) throw new Error("The complete signed lifecycle manifest is required.");

  return {
    p_institution_id: normalizedText(institutionId),
    p_manifest_text: manifestText,
    p_manifest_sha256: PRIVACY_RECORDS_APPROVAL_CANDIDATE.manifestSha256,
    p_reviewer_name: normalizedText(input.reviewerName),
    p_reviewer_authority: normalizedText(input.reviewerAuthority),
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_summary: normalizedText(input.summary),
    p_attestation: true,
  };
}

export function validatePrivacyRecordsApprovalDecision(input = {}, now = new Date()) {
  const decision = normalizedText(input.decision).toLowerCase();
  const expiration = expirationFromDate(input.expiresOn);
  const ceiling = new Date(PRIVACY_RECORDS_APPROVAL_CANDIDATE.expirationCeiling);
  const issues = [];

  if (!PRIVACY_RECORDS_DECISIONS.has(decision)) issues.push("Choose PASS, HOLD, or FAIL.");
  validateReviewerInput(input, issues);
  if (!expiration || expiration <= now) issues.push("Choose a future evidence expiration date.");
  if (expiration && expiration > ceiling) issues.push(`The decision must expire on or before ${PRIVACY_RECORDS_APPROVAL_CANDIDATE.expirationLatestDate}.`);
  if (!input.lifecycleReconciliationCompleted) issues.push("Confirm that all 61 decisions were reconciled.");
  if (!input.calendarGuardrailsAccepted) issues.push("Accept the conservative calendar-year guardrails.");
  if (!input.ferpaOverridesAccepted) issues.push("Accept the access-request, dispute, audit, and legal-hold overrides.");
  if (!input.providerResidualsReviewed) issues.push("Confirm the provider residual-copy boundaries were reviewed.");
  if (!input.researchBoundaryAccepted) issues.push("Accept the separate consent, IRB, and research-data boundary.");
  if (!input.asuAdoptionParked) issues.push("Confirm that Angelo State adoption remains parked.");

  if (decision === "passed") {
    issues.push("PASS is unavailable while 28 lifecycle domains remain explicitly blocked.");
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildPrivacyRecordsApprovalRpcPayload(institutionId, input = {}, now = new Date()) {
  const validation = validatePrivacyRecordsApprovalDecision(input, now);
  if (!validation.valid) throw new Error(validation.issues[0]);

  const candidate = PRIVACY_RECORDS_APPROVAL_CANDIDATE;
  const decision = normalizedText(input.decision).toLowerCase();
  return {
    p_institution_id: normalizedText(institutionId),
    p_gate_key: "privacyRecordsApproval",
    p_status: decision,
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_summary: normalizedText(input.summary),
    p_tested_commit: candidate.testedCommit,
    p_migration_version: candidate.migrationVersion,
    p_environment_reference: `supabase:${candidate.stagingProjectRef};github:BREXAtlas/EdNotebook;branch:staging`,
    p_region: candidate.region,
    p_evidence_summary: {
      decision,
      reviewer_name: normalizedText(input.reviewerName),
      reviewer_title_unit_and_authority: normalizedText(input.reviewerAuthority),
      reviewer_authority_attested: true,
      manifest_sha256: candidate.manifestSha256,
      lifecycle_domain_count: candidate.requiredDomainCount,
      recorded_lifecycle_domain_count: candidate.requiredDomainCount,
      approved_lifecycle_domain_count: candidate.approvedDomainCount,
      blocked_lifecycle_domain_count: candidate.blockedDomainCount,
      lifecycle_reconciliation_completed: true,
      calendar_guardrails_accepted: true,
      ferpa_access_dispute_audit_and_hold_overrides_accepted: true,
      provider_residual_copies_reviewed: true,
      research_and_irb_boundary_accepted: true,
      asu_institutional_adoption_parked: true,
      automatic_lifecycle_execution_enabled: false,
      staging_project_ref: candidate.stagingProjectRef,
      environment_scope: "staging",
      synthetic_only: true,
      production_project_touched: false,
      production_student_intake_enabled: false,
      production_action_executed: false,
    },
    p_expires_at: expirationFromDate(input.expiresOn).toISOString(),
    p_attestation: true,
  };
}
