import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildLiveServiceOperatingLaneRpcPayload,
  validateLiveServiceOperatingLane,
} from "./liveServiceOperatingLane.js";

const INPUT = Object.freeze({
  operatingLane: "pilot",
  sourceCommit: "e39c17b6a85089b125f099523414c7fac9622fbf",
  purpose: "Move the same approved live accounts and courses from Beta into the Digital Literacy Pilot.",
  evidenceReference: "release:live-pilot-acceptance",
  authorityAttestation: true,
});

test("Beta and Pilot are live operating lanes while Production stays separately protected", () => {
  assert.equal(validateLiveServiceOperatingLane(INPUT).valid, true);
  assert.equal(validateLiveServiceOperatingLane({ ...INPUT, operatingLane: "beta" }).valid, true);
  const production = validateLiveServiceOperatingLane({ ...INPUT, operatingLane: "production" });
  assert.equal(production.valid, false);
  assert.match(production.issues.join(" "), /protected production-promotion/iu);
});

test("the live-lane RPC payload is human-attested and commit-bound", () => {
  assert.deepEqual(buildLiveServiceOperatingLaneRpcPayload(INPUT), {
    p_operating_lane: "pilot",
    p_source_commit: "e39c17b6a85089b125f099523414c7fac9622fbf",
    p_purpose: "Move the same approved live accounts and courses from Beta into the Digital Literacy Pilot.",
    p_evidence_reference: "release:live-pilot-acceptance",
    p_attestation: true,
  });
});

test("the banner keeps the staging sandbox separate from the live Beta/Pilot label", async () => {
  const [banner, portalHome, migration, deployment] = await Promise.all([
    readFile(new URL("../EnvironmentBanner.jsx", import.meta.url), "utf8"),
    readFile(new URL("../portal/PortalHome.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/migrations/20260803033914_correct_live_beta_pilot_release_lanes.sql", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/pages-deploy.yml", import.meta.url), "utf8"),
  ]);
  assert.match(banner, /EDNOTEBOOK STAGING SANDBOX · TEST DATA ONLY/u);
  assert.match(banner, /EDNOTEBOOK BETA · LIVE SERVICE/u);
  assert.match(banner, /EDNOTEBOOK PILOT · LIVE SERVICE/u);
  assert.match(banner, /get_live_service_operating_lane/u);
  assert.match(banner, /if \(liveLane === "production"\) return null/u);
  assert.match(banner, /Early Access Beta/u);
  assert.match(banner, /You’re helping test EdNotebook before its official release/u);
  assert.match(banner, /You’re using a pre-release version of EdNotebook/u);
  assert.match(portalHome, /FOUNDING BETA PROGRAM/u);
  assert.match(portalHome, /lifetime free access/u);
  assert.match(portalHome, /priority support/u);
  assert.match(portalHome, /Join as a student/u);
  assert.match(portalHome, /Join as an educator/u);
  assert.doesNotMatch(banner, /BETA MODE · STAGING|PILOT MODE · STAGING/u);
  assert.match(migration, /new_site_created',false/u);
  assert.match(migration, /new_database_created',false/u);
  assert.match(migration, /new_url_created',false/u);
  assert.match(migration, /if v_actor is null then raise exception 'Authentication required'/u);
  assert.match(migration, /grant execute on function public\.get_live_service_operating_lane\(\) to authenticated/u);
  assert.doesNotMatch(migration, /grant execute on function public\.get_live_service_operating_lane\(\) to anon/u);
  assert.match(migration, /carried_account_ids uuid\[\]/u);
  assert.match(migration, /carried_course_ids uuid\[\]/u);
  assert.match(deployment, /VITE_LIVE_OPERATING_LANE/u);
  assert.match(deployment, /must be beta or pilot; unlabeled production requires the protected production-promotion workflow/u);
  assert.match(deployment, /"deployment_surface": "live_service"/u);
  assert.match(deployment, /"deployment_surface": "staging_sandbox"/u);
});
