import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { ensureAllowedTarget, ensureServiceUrl, validateLaunchClaims } from "./claims.ts";
import { canonicalRole, LTI_CLAIMS, LTI_MESSAGES, LTI_VERSION } from "./constants.ts";

const now = 1_800_000_000;
const payload = {
  iss: "https://lms.example.edu",
  aud: "client-1",
  sub: "opaque-subject",
  nonce: "nonce-1",
  iat: now - 10,
  exp: now + 300,
  [LTI_CLAIMS.version]: LTI_VERSION,
  [LTI_CLAIMS.deploymentId]: "deployment-1",
  [LTI_CLAIMS.messageType]: LTI_MESSAGES.resourceLink,
  [LTI_CLAIMS.targetLinkUri]: "https://tool.example.edu/functions/v1/lti-launch",
  [LTI_CLAIMS.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
  [LTI_CLAIMS.context]: { id: "context-1" },
  [LTI_CLAIMS.resourceLink]: { id: "resource-1" },
};
const expected = { issuer: payload.iss, clientId: "client-1", deploymentId: "deployment-1", nonce: "nonce-1", targetLinkUri: payload[LTI_CLAIMS.targetLinkUri], now };

Deno.test("validates a complete LTI resource-link launch", () => {
  const launch = validateLaunchClaims(payload, expected);
  assertEquals(launch.subject, "opaque-subject");
  assertEquals(launch.canonicalRole, "learner");
});

Deno.test("rejects wrong issuer, audience, nonce, deployment, target, and replay-window claims", () => {
  for (const [field, value] of [["iss", "https://attacker.example"], ["aud", "wrong-client"], ["nonce", "wrong-nonce"], [LTI_CLAIMS.deploymentId, "wrong-deployment"], [LTI_CLAIMS.targetLinkUri, "https://tool.example.edu/wrong"], ["exp", now - 1000]] as const) {
    assertThrows(() => validateLaunchClaims({ ...payload, [field]: value }, expected));
  }
});

Deno.test("requires azp when an ID token has multiple audiences", () => {
  assertThrows(() => validateLaunchClaims({ ...payload, aud: ["client-1", "other"] }, expected));
  assertEquals(validateLaunchClaims({ ...payload, aud: ["client-1", "other"], azp: "client-1" }, expected).subject, "opaque-subject");
});

Deno.test("normalizes familiar LTI roles", () => {
  assertEquals(canonicalRole(["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"]), "instructor");
  assertEquals(canonicalRole(["http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant"]), "teaching_assistant");
  assertEquals(canonicalRole([]), "unknown");
});

Deno.test("requires exact registered target URLs and allowlisted HTTPS service hosts", () => {
  assertEquals(ensureAllowedTarget(payload[LTI_CLAIMS.targetLinkUri], [payload[LTI_CLAIMS.targetLinkUri]]).hostname, "tool.example.edu");
  assertThrows(() => ensureAllowedTarget("https://tool.example.edu/other", [payload[LTI_CLAIMS.targetLinkUri]]));
  assertEquals(ensureServiceUrl("https://lms.example.edu/ags/1", ["lms.example.edu"], "AGS")?.includes("/ags/1"), true);
  assertThrows(() => ensureServiceUrl("https://attacker.example/ags", ["lms.example.edu"], "AGS"));
});
