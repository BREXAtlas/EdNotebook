import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, HttpError } from "../_shared/runtime.ts";
import { ensureAllowedTarget, ensureServiceUrl, validateLaunchClaims } from "../_shared/lti/claims.ts";
import { isInstructorRole, LTI_MESSAGES } from "../_shared/lti/constants.ts";
import { randomToken, sha256, verifyRs256Jwt } from "../_shared/lti/crypto.ts";
import { fetchPlatformJwks } from "../_shared/lti/platform.ts";
import { htmlResponse, parseLtiRequest, safeErrorHtml, siteUrl } from "../_shared/lti/request.ts";

const clean = (value: unknown, max = 500): string | null => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  try {
    const input = await parseLtiRequest(req);
    if (!input.state || !input.id_token) throw new HttpError(400, "LTI state and ID token are required.");
    const admin = adminClient();
    const stateHash = await sha256(input.state);
    const { data: state, error: stateError } = await admin.from("lti_launch_states").select("*").eq("state_hash", stateHash).maybeSingle();
    if (stateError) throw stateError;
    if (!state || state.consumed_at || new Date(state.expires_at).getTime() <= Date.now()) throw new HttpError(401, "LTI state is expired, invalid, or already used.");
    const [{ data: registration, error: registrationError }, { data: deployment, error: deploymentError }] = await Promise.all([
      admin.from("lti_platform_registrations").select("*").eq("id", state.registration_id).single(),
      admin.from("lti_deployments").select("*").eq("id", state.deployment_id).single(),
    ]);
    if (registrationError) throw registrationError;
    if (deploymentError) throw deploymentError;
    if (!["testing", "active"].includes(registration.status) || !["testing", "active"].includes(deployment.status)) throw new HttpError(403, "This LTI connection is not enabled.");
    ensureAllowedTarget(state.target_link_uri, deployment.allowed_target_link_urls || []);
    const jwksHost = new URL(registration.jwks_url).hostname.toLowerCase();
    const allowedHosts = Array.from(new Set([jwksHost, ...(registration.allowed_service_hosts || []).map((host: string) => host.toLowerCase())]));
    const payload = await verifyRs256Jwt(input.id_token, await fetchPlatformJwks(registration.jwks_url, allowedHosts));
    const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
    const launch = validateLaunchClaims(payload, { issuer: registration.issuer, clientId: registration.client_id, deploymentId: deployment.deployment_id, nonce, targetLinkUri: state.target_link_uri });
    const nonceHash = await sha256(nonce);
    if (nonceHash !== state.nonce_hash) throw new HttpError(401, "LTI nonce does not match the login request.");
    const { error: consumeError } = await admin.rpc("consume_lti_launch_state", { p_state_hash: stateHash, p_nonce_hash: nonceHash });
    if (consumeError) throw new HttpError(401, "LTI state is expired, invalid, or already used.");

    const contextId = clean(launch.context?.id, 1000);
    if (!contextId) throw new HttpError(401, "LTI course context is required.");
    const { data: existingContext, error: contextLookupError } = await admin.from("lti_context_mappings").select("*").eq("deployment_id", deployment.id).eq("lti_context_id", contextId).maybeSingle();
    if (contextLookupError) throw contextLookupError;
    let context = existingContext;
    if (context) {
      const { data, error } = await admin.from("lti_context_mappings").update({ lti_context_label: clean(launch.context?.label), lti_context_title: clean(launch.context?.title), lti_context_type: Array.isArray(launch.context?.type) ? launch.context.type.filter((value): value is string => typeof value === "string").slice(0, 20) : [], last_launched_at: new Date().toISOString() }).eq("id", context.id).select().single();
      if (error) throw error; context = data;
    } else {
      const { data, error } = await admin.from("lti_context_mappings").insert({ deployment_id: deployment.id, institution_id: deployment.institution_id, lti_context_id: contextId, lti_context_label: clean(launch.context?.label), lti_context_title: clean(launch.context?.title), lti_context_type: Array.isArray(launch.context?.type) ? launch.context.type.filter((value): value is string => typeof value === "string").slice(0, 20) : [], last_launched_at: new Date().toISOString() }).select().single();
      if (error) throw error; context = data;
    }

    const retainProfile = registration.settings?.retain_roster_profile !== false;
    const profileFields = retainProfile ? { external_user_id: clean(payload["https://purl.imsglobal.org/spec/lti/claim/lis"] && (payload["https://purl.imsglobal.org/spec/lti/claim/lis"] as Record<string, unknown>).person_sourcedid), given_name: clean(payload.given_name), family_name: clean(payload.family_name), display_name: clean(payload.name), email: clean(payload.email, 320)?.toLowerCase() } : {};
    const { data: existingUser, error: userLookupError } = await admin.from("lti_user_mappings").select("*").eq("deployment_id", deployment.id).eq("lti_subject", launch.subject).maybeSingle();
    if (userLookupError) throw userLookupError;
    let user = existingUser;
    if (user) {
      const { data, error } = await admin.from("lti_user_mappings").update({ canonical_role: launch.canonicalRole, lti_roles: launch.roles, ...profileFields, last_launched_at: new Date().toISOString() }).eq("id", user.id).select().single();
      if (error) throw error; user = data;
    } else {
      const { data, error } = await admin.from("lti_user_mappings").insert({ deployment_id: deployment.id, institution_id: deployment.institution_id, lti_subject: launch.subject, canonical_role: launch.canonicalRole, lti_roles: launch.roles, ...profileFields, last_launched_at: new Date().toISOString() }).select().single();
      if (error) throw error; user = data;
    }

    let resource = null;
    if (launch.messageType === LTI_MESSAGES.resourceLink) {
      const resourceLinkId = clean(launch.resourceLink?.id, 1000);
      if (!resourceLinkId) throw new HttpError(401, "LTI resource-link ID is required.");
      const { data: existingResource, error: resourceLookupError } = await admin.from("lti_resource_links").select("*").eq("deployment_id", deployment.id).eq("lti_resource_link_id", resourceLinkId).maybeSingle();
      if (resourceLookupError) throw resourceLookupError;
      const custom = payload["https://purl.imsglobal.org/spec/lti/claim/custom"] && typeof payload["https://purl.imsglobal.org/spec/lti/claim/custom"] === "object" ? payload["https://purl.imsglobal.org/spec/lti/claim/custom"] as Record<string, unknown> : {};
      const targetType = ["course", "publication", "lesson", "assignment"].includes(String(custom.ednotebook_target_type)) ? String(custom.ednotebook_target_type) : existingResource?.target_type || "course";
      const targetId = clean(custom.ednotebook_target_id, 100);
      let publicationId = existingResource?.publication_id || null;
      let assignmentId = existingResource?.assignment_id || null;
      let lessonKey = existingResource?.lesson_key || null;
      if (targetType === "course" && context.ednotebook_course_id) {
        const { data: publication } = await admin.from("course_publications").select("id").eq("course_id", context.ednotebook_course_id).eq("status", "published").maybeSingle();
        publicationId = publication?.id || null;
      } else if (targetType === "publication" || targetType === "lesson") {
        const { data: publication } = await admin.from("course_publications").select("id").eq("id", targetId).eq("course_id", context.ednotebook_course_id).eq("status", "published").maybeSingle();
        if (!publication) throw new HttpError(403, "The linked EdNotebook publication is not available for this course.");
        publicationId = publication.id;
        lessonKey = targetType === "lesson" ? clean(custom.ednotebook_lesson_key, 500) : null;
      } else if (targetType === "assignment") {
        const { data: assignment } = await admin.from("assignments").select("id").eq("id", targetId).eq("course_id", context.ednotebook_course_id).maybeSingle();
        if (!assignment) throw new HttpError(403, "The linked EdNotebook assignment is not available for this course.");
        assignmentId = assignment.id;
      }
      const resourceValues = { context_mapping_id: context.id, ednotebook_course_id: context.ednotebook_course_id, title: clean(launch.resourceLink?.title), description: clean(launch.resourceLink?.description, 2000), target_type: targetType, publication_id: publicationId, assignment_id: assignmentId, lesson_key: lessonKey, status: context.mapping_status === "mapped" ? "active" : "pending", last_launched_at: new Date().toISOString() };
      if (existingResource) {
        const { data, error } = await admin.from("lti_resource_links").update(resourceValues).eq("id", existingResource.id).select().single();
        if (error) throw error; resource = data;
      } else {
        const { data, error } = await admin.from("lti_resource_links").insert({ deployment_id: deployment.id, institution_id: deployment.institution_id, lti_resource_link_id: resourceLinkId, ...resourceValues }).select().single();
        if (error) throw error; resource = data;
      }
    }

    const grantedScopes = Array.from(new Set([...(Array.isArray(launch.ags?.scope) ? launch.ags.scope : []), ...(launch.nrps ? ["https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly"] : [])].filter((value): value is string => typeof value === "string")));
    if (launch.nrps && (!Array.isArray(launch.nrps.service_versions) || !launch.nrps.service_versions.includes("2.0"))) throw new HttpError(401, "Unsupported NRPS service version.");
    const deepLinkAcceptTypes = Array.isArray(launch.deepLinking?.accept_types) ? launch.deepLinking.accept_types.filter((value): value is string => typeof value === "string").slice(0, 20) : [];
    if (launch.messageType === LTI_MESSAGES.deepLinkRequest && !deepLinkAcceptTypes.includes("ltiResourceLink")) throw new HttpError(403, "The LMS Deep Linking request does not accept LTI resource links.");
    const endpointValues = {
      ags_lineitems_url: ensureServiceUrl(launch.ags?.lineitems, allowedHosts, "AGS line-items URL"),
      ags_lineitem_url: ensureServiceUrl(launch.ags?.lineitem, allowedHosts, "AGS line-item URL"),
      nrps_memberships_url: ensureServiceUrl(launch.nrps?.context_memberships_url, allowedHosts, "NRPS memberships URL"),
      granted_scopes: grantedScopes,
      last_validated_at: new Date().toISOString(),
    };
    const { data: existingService, error: serviceLookupError } = await admin.from("lti_service_endpoints").select("*").eq("deployment_id", deployment.id).eq("context_mapping_id", context.id).filter("resource_link_id", resource ? "eq" : "is", resource?.id || null).maybeSingle();
    if (serviceLookupError) throw serviceLookupError;
    let service;
    if (existingService) {
      const { data, error } = await admin.from("lti_service_endpoints").update(endpointValues).eq("id", existingService.id).select().single();
      if (error) throw error; service = data;
    } else {
      const { data, error } = await admin.from("lti_service_endpoints").insert({ deployment_id: deployment.id, context_mapping_id: context.id, resource_link_id: resource?.id || null, ...endpointValues }).select().single();
      if (error) throw error; service = data;
    }

    const returnUrl = ensureServiceUrl(launch.deepLinking?.deep_link_return_url, allowedHosts, "Deep Linking return URL");
    const launchToken = randomToken(32);
    const { error: sessionError } = await admin.from("lti_launch_sessions").insert({ token_hash: await sha256(launchToken), deployment_id: deployment.id, context_mapping_id: context.id, user_mapping_id: user.id, resource_link_id: resource?.id || null, service_endpoint_id: service.id, message_type: launch.messageType, canonical_role: launch.canonicalRole, target_link_uri: launch.targetLinkUri, return_url: returnUrl, deep_link_data: clean(launch.deepLinking?.data, 4000), deep_link_accept_multiple: launch.deepLinking?.accept_multiple === true, deep_link_accept_types: deepLinkAcceptTypes, locale: clean((payload["https://purl.imsglobal.org/spec/lti/claim/launch_presentation"] as Record<string, unknown> | undefined)?.locale, 40), expires_at: new Date(Date.now() + 4 * 60 * 60_000).toISOString() });
    if (sessionError) throw sessionError;

    const now = new Date().toISOString();
    await admin.from("lti_deployments").update({ launch_count: deployment.launch_count + 1, last_launch_at: now, ...(isInstructorRole(launch.canonicalRole) ? { last_instructor_launch_at: now } : { last_learner_launch_at: now }) }).eq("id", deployment.id);
    await admin.from("audit_events").insert({ actor_id: user.ednotebook_user_id, institution_id: deployment.institution_id, course_id: context.ednotebook_course_id, event_type: "lti.launch_validated", target_type: "lti_deployment", target_id: deployment.id, details: { correlation_id: correlationId, message_type: launch.messageType, canonical_role: launch.canonicalRole, context_mapping_status: context.mapping_status }, event_hash: "" });
    const route = launch.messageType === LTI_MESSAGES.deepLinkRequest || isInstructorRole(launch.canonicalRole) ? "instructor" : "student";
    return Response.redirect(`${siteUrl()}/#/lti/${route}?launch=${encodeURIComponent(launchToken)}`, 303);
  } catch (error) {
    console.error("LTI launch rejected", { correlationId, name: error instanceof Error ? error.name : "Error", status: error instanceof HttpError ? error.status : 500 });
    return htmlResponse(safeErrorHtml(correlationId), error instanceof HttpError ? error.status : 500);
  }
});
