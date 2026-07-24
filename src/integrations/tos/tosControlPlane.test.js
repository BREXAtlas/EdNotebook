import assert from "node:assert/strict";
import test from "node:test";

import {
  createSafeTosContextPreview,
  createSyntheticCloseoutManifest,
  validateSyntheticCloseoutManifest,
} from "./tosControlPlane.js";

test("synthetic closeout includes counts but no identifiers, raw grades, or credentials", () => {
  const manifest = createSyntheticCloseoutManifest("2026-07-24T15:00:00.000Z");
  assert.equal(validateSyntheticCloseoutManifest(manifest).allowed, true);
  assert.equal(manifest.containsDirectIdentifiers, false);
  assert.equal(manifest.containsRawGrades, false);
  assert.equal(manifest.containsCredentials, false);
  assert.equal(manifest.officialRecordTransfer, false);
});

test("validation fails closed for real data, a wrong scope, or an imbalanced roster", () => {
  const manifest = createSyntheticCloseoutManifest();
  const cases = [
    { ...manifest, containsRawGrades: true },
    { ...manifest, scope: { ...manifest.scope, dataClass: "education_record" } },
    {
      ...manifest,
      recordCounts: { ...manifest.recordCounts, finalizedGrades: 21 },
    },
  ];
  for (const value of cases) {
    const result = validateSyntheticCloseoutManifest(value);
    assert.equal(result.allowed, false);
    assert.equal(result.trustedExchangePerformed, false);
  }
});

test("context preview carries no token, personal data, or education record", () => {
  const context = createSafeTosContextPreview();
  assert.equal(context.containsAuthToken, false);
  assert.equal(context.containsPersonalData, false);
  assert.equal(context.containsEducationRecords, false);
  assert.equal(context.exchangeMode, "not_connected");
});
