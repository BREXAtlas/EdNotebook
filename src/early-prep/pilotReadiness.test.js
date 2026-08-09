import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EARLY_PREP_HUMAN_APPROVAL_GATES,
  EARLY_PREP_PILOT_ACKNOWLEDGEMENTS,
  EARLY_PREP_STAGING_WALKTHROUGH_CHECKS,
  EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE,
  EARLY_PREP_TECHNICAL_EVIDENCE,
  prepareEarlyPrepInstitutionReviewPacket,
  previewEarlyPrepPilotReadiness,
} from "./pilotReadiness.js";

const liveLane = await readFile(new URL("../admin-control/liveServiceOperatingLane.js", import.meta.url), "utf8");
const dataLane = await readFile(new URL("../admin-control/studentDataEnvironmentLane.js", import.meta.url), "utf8");
const privacy = await readFile(new URL("../admin-control/privacyRecordsApprovalDecision.js", import.meta.url), "utf8");
const security = await readFile(new URL("../admin-control/securityApprovalDecision.js", import.meta.url), "utf8");
const accessibility = await readFile(new URL("../admin-control/accessibilityApprovalDecision.js", import.meta.url), "utf8");

const ALL_ACKNOWLEDGEMENTS = Object.fromEntries(EARLY_PREP_PILOT_ACKNOWLEDGEMENTS.map(({ id }) => [id, true]));

test("readiness inventory separates eight technical evidence items from seven human decisions", () => {
  assert.equal(EARLY_PREP_TECHNICAL_EVIDENCE.length, 8);
  assert.equal(EARLY_PREP_HUMAN_APPROVAL_GATES.length, 7);
  assert.ok(EARLY_PREP_TECHNICAL_EVIDENCE.every(({ status }) => status === "repository_evidence_ready"));
  assert.ok(EARLY_PREP_HUMAN_APPROVAL_GATES.every(({ status }) => status === "authorized_human_decision_required"));
  assert.ok(Object.isFrozen(EARLY_PREP_TECHNICAL_EVIDENCE));
  assert.ok(Object.isFrozen(EARLY_PREP_HUMAN_APPROVAL_GATES));
  assert.equal(EARLY_PREP_STAGING_WALKTHROUGH_CHECKS.length, 16);
  assert.ok(EARLY_PREP_STAGING_WALKTHROUGH_CHECKS.every(({ status }) => status === "passed_staging_walkthrough"));
  assert.equal(EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE.status, "passed");
  assert.equal(EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE.completedChecks, 16);
  assert.match(EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE.deployedCommit, /^[0-9a-f]{40}$/u);
});

test("preview is Early Prep-only and rejects real data, integrations, production, research, and commerce", () => {
  assert.throws(() => previewEarlyPrepPilotReadiness({ division: "university" }), /early_prep_division_required/u);
  assert.throws(() => previewEarlyPrepPilotReadiness({ classification: "real_student_data" }), /synthetic_data_only/u);
  assert.throws(() => previewEarlyPrepPilotReadiness({ integrationMode: "powerschool" }), /live_integrations_not_authorized/u);
  assert.throws(() => previewEarlyPrepPilotReadiness({ productionMode: "enabled" }), /production_not_authorized/u);
  assert.throws(() => previewEarlyPrepPilotReadiness({ researchMode: "enabled" }), /research_not_authorized/u);
  assert.throws(() => previewEarlyPrepPilotReadiness({ commerceMode: "enabled" }), /commerce_not_authorized/u);
});

test("technical evidence cannot claim institution approval or activate a pilot", () => {
  const preview = previewEarlyPrepPilotReadiness();
  assert.equal(preview.counts.technicalEvidenceReady, 8);
  assert.equal(preview.counts.stagingWalkthroughChecksPending, 0);
  assert.equal(preview.counts.stagingWalkthroughChecksCompleted, 16);
  assert.equal(preview.counts.humanDecisionsRequired, 7);
  assert.equal(preview.counts.institutionApprovalsRecorded, 0);
  assert.equal(preview.status, "ready_for_beta_promotion_review");
  assert.equal(preview.betaPromotionDecisionStatus, "not_recorded");
  assert.equal(preview.betaPromotionAuthorized, false);
  assert.equal(preview.pilotApproved, false);
  assert.equal(preview.stagingWalkthroughCompleted, true);
  assert.equal(preview.mainPromotionAuthorized, false);
  assert.equal(preview.liveDataLaneAssigned, false);
  assert.equal(preview.realMinorDataAuthorized, false);
  assert.equal(preview.productionActivated, false);
  assert.equal(preview.paymentsEnabled, false);
  assert.equal(preview.universityRecordsModified, false);
});

test("institution review packet requires every boundary acknowledgement", () => {
  const preview = previewEarlyPrepPilotReadiness();
  assert.throws(() => prepareEarlyPrepInstitutionReviewPacket(preview, {}), /acknowledgement_required/u);
  const incomplete = { ...ALL_ACKNOWLEDGEMENTS, noLiveIntegrations: false };
  assert.throws(() => prepareEarlyPrepInstitutionReviewPacket(preview, incomplete), /noLiveIntegrations/u);
});

test("packet remains review evidence with no approval, activation, or real-data authority", () => {
  const packet = prepareEarlyPrepInstitutionReviewPacket(previewEarlyPrepPilotReadiness(), ALL_ACKNOWLEDGEMENTS);
  assert.equal(packet.status, "ready_for_beta_promotion_review");
  assert.equal(packet.betaPromotionDecisionStatus, "not_recorded");
  assert.equal(packet.betaPromotionAuthorized, false);
  assert.equal(packet.institutionDecisionStatus, "not_recorded");
  assert.equal(packet.humanApprovalGates.length, 7);
  assert.ok(packet.humanApprovalGates.every(({ status }) => status === "authorized_human_decision_required"));
  assert.equal(packet.pilotApproved, false);
  assert.equal(packet.pilotActivated, false);
  assert.equal(packet.stagingWalkthroughChecks.length, 16);
  assert.ok(packet.stagingWalkthroughChecks.every(({ status }) => status === "passed_staging_walkthrough"));
  assert.equal(packet.stagingWalkthroughCompleted, true);
  assert.equal(packet.mainPromotionAuthorized, false);
  assert.equal(packet.liveDataLaneAssigned, false);
  assert.equal(packet.realMinorDataAuthorized, false);
  assert.equal(packet.liveIntegrationAuthorized, false);
  assert.equal(packet.researchActivated, false);
  assert.match(packet.packetHash, /^fnv1a-[0-9a-f]{8}$/u);
});

test("packet confirmation rejects a changed readiness preview", () => {
  const preview = previewEarlyPrepPilotReadiness();
  const tampered = { ...preview, pilotApproved: true };
  assert.throws(() => prepareEarlyPrepInstitutionReviewPacket(tampered, ALL_ACKNOWLEDGEMENTS), /integrity_failed/u);
});

test("existing governed controls preserve human authority and keep production separate", () => {
  assert.match(liveLane, /authorityAttestation/u);
  assert.match(liveLane, /Choose Beta or Pilot\. Unlabeled Production requires the protected production-promotion workflow/u);
  assert.match(dataLane, /An authorized human must attest to the lane assignment/u);
  assert.match(privacy, /PASS is unavailable while 28 lifecycle domains remain explicitly blocked/u);
  assert.match(security, /The reviewer must attest to their security authority/u);
  assert.match(accessibility, /PASS requires complete-process manual review/u);
});
