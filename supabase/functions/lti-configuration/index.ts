import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { edgeFunctionUrl, siteUrl } from "../_shared/lti/request.ts";

Deno.serve((req) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "GET is required." }), { status: 405, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({
    title: "EdNotebook",
    description: "EdNotebook course, roster, Deep Linking, and grade services",
    oidc_initiation_url: edgeFunctionUrl("lti-oidc-login"),
    target_link_uri: edgeFunctionUrl("lti-launch"),
    redirect_uris: [edgeFunctionUrl("lti-launch")],
    public_jwk_url: edgeFunctionUrl("lti-jwks"),
    deep_linking_launch_url: edgeFunctionUrl("lti-launch"),
    home_url: `${siteUrl()}/#/admin/integrations/lti`,
    lti_version: "1.3.0",
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
});
