import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP,
  LIVE_ACTIVATION_GATES,
  SYNTHETIC_PILOT_STEPS,
  applySyntheticPilotStep,
  createSyntheticPilotEvidencePacket,
  createSyntheticPilotState,
  evaluateLiveActivation,
} from "./syntheticInstitutionPilot.js";

test("the full synthetic institution journey closes and exports counts-only evidence", async () => {
  let state = createSyntheticPilotState();
  SYNTHETIC_PILOT_STEPS.forEach((step, index) => {
    state = applySyntheticPilotStep(
      state,
      step.id,
      step.actor,
      `2026-07-24T23:${String(index).padStart(2, "0")}:00.000Z`,
    );
  });

  assert.equal(state.course.status, "closed");
  assert.equal(state.student.gradeVisible, true);
  assert.equal(state.assignment.progressPoints, 10);
  assert.equal(state.closeout.tosEvidenceReady, true);
  assert.equal(state.audit.length, SYNTHETIC_PILOT_STEPS.length);
  assert.equal(state.audit[0].action, "semester_closeout");

  const packet = await createSyntheticPilotEvidencePacket(
    state,
    "2026-07-24T23:30:00.000Z",
  );
  assert.equal(packet.recordCounts.finalizedGrades, 1);
  assert.equal(packet.recordCounts.discussions, 2);
  assert.equal(packet.containsDirectIdentifiers, false);
  assert.equal(packet.containsRawGrades, false);
  assert.equal(packet.containsCredentials, false);
  assert.equal(packet.officialRecordTransfer, false);
  assert.deepEqual(
    packet.infrastructureMappings.map((mapping) => mapping.action),
    SYNTHETIC_PILOT_STEPS.map((step) => step.id),
  );
  assert.equal(
    packet.infrastructureMappings.length,
    EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP.length,
  );
  assert.match(packet.integrity.digest, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(packet), /@|student name|raw grade/i);
});

test("actions fail closed when attempted out of order or by the wrong role", () => {
  const initial = createSyntheticPilotState();
  const outOfOrder = applySyntheticPilotStep(
    initial,
    "grade_publish",
    "professor",
    "2026-07-24T23:00:00.000Z",
  );
  assert.equal(outOfOrder.nextStepIndex, 0);
  assert.equal(outOfOrder.audit[0].outcome, "denied");

  const wrongActor = applySyntheticPilotStep(
    initial,
    "institution_application",
    "agent",
    "2026-07-24T23:01:00.000Z",
  );
  assert.equal(wrongActor.nextStepIndex, 0);
  assert.match(wrongActor.audit[0].summary, /cannot perform/i);
});

test("live pilot and production activation remain denied until every gate passes", () => {
  assert.equal(
    evaluateLiveActivation("synthetic_bounded_pilot", {}).allowed,
    true,
  );
  const denied = evaluateLiveActivation("approved_pilot", {});
  assert.equal(denied.allowed, false);
  assert.deepEqual(denied.missing, LIVE_ACTIVATION_GATES);

  const complete = Object.fromEntries(
    LIVE_ACTIVATION_GATES.map((gate) => [gate, true]),
  );
  assert.equal(evaluateLiveActivation("approved_pilot", complete).allowed, true);
  assert.equal(evaluateLiveActivation("production", complete).allowed, true);
});
