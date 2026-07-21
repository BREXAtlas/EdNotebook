import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, errorResponse, HttpError, jsonResponse, preflight, requirePost } from "../_shared/runtime.ts";
import { canonicalRole, isInstructorRole, LTI_SCOPES } from "../_shared/lti/constants.ts";
import { getPlatformAccessToken } from "../_shared/lti/platform.ts";
import { requireLaunchSession } from "../_shared/lti/session.ts";

function nextLink(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/iu);
    if (match) return match[1];
  }
  return null;
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  let eventId: string | null = null;
  try {
    requirePost(req);
    const admin = adminClient();
    const launch = await requireLaunchSession(admin, req);
    if (!isInstructorRole(launch.session.canonical_role)) throw new HttpError(403, "An instructor LTI launch is required for roster sync.");
    if (!launch.context?.ednotebook_course_id || launch.context.mapping_status !== "mapped") throw new HttpError(409, "Map this LMS course before roster sync.");
    if (!launch.service?.nrps_memberships_url || !launch.service.granted_scopes?.includes(LTI_SCOPES.nrps)) throw new HttpError(403, "NRPS was not granted for this launch.");
    const { data: event, error: eventError } = await admin.from("lti_roster_sync_events").insert({ deployment_id: launch.deployment.id, context_mapping_id: launch.context.id, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, initiated_by: launch.user.ednotebook_user_id }).select().single();
    if (eventError) throw eventError; eventId = event.id;
    const token = await getPlatformAccessToken(launch.registration, [LTI_SCOPES.nrps]);
    const allowedHosts = (launch.registration.allowed_service_hosts || []).map((host: string) => host.toLowerCase());
    let url: string | null = launch.service.nrps_memberships_url;
    let received = 0; let mapped = 0; let conflicts = 0; let pages = 0;
    while (url && pages < 20 && received < 10_000) {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname.toLowerCase())) throw new HttpError(403, "NRPS pagination URL left the registered LMS hosts.");
      const response = await fetch(parsed, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.ims.lti-nrps.v2.membershipcontainer+json, application/json" }, signal: AbortSignal.timeout(12_000), redirect: "error" });
      if (!response.ok) throw new HttpError(502, `The LMS roster service returned HTTP ${response.status}.`);
      const body = await response.json();
      if (!Array.isArray(body?.members)) throw new HttpError(502, "The LMS roster response is invalid.");
      for (const member of body.members) {
        const subject = typeof member.user_id === "string" ? member.user_id.slice(0, 1000) : "";
        if (!subject) { conflicts += 1; continue; }
        const roles = Array.isArray(member.roles) ? member.roles.filter((value: unknown): value is string => typeof value === "string").slice(0, 50) : [];
        const fields = launch.registration.settings?.retain_roster_profile === false ? {} : { external_user_id: typeof member.user_id === "string" ? member.user_id.slice(0, 500) : null, lis_person_sourced_id: typeof member.lis_person_sourcedid === "string" ? member.lis_person_sourcedid.slice(0, 500) : null, given_name: typeof member.given_name === "string" ? member.given_name.slice(0, 500) : null, family_name: typeof member.family_name === "string" ? member.family_name.slice(0, 500) : null, display_name: typeof member.name === "string" ? member.name.slice(0, 500) : null, email: typeof member.email === "string" ? member.email.toLowerCase().slice(0, 320) : null };
        const { data: existing } = await admin.from("lti_user_mappings").select("id,ednotebook_user_id,mapping_status").eq("deployment_id", launch.deployment.id).eq("lti_subject", subject).maybeSingle();
        const values = { institution_id: launch.deployment.institution_id, canonical_role: canonicalRole(roles), lti_roles: roles, ...fields };
        let userMappingId: string;
        if (existing) {
          const { error } = await admin.from("lti_user_mappings").update(values).eq("id", existing.id); if (error) throw error;
          userMappingId = existing.id;
          if (existing.mapping_status === "mapped" && existing.ednotebook_user_id) mapped += 1;
        } else {
          const { data: created, error } = await admin.from("lti_user_mappings").insert({ deployment_id: launch.deployment.id, lti_subject: subject, mapping_status: "pending", ...values }).select("id").single(); if (error) throw error;
          userMappingId = created.id;
        }
        const membershipStatus = String(member.status || "Active").toLowerCase() === "inactive" ? "inactive" : String(member.status || "Active").toLowerCase() === "active" ? "active" : "unknown";
        const { error: membershipError } = await admin.from("lti_context_memberships").upsert({ deployment_id: launch.deployment.id, context_mapping_id: launch.context.id, user_mapping_id: userMappingId, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, external_enrollment_id: typeof member.message?.custom?.enrollment_id === "string" ? member.message.custom.enrollment_id.slice(0, 500) : null, canonical_role: canonicalRole(roles), lti_roles: roles, enrollment_status: membershipStatus, last_sync_run_id: eventId, last_seen_at: new Date().toISOString() }, { onConflict: "context_mapping_id,user_mapping_id" });
        if (membershipError) throw membershipError;
        received += 1;
      }
      pages += 1;
      url = nextLink(response.headers.get("link"));
    }
    const pending = Math.max(received - mapped - conflicts, 0);
    const status = url ? "partial" : "succeeded";
    if (status === "succeeded") await admin.from("lti_context_memberships").update({ enrollment_status: "inactive" }).eq("context_mapping_id", launch.context.id).or(`last_sync_run_id.is.null,last_sync_run_id.neq.${eventId}`);
    await admin.from("lti_roster_sync_events").update({ status, received_count: received, mapped_count: mapped, pending_count: pending, conflict_count: conflicts, page_count: pages, completed_at: new Date().toISOString() }).eq("id", eventId);
    await admin.from("audit_events").insert({ actor_id: launch.user.ednotebook_user_id, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, event_type: "lti.roster_synchronized", target_type: "lti_roster_sync_event", target_id: eventId, details: { status, received_count: received, mapped_count: mapped, pending_count: pending, conflict_count: conflicts, page_count: pages }, event_hash: "" });
    return jsonResponse(req, { eventId, status, received, mapped, pending, conflicts, pages });
  } catch (error) {
    if (eventId) await adminClient().from("lti_roster_sync_events").update({ status: "failed", error_code: "nrps_sync_failed", error_summary: error instanceof Error ? error.message.slice(0, 500) : "Roster sync failed", completed_at: new Date().toISOString() }).eq("id", eventId);
    return errorResponse(req, error);
  }
});
