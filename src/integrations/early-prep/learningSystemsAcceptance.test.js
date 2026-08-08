import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE,
  ONEROSTER_12_CSV_FILES,
  previewOneRoster12CsvPackage,
  previewSchoologyLtiAcceptance,
  runEarlyPrepLearningSystemsAcceptance,
} from "./learningSystemsAcceptance.js";
import { EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE } from "./syntheticDistrictPilot.js";

test("OneRoster 1.2 acceptance covers all eight governed CSV resources without authorizing a write", () => {
  const preview = previewOneRoster12CsvPackage();
  assert.deepEqual(preview.files.map(({ resource }) => resource), ["orgs", "academicSessions", "courses", "classes", "users", "enrollments", "lineItems", "results"]);
  assert.deepEqual(preview.files.map(({ fileName }) => fileName), Object.values(ONEROSTER_12_CSV_FILES));
  assert.equal(preview.totalRows, 10);
  assert.equal(preview.issues.length, 0);
  assert.equal(preview.writeAuthorized, false);
  assert.equal(preview.previewHash, previewOneRoster12CsvPackage().previewHash);
});

test("Schoology rehearsal covers LTI launch, Deep Linking, NRPS, and AGS with zero provider writes", () => {
  const preview = previewSchoologyLtiAcceptance();
  assert.equal(preview.provider, "schoology");
  assert.equal(preview.mode, "lti_1_3");
  assert.deepEqual(preview.capabilities, ["oidc-login", "resource-link", "deep-linking", "nrps", "ags"]);
  assert.equal(preview.syntheticReady, true);
  assert.ok(preview.checks.every((check) => check.passed));
  assert.equal(preview.gradeReviewStatus, "reconciled");
  assert.equal(preview.providerWriteCount, 0);
  assert.equal(preview.liveConnectionAuthorized, false);
  assert.equal(preview.productionApproved, false);
});

test("combined acceptance returns counts-only evidence and cannot claim a live connection", () => {
  const evidence = runEarlyPrepLearningSystemsAcceptance();
  assert.equal(evidence.status, "synthetic_acceptance_passed");
  assert.equal(evidence.passed, true);
  assert.equal(evidence.classification, "synthetic_test_data_only");
  assert.equal(evidence.oneRoster.writeAuthorized, false);
  assert.equal(evidence.schoology.providerWriteCount, 0);
  assert.equal(evidence.schoology.liveConnectionAuthorized, false);
  assert.equal(evidence.productionApproved, false);
  assert.doesNotMatch(JSON.stringify(evidence), /@|student_number|full_name|service_role|client_secret|access_token/iu);
});

test("acceptance rejects real classifications, credentials, and non-synthetic Schoology origins", () => {
  assert.throws(
    () => previewSchoologyLtiAcceptance({ ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE, classification: "pilot_student_data" }),
    /synthetic_early_prep_fixture_required/u,
  );
  assert.throws(
    () => previewSchoologyLtiAcceptance({
      ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE,
      registration: { ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE.registration, issuer: "https://schoology.example.edu" },
    }),
    /synthetic_schoology_origin_required/u,
  );
  assert.throws(
    () => previewSchoologyLtiAcceptance({
      ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE,
      registration: { ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE.registration, oauth_token_url: "https://schoology.example.edu/oauth/token" },
    }),
    /synthetic_schoology_origin_required/u,
  );
  assert.throws(
    () => previewSchoologyLtiAcceptance({ ...EARLY_PREP_SCHOOLOGY_SYNTHETIC_FIXTURE, client_secret: "not-allowed" }),
    /credentials_prohibited_in_synthetic_fixture/u,
  );
});

test("OneRoster acceptance rejects fixtures outside Early Prep", () => {
  assert.throws(
    () => previewOneRoster12CsvPackage({
      ...EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE,
      educationDivision: "university",
    }),
    /synthetic_early_prep_fixture_required/u,
  );
});
