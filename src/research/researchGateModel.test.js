import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  DIGITAL_LITERACY_RESEARCH_FIXTURE,
  evaluateResearchGate,
  purposeRequiresResearchGate,
  purposeUsesOrdinaryFeedbackMode,
  researchContractChangeRequiresNewVersion,
} from "./researchGateModel.js";

const NOW = new Date("2026-08-15T12:00:00.000Z");

function approvedContract(overrides = {}) {
  return {
    purpose: "research",
    institution_id: "institution-a",
    course_id: "course-a",
    purpose_statement: "Evaluate the Digital Literacy course using a bounded mixed-methods pilot.",
    research_activities: ["pre_post_assessment", "qualitative_interview"],
    data_owner: { name: "Pilot Data Owner", contact: "owner@example.edu" },
    effective_at: "2026-08-01T00:00:00.000Z",
    expires_at: "2026-12-31T23:59:59.000Z",
    notice_config: { version: "notice-v1", participant_notice: "Approved notice text." },
    consent_config: { mode: "required" },
    minimization_rules: { collection_limit: "Approved instrument fields only." },
    retention_days: 180,
    export_rules: { mode: "approved_scoped" },
    deletion_rules: { request_process: "Participant request with audited resolution." },
    instruments: [
      { instrument_kind: "pre_assessment", instrument_version: "1.0" },
      { instrument_kind: "post_assessment", instrument_version: "1.0" },
      { instrument_kind: "qualitative_interview", instrument_version: "1.0" },
    ],
    latest_determination: {
      decision: "approved",
      protocol_reference: "ASU-IRB-EXAMPLE-001",
      documentation_reference: "restricted://determinations/example",
      effective_at: "2026-07-20T00:00:00.000Z",
      expires_at: "2027-07-20T00:00:00.000Z",
    },
    feature_enabled: true,
    status: "active",
    activated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("ordinary product and course feedback do not enter research mode", () => {
  assert.equal(purposeUsesOrdinaryFeedbackMode("product_feedback"), true);
  assert.equal(purposeUsesOrdinaryFeedbackMode("course_feedback"), true);
  assert.equal(purposeRequiresResearchGate("product_feedback"), false);
  assert.equal(purposeRequiresResearchGate("research"), true);
  assert.deepEqual(evaluateResearchGate({ purpose: "product_feedback" }, { now: NOW }), {
    status: "ordinary_feedback",
    activated: false,
    collectionAllowed: false,
    blockers: [],
  });
});

test("the Digital Literacy fixture is synthetic and fail-closed", () => {
  const result = evaluateResearchGate(DIGITAL_LITERACY_RESEARCH_FIXTURE, { now: NOW });
  assert.equal(DIGITAL_LITERACY_RESEARCH_FIXTURE.fixture, true);
  assert.equal(result.status, "not_activated");
  assert.equal(result.collectionAllowed, false);
  assert.ok(result.blockers.includes("written_determination_missing_or_revoked"));
  assert.ok(result.blockers.includes("instrument_version_missing"));
  assert.ok(result.blockers.includes("explicit_activation_missing"));
});

test("collection readiness requires the exact approved, current, explicitly activated contract", () => {
  const result = evaluateResearchGate(approvedContract(), { now: NOW });
  assert.deepEqual(result, {
    status: "active",
    activated: true,
    collectionAllowed: true,
    blockers: [],
  });

  const noActivation = evaluateResearchGate(approvedContract({
    status: "approved",
    activated_at: null,
  }), { now: NOW });
  assert.equal(noActivation.collectionAllowed, false);
  assert.ok(noActivation.blockers.includes("explicit_activation_missing"));

  const expired = evaluateResearchGate(approvedContract({
    latest_determination: {
      ...approvedContract().latest_determination,
      expires_at: "2026-08-01T00:00:00.000Z",
    },
  }), { now: NOW });
  assert.ok(expired.blockers.includes("determination_not_current"));
});

test("changing purpose or an instrument version requires a new contract version", () => {
  assert.equal(researchContractChangeRequiresNewVersion({
    currentPurpose: "research",
    nextPurpose: "research",
    currentInstrumentVersion: "1.0",
    nextInstrumentVersion: "1.1",
  }), true);
  assert.equal(researchContractChangeRequiresNewVersion({
    currentPurpose: "course_feedback",
    nextPurpose: "research",
    currentInstrumentVersion: "1.0",
    nextInstrumentVersion: "1.0",
  }), true);
  assert.equal(researchContractChangeRequiresNewVersion({
    currentPurpose: "research",
    nextPurpose: "research",
    currentInstrumentVersion: "1.0",
    nextInstrumentVersion: "1.0",
  }), false);
});

test("the database migration keeps research tables private and collection fail-closed", async () => {
  const sql = await readFile(
    new URL("../../supabase/migrations/20260729042330_digital_literacy_research_gate.sql", import.meta.url),
    "utf8",
  );

  for (const table of [
    "research_pilot_projects",
    "research_pilot_versions",
    "research_pilot_instruments",
    "research_pilot_approval_records",
    "research_participation_states",
    "research_subject_requests",
    "research_response_records",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "u"));
  }
  assert.match(sql, /'research\.human_subjects_collection'[\s\S]*?'false'::jsonb/u);
  assert.match(sql, /create trigger research_response_records_gate/u);
  assert.match(sql, /private\.research_collection_is_allowed/u);
  assert.match(sql, /Research response collection is not active for this participant and version/u);
  assert.match(sql, /Research contract fields are immutable; create a new project version/u);
  assert.match(sql, /Instrument changes require a new draft research project version/u);
  assert.match(sql, /revoke all on[\s\S]*research_response_records[\s\S]*from public, anon, authenticated/u);
  assert.doesNotMatch(sql, /grant (?:select|insert|update|delete|all)[^;]*research_response_records[^;]*to authenticated/iu);
  assert.doesNotMatch(sql, /grant execute[^;]*to anon/iu);
});

test("the disposable database harness covers approval, tenant, consent, minimization, withdrawal, and deletion gates", async () => {
  const sql = await readFile(
    new URL("../../supabase/tests/digital_literacy_research_gate.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /^begin;/mu);
  assert.match(sql, /rollback;\s*$/mu);
  assert.match(sql, /PASS activation fails before a written determination/u);
  assert.match(sql, /PASS unrelated account cannot create or view cross-tenant research records/u);
  assert.match(sql, /PASS written determination cannot bypass the independent feature gate/u);
  assert.match(sql, /PASS instrument changes require a new research contract version/u);
  assert.match(sql, /PASS participation can be recorded only by the participant/u);
  assert.match(sql, /PASS enrollment and account terms do not imply research participation/u);
  assert.match(sql, /PASS instrument field allowlist and minimization reject direct identifiers/u);
  assert.match(sql, /PASS withdrawal immediately stops collection/u);
  assert.match(sql, /PASS withdrawal, deletion, and audit state remain visible/u);
});

test("the admin planning surface stays visibly inactive and separates ordinary feedback", async () => {
  const source = await readFile(new URL("./ResearchPilotGatePanel.jsx", import.meta.url), "utf8");
  assert.match(source, /NOT ACTIVATED/u);
  assert.match(source, /Product feedback, usability reports, feature voting, and course-improvement feedback remain available/u);
  assert.match(source, /Enrollment, an EdNotebook account, course work, or acceptance of account terms never counts as research participation/u);
  assert.doesNotMatch(source, /Activate research/u);
});
