import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { base64UrlDecode, base64UrlEncode, parseJwt, randomToken, sha256, verifyRs256Jwt } from "./crypto.ts";

Deno.test("round-trips base64url and produces unique opaque handles", () => {
  const value = "EdNotebook · LTI 1.3";
  assertEquals(new TextDecoder().decode(base64UrlDecode(base64UrlEncode(value))), value);
  const first = randomToken(32); const second = randomToken(32);
  assertNotEquals(first, second); assertEquals(first.includes("="), false);
});

Deno.test("hashes state and nonce deterministically without storing the secret", async () => {
  assertEquals(await sha256("state"), "4ba69735ca53765ed6a709edb56c6ea236b7193a3b29a6b390c346f0f4340e4e");
});

Deno.test("verifies RS256 signature and key ID", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", kid: "test-key" }));
  const body = base64UrlEncode(JSON.stringify({ sub: "subject-1" }));
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  assertEquals(parseJwt(jwt).payload.sub, "subject-1");
  assertEquals((await verifyRs256Jwt(jwt, { keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] })).sub, "subject-1");
});
