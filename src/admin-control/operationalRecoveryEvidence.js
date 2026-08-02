import { STUDENT_DATA_DOMAINS } from "./studentDataSafetyModel.js";

export const OPERATIONAL_RECOVERY_EVIDENCE_VERSION = "1.0";
export const STAGING_SUPABASE_PROJECT_REF = "gfalgonektwdylsxsgzc";
export const PRODUCTION_SUPABASE_PROJECT_REF = "didwxihufueqbpfnfdmm";

const COMPONENT_CONFIGURATION = Object.freeze({
  database: Object.freeze({
    gateKey: "databaseRestore",
    restoredMethods: Object.freeze(["provider_database_restore", "provider_pitr"]),
  }),
  storage: Object.freeze({
    gateKey: "storageRestore",
    restoredMethods: Object.freeze(["private_storage_restore"]),
  }),
});

const MANIFEST_KEYS = Object.freeze([
  "version",
  "environment",
  "sourceProjectRef",
  "component",
  "captureKind",
  "recoveryMethod",
  "recoveryPoint",
  "capturedAt",
  "sourceCommit",
  "migrationVersion",
  "evidenceReference",
  "items",
]);
const DATABASE_ITEM_KEYS = Object.freeze(["domainKey", "rowCount", "digestSha256"]);
const STORAGE_ITEM_KEYS = Object.freeze([
  "bucketId",
  "objectKeySha256",
  "byteLength",
  "checksumSha256",
  "versionReferenceSha256",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const SAFE_REFERENCE_PATTERN = /^[a-z][a-z0-9_-]{2,31}:[a-zA-Z0-9][a-zA-Z0-9._/#-]{3,479}$/u;
const MIGRATION_PATTERN = /^[0-9]{14}_[a-z0-9_]{3,160}$/u;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/u;

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} contains missing or unsupported fields.`);
  }
}

function requiredIsoDate(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  return value;
}

function requiredSha256(value, label) {
  if (!SHA256_PATTERN.test(String(value || ""))) {
    throw new TypeError(`${label} must be a lowercase SHA-256 digest.`);
  }
  return String(value);
}

function requiredNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer.`);
  }
  return value;
}

function requiredPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function requiredSafeReference(value, label) {
  if (!SAFE_REFERENCE_PATTERN.test(String(value || ""))) {
    throw new TypeError(`${label} must be an opaque evidence reference of at least eight safe characters.`);
  }
  return String(value);
}

function validateScope(manifest) {
  if (manifest.environment !== "staging") {
    throw new RangeError("Operational recovery evidence is restricted to the staging environment.");
  }
  if (manifest.sourceProjectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new RangeError("The production Supabase project is forbidden for this recovery exercise.");
  }
  if (manifest.sourceProjectRef !== STAGING_SUPABASE_PROJECT_REF) {
    throw new RangeError("The recovery source must be the approved staging Supabase project.");
  }
}

function validateDatabaseItems(items) {
  if (!Array.isArray(items)) throw new TypeError("Database recovery items must be an array.");
  const domains = new Set();
  const normalized = items.map((item, index) => {
    assertExactKeys(item, DATABASE_ITEM_KEYS, `Database recovery item ${index + 1}`);
    if (!STUDENT_DATA_DOMAINS.includes(item.domainKey)) {
      throw new RangeError(`Database recovery item ${index + 1} has an unknown domain key.`);
    }
    if (domains.has(item.domainKey)) throw new RangeError(`Database recovery domain ${item.domainKey} is duplicated.`);
    domains.add(item.domainKey);
    return Object.freeze({
      domainKey: item.domainKey,
      rowCount: requiredNonnegativeInteger(item.rowCount, `${item.domainKey}.rowCount`),
      digestSha256: requiredSha256(item.digestSha256, `${item.domainKey}.digestSha256`),
    });
  });

  const missingDomains = STUDENT_DATA_DOMAINS.filter((domain) => !domains.has(domain));
  if (missingDomains.length || normalized.length !== STUDENT_DATA_DOMAINS.length) {
    throw new RangeError("Database recovery evidence must contain every canonical student-data domain exactly once.");
  }
  return normalized.sort((left, right) => left.domainKey.localeCompare(right.domainKey));
}

function validateStorageItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError("Storage recovery evidence must contain at least one synthetic private object.");
  }
  const objectKeys = new Set();
  const normalized = items.map((item, index) => {
    assertExactKeys(item, STORAGE_ITEM_KEYS, `Storage recovery item ${index + 1}`);
    if (!BUCKET_PATTERN.test(String(item.bucketId || ""))) {
      throw new TypeError(`Storage recovery item ${index + 1} has an invalid bucket identifier.`);
    }
    const objectKeySha256 = requiredSha256(item.objectKeySha256, `Storage recovery item ${index + 1}.objectKeySha256`);
    const versionReferenceSha256 = item.versionReferenceSha256 === null
      ? null
      : requiredSha256(item.versionReferenceSha256, `Storage recovery item ${index + 1}.versionReferenceSha256`);
    const objectKey = `${item.bucketId}:${objectKeySha256}`;
    if (objectKeys.has(objectKey)) throw new RangeError("A storage recovery object is duplicated.");
    objectKeys.add(objectKey);
    return Object.freeze({
      bucketId: item.bucketId,
      objectKeySha256,
      byteLength: requiredPositiveInteger(item.byteLength, `Storage recovery item ${index + 1}.byteLength`),
      checksumSha256: requiredSha256(item.checksumSha256, `Storage recovery item ${index + 1}.checksumSha256`),
      versionReferenceSha256,
    });
  });
  return normalized.sort((left, right) => (
    `${left.bucketId}:${left.objectKeySha256}`.localeCompare(`${right.bucketId}:${right.objectKeySha256}`)
  ));
}

export function createOperationalRecoveryManifest(input) {
  assertExactKeys(input, MANIFEST_KEYS, "Operational recovery manifest");
  if (input.version !== OPERATIONAL_RECOVERY_EVIDENCE_VERSION) {
    throw new RangeError("The operational recovery evidence version is not supported.");
  }
  validateScope(input);
  const configuration = COMPONENT_CONFIGURATION[input.component];
  if (!configuration) throw new RangeError("Recovery component must be database or storage.");
  if (!COMMIT_PATTERN.test(String(input.sourceCommit || ""))) {
    throw new TypeError("sourceCommit must be a full lowercase Git commit SHA.");
  }
  if (!MIGRATION_PATTERN.test(String(input.migrationVersion || ""))) {
    throw new TypeError("migrationVersion must identify an applied Supabase migration.");
  }
  if (!['source', 'restored'].includes(input.captureKind)) {
    throw new RangeError("captureKind must be source or restored.");
  }
  const allowedMethods = input.captureKind === "source"
    ? ["source_inventory"]
    : configuration.restoredMethods;
  if (!allowedMethods.includes(input.recoveryMethod)) {
    throw new RangeError("The recovery method does not match the component and capture kind.");
  }

  const recoveryPoint = requiredIsoDate(input.recoveryPoint, "recoveryPoint");
  const capturedAt = requiredIsoDate(input.capturedAt, "capturedAt");
  if (new Date(capturedAt) < new Date(recoveryPoint)) {
    throw new RangeError("capturedAt cannot precede the declared recovery point.");
  }
  const items = input.component === "database"
    ? validateDatabaseItems(input.items)
    : validateStorageItems(input.items);

  return Object.freeze({
    version: input.version,
    environment: input.environment,
    sourceProjectRef: input.sourceProjectRef,
    component: input.component,
    captureKind: input.captureKind,
    recoveryMethod: input.recoveryMethod,
    recoveryPoint,
    capturedAt,
    sourceCommit: input.sourceCommit,
    migrationVersion: input.migrationVersion,
    evidenceReference: requiredSafeReference(input.evidenceReference, "evidenceReference"),
    items: Object.freeze(items),
  });
}

