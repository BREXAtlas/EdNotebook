import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("./EarlyPrepPilotReadiness.jsx", import.meta.url), "utf8");
const model = await readFile(new URL("./pilotReadiness.js", import.meta.url), "utf8");
const main = await readFile(new URL("../main.jsx", import.meta.url), "utf8");
const controlCenter = await readFile(new URL("../admin-control/AdminControlCenter.jsx", import.meta.url), "utf8");
const promotionPacket = await readFile(new URL("../../docs/EARLY_PREP_BETA_PROMOTION_PACKET.md", import.meta.url), "utf8");

test("pilot-readiness review is lazy, institution-gated, and linked only in the K12 control scope", () => {
  assert.match(main, /lazy\(\(\) => import\("\.\/early-prep\/EarlyPrepPilotReadiness\.jsx"\)\)/u);
  assert.match(main, /route\.startsWith\("#\/admin\/early-prep-pilot-readiness"\).*accountType="institution"/u);
  assert.match(controlCenter, /educationDivision === "k12" \? <a className="ac-button ac-button--quiet" href="#\/admin\/early-prep-pilot-readiness"/u);
});

test("visible review state cannot be mistaken for institution approval", () => {
  assert.match(component, /TECHNICAL CLOSEOUT COMPLETE · BETA PROMOTION NOT AUTHORIZED/u);
  assert.match(component, /cannot approve a staging-to-main promotion or a real pilot/u);
  assert.match(component, /Every real-student pilot gate remains undecided here/u);
  assert.match(component, /Full synthetic teacher-and-student verification is complete/u);
  assert.match(component, /All 16 checks passed against the deployed PR #137 staging candidate/u);
  assert.match(component, /Confirm the boundaries—not an approval/u);
  assert.doesNotMatch(component, />Approve(?: pilot)?</u);
});

test("packet result keeps every live and protected boundary closed", () => {
  assert.match(component, /Pilot approved<\/dt><dd>No/u);
  assert.match(component, /Staging walkthrough complete<\/dt><dd>Yes/u);
  assert.match(component, /Beta promotion authorized<\/dt><dd>No/u);
  assert.match(component, /Main promotion authorized<\/dt><dd>No/u);
  assert.match(component, /Live data lane assigned<\/dt><dd>No/u);
  assert.match(component, /Real minor data authorized<\/dt><dd>No/u);
  assert.match(component, /Production or research activated<\/dt><dd>No/u);
  assert.match(component, /No live minor data, integrations, research, production, payments, or University-side changes/u);
});

test("review surface has no Supabase, integration, commercial, professor, or publisher operation", () => {
  assert.doesNotMatch(component, /supabaseClient|functions\.invoke|\.rpc\(|fetch\(/u);
  assert.doesNotMatch(model, /supabaseClient|functions\.invoke|\.rpc\(|fetch\(/u);
  assert.doesNotMatch(model, /checkout|stripe|seller|payout/iu);
});

test("Beta promotion packet closes technical work without inventing owner or institution approval", () => {
  assert.match(promotionPacket, /All 16 synthetic teacher\/student staging walkthrough checks passed/u);
  assert.match(promotionPacket, /does not make that decision and does not authorize a merge to `main`/u);
  assert.match(promotionPacket, /University, professor, publisher, marketplace, and payment routes and records remain preserved/u);
  assert.match(promotionPacket, /real minor or education-record data/u);
  assert.match(promotionPacket, /revert the main merge commit through a protected pull request/u);
});
