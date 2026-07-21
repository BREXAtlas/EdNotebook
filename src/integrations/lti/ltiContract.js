export const LTI_ADVANTAGE_SCOPES = Object.freeze([
  ["https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly", "Roster (NRPS)"],
  ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem", "Create and update grade columns"],
  ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly", "Read grade columns"],
  ["https://purl.imsglobal.org/spec/lti-ags/scope/score", "Send grades"],
  ["https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly", "Read grade results"],
]);

export const LTI_STATUS_LABELS = Object.freeze({ setup: "Setup incomplete", testing: "Testing", active: "Active", suspended: "Suspended" });

export function splitList(value) {
  return Array.from(new Set(String(value || "").split(/[\n,]/u).map((item) => item.trim()).filter(Boolean)));
}

export function ltiRegistrationReadiness(registration, deployments = [], contexts = [], gradeSync = []) {
  const linkedDeployments = deployments.filter((item) => item.registration_id === registration.id);
  const deploymentIds = new Set(linkedDeployments.map((item) => item.id));
  const checks = [
    ["Platform endpoints", [registration.issuer, registration.client_id, registration.oidc_authorization_url, registration.jwks_url, registration.oauth_token_url].every(Boolean)],
    ["Deployment ID", linkedDeployments.length > 0],
    ["Instructor launch", linkedDeployments.some((item) => item.last_instructor_launch_at)],
    ["Learner launch", linkedDeployments.some((item) => item.last_learner_launch_at)],
    ["Course context mapped", contexts.some((item) => deploymentIds.has(item.deployment_id) && item.mapping_status === "mapped")],
    ["Grade passback verified", gradeSync.some((item) => deploymentIds.has(item.deployment_id) && item.status === "succeeded")],
  ];
  return { checks, ready: checks.every(([, passed]) => passed) };
}

export function launchTokenFromHash(hash = window.location.hash) {
  const query = hash.split("?")[1] || "";
  return new URLSearchParams(query).get("launch") || "";
}
