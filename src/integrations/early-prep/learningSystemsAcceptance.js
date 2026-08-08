import {
  LEARNING_SYSTEMS,
  INTEGRATION_MODES,
} from "../learningRecordContract.js";
import { ltiRegistrationReadiness } from "../lti/ltiContract.js";
import {
  ONEROSTER_12_RESOURCES,
  authorizeEarlyPrepGradeExport,
  prepareEarlyPrepGradeExport,
  reconcileEarlyPrepNoopGradeExport,
  schoologyLtiContract,
  stablePreviewHash,
} from "./earlyPrepLearningAdapters.js";
import { EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE } from "./syntheticDistrictPilot.js";

export const EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION = "early-prep-learning-systems-v1";

export const ONEROSTER_12_CSV_FILES = Object.freeze({
  orgs: "orgs.csv",
  academicSessions: "academicSessions.csv",
  courses: "courses.csv",
  classes: "classes.csv",
  users: "users.csv",
  enrollments: "enrollments.csv",
  lineItems: "lineItems.csv",
  results: "results.csv",
});

export const EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE = Object.freeze({
  fixtureId: "early-prep-schoology-synthetic-2026-08",
  classification: "synthetic_test_data_only",
  educationDivision: "k12",
  registration: {
    id: "synthetic-schoology-registration",
    issuer: "https://schoology.early-prep-synthetic.invalid",
    client_id: "synthetic-client-id",
    oidc_authorization_url: "https://schoology.early-prep-synthetic.invalid/oidc",
    jwks_url: "https://schoology.early-prep-synthetic.invalid/jwks",
    oauth_token_url: "https://schoology.early-prep-synthetic.invalid/oauth/token",
    status: "testing",
  },
  deployments: [{
    id: "synthetic-schoology-deployment",
    registration_id: "synthetic-schoology-registration",
    deployment_id: "synthetic-deployment-id",
    status: "testing",
    last_instructor_launch_at: "2026-08-08T20:00:00.000Z",
    last_learner_launch_at: "2026-08-08T20:05:00.000Z",
  }],
  contexts: [{
    deployment_id: "synthetic-schoology-deployment",
    lti_context_id: "synthetic-algebra-period-4",
    mapping_status: "mapped",
  }],
  rosterSync: [{
    deployment_id: "synthetic-schoology-deployment",
    status: "succeeded",
    received_count: 2,
    mapped_count: 2,
    pending_count: 0,
  }],
  deepLink: {
    targetType: "assignment",
    targetId: "synthetic-linear-equations-check",
    returnMode: "lti_deep_linking_response",
  },
  gradeSync: [{
    deployment_id: "synthetic-schoology-deployment",
    status: "succeeded",
    idempotency_key: "synthetic-schoology-ags-noop-2026-08",
    actual_write_count: 0,
  }],
  gradeExport: {
    provider: LEARNING_SYSTEMS.SCHOOLOGY,
    courseId: "33000000-0000-4000-8000-000000000020",
    idempotencyKey: "synthetic-schoology-ags-noop-2026-08",
    rows: [{
      student_id: "33000000-0000-4000-8000-000000000003",
      grade_item_id: "synthetic-linear-equations-check",
      current_score: 9,
      current_max_points: 10,
      score: 9,
      max_points: 10,
      status: "finalized",
    }],
  },
});

function isSyntheticOrigin(value) {
  try {
    return new URL(value).hostname.endsWith(".invalid");
  } catch {
    return false;
  }
}

function hasOnlySyntheticRegistrationOrigins(registration) {
  return [
    registration?.issuer,
    registration?.oidc_authorization_url,
    registration?.jwks_url,
    registration?.oauth_token_url,
  ].every(isSyntheticOrigin);
}

function assertSyntheticFixture(fixture) {
  if (fixture?.classification !== "synthetic_test_data_only" || fixture?.educationDivision !== "k12") {
    throw new Error("synthetic_early_prep_fixture_required");
  }
  const serialized = JSON.stringify(fixture);
  if (/service_role|private_key|client_secret|access_token|refresh_token|password/iu.test(serialized)) {
    throw new Error("credentials_prohibited_in_synthetic_fixture");
  }
}

export function previewOneRoster12CsvPackage(fixture = EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE) {
  const scopedFixture = {
    ...fixture,
    educationDivision: fixture.educationDivision || "k12",
  };
  assertSyntheticFixture(scopedFixture);
  const missingResources = ONEROSTER_12_RESOURCES.filter((resource) => !Array.isArray(fixture.oneRoster?.[resource]));
  const invalidResources = ONEROSTER_12_RESOURCES.filter((resource) =>
    Array.isArray(fixture.oneRoster?.[resource]) && fixture.oneRoster[resource].some((row) => !String(row?.sourcedId || "").trim()),
  );
  const preview = {
    acceptanceVersion: EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION,
    contractVersion: "OneRoster 1.2",
    educationDivision: "k12",
    provider: LEARNING_SYSTEMS.ONEROSTER,
    mode: INTEGRATION_MODES.ONEROSTER_CSV,
    classification: fixture.classification,
    files: ONEROSTER_12_RESOURCES.map((resource) => ({
      resource,
      fileName: ONEROSTER_12_CSV_FILES[resource],
      rowCount: Array.isArray(fixture.oneRoster?.[resource]) ? fixture.oneRoster[resource].length : 0,
    })),
    issues: [
      ...missingResources.map((resource) => `missing_resource:${resource}`),
      ...invalidResources.map((resource) => `missing_sourced_id:${resource}`),
    ],
    reviewStatus: "preview_ready",
    writeAuthorized: false,
  };
  return {
    ...preview,
    previewHash: stablePreviewHash(preview),
    totalRows: preview.files.reduce((sum, file) => sum + file.rowCount, 0),
  };
}

