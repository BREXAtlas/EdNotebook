import { HttpError } from "../runtime.ts";
import { canonicalRole, LTI_CLAIMS, LTI_MESSAGES, LTI_VERSION } from "./constants.ts";

const stringValue = (value: unknown, label: string, max = 2000): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new HttpError(401, `${label} is missing or invalid.`);
  return value;
};

export interface LaunchValidation {
  subject: string;
  deploymentId: string;
  messageType: string;
  targetLinkUri: string;
  roles: string[];
  canonicalRole: string;
  context: Record<string, unknown> | null;
  resourceLink: Record<string, unknown> | null;
  deepLinking: Record<string, unknown> | null;
  ags: Record<string, unknown> | null;
  nrps: Record<string, unknown> | null;
}

function audienceIncludes(aud: unknown, clientId: string): boolean {
  return aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
}

export function validateLaunchClaims(payload: Record<string, unknown>, expected: {
  issuer: string;
  clientId: string;
  deploymentId: string;
  nonce: string;
  targetLinkUri: string;
  now?: number;
}): LaunchValidation {
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (payload.iss !== expected.issuer) throw new HttpError(401, "LTI issuer does not match the registration.");
  if (!audienceIncludes(payload.aud, expected.clientId)) throw new HttpError(401, "LTI audience does not include this tool.");
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== expected.clientId) throw new HttpError(401, "LTI authorized party is invalid.");
  if (payload.nonce !== expected.nonce) throw new HttpError(401, "LTI nonce does not match the login request.");
  if (typeof payload.exp !== "number" || payload.exp < now - 30) throw new HttpError(401, "LTI launch token is expired.");
  if (typeof payload.iat !== "number" || payload.iat > now + 60 || payload.iat < now - 600) throw new HttpError(401, "LTI launch time is outside the allowed window.");
  if (payload[LTI_CLAIMS.version] !== LTI_VERSION) throw new HttpError(401, "Unsupported LTI version.");
  const deploymentId = stringValue(payload[LTI_CLAIMS.deploymentId], "LTI deployment ID", 500);
  if (deploymentId !== expected.deploymentId) throw new HttpError(401, "LTI deployment does not match the login request.");
  const messageType = stringValue(payload[LTI_CLAIMS.messageType], "LTI message type", 100);
  const supportedMessages: string[] = [LTI_MESSAGES.resourceLink, LTI_MESSAGES.deepLinkRequest];
  if (!supportedMessages.includes(messageType)) throw new HttpError(401, "Unsupported LTI message type.");
  const targetLinkUri = stringValue(payload[LTI_CLAIMS.targetLinkUri], "LTI target link URI");
  if (targetLinkUri !== expected.targetLinkUri) throw new HttpError(401, "LTI target link changed after login initiation.");
  const roleClaim = payload[LTI_CLAIMS.roles];
  const roles = Array.isArray(roleClaim) ? roleClaim.filter((value: unknown): value is string => typeof value === "string").slice(0, 50) : [];
  if (!roles.length) throw new HttpError(401, "LTI roles are required.");
  const context = payload[LTI_CLAIMS.context];
  const resourceLink = payload[LTI_CLAIMS.resourceLink];
  const deepLinking = payload[LTI_CLAIMS.deepLinkingSettings];
  if (messageType === LTI_MESSAGES.resourceLink && (!resourceLink || typeof resourceLink !== "object")) throw new HttpError(401, "LTI resource link is required.");
  if (messageType === LTI_MESSAGES.deepLinkRequest && (!deepLinking || typeof deepLinking !== "object")) throw new HttpError(401, "LTI Deep Linking settings are required.");
  return {
    subject: stringValue(payload.sub, "LTI subject", 1000), deploymentId, messageType, targetLinkUri, roles,
    canonicalRole: canonicalRole(roles),
    context: context && typeof context === "object" ? context as Record<string, unknown> : null,
    resourceLink: resourceLink && typeof resourceLink === "object" ? resourceLink as Record<string, unknown> : null,
    deepLinking: deepLinking && typeof deepLinking === "object" ? deepLinking as Record<string, unknown> : null,
    ags: payload[LTI_CLAIMS.agsEndpoint] && typeof payload[LTI_CLAIMS.agsEndpoint] === "object" ? payload[LTI_CLAIMS.agsEndpoint] as Record<string, unknown> : null,
    nrps: payload[LTI_CLAIMS.nrps] && typeof payload[LTI_CLAIMS.nrps] === "object" ? payload[LTI_CLAIMS.nrps] as Record<string, unknown> : null,
  };
}

export function ensureAllowedTarget(target: string, allowed: string[]): URL {
  let parsed: URL;
  try { parsed = new URL(target); } catch { throw new HttpError(400, "LTI target link URI is invalid."); }
  if (parsed.protocol !== "https:") throw new HttpError(400, "LTI target link URI must use HTTPS.");
  if (!allowed.includes(parsed.href)) throw new HttpError(400, "LTI target link URI is not registered for this deployment.");
  return parsed;
}

export function ensureServiceUrl(value: unknown, allowedHosts: string[], label: string): string | null {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 2000) throw new HttpError(401, `${label} is invalid.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new HttpError(401, `${label} is invalid.`); }
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) throw new HttpError(401, `${label} host is not registered.`);
  return url.href;
}
