import test from "node:test";
import assert from "node:assert/strict";

import {
  FEATURE_CATALOG,
  FEATURE_PATHWAYS,
  getFeatureDefinition,
  requireFeatureDefinition,
  validateFeatureCatalog,
} from "./featureCatalog.js";
import {
  buildControlImpact,
  featuresForPathway,
  filterFeatures,
  getConnectionStatusDetails,
  getConnectionStatusLabel,
  normalizeConnectionStatus,
  resolveFeatureControl,
  sanitizeCsvValue,
  serializeReportToCsv,
  validateControlPolicy,
} from "./controlModel.js";

test("the canonical catalog is valid, complete, and deeply immutable", () => {
  assert.equal(validateFeatureCatalog(), true);
  assert.ok(FEATURE_CATALOG.length >= 70, "the catalog should cover the platform's major control surfaces");

  const pathways = new Set(FEATURE_CATALOG.map((definition) => definition.pathway));
  for (const pathway of FEATURE_PATHWAYS) assert.ok(pathways.has(pathway), `missing ${pathway} definitions`);

  const keys = new Set(FEATURE_CATALOG.map((definition) => definition.key));
  assert.equal(keys.size, FEATURE_CATALOG.length);
  for (const definition of FEATURE_CATALOG) {
    assert.ok(definition.description.length >= 30, `${definition.key} needs a plain-language description`);
    assert.ok(definition.helpText.length >= 30, `${definition.key} needs plain-language help text`);
    assert.ok(Object.isFrozen(definition));
    assert.ok(Object.isFrozen(definition.allowedScopes));
    assert.ok(Object.isFrozen(definition.dependencies));
    for (const dependency of definition.dependencies) {
      assert.ok(keys.has(dependency), `${definition.key} has unknown dependency ${dependency}`);
    }
  }
});

test("feature definitions can be found without exposing a mutable object", () => {
  const gradeReport = getFeatureDefinition("student.grade_report");
  assert.equal(gradeReport?.name, "Student grade report");
  assert.equal(gradeReport?.pathway, "student");
  assert.equal(getFeatureDefinition("missing.feature"), null);
  assert.throws(() => requireFeatureDefinition("missing.feature"), /Unknown feature/u);
  assert.throws(() => {
    gradeReport.name = "Changed";
  }, TypeError);
});

test("specific controls override broad controls for the matching institution and account", () => {
  const policies = [
    { id: "platform", featureKey: "student.messaging", scope: "platform", mode: "on" },
    { id: "another-school", featureKey: "student.messaging", scope: "institution", scopeId: "other", mode: "off" },
    { id: "institution", featureKey: "student.messaging", scope: "institution", scopeId: "asu", mode: "off" },
    { id: "course", featureKey: "student.messaging", scope: "course", scopeId: "course-1", mode: "on" },
    { id: "account", featureKey: "student.messaging", scope: "account", scopeId: "student-1", mode: "off" },
  ];

  const result = resolveFeatureControl("student.messaging", policies, {
    institutionId: "asu",
    courseId: "course-1",
    accountId: "student-1",
    pathway: "student",
  }, { at: "2026-07-21T12:00:00.000Z" });

  assert.equal(result.value, false);
  assert.equal(result.enabled, false);
  assert.equal(result.source.policyId, "account");
  assert.deepEqual(result.appliedPolicyIds, ["platform", "institution", "course", "account"]);
  assert.equal(result.matchingPolicyCount, 4);
});

test("a locked broad policy blocks narrower overrides and required controls stay on", () => {
  const locked = resolveFeatureControl("student.messaging", [
    { id: "platform-lock", featureKey: "student.messaging", scope: "platform", mode: "locked", value: false },
    { id: "institution-on", featureKey: "student.messaging", scope: "institution", scopeId: "asu", mode: "on" },
    { id: "account-on", featureKey: "student.messaging", scope: "account", scopeId: "student-1", mode: "on" },
  ], { institutionId: "asu", accountId: "student-1" });

  assert.equal(locked.value, false);
  assert.equal(locked.locked, true);
  assert.equal(locked.lockSource.policyId, "platform-lock");
  assert.deepEqual(locked.ignoredByLock, ["institution-on", "account-on"]);

  const required = resolveFeatureControl("accessibility.keyboard_navigation", [
    { id: "attempted-off", featureKey: "accessibility.keyboard_navigation", scope: "platform", mode: "off" },
  ]);
  assert.equal(required.value, true);
  assert.equal(required.enabled, true);
  assert.equal(required.locked, true);
  assert.deepEqual(required.ignoredByLock, ["attempted-off"]);
});

test("scheduled policies are reported but do not apply outside their time window", () => {
  const policies = [
    { id: "institution-now", featureKey: "student.messaging", scope: "institution", scopeId: "asu", mode: "on" },
    {
      id: "future-account-off",
      featureKey: "student.messaging",
      scope: "account",
      scopeId: "student-1",
      mode: "off",
      startsAt: "2026-07-22T12:00:00.000Z",
    },
  ];
  const context = { institutionId: "asu", accountId: "student-1" };

  const before = resolveFeatureControl("student.messaging", policies, context, { at: "2026-07-21T12:00:00.000Z" });
  assert.equal(before.value, true);
  assert.equal(before.scheduledPolicies.length, 1);
  assert.equal(before.scheduledPolicies[0].state, "scheduled");
  assert.equal(before.nextChangeAt, "2026-07-22T12:00:00.000Z");

  const during = resolveFeatureControl("student.messaging", policies, context, { at: "2026-07-23T12:00:00.000Z" });
  assert.equal(during.value, false);
  assert.equal(during.source.policyId, "future-account-off");
});

