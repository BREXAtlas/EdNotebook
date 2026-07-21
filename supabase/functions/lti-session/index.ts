import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, errorResponse, HttpError, jsonResponse, preflight, requirePost, requireUser } from "../_shared/runtime.ts";
import { isInstructorRole } from "../_shared/lti/constants.ts";
import { requireLaunchSession } from "../_shared/lti/session.ts";

function responseBody(data: Awaited<ReturnType<typeof requireLaunchSession>>) {
  const { session, deployment, context, user, resource, service } = data;
  return {
    launch: { messageType: session.message_type, role: session.canonical_role, expiresAt: session.expires_at, locale: session.locale },
    institution: { id: deployment.institution_id, deploymentLabel: deployment.display_name },
    context: context ? { id: context.id, label: context.lti_context_label, title: context.lti_context_title, mappingStatus: context.mapping_status, courseId: context.ednotebook_course_id } : null,
    person: { mappingStatus: user.mapping_status, userId: user.ednotebook_user_id, displayName: user.display_name },
    resource: resource ? { status: resource.status, targetType: resource.target_type, publicationId: resource.publication_id, assignmentId: resource.assignment_id, lessonKey: resource.lesson_key, title: resource.title } : null,
    services: { deepLinking: session.message_type === "LtiDeepLinkingRequest" && Boolean(session.return_url), nrps: Boolean(service?.nrps_memberships_url), ags: Boolean(service?.ags_lineitems_url || service?.ags_lineitem_url), scopes: service?.granted_scopes || [] },
  };
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requirePost(req);
    const admin = adminClient();
    const launch = await requireLaunchSession(admin, req);
    const action = new URL(req.url).searchParams.get("action") || "read";
    if (action === "read") return jsonResponse(req, responseBody(launch));
    if (action !== "link-current-user") throw new HttpError(400, "Unsupported LTI session action.");
    const { user: signedIn } = await requireUser(req);
    if (launch.user.ednotebook_user_id && launch.user.ednotebook_user_id !== signedIn.id) throw new HttpError(409, "This LMS identity is already linked to another account.");
    const { data: profile, error: profileError } = await admin.from("profiles").select("id,role").eq("id", signedIn.id).single();
    if (profileError) throw profileError;
    if (isInstructorRole(launch.session.canonical_role) && !["professor", "admin", "owner"].includes(profile.role)) throw new HttpError(403, "An educator EdNotebook account is required for this LMS role.");
    if (!isInstructorRole(launch.session.canonical_role) && !["learner", "admin", "owner"].includes(profile.role)) throw new HttpError(403, "A learner EdNotebook account is required for this LMS role.");
    if (launch.context?.ednotebook_course_id) {
      const { data: membership } = await admin.from("course_memberships").select("role").eq("course_id", launch.context.ednotebook_course_id).eq("user_id", signedIn.id).maybeSingle();
      if (!membership) await admin.from("course_memberships").insert({ course_id: launch.context.ednotebook_course_id, user_id: signedIn.id, role: isInstructorRole(launch.session.canonical_role) ? "professor" : "learner" });
    }
    const { error: updateError } = await admin.from("lti_user_mappings").update({ ednotebook_user_id: signedIn.id, mapping_status: "mapped", mapped_by: signedIn.id, mapped_at: new Date().toISOString() }).eq("id", launch.user.id);
    if (updateError) throw updateError;
    await admin.from("learning_system_identifiers").upsert({ institution_id: launch.deployment.institution_id, provider: "blackboard", integration_mode: "lti_1_3", object_type: "person", identifier_type: "lti_subject", identifier_value: launch.user.lti_subject, ednotebook_institution_id: launch.deployment.institution_id, ednotebook_user_id: signedIn.id, source_status: "active", provenance: { deployment_id: launch.deployment.id, contract_version: "1.0" }, last_reconciled_at: new Date().toISOString() }, { onConflict: "provider,integration_mode,institution_id,object_type,identifier_type,identifier_value" });
    await admin.from("audit_events").insert({ actor_id: signedIn.id, institution_id: launch.deployment.institution_id, course_id: launch.context?.ednotebook_course_id, event_type: "lti.identity_linked", target_type: "lti_user_mapping", target_id: launch.user.id, details: { canonical_role: launch.session.canonical_role }, event_hash: "" });
    return jsonResponse(req, { ...responseBody(launch), person: { ...responseBody(launch).person, mappingStatus: "mapped", userId: signedIn.id } });
  } catch (error) { return errorResponse(req, error); }
});
