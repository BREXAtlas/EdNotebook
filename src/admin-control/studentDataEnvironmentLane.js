const DATA_LANES = new Set(["beta", "pilot"]);
const LANE_STATUSES = new Set(["active", "retired"]);
const LANE_SCOPES = new Set(["institution", "course", "account"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function normalizedText(value) {
  return String(value ?? "").trim();
}
export function validateStudentDataEnvironmentLane(institutionId, input = {}) {
  const issues = [];
  const normalizedInstitutionId = normalizedText(institutionId);
  const scopeType = normalizedText(input.scopeType).toLowerCase();
  const scopeId = scopeType === "institution"
    ? normalizedInstitutionId
    : normalizedText(input.scopeId);

  if (!UUID_PATTERN.test(normalizedInstitutionId)) issues.push("A valid institution is required.");
  if (!LANE_SCOPES.has(scopeType)) issues.push("Choose an institution, course, or account scope.");
  if (!UUID_PATTERN.test(scopeId)) issues.push("Enter the exact course or account ID for this lane.");
  if (!DATA_LANES.has(normalizedText(input.dataLane).toLowerCase())) {
    issues.push("Staging lanes may be Beta or Pilot; Production is assigned only through production promotion.");
  }
  if (!LANE_STATUSES.has(normalizedText(input.status).toLowerCase())) issues.push("Choose Active or Retired.");
  if (normalizedText(input.purpose).length < 20) issues.push("Describe who is testing and what this lane is for.");
  if (normalizedText(input.evidenceReference).length < 8) issues.push("Enter a durable lane evidence reference.");
  if (!input.authorityAttestation) issues.push("An authorized human must attest to the lane assignment.");

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function buildStudentDataEnvironmentLaneRpcPayload(institutionId, input = {}) {
  const validation = validateStudentDataEnvironmentLane(institutionId, input);
  if (!validation.valid) throw new Error(validation.issues[0]);

  const scopeType = normalizedText(input.scopeType).toLowerCase();
  return {
    p_institution_id: normalizedText(institutionId),
    p_scope_type: scopeType,
    p_scope_id: scopeType === "institution" ? normalizedText(institutionId) : normalizedText(input.scopeId),
    p_data_lane: normalizedText(input.dataLane).toLowerCase(),
    p_status: normalizedText(input.status).toLowerCase(),
    p_purpose: normalizedText(input.purpose),
    p_evidence_reference: normalizedText(input.evidenceReference),
    p_attestation: true,
  };
}
