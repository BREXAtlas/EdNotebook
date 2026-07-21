import test from "node:test";
import assert from "node:assert/strict";
import { LTI_ADVANTAGE_SCOPES, launchTokenFromHash, ltiRegistrationReadiness, splitList } from "./ltiContract.js";

test("uses the standard NRPS and AGS scope identifiers", () => {
  const scopes = LTI_ADVANTAGE_SCOPES.map(([scope]) => scope);
  assert.ok(scopes.includes("https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly"));
  assert.ok(scopes.includes("https://purl.imsglobal.org/spec/lti-ags/scope/score"));
  assert.equal(new Set(scopes).size, 5);
});

test("normalizes owner-entered hostname and URL lists without duplicates", () => {
  assert.deepEqual(splitList("blackboard.example.edu\nservices.example.edu,blackboard.example.edu"), ["blackboard.example.edu", "services.example.edu"]);
});

test("keeps the opaque launch handle in the URL fragment", () => {
  assert.equal(launchTokenFromHash("#/lti/student?launch=opaque-token"), "opaque-token");
  assert.equal(launchTokenFromHash("#/lti/student"), "");
});

test("does not label a registration ready before real instructor, learner, mapping, and grade tests", () => {
  const registration = { id: "registration-1", issuer: "https://lms.example.edu", client_id: "client", oidc_authorization_url: "https://lms.example.edu/auth", jwks_url: "https://lms.example.edu/jwks", oauth_token_url: "https://lms.example.edu/token" };
  const before = ltiRegistrationReadiness(registration, [{ id: "deployment-1", registration_id: registration.id }], [], []);
  assert.equal(before.ready, false);
  const after = ltiRegistrationReadiness(registration, [{ id: "deployment-1", registration_id: registration.id, last_instructor_launch_at: "2026-07-21T10:00:00Z", last_learner_launch_at: "2026-07-21T10:05:00Z" }], [{ deployment_id: "deployment-1", mapping_status: "mapped" }], [{ deployment_id: "deployment-1", status: "succeeded" }]);
  assert.equal(after.ready, true);
});
