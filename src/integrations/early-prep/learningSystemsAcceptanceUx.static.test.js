import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("./EarlyPrepLearningSystemsAcceptance.jsx", import.meta.url), "utf8");
const model = await readFile(new URL("./learningSystemsAcceptance.js", import.meta.url), "utf8");
const professorDashboard = await readFile(new URL("../../portal/ProfessorDashboard.jsx", import.meta.url), "utf8");

test("the learning-system rehearsal is lazy and Early Prep-only", () => {
  assert.match(professorDashboard, /lazy\(\(\) =>\s*import\("\.\.\/integrations\/early-prep\/EarlyPrepLearningSystemsAcceptance\.jsx"\)/u);
  assert.match(professorDashboard, /EARLY_PREP_ONLY_NAV_ITEMS = new Set\(\["financial-literacy", "learning-systems"\]\)/u);
  assert.match(professorDashboard, /tab === "learning-systems" && earlyPrep/u);
  assert.match(professorDashboard, /!EARLY_PREP_ONLY_NAV_ITEMS\.has\(id\) \|\| divisionScope === "k12"/u);
});

test("the visible acceptance flow is explicit, synthetic, and counts-only", () => {
  assert.match(workspace, /Run synthetic acceptance/u);
  assert.match(workspace, /Synthetic pass is not a live PowerSchool or Schoology approval/u);
  assert.match(workspace, /Provider write count remains zero/u);
  assert.match(workspace, /Teachers cannot activate those operations from this page/u);
  assert.doesNotMatch(workspace, /input type="password"|client_secret|access_token|service_role/iu);
});

test("the synthetic model never imports the live Supabase or LTI service layers", () => {
  assert.doesNotMatch(model, /supabaseClient|ltiService|functions\.invoke|\.rpc\(/u);
  assert.doesNotMatch(workspace, /supabaseClient|ltiService|fetch\(|functions\.invoke|\.rpc\(/u);
});
