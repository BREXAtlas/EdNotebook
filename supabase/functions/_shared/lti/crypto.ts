import { HttpError } from "../runtime.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    throw new HttpError(400, "JWT encoding is invalid.");
  }
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64UrlEncode(value);
}

export interface ParsedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Uint8Array;
}

type JwkWithKid = JsonWebKey & { kid?: string };

export function parseJwt(token: string): ParsedJwt {
  if (token.length > 50_000) throw new HttpError(413, "LTI launch token is too large.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(400, "LTI launch token is malformed.");
  try {
    const header = JSON.parse(decoder.decode(base64UrlDecode(parts[0]))) as Record<string, unknown>;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(parts[1]))) as Record<string, unknown>;
    return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: base64UrlDecode(parts[2]) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "LTI launch token contains invalid JSON.");
  }
}

export async function verifyRs256Jwt(token: string, jwks: { keys?: JwkWithKid[] }): Promise<Record<string, unknown>> {
  const parsed = parseJwt(token);
  if (parsed.header.alg !== "RS256" || typeof parsed.header.kid !== "string") {
    throw new HttpError(401, "LTI launch must use RS256 with a registered key ID.");
  }
  const key = jwks.keys?.find((candidate) => candidate.kid === parsed.header.kid && candidate.kty === "RSA");
  if (!key) throw new HttpError(401, "The LTI signing key is not registered.");
  const cryptoKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, parsed.signature as unknown as BufferSource, encoder.encode(parsed.signingInput));
  if (!valid) throw new HttpError(401, "The LTI launch signature is invalid.");
  return parsed.payload;
}

function pemBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/u, "").replace(/-----END (?:RSA )?PRIVATE KEY-----/u, "").replace(/\s/gu, "");
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

export interface ToolSigningKey { kid: string; privateKey: CryptoKey; publicJwk: JsonWebKey }

export async function loadToolSigningKey(prefix = "LTI_SIGNING"): Promise<ToolSigningKey> {
  const pem = Deno.env.get(`${prefix}_PRIVATE_KEY_PEM`)?.replaceAll("\\n", "\n");
  const kid = Deno.env.get(`${prefix}_KID`);
  if (!pem || !kid) throw new HttpError(503, "LTI signing key is not configured.");
  let privateKey: CryptoKey;
  try {
    privateKey = await crypto.subtle.importKey("pkcs8", pemBytes(pem) as unknown as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
  } catch {
    throw new HttpError(503, "LTI signing key must be an RSA PKCS#8 private key.");
  }
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const publicJwk: JwkWithKid = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", use: "sig", kid };
  if (!publicJwk.n || !publicJwk.e) throw new HttpError(503, "LTI RSA public key could not be derived.");
  return { kid, privateKey, publicJwk };
}

export async function signRs256Jwt(payload: Record<string, unknown>, providedKey?: ToolSigningKey): Promise<string> {
  const key = providedKey || await loadToolSigningKey();
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: key.kid }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}
