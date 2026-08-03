export const STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE = Object.freeze({
  migrationVersion: "20260802233000_govern_student_data_promotion_preflight",
  stagingProjectRef: "gfalgonektwdylsxsgzc",
  productionProjectRef: "didwxihufueqbpfnfdmm",
  institutionId: "22222222-2222-4222-8222-222222222222",
  region: "us-east-1",
  requiredDomainCount: 61,
  requiredEvidenceGateCount: 13,
  testingDataScope: "beta_demo_or_authorized_pilot_data",
});

function normalizedText(value) {
  return String(value ?? "").trim();
}

function integer(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function currentPreflight(preflight) {
  return preflight?.current && typeof preflight.current === "object"
    ? preflight.current
    : null;
}

export function validateStudentDataPromotionPreflight(preflight, input = {}, now = new Date()) {
  const issues = [];
  const current = currentPreflight(preflight);
  const snapshot = current?.snapshot;
  const evaluatedAt = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(evaluatedAt.getTime())) throw new TypeError("Promotion-preflight validation time is invalid.");
  if (!current || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    issues.push("Refresh the current governed promotion preflight.");
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }

  if (!/^[0-9a-f]{64}$/u.test(normalizedText(current.snapshot_sha256))) {
    issues.push("The current preflight checksum is invalid.");
  }
  const validUntil = new Date(current.valid_until);
  if (Number.isNaN(validUntil.getTime()) || validUntil <= evaluatedAt) {
    issues.push("The current preflight evidence has expired.");
  }

  const domainCount = integer(snapshot.lifecycle_domain_count);
  const recordedDomainCount = integer(snapshot.recorded_lifecycle_domain_count);
  const approvedDomainCount = integer(snapshot.approved_lifecycle_domain_count);
  const blockedDomainCount = integer(snapshot.blocked_lifecycle_domain_count);
  const requiredGateCount = integer(snapshot.required_evidence_gate_count);
  const passedGateCount = integer(snapshot.passed_evidence_gate_count);
  const expectedReady = approvedDomainCount === domainCount && passedGateCount === requiredGateCount;

  if (domainCount !== STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.requiredDomainCount) {
    issues.push("The preflight must cover all 61 lifecycle domains.");
  }
  if (recordedDomainCount !== domainCount || approvedDomainCount + blockedDomainCount !== domainCount) {
    issues.push("The lifecycle decision counts do not reconcile.");
  }
  if (requiredGateCount !== STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.requiredEvidenceGateCount
      || passedGateCount < 0 || passedGateCount > requiredGateCount) {
    issues.push("The evidence-gate counts do not reconcile.");
  }
  if (Boolean(snapshot.ready_for_promotion_review) !== expectedReady
      || snapshot.decision !== (expectedReady ? "ready_for_human_promotion_review" : "hold")) {
    issues.push("The production-promotion decision does not match its blockers.");
  }

  if (snapshot.production_student_intake_enabled !== false
      || snapshot.production_action_executed !== false
      || snapshot.automatic_lifecycle_execution_enabled !== false) {
    issues.push("Production intake and automatic lifecycle execution must remain disabled.");
  }
  if (snapshot.hold_scope !== "production_promotion_only") {
    issues.push("HOLD must apply only to production promotion.");
  }
  if (snapshot.staging_beta_testing_allowed !== true || snapshot.staging_pilot_testing_allowed !== true) {
    issues.push("Bounded staging beta and pilot testing must remain allowed.");
  }
  if (snapshot.testing_data_scope !== STUDENT_DATA_PROMOTION_PREFLIGHT_CANDIDATE.testingDataScope) {
    issues.push("Staging must remain limited to Beta demonstrations or explicitly authorized Pilot data.");
  }

  if (!/^[0-9a-f]{7,64}$/u.test(normalizedText(input.sourceCommit))) {
    issues.push("Enter the exact merged staging commit.");
  }
  if (normalizedText(input.evidenceReference).length < 8) {
    issues.push("Enter a durable preflight evidence reference.");
  }
  if (normalizedText(input.summary).length < 20) {
    issues.push("Summarize the preflight outcome and remaining production blockers.");
  }
  if (!input.authorityAttestation) {
    issues.push("An authorized human must attest to the preflight snapshot.");
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildStudentDataPromotionPreflightRpcPayload(
  institutionId,
  preflight,
  input = {},
  now = new Date(),
) {
  const validation = validateStudentDataPromotionPreflight(preflight, input, now);
  if (!validation.valid) throw new Error(validation.issues[0]);

  return {
    p_institution_id: normalizedText(institutionId),
    p_source_commit: normalizedText(input.sourceCommit).toLowerCase(),
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_summary: normalizedText(input.summary),
    p_expected_snapshot_sha256: normalizedText(preflight.current.snapshot_sha256).toLowerCase(),
    p_attestation: true,
  };
}
