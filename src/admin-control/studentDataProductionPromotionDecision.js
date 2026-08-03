export const STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE = Object.freeze({
  migrationVersion: "20260803010000_govern_student_data_production_promotion_decision",
  stagingProjectRef: "gfalgonektwdylsxsgzc",
  productionProjectRefSha256: "fc9aed1322166add36f6e7b6711367c715891bff8c3e9dabf03f0e80c816a9b0",
  institutionId: "22222222-2222-4222-8222-222222222222",
  testingDataScope: "beta_demo_or_authorized_pilot_data",
});

function normalizedText(value) {
  return String(value ?? "").trim();
}

function currentCandidate(review) {
  return review?.current && typeof review.current === "object" ? review.current : null;
}

export function validateStudentDataProductionPromotionDecision(review, input = {}, now = new Date()) {
  const issues = [];
  const current = currentCandidate(review);
  const snapshot = current?.snapshot;
  const evaluatedAt = now instanceof Date ? now : new Date(now);
  const decision = normalizedText(input.decision);

  if (Number.isNaN(evaluatedAt.getTime())) throw new TypeError("Production-promotion validation time is invalid.");
  if (!current || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    issues.push("Refresh the current governed production-promotion review.");
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  if (!/^[0-9a-f]{64}$/u.test(normalizedText(current.snapshot_sha256))) {
    issues.push("The current promotion-review checksum is invalid.");
  }
  const validUntil = new Date(current.valid_until);
  if (Number.isNaN(validUntil.getTime()) || validUntil <= evaluatedAt) {
    issues.push("The current promotion-review evidence has expired.");
  }
  if (!/^[0-9a-f]{64}$/u.test(normalizedText(snapshot.preflight_snapshot_sha256))) {
    issues.push("The recorded Phase 4 preflight checksum is missing.");
  }
  if (snapshot.target_project_ref_sha256 !== STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.productionProjectRefSha256) {
    issues.push("The production target fingerprint is not the approved target.");
  }
  if (snapshot.target_environment !== "production") {
    issues.push("The promotion review must target production explicitly.");
  }
  if (snapshot.production_student_intake_enabled !== false
      || snapshot.production_action_executed !== false
      || snapshot.automatic_lifecycle_execution_enabled !== false) {
    issues.push("This decision cannot activate production or automatic lifecycle execution.");
  }
  if (snapshot.staging_beta_testing_allowed !== true || snapshot.staging_pilot_testing_allowed !== true) {
    issues.push("Beta and Pilot testing must remain available while production is held.");
  }
  if (snapshot.testing_data_scope !== STUDENT_DATA_PRODUCTION_PROMOTION_CANDIDATE.testingDataScope) {
    issues.push("The live Beta/Pilot testing-data boundary is invalid.");
  }

  if (!['hold', 'approved_for_manual_promotion'].includes(decision)) {
    issues.push("Choose HOLD or approved for a separate manual promotion.");
  }
  if (decision === "approved_for_manual_promotion" && snapshot.eligible_for_manual_promotion !== true) {
    issues.push("Production cannot be approved while lifecycle or evidence blockers remain.");
  }
  if (!/^[0-9a-f]{7,64}$/u.test(normalizedText(input.sourceCommit))) {
    issues.push("Enter the exact merged staging release commit.");
  }
  if (normalizedText(input.evidenceReference).length < 8) {
    issues.push("Enter a durable owner-decision evidence reference.");
  }
  if (normalizedText(input.rollbackReference).length < 8) {
    issues.push("Enter a durable rollback-plan reference.");
  }
  if (normalizedText(input.summary).length < 20) {
    issues.push("Summarize the decision, blockers, and promotion boundary.");
  }
  if (!input.authorityAttestation) {
    issues.push("The accountable human owner must attest to this decision.");
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildStudentDataProductionPromotionDecisionRpcPayload(
  institutionId,
  review,
  input = {},
  now = new Date(),
) {
  const validation = validateStudentDataProductionPromotionDecision(review, input, now);
  if (!validation.valid) throw new Error(validation.issues[0]);

  return {
    p_institution_id: normalizedText(institutionId),
    p_decision: normalizedText(input.decision),
    p_source_commit: normalizedText(input.sourceCommit).toLowerCase(),
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_rollback_reference: normalizedText(input.rollbackReference),
    p_summary: normalizedText(input.summary),
    p_expected_snapshot_sha256: normalizedText(review.current.snapshot_sha256).toLowerCase(),
    p_attestation: true,
  };
}