test("control policy validation rejects unsafe or ambiguous policy shapes", () => {
  assert.equal(validateControlPolicy({ featureKey: "student.messaging", scope: "platform", mode: "off" }), true);
  assert.throws(
    () => validateControlPolicy({ featureKey: "student.messaging", scope: "institution", mode: "on" }),
    /requires a scope ID/u,
  );
  assert.throws(
    () => validateControlPolicy({ featureKey: "student.messaging", scope: "platform", mode: "locked" }),
    /requires a value/u,
  );
  assert.throws(
    () => validateControlPolicy({ featureKey: "security.row_level_access", scope: "account", scopeId: "one", mode: "on" }),
    /cannot be controlled/u,
  );
  assert.throws(
    () => validateControlPolicy({
      featureKey: "student.messaging",
      scope: "platform",
      mode: "off",
      startsAt: "2026-07-23T00:00:00Z",
      endsAt: "2026-07-22T00:00:00Z",
    }),
    /must be after/u,
  );
});

test("impact previews explain affected people and demand stronger confirmation for critical changes", () => {
  const impact = buildControlImpact({
    feature: "professor.grade_publish",
    previousValue: true,
    nextValue: false,
    scope: "institution",
    scopeLabel: "Angelo State University",
    affected: { institutions: 1, courses: 24, accounts: 640 },
  });

  assert.equal(impact.changed, true);
  assert.equal(impact.confirmationLevel, "multiple");
  assert.match(impact.summary, /Angelo State University/u);
  assert.match(impact.summary, /24 courses/u);
  assert.ok(impact.warnings.some(({ code }) => code === "critical-feature"));
  assert.ok(impact.warnings.some(({ code }) => code === "wide-impact"));
  assert.ok(impact.warnings.some(({ code }) => code === "disable-block"));

  const required = buildControlImpact({
    feature: "accessibility.keyboard_navigation",
    previousValue: true,
    nextValue: false,
    scope: "platform",
  });
  assert.ok(required.warnings.some(({ code }) => code === "required-control"));
  assert.ok(required.warnings.some(({ code }) => code === "accessibility-review"));
});

test("connection status values use clear, stable labels", () => {
  assert.equal(normalizeConnectionStatus("live"), "active");
  assert.equal(normalizeConnectionStatus("SETUP-NEEDED"), "setup_needed");
  assert.equal(normalizeConnectionStatus("something-new"), "not_connected");
  assert.equal(getConnectionStatusLabel("prepared"), "Ready to activate");
  assert.deepEqual(getConnectionStatusDetails("failed"), {
    key: "failed",
    label: "Test failed",
    description: "The latest connection test failed and activation should remain blocked.",
    tone: "danger",
  });
});

test("catalog filtering supports pathway templates, integrations, and plain-language search", () => {
  const studentTemplate = featuresForPathway("student");
  const studentPathways = new Set(studentTemplate.map(({ pathway }) => pathway));
  assert.ok(studentPathways.has("student"));
  assert.ok(studentPathways.has("shared"));
  assert.ok(studentPathways.has("security"));
  assert.ok(studentPathways.has("accessibility"));
  assert.ok(studentPathways.has("theme"));
  assert.ok(!studentPathways.has("professor"));
  assert.ok(!studentPathways.has("integration"));

  const withIntegrations = featuresForPathway("professor", { includeIntegrations: true });
  assert.ok(withIntegrations.some(({ key }) => key === "integration.blackboard_ags"));

  const gradeConnections = filterFeatures({ query: "blackboard grade" });
  assert.ok(gradeConnections.some(({ key }) => key === "integration.blackboard_csv"));
  assert.ok(gradeConnections.every(({ pathway }) => pathway === "integration"));

  const platformOnly = filterFeatures({ institutionDelegable: false });
  assert.ok(platformOnly.length > 0);
  assert.ok(platformOnly.every(({ institutionDelegable }) => institutionDelegable === false));
});

test("CSV reports are spreadsheet-safe and preserve commas, quotes, and line breaks", () => {
  assert.equal(sanitizeCsvValue("=HYPERLINK(\"https://example.invalid\")"), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(sanitizeCsvValue("  +1"), "'  +1");
  assert.equal(sanitizeCsvValue(true), "Yes");

  const csv = serializeReportToCsv([
    {
      account: "Student, One",
      note: "Said \"hello\"\non two lines",
      formula: "@SUM(A1:A2)",
      enabled: false,
    },
  ], [
    { key: "account", label: "Account" },
    { key: "note", label: "Change note" },
    { key: "formula", label: "Entered value" },
    { key: "enabled", label: "Enabled" },
  ]);

  assert.ok(csv.endsWith("\r\n"));
  assert.match(csv, /^"Account","Change note","Entered value","Enabled"\r\n/u);
  assert.match(csv, /"Student, One"/u);
  assert.match(csv, /"Said ""hello""\non two lines"/u);
  assert.match(csv, /"'@SUM\(A1:A2\)"/u);
  assert.match(csv, /"No"/u);
  assert.equal(serializeReportToCsv([]), "");
  assert.throws(() => serializeReportToCsv({}), /must be an array/u);
});
