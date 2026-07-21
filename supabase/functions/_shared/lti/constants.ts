export const LTI_VERSION = "1.3.0";
export const LTI_CLAIMS = Object.freeze({
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  targetLinkUri: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  launchPresentation: "https://purl.imsglobal.org/spec/lti/claim/launch_presentation",
  lis: "https://purl.imsglobal.org/spec/lti/claim/lis",
  custom: "https://purl.imsglobal.org/spec/lti/claim/custom",
  deepLinkingSettings: "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings",
  deepLinkData: "https://purl.imsglobal.org/spec/lti-dl/claim/data",
  contentItems: "https://purl.imsglobal.org/spec/lti-dl/claim/content_items",
  agsEndpoint: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
  nrps: "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice",
});

export const LTI_MESSAGES = Object.freeze({
  resourceLink: "LtiResourceLinkRequest",
  deepLinkRequest: "LtiDeepLinkingRequest",
  deepLinkResponse: "LtiDeepLinkingResponse",
});

export const LTI_SCOPES = Object.freeze({
  lineItem: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  lineItemReadonly: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
  score: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  resultReadonly: "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  nrps: "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
});

export const AGS_ACTIVITY_PROGRESS = Object.freeze(["Initialized", "Started", "InProgress", "Submitted", "Completed"]);
export const AGS_GRADING_PROGRESS = Object.freeze(["NotReady", "Failed", "Pending", "PendingManual", "FullyGraded"]);

const ROLE_MARKERS = Object.freeze({
  administrator: ["#Administrator", "/Administrator"],
  instructor: ["#Instructor", "/Instructor", "#Faculty", "/Faculty"],
  teaching_assistant: ["#TeachingAssistant", "/TeachingAssistant", "#ContentDeveloper", "/ContentDeveloper"],
  learner: ["#Learner", "/Learner", "#Student", "/Student"],
  observer: ["#Observer", "/Observer", "#Mentor", "/Mentor"],
  content_developer: ["#ContentDeveloper", "/ContentDeveloper"],
});

export function canonicalRole(roles: unknown): string {
  const values = Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
  for (const role of ["administrator", "instructor", "teaching_assistant", "learner", "observer", "content_developer"] as const) {
    if (values.some((value) => ROLE_MARKERS[role].some((marker) => value.endsWith(marker)))) return role;
  }
  return "unknown";
}

export function isInstructorRole(role: string): boolean {
  return ["administrator", "instructor", "teaching_assistant", "content_developer"].includes(role);
}