export function previewSchoologyLtiAcceptance(fixture = EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE) {
  assertSyntheticFixture(fixture);
  if (!hasOnlySyntheticRegistrationOrigins(fixture.registration)) throw new Error("synthetic_schoology_origin_required");

  const contract = schoologyLtiContract();
  const readiness = ltiRegistrationReadiness(
    fixture.registration,
    fixture.deployments,
    fixture.contexts,
    fixture.gradeSync,
  );
  const gradePreview = prepareEarlyPrepGradeExport(fixture.gradeExport);
  const approvedNoop = authorizeEarlyPrepGradeExport(gradePreview, {
    reviewedBy: "synthetic-early-prep-reviewer",
    idempotencyKey: gradePreview.idempotencyKey,
  });
  const reconciledNoop = reconcileEarlyPrepNoopGradeExport(approvedNoop, {
    reconciledBy: "synthetic-early-prep-reviewer",
    actualWriteCount: 0,
  });
  const capabilities = new Set(contract.capabilities);
  const roster = fixture.rosterSync?.[0];
  const checks = [
    { id: "oidc", label: "OIDC and LTI 1.3 contract", passed: capabilities.has("oidc-login") && capabilities.has("resource-link") },
    { id: "instructor-launch", label: "Synthetic instructor launch", passed: readiness.checks.find(([label]) => label === "Instructor launch")?.[1] === true },
    { id: "learner-launch", label: "Synthetic learner launch", passed: readiness.checks.find(([label]) => label === "Learner launch")?.[1] === true },
    { id: "context", label: "Existing class context mapping", passed: readiness.checks.find(([label]) => label === "Course context mapped")?.[1] === true },
    { id: "deep-linking", label: "Deep Linking assignment selection", passed: capabilities.has("deep-linking") && fixture.deepLink?.targetType === "assignment" && Boolean(fixture.deepLink?.targetId) },
    { id: "nrps", label: "NRPS roster reconciliation", passed: capabilities.has("nrps") && roster?.status === "succeeded" && roster.received_count === roster.mapped_count && roster.pending_count === 0 },
    { id: "ags", label: "AGS reviewed no-op grade reconciliation", passed: capabilities.has("ags") && reconciledNoop.reviewStatus === "reconciled" && reconciledNoop.reconciliation.actualWriteCount === 0 },
    { id: "credentials", label: "Credentials remain server-only", passed: contract.credentials === "server-only" },
  ];

  return {
    acceptanceVersion: EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION,
    fixtureId: fixture.fixtureId,
    classification: fixture.classification,
    educationDivision: "k12",
    provider: LEARNING_SYSTEMS.SCHOOLOGY,
    mode: INTEGRATION_MODES.LTI_1_3,
    capabilities: contract.capabilities,
    checks,
    syntheticReady: checks.every((check) => check.passed),
    gradePreviewHash: reconciledNoop.previewHash,
    gradeReviewStatus: reconciledNoop.reviewStatus,
    providerWriteCount: 0,
    liveConnectionAuthorized: false,
    productionApproved: false,
  };
}

export function runEarlyPrepLearningSystemsAcceptance() {
  const oneRoster = previewOneRoster12CsvPackage();
  const schoology = previewSchoologyLtiAcceptance();
  const passed = oneRoster.issues.length === 0 && oneRoster.files.every((file) => file.rowCount > 0) && schoology.syntheticReady;
  return {
    acceptanceVersion: EARLY_PREP_LEARNING_SYSTEMS_ACCEPTANCE_VERSION,
    classification: "synthetic_test_data_only",
    educationDivision: "k12",
    status: passed ? "synthetic_acceptance_passed" : "synthetic_acceptance_blocked",
    passed,
    oneRoster: {
      contractVersion: oneRoster.contractVersion,
      previewHash: oneRoster.previewHash,
      totalRows: oneRoster.totalRows,
      files: oneRoster.files,
      writeAuthorized: false,
    },
    schoology: {
      provider: schoology.provider,
      mode: schoology.mode,
      capabilities: schoology.capabilities,
      checks: schoology.checks,
      gradePreviewHash: schoology.gradePreviewHash,
      gradeReviewStatus: schoology.gradeReviewStatus,
      providerWriteCount: 0,
      liveConnectionAuthorized: false,
    },
    productionApproved: false,
  };
}