function itemKey(component, item) {
  return component === "database" ? item.domainKey : `${item.bucketId}:${item.objectKeySha256}`;
}

function itemDifferences(component, sourceItem, restoredItem) {
  if (!sourceItem) return ["unexpected_after_restore"];
  if (!restoredItem) return ["missing_after_restore"];
  if (component === "database") {
    return [
      ...(sourceItem.rowCount === restoredItem.rowCount ? [] : ["row_count_mismatch"]),
      ...(sourceItem.digestSha256 === restoredItem.digestSha256 ? [] : ["digest_mismatch"]),
    ];
  }
  return [
    ...(sourceItem.byteLength === restoredItem.byteLength ? [] : ["byte_length_mismatch"]),
    ...(sourceItem.checksumSha256 === restoredItem.checksumSha256 ? [] : ["checksum_mismatch"]),
    ...(sourceItem.versionReferenceSha256 === restoredItem.versionReferenceSha256 ? [] : ["version_reference_mismatch"]),
  ];
}

function totals(component, manifest) {
  return component === "database"
    ? Object.freeze({ itemCount: manifest.items.length, rowCount: manifest.items.reduce((sum, item) => sum + item.rowCount, 0) })
    : Object.freeze({ itemCount: manifest.items.length, byteLength: manifest.items.reduce((sum, item) => sum + item.byteLength, 0) });
}

export function reconcileOperationalRecoveryEvidence(sourceInput, restoredInput) {
  const source = createOperationalRecoveryManifest(sourceInput);
  const restored = createOperationalRecoveryManifest(restoredInput);
  if (source.captureKind !== "source" || restored.captureKind !== "restored") {
    throw new RangeError("Reconciliation requires a source capture followed by a restored capture.");
  }
  if (source.component !== restored.component) throw new RangeError("Recovery components do not match.");
  if (source.sourceProjectRef !== restored.sourceProjectRef) throw new RangeError("Recovery source projects do not match.");

  const metadataDifferences = [
    ...(source.recoveryPoint === restored.recoveryPoint ? [] : ["recovery_point_mismatch"]),
    ...(source.sourceCommit === restored.sourceCommit ? [] : ["source_commit_mismatch"]),
    ...(source.migrationVersion === restored.migrationVersion ? [] : ["migration_version_mismatch"]),
    ...(new Date(restored.capturedAt) >= new Date(source.capturedAt) ? [] : ["capture_order_invalid"]),
  ];
  const sourceItems = new Map(source.items.map((item) => [itemKey(source.component, item), item]));
  const restoredItems = new Map(restored.items.map((item) => [itemKey(restored.component, item), item]));
  const keys = [...new Set([...sourceItems.keys(), ...restoredItems.keys()])].sort();
  const itemDifferenceRecords = keys.flatMap((key) => itemDifferences(
    source.component,
    sourceItems.get(key),
    restoredItems.get(key),
  ).map((issue) => Object.freeze({ key, issue })));
  const differences = Object.freeze([
    ...metadataDifferences.map((issue) => Object.freeze({ key: "manifest", issue })),
    ...itemDifferenceRecords,
  ]);
  const technicallyReconciled = differences.length === 0;

  return Object.freeze({
    version: OPERATIONAL_RECOVERY_EVIDENCE_VERSION,
    gateKey: COMPONENT_CONFIGURATION[source.component].gateKey,
    component: source.component,
    technicallyReconciled,
    decision: technicallyReconciled ? "eligible_for_human_review" : "hold",
    gatePassed: false,
    reviewerTypeRequired: "human",
    productionStudentIntakeEnabled: false,
    productionActionExecuted: false,
    sourceTotals: totals(source.component, source),
    restoredTotals: totals(restored.component, restored),
    differences,
  });
}
