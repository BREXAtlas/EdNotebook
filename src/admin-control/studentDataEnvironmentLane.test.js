import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildStudentDataEnvironmentLaneRpcPayload,
  validateStudentDataEnvironmentLane,
} from "./studentDataEnvironmentLane.js";

const INSTITUTION_ID = "22222222-2222-4222-8222-222222222222";

function input(overrides = {}) {
  return {
    scopeType: "institution",
    scopeId: "",
    dataLane: "beta",
    status: "active",
    purpose: "Administrative staff and investor walkthrough testing.",
    evidenceReference: "walkthrough:beta-readiness",
    authorityAttestation: true,
    ...overrides,
  };
}

test("beta and pilot are the only assignable staging lanes", () => {
  assert.equal(validateStudentDataEnvironmentLane(INSTITUTION_ID, input()).valid, true);
  assert.equal(validateStudentDataEnvironmentLane(INSTITUTION_ID, input({ dataLane: "pilot" })).valid, true);
  const production = validateStudentDataEnvironmentLane(INSTITUTION_ID, input({ dataLane: "production" }));
  assert.equal(production.valid, false);
  assert.match(production.issues.join(" "), /production promotion/iu);
});

test("institution scope uses the institution ID and produces an attested RPC payload", () => {
  assert.deepEqual(buildStudentDataEnvironmentLaneRpcPayload(INSTITUTION_ID, input()), {
    p_institution_id: INSTITUTION_ID,
    p_scope_type: "institution",
    p_scope_id: INSTITUTION_ID,
    p_data_lane: "beta",
    p_status: "active",
    p_purpose: "Administrative staff and investor walkthrough testing.",
    p_evidence_reference: "walkthrough:beta-readiness",
    p_attestation: true,
  });
});

test("course and account assignments require exact IDs", () => {
  assert.equal(validateStudentDataEnvironmentLane(INSTITUTION_ID, input({ scopeType: "course" })).valid, false);
  assert.equal(validateStudentDataEnvironmentLane(INSTITUTION_ID, input({
    scopeType: "account",
    scopeId: "e1be0f06-2a6c-4d14-ac19-16867bbb424b",
  })).valid, true);
});

test("the global page label is server-resolved and production has no banner", async () => {
  const [banner, migration] = await Promise.all([
    readFile(new URL("../EnvironmentBanner.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/migrations/20260802233000_govern_student_data_promotion_preflight.sql", import.meta.url), "utf8"),
  ]);
  assert.match(banner, /get_my_student_data_environment_lane/u);
  assert.match(banner, /EDNOTEBOOK BETA MODE/u);
  assert.match(banner, /EDNOTEBOOK PILOT MODE/u);
  assert.match(banner, /if \(!isStaging\) return null/u);
  assert.doesNotMatch(banner, /URLSearchParams/u);
  assert.match(migration, /if p_data_lane not in \('beta','pilot'\) then raise exception 'Production lane cannot be assigned in staging'/u);
  assert.match(migration, /new\.data_lane := v_lane/u);
  assert.match(migration, /audit_events_institution_data_lane_occurred_idx/u);
  assert.match(migration, /legacy_unclassified_audit_count/u);
  assert.match(migration, /carried_account_ids uuid\[\]/u);
  assert.match(migration, /carried_course_ids uuid\[\]/u);
  assert.match(migration, /data_lane text not null check \(data_lane in \('beta','pilot'\)\)/u);
  assert.match(migration, /create policy student_data_environment_lane_versions_api_deny_all/u);
  assert.match(migration, /select course\.owner_id as user_id/u);
  assert.match(migration, /from public\.course_memberships membership/u);
  assert.match(migration, /course\.owner_id=v_actor/u);
  assert.doesNotMatch(migration, /course\.professor_id=v_actor/u);
  assert.match(migration, /previous_data_lane/u);
  assert.match(migration, /carry_set_sha256/u);
});
