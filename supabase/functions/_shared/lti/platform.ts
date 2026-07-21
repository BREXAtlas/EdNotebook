import { HttpError } from "../runtime.ts";
import { LTI_SCOPES } from "./constants.ts";
import { randomToken, signRs256Jwt } from "./crypto.ts";

export interface PlatformRegistration {
  client_id: string;
  issuer: string;
  oauth_token_url: string;
  oauth_audience?: string | null;
  enabled_scopes: string[];
  allowed_service_hosts?: string[];
}

export async function fetchPlatformJwks(jwksUrl: string, allowedHosts: string[]): Promise<{ keys?: JsonWebKey[] }> {
  const url = new URL(jwksUrl);
  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) throw new HttpError(401, "Platform JWKS host is not registered.");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7_000), redirect: "error" });
  if (!response.ok) throw new HttpError(502, "Platform signing keys could not be loaded.");
  const body = await response.json();
  if (!body || !Array.isArray(body.keys) || body.keys.length > 50) throw new HttpError(502, "Platform signing-key response is invalid.");
  return body;
}

export async function getPlatformAccessToken(registration: PlatformRegistration, requestedScopes: string[]): Promise<string> {
  const knownScopes = new Set<string>(Object.values(LTI_SCOPES));
  const approved = requestedScopes.filter((scope) => knownScopes.has(scope) && registration.enabled_scopes.includes(scope));
  if (!approved.length || approved.length !== requestedScopes.length) throw new HttpError(403, "Required LTI Advantage scope was not approved.");
  const tokenUrl = new URL(registration.oauth_token_url);
  const allowedHosts = (registration.allowed_service_hosts || []).map((host) => host.toLowerCase());
  if (tokenUrl.protocol !== "https:" || !allowedHosts.includes(tokenUrl.hostname.toLowerCase())) throw new HttpError(403, "The LMS token endpoint host is not registered.");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signRs256Jwt({
    iss: registration.client_id,
    sub: registration.client_id,
    aud: registration.oauth_audience || registration.oauth_token_url,
    iat: now,
    exp: now + 300,
    jti: randomToken(24),
  });
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: approved.join(" "),
  });
  const response = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!response.ok) throw new HttpError(502, `The LMS token endpoint returned HTTP ${response.status}.`);
  const token = await response.json();
  if (typeof token?.access_token !== "string" || token.token_type?.toLowerCase() !== "bearer") throw new HttpError(502, "The LMS token response is invalid.");
  return token.access_token;
}

export async function platformJson(url: string, token: string, options: { method?: string; body?: unknown; contentType?: string } = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(options.body ? { "Content-Type": options.contentType || "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(12_000),
    redirect: "error",
  });
  const text = await response.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!response.ok) throw new HttpError(502, `The LMS service returned HTTP ${response.status}.`, { status: response.status });
  return { response, body };
}
