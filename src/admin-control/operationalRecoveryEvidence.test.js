import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATIONAL_RECOVERY_EVIDENCE_VERSION,
  PRODUCTION_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
  createOperationalRecoveryManifest,
  reconcileOperationalRecoveryEvidence,
} from "./operationalRecoveryEvidence.js";
import { STUDENT_DATA_DOMAINS } from "./studentDataSafetyModel.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SOURCE_COMMIT = "7".repeat(40);
const MIGRATION_VERSION = "20260802040114_index_student_data_governance_foreign_keys";

function databaseManifest(overrides = {}) {
  return {
    version: OPERATIONAL_RECOVERY_EVIDENCE_VERSION,
    environment: "staging",
    sourceProjectRef: STAGING_SUPABASE_PROJECT_REF,
    component: "database",
    captureKind: "source",
    recoveryMethod: "source_inventory",
    recoveryPoint: "2026-08-02T04:30:00.000Z",
    capturedAt: "2026-08-02T04:31:00.000Z",
    sourceCommit: SOURCE_COMMIT,
    migrationVersion: MIGRATION_VERSION,
    evidenceReference: "evidence:database-source",
    items: STUDENT_DATA_DOMAINS.map((domainKey, index) => ({
      domainKey,
      rowCount: index % 3,
      digestSha256: index % 2 ? SHA_A : SHA_B,
    })),
    ...overrides,
  };
}

function restoredDatabase(overrides = {}) {
  return databaseManifest({
    captureKind: "restored",
    recoveryMethod: "provider_database_restore",
    capturedAt: "2026-08-02T05:00:00.000Z",
    evidenceReference: "evidence:database-restored",
    ...overrides,
  });
}

function storageManifest(overrides = {}) {
  return {
    version: OPERATIONAL_RECOVERY_EVIDENCE_VERSION,
    environment: "staging",
    sourceProjectRef: STAGING_SUPABASE_PROJECT_REF,
    component: "storage",
    captureKind: "source",
    recoveryMethod: "source_inventory",
    recoveryPoint: "2026-08-02T04:30:00.000Z",
    capturedAt: "2026-08-02T04:31:00.000Z",
    sourceCommit: SOURCE_COMMIT,
    migrationVersion: MIGRATION_VERSION,
    evidenceReference: "evidence:storage-source",
    items: [{
      bucketId: "private-documents",
      objectKeySha256: SHA_A,
      byteLength: 4096,
      checksumSha256: SHA_B,
      versionReferenceSha256: null,
    }],
    ...overrides,
  };
}

function restoredStorage(overrides = {}) {
  return storageManifest({
    captureKind: "restored",
    recoveryMethod: "private_storage_restore",
    capturedAt: "2026-08-02T05:00:00.000Z",
    evidenceReference: "evidence:storage-restored",
    ...overrides,
  });
}

test("database recovery reconciliation covers all 50 domains and still requires human review", () => {
  const result = reconcileOperationalRecoveryEvidence(databaseManifest(), restoredDatabase());

  assert.equal(STUDENT_DATA_DOMAINS.length, 50);
  assert.equal(result.gateKey, "databaseRestore");
  assert.equal(result.technicallyReconciled, true);
  assert.equal(result.decision, "eligible_for_human_review");
  assert.equal(result.gatePassed, false);
  assert.equal(result.reviewerTypeRequired, "human");
  assert.equal(result.productionStudentIntakeEnabled, false);
  assert.equal(result.productionActionExecuted, false);
  assert.deepEqual(result.differences, []);
});

test("database reconciliation fails closed for missing domains and changed rows", () => {
  assert.throws(
    () => createOperationalRecoveryManifest(databaseManifest({ items: databaseManifest().items.slice(1) })),
    /every canonical student-data domain exactly once/u,
  );

  const changedItems = restoredDatabase().items.map((item) => (
    item.domainKey === "studentGrades" ? { ...item, rowCount: item.rowCount + 1, digestSha256: "c".repeat(64) } : item
  ));
  const result = reconcileOperationalRecoveryEvidence(
    databaseManifest(),
    restoredDatabase({ items: changedItems }),
  );
  assert.equal(result.technicallyReconciled, false);
  assert.equal(result.decision, "hold");
  assert.equal(result.gatePassed, false);
  assert.deepEqual(
    result.differences.filter(({ key }) => key === "studentGrades").map(({ issue }) => issue),
    ["row_count_mismatch", "digest_mismatch"],
  );
});

