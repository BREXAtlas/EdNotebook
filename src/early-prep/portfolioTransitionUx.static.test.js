import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const transition = await readFile(new URL("./EarlyPrepPortfolioTransition.jsx", import.meta.url), "utf8");
const model = await readFile(new URL("./portfolioTransition.js", import.meta.url), "utf8");
const studentDashboard = await readFile(new URL("../portal/StudentDashboard.jsx", import.meta.url), "utf8");

test("portfolio transition is lazy and available only from the Early Prep student page", () => {
  assert.match(studentDashboard, /lazy\(\(\) => import\("\.\.\/early-prep\/EarlyPrepPortfolioTransition\.jsx"\)\)/u);
  assert.match(studentDashboard, /track === "k12" && transitionOpen/u);
  assert.match(studentDashboard, /track === "k12" && <section className="dashboard-card student-transfer-card"/u);
  assert.match(studentDashboard, /onClick=\{\(\) => setTransitionOpen\(true\)\}/u);
});

test("preview makes item selection, archives, and later review explicit", () => {
  assert.match(transition, /Nothing is selected automatically/u);
  assert.match(transition, /Protected school context stays protected/u);
  assert.match(transition, /institutional review, student reconfirmation/u);
  assert.match(transition, /disabled=\{!selectedItemIds\.length \|\| !allConfirmed\}/u);
  assert.match(transition, /Records copied<\/dt><dd>\{result\.recordsCopied\}/u);
});

test("transition model is fail-closed and verifies preview integrity", () => {
  assert.match(model, /transition_item_not_transferable/u);
  assert.match(model, /transition_preview_integrity_failed/u);
  assert.match(model, /applyAuthorized: false/u);
  assert.match(model, /universityRecordsModified: false/u);
  assert.match(model, /socialAudiencesMerged: false/u);
});

test("preview has no data, payment, marketplace, professor, or publisher integration", () => {
  assert.doesNotMatch(transition, /supabaseClient|functions\.invoke|\.rpc\(|fetch\(/u);
  assert.doesNotMatch(model, /supabaseClient|functions\.invoke|\.rpc\(|fetch\(/u);
  assert.doesNotMatch(model, /checkout|stripe|seller|payout/iu);
});
