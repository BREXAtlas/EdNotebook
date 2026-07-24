export const TOS_EDNOTEBOOK_CONTRACT_VERSION = "tos.ednotebook.integration/1.0.0";

const SYNTHETIC_SCOPE = Object.freeze({
  tenantId: "tenant.synthetic.ednotebook-pilot",
  institutionId: "institution.synthetic.example-university",
  productId: "ednotebook",
  environment: "simulation",
  dataClass: "synthetic",
});

export const TOS_CONTROL_CENTER_URL =
  "https://brexatlas.github.io/TOS-Platform/control-center/ednotebook/operations/";

export function createSyntheticCloseoutManifest(
  generatedAt = new Date().toISOString(),
) {
  return Object.freeze({
    contractVersion: TOS_EDNOTEBOOK_CONTRACT_VERSION,
    id: "closeout.synthetic.edld-5310.fall-2026",
    version: "1.0.0",
    scope: SYNTHETIC_SCOPE,
    courseReference: "course.synthetic.edld-5310",
    courseLabel: "EDLD 5310 · Fall 2026 (synthetic)",
    sourceSystem: "ednotebook_synthetic_fixture",
    targetSystem: "blackboard_synthetic_fixture",
    recordCounts: Object.freeze({
      learners: 24,
      enrollments: 24,
      drops: 2,
      finalizedGrades: 22,
    }),
    containsDirectIdentifiers: false,
    containsRawGrades: false,
    containsCredentials: false,
    humanConfirmationRequired: true,
    institutionApprovalRequired: true,
    officialRecordTransfer: false,
    generatedAt,
  });
}

export function validateSyntheticCloseoutManifest(manifest) {
  const errors = [];
  if (manifest?.contractVersion !== TOS_EDNOTEBOOK_CONTRACT_VERSION)
    errors.push("contract_version");
  if (manifest?.scope?.environment !== "simulation") errors.push("environment");
  if (manifest?.scope?.dataClass !== "synthetic") errors.push("data_class");
  if (manifest?.scope?.productId !== "ednotebook") errors.push("product");
  if (manifest?.containsDirectIdentifiers !== false)
    errors.push("direct_identifiers");
  if (manifest?.containsRawGrades !== false) errors.push("raw_grades");
  if (manifest?.containsCredentials !== false) errors.push("credentials");
  if (manifest?.officialRecordTransfer !== false)
    errors.push("official_record_transfer");
  const counts = manifest?.recordCounts;
  if (
    !counts ||
    counts.enrollments - counts.drops !== counts.finalizedGrades
  )
    errors.push("enrollment_balance");
  return Object.freeze({
    allowed: errors.length === 0,
    errors: Object.freeze(errors),
    trustedExchangePerformed: false,
    persisted: false,
  });
}

export function createSafeTosContextPreview() {
  return Object.freeze({
    contractVersion: TOS_EDNOTEBOOK_CONTRACT_VERSION,
    contextType: "synthetic_operations_preview",
    productId: "ednotebook",
    institutionReference: SYNTHETIC_SCOPE.institutionId,
    containsAuthToken: false,
    containsPersonalData: false,
    containsEducationRecords: false,
    exchangeMode: "not_connected",
  });
}
