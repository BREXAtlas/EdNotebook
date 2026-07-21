import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, errorResponse, HttpError } from "../_shared/runtime.ts";
import { ensureAllowedTarget } from "../_shared/lti/claims.ts";
import { randomToken, sha256 } from "../_shared/lti/crypto.ts";
import { edgeFunctionUrl, parseLtiRequest } from "../_shared/lti/request.ts";

Deno.serve(async (req) => {
  try {
    const input = await parseLtiRequest(req);
    const issuer = String(input.iss || "").trim();
    if (!issuer.startsWith("https://") || !input.login_hint || !input.target_link_uri || !input.lti_deployment_id) throw new HttpError(400, "Issuer, login hint, target link, and deployment ID are required.");
    const admin = adminClient();
    let query = admin.from("lti_platform_registrations").select("*").eq("issuer", issuer).in("status", ["testing", "active"]);
    if (input.client_id) query = query.eq("client_id", input.client_id);
    const { data: registrations, error: registrationError } = await query.limit(2);
    if (registrationError) throw registrationError;
    if (!registrations || registrations.length !== 1) throw new HttpError(400, "The LTI platform registration is missing or ambiguous.");
    const registration = registrations[0];
    const { data: deployment, error: deploymentError } = await admin.from("lti_deployments").select("*").eq("registration_id", registration.id).eq("deployment_id", input.lti_deployment_id).in("status", ["testing", "active"]).maybeSingle();
    if (deploymentError) throw deploymentError;
    if (!deployment) throw new HttpError(403, "The LTI deployment is not enabled.");
    ensureAllowedTarget(input.target_link_uri, deployment.allowed_target_link_urls || []);

    const state = randomToken(32);
    const nonce = randomToken(32);
    const { error: stateError } = await admin.from("lti_launch_states").insert({
      registration_id: registration.id,
      deployment_id: deployment.id,
      state_hash: await sha256(state),
      nonce_hash: await sha256(nonce),
      login_hint_hash: await sha256(input.login_hint),
      target_link_uri: input.target_link_uri,
      lti_message_hint: input.lti_message_hint?.slice(0, 4000) || null,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (stateError) throw stateError;

    const authorization = new URL(registration.oidc_authorization_url);
    authorization.searchParams.set("scope", "openid");
    authorization.searchParams.set("response_type", "id_token");
    authorization.searchParams.set("response_mode", "form_post");
    authorization.searchParams.set("prompt", "none");
    authorization.searchParams.set("client_id", registration.client_id);
    authorization.searchParams.set("redirect_uri", edgeFunctionUrl("lti-launch"));
    authorization.searchParams.set("login_hint", input.login_hint);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("nonce", nonce);
    if (input.lti_message_hint) authorization.searchParams.set("lti_message_hint", input.lti_message_hint);
    return Response.redirect(authorization.href, 302);
  } catch (error) {
    return errorResponse(req, error);
  }
});
