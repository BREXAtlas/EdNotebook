import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(
  new URL("./staging-lifecycle-evidence/index.ts", import.meta.url),
  "utf8",
);
const contractSource = await readFile(
  new URL("./_shared/staging-lifecycle-evidence.ts", import.meta.url),
  "utf8",
);
const workflowSource = await readFile(
  new URL("../../.github/workflows/staging-lifecycle-evidence.yml", import.meta.url),
  "utf8",
);

test("staging lifecycle evidence is hard-bound away from production", () => {
  assert.match(contractSource, /gfalgonektwdylsxsgzc/u);
  assert.match(contractSource, /didwxihufueqbpfnfdmm/u);
  assert.match(contractSource, /Production is forbidden/u);
  assert.match(functionSource, /STAGING_LIFECYCLE_EVIDENCE_SECRET/u);
  assert.match(functionSource, /constantTimeEqual/u);
});

test("staging lifecycle evidence uses the real secure upload and deletion chain", () => {
  assert.match(functionSource, /"secure-upload-session"/u);
  assert.match(functionSource, /uploadToSignedUrl/u);
  assert.match(functionSource, /"secure-upload-complete"/u);
  assert.match(functionSource, /"secure-file-delete"/u);
  assert.match(functionSource, /"deferred_retention"/u);
  assert.match(functionSource, /"blocked_legal_hold"/u);
  assert.match(functionSource, /anonymousReadDenied/u);
  assert.match(functionSource, /requiredAuditsPresent/u);
  assert.match(functionSource, /cleanupFixtures/u);
});

test("the permanent evidence workflow is manual, staging-only, and metadata-only", () => {
  assert.match(workflowSource, /^\s*workflow_dispatch:/mu);
  assert.doesNotMatch(workflowSource, /^\s*schedule:/mu);
  assert.match(workflowSource, /https:\/\/gfalgonektwdylsxsgzc\.supabase\.co\/functions\/v1\/staging-lifecycle-evidence/u);
  assert.doesNotMatch(workflowSource, /didwxihufueqbpfnfdmm/u);
  assert.match(workflowSource, /STAGING_LIFECYCLE_EVIDENCE_SECRET/u);
  assert.match(workflowSource, /gatePassed/u);
  assert.match(workflowSource, /productionActionExecuted/u);
});

test("technical success cannot approve a governance gate or production", () => {
  assert.match(contractSource, /gatePassed: false/u);
  assert.match(contractSource, /reviewerTypeRequired: "human"/u);
  assert.match(contractSource, /productionStudentIntakeEnabled: false/u);
  assert.match(contractSource, /productionActionExecuted: false/u);
});
