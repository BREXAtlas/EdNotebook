import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE,
  runEarlyPrepSyntheticDistrictPilot,
} from "./syntheticDistrictPilot.js";
import {
  authorizeEarlyPrepGradeExport,
  powerSchoolCsvPreview,
  prepareEarlyPrepGradeExport,
  reconcileEarlyPrepNoopGradeExport,
} from "./earlyPrepLearningAdapters.js";

test("the synthetic district fixture covers every OneRoster 1.2 resource without real student data", () => {
  const evidence = runEarlyPrepSyntheticDistrictPilot();
  assert.equal(evidence.classification, "synthetic_test_data_only");
  assert.deepEqual(Object.keys(evidence.oneRosterResourceCounts), ["orgs", "academicSessions", "courses", "classes", "users", "enrollments", "lineItems", "results"]);
  assert.ok(Object.values(evidence.oneRosterResourceCounts).every((count) => count > 0));
  const serialized = JSON.stringify(EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE);
  assert.match(serialized, /\.invalid/u);
  assert.doesNotMatch(serialized, /service_role|secret|password|didwxihufueqbpfnfdmm/u);
});

test("PowerSchool import previews are deterministic and cannot write", () => {
  const first = powerSchoolCsvPreview(EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE.powerSchool);
  const second = powerSchoolCsvPreview(EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE.powerSchool);
  assert.equal(first.previewHash, second.previewHash);
  assert.equal(first.writeAuthorized, false);
  assert.deepEqual(first.summary, { courses: 1, people: 2, enrollments: 2 });
});

test("a reviewed no-op grade export reconciles without authorizing or recording a provider write", () => {
  const preview = prepareEarlyPrepGradeExport(EARLY_PREP_SYNTHETIC_DISTRICT_FIXTURE.gradeExport);
  assert.equal(preview.noOp, true);
  assert.equal(preview.changedRowCount, 0);
  const approved = authorizeEarlyPrepGradeExport(preview, {
    reviewedBy: "synthetic-reviewer",
    idempotencyKey: preview.idempotencyKey,
  });
  assert.equal(approved.writeAuthorized, false);
  const reconciled = reconcileEarlyPrepNoopGradeExport(approved, { reconciledBy: "synthetic-reviewer", actualWriteCount: 0 });
  assert.equal(reconciled.reviewStatus, "reconciled");
  assert.deepEqual(reconciled.reconciliation, {
    expectedWriteCount: 0,
    actualWriteCount: 0,
    reconciledBy: "synthetic-reviewer",
    providerReceipt: null,
  });
  assert.throws(() => reconcileEarlyPrepNoopGradeExport(approved, { reconciledBy: "synthetic-reviewer", actualWriteCount: 1 }), /noop_export_must_not_write/u);
});
