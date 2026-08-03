const LIVE_OPERATING_LANES = new Set(["beta", "pilot"]);

function normalizedText(value) {
  return String(value ?? "").trim();
}

export function validateLiveServiceOperatingLane(input = {}) {
  const issues = [];
  if (!LIVE_OPERATING_LANES.has(normalizedText(input.operatingLane).toLowerCase())) {
    issues.push("Choose Beta or Pilot. Unlabeled Production requires the protected production-promotion workflow.");
  }
  if (!/^[0-9a-f]{7,64}$/u.test(normalizedText(input.sourceCommit).toLowerCase())) {
    issues.push("Enter the exact merged release commit.");
  }
  if (normalizedText(input.purpose).length < 20) {
    issues.push("Describe the authorized live testing group and purpose.");
  }
  if (normalizedText(input.evidenceReference).length < 8) {
    issues.push("Enter a durable live-lane evidence reference.");
  }
  if (!input.authorityAttestation) {
    issues.push("The accountable platform owner must attest to the live-lane transition.");
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildLiveServiceOperatingLaneRpcPayload(input = {}) {
  const validation = validateLiveServiceOperatingLane(input);
  if (!validation.valid) throw new Error(validation.issues[0]);
  return {
    p_operating_lane: normalizedText(input.operatingLane).toLowerCase(),
    p_source_commit: normalizedText(input.sourceCommit).toLowerCase(),
    p_purpose: normalizedText(input.purpose),
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_attestation: true,
  };
}
