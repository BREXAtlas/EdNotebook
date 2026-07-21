import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { loadToolSigningKey } from "../_shared/lti/crypto.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "GET is required." }), { status: 405, headers: { "Content-Type": "application/json" } });
  try {
    const current = await loadToolSigningKey();
    const keys = [current.publicJwk];
    if (Deno.env.get("LTI_SIGNING_PREVIOUS_PRIVATE_KEY_PEM") && Deno.env.get("LTI_SIGNING_PREVIOUS_KID")) {
      keys.push((await loadToolSigningKey("LTI_SIGNING_PREVIOUS")).publicJwk);
    }
    return new Response(JSON.stringify({ keys }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(JSON.stringify({ error: "LTI signing keys are not available." }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
});