test("private Storage recovery compares bytes, checksums, and version references separately", () => {
  const matching = reconcileOperationalRecoveryEvidence(storageManifest(), restoredStorage());
  assert.equal(matching.gateKey, "storageRestore");
  assert.equal(matching.technicallyReconciled, true);
  assert.deepEqual(matching.sourceTotals, { itemCount: 1, byteLength: 4096 });

  const damaged = reconcileOperationalRecoveryEvidence(
    storageManifest(),
    restoredStorage({
      items: [{
        ...restoredStorage().items[0],
        byteLength: 4095,
        checksumSha256: "c".repeat(64),
        versionReferenceSha256: "d".repeat(64),
      }],
    }),
  );
  assert.equal(damaged.decision, "hold");
  assert.deepEqual(damaged.differences.map(({ issue }) => issue), [
    "byte_length_mismatch",
    "checksum_mismatch",
    "version_reference_mismatch",
  ]);
  assert.throws(
    () => createOperationalRecoveryManifest(storageManifest({
      items: [{ ...storageManifest().items[0], byteLength: 0 }],
    })),
    /positive safe integer/u,
  );
});

test("private Storage recovery detects missing and unexpected objects without exposing paths", () => {
  const secondObject = {
    ...storageManifest().items[0],
    objectKeySha256: "c".repeat(64),
    checksumSha256: "d".repeat(64),
  };
  const missing = reconcileOperationalRecoveryEvidence(
    storageManifest({ items: [...storageManifest().items, secondObject] }),
    restoredStorage(),
  );
  assert.equal(missing.decision, "hold");
  assert.deepEqual(missing.differences, [{
    key: `private-documents:${"c".repeat(64)}`,
    issue: "missing_after_restore",
  }]);

  const unexpected = reconcileOperationalRecoveryEvidence(
    storageManifest(),
    restoredStorage({ items: [...restoredStorage().items, secondObject] }),
  );
  assert.equal(unexpected.decision, "hold");
  assert.deepEqual(unexpected.differences, [{
    key: `private-documents:${"c".repeat(64)}`,
    issue: "unexpected_after_restore",
  }]);
});

test("recovery manifests reject production, other projects, raw fields, and invalid methods", () => {
  assert.throws(
    () => createOperationalRecoveryManifest(databaseManifest({ sourceProjectRef: PRODUCTION_SUPABASE_PROJECT_REF })),
    /production Supabase project is forbidden/u,
  );
  assert.throws(
    () => createOperationalRecoveryManifest(databaseManifest({ sourceProjectRef: "another-project-ref" })),
    /approved staging Supabase project/u,
  );
  assert.throws(
    () => createOperationalRecoveryManifest({ ...databaseManifest(), rows: [{ private: "student data" }] }),
    /missing or unsupported fields/u,
  );
  assert.throws(
    () => createOperationalRecoveryManifest(storageManifest({
      items: [{ ...storageManifest().items[0], objectPath: "student/private/file.pdf" }],
    })),
    /missing or unsupported fields/u,
  );
  assert.throws(
    () => createOperationalRecoveryManifest(restoredStorage({ recoveryMethod: "provider_pitr" })),
    /does not match the component/u,
  );
});

test("reconciliation binds the recovery point, source commit, migration, and capture order", () => {
  const result = reconcileOperationalRecoveryEvidence(databaseManifest(), restoredDatabase({
    recoveryPoint: "2026-08-02T04:29:00.000Z",
    capturedAt: "2026-08-02T04:30:00.000Z",
    sourceCommit: "8".repeat(40),
    migrationVersion: "20260802040115_another_migration",
  }));

  assert.equal(result.decision, "hold");
  assert.deepEqual(result.differences.map(({ issue }) => issue), [
    "recovery_point_mismatch",
    "source_commit_mismatch",
    "migration_version_mismatch",
    "capture_order_invalid",
  ]);
});
