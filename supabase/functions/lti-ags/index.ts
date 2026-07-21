import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, errorResponse, HttpError, jsonResponse, parseJson, preflight, requirePost } from "../_shared/runtime.ts";
import { AGS_ACTIVITY_PROGRESS, AGS_GRADING_PROGRESS, isInstructorRole, LTI_SCOPES } from "../_shared/lti/constants.ts";
import { ensureServiceUrl } from "../_shared/lti/claims.ts";
import { sha256 } from "../_shared/lti/crypto.ts";
import { getPlatformAccessToken, platformJson } from "../_shared/lti/platform.ts";
import { requireLaunchSession } from "../_shared/lti/session.ts";

function childServiceUrl(lineItemUrl: string, child: "scores" | "results"): string {
  const url = new URL(lineItemUrl); url.pathname = `${url.pathname.replace(/\/$/u, "")}/${child}`; return url.href;
}

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requirePost(req);
    const admin = adminClient();
    const launch = await requireLaunchSession(admin, req);
    if (!isInstructorRole(launch.session.canonical_role)) throw new HttpError(403, "An instructor LTI launch is required for grade services.");
    if (!launch.context?.ednotebook_course_id || launch.context.mapping_status !== "mapped") throw new HttpError(409, "Map this LMS course before using grade services.");
    const input = await parseJson<Record<string, unknown>>(req, 50_000);
    const action = String(input.action || "list");
    if (action === "list") {
      const { data: mappings, error } = await admin.from("lti_grade_item_mappings").select("*").eq("deployment_id", launch.deployment.id).eq("course_id", launch.context.ednotebook_course_id).order("created_at", { ascending: false });
      if (error) throw error;
      const { data: events } = await admin.from("lti_grade_sync_events").select("id,grade_item_mapping_id,status,attempt_count,error_code,error_summary,requested_at,succeeded_at").eq("deployment_id", launch.deployment.id).eq("course_id", launch.context.ednotebook_course_id).order("created_at", { ascending: false }).limit(100);
      return jsonResponse(req, { mappings: mappings || [], events: events || [] });
    }
    if (action === "create-line-item") {
      if (!launch.service?.ags_lineitems_url || !launch.service.granted_scopes?.includes(LTI_SCOPES.lineItem)) throw new HttpError(403, "AGS line-item creation was not granted for this launch.");
      const { data: gradeItem, error } = await admin.from("grade_items").select("*").eq("id", String(input.gradeItemId || "")).eq("course_id", launch.context.ednotebook_course_id).eq("publish_state", "published").maybeSingle();
      if (error) throw error; if (!gradeItem) throw new HttpError(404, "Published EdNotebook grade item not found.");
      const releaseMode = ["manual", "automatic", "held"].includes(String(input.releaseMode)) ? String(input.releaseMode) : "manual";
      const lineItem = { label: String(input.label || gradeItem.title).slice(0, 500), scoreMaximum: Number(gradeItem.max_points), resourceId: gradeItem.id, tag: String(input.tag || "ednotebook").slice(0, 180), ...(gradeItem.due_at ? { endDateTime: gradeItem.due_at } : {}) };
      const token = await getPlatformAccessToken(launch.registration, [LTI_SCOPES.lineItem]);
      const { body } = await platformJson(launch.service.ags_lineitems_url, token, { method: "POST", body: lineItem, contentType: "application/vnd.ims.lis.v2.lineitem+json" });
      const lineItemUrl = ensureServiceUrl(body?.id, launch.registration.allowed_service_hosts || [], "AGS line-item URL");
      if (!lineItemUrl) throw new HttpError(502, "The LMS did not return a line-item URL.");
      const { data: mapping, error: mappingError } = await admin.from("lti_grade_item_mappings").upsert({ deployment_id: launch.deployment.id, context_mapping_id: launch.context.id, resource_link_id: launch.resource?.id || null, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, ednotebook_grade_item_id: gradeItem.id, lti_line_item_url: lineItemUrl, lti_line_item_tag: lineItem.tag, label: lineItem.label, score_maximum: lineItem.scoreMaximum, resource_id: lineItem.resourceId, release_mode: releaseMode, created_by: launch.user.ednotebook_user_id, last_reconciled_at: new Date().toISOString() }, { onConflict: "deployment_id,ednotebook_grade_item_id" }).select().single();
      if (mappingError) throw mappingError;
      return jsonResponse(req, { mapping }, 201);
    }
    if (action === "read-results") {
      if (!launch.service?.granted_scopes?.includes(LTI_SCOPES.resultReadonly)) throw new HttpError(403, "AGS result reading was not granted for this launch.");
      const { data: mapping } = await admin.from("lti_grade_item_mappings").select("*").eq("id", String(input.mappingId || "")).eq("course_id", launch.context.ednotebook_course_id).maybeSingle();
      if (!mapping) throw new HttpError(404, "Grade-item mapping not found.");
      ensureServiceUrl(mapping.lti_line_item_url, launch.registration.allowed_service_hosts || [], "AGS line-item URL");
      const token = await getPlatformAccessToken(launch.registration, [LTI_SCOPES.resultReadonly]);
      const { body } = await platformJson(childServiceUrl(mapping.lti_line_item_url, "results"), token);
      const results = Array.isArray(body) ? body : [];
      return jsonResponse(req, { count: results.length, results: results.slice(0, 1000).map((result: Record<string, unknown>) => ({ userId: result.userId, resultScore: result.resultScore, resultMaximum: result.resultMaximum, scoreOf: result.scoreOf })) });
    }
    if (action !== "send-score" && action !== "retry-score") throw new HttpError(400, "Unsupported AGS action.");
    if (!launch.service?.granted_scopes?.includes(LTI_SCOPES.score)) throw new HttpError(403, "AGS score passback was not granted for this launch.");
    if (input.confirmRelease !== true) throw new HttpError(400, "Professor confirmation is required before grade release.");
    let syncEvent: Record<string, unknown> | null = null;
    let mapping; let grade; let userMapping;
    if (action === "retry-score") {
      const { data: event } = await admin.from("lti_grade_sync_events").select("*").eq("id", String(input.eventId || "")).eq("deployment_id", launch.deployment.id).eq("course_id", launch.context.ednotebook_course_id).eq("status", "failed").maybeSingle();
      if (!event) throw new HttpError(404, "Failed grade-sync event not found."); syncEvent = event;
      ({ data: mapping } = await admin.from("lti_grade_item_mappings").select("*").eq("id", event.grade_item_mapping_id).eq("deployment_id", launch.deployment.id).eq("course_id", launch.context.ednotebook_course_id).eq("enabled", true).single());
      ({ data: grade } = await admin.from("student_grades").select("*").eq("id", event.student_grade_id).eq("course_id", launch.context.ednotebook_course_id).eq("status", "finalized").single());
      ({ data: userMapping } = await admin.from("lti_user_mappings").select("*").eq("id", event.user_mapping_id).eq("deployment_id", launch.deployment.id).eq("mapping_status", "mapped").single());
    } else {
      ({ data: mapping } = await admin.from("lti_grade_item_mappings").select("*").eq("id", String(input.mappingId || "")).eq("course_id", launch.context.ednotebook_course_id).eq("enabled", true).maybeSingle());
      if (!mapping || mapping.release_mode === "held") throw new HttpError(403, "This grade-item mapping is unavailable or held.");
      ({ data: grade } = await admin.from("student_grades").select("*").eq("id", String(input.studentGradeId || "")).eq("course_id", launch.context.ednotebook_course_id).eq("grade_item_id", mapping.ednotebook_grade_item_id).eq("status", "finalized").maybeSingle());
      if (!grade || grade.score === null) throw new HttpError(409, "Only finalized EdNotebook grades can be released.");
      ({ data: userMapping } = await admin.from("lti_user_mappings").select("*").eq("deployment_id", launch.deployment.id).eq("ednotebook_user_id", grade.student_id).eq("mapping_status", "mapped").maybeSingle());
      if (!userMapping) throw new HttpError(409, "The learner does not have a confirmed LMS identity mapping.");
      const activityProgress = AGS_ACTIVITY_PROGRESS.includes(String(input.activityProgress)) ? String(input.activityProgress) : "Completed";
      const gradingProgress = AGS_GRADING_PROGRESS.includes(String(input.gradingProgress)) ? String(input.gradingProgress) : "FullyGraded";
      const idempotencyKey = await sha256([mapping.id, grade.id, grade.updated_at, grade.score, mapping.score_maximum].join("|"));
      const { data: existing } = await admin.from("lti_grade_sync_events").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing?.status === "succeeded") return jsonResponse(req, { event: existing, duplicate: true });
      if (existing) syncEvent = existing;
      else {
        const { data: created, error } = await admin.from("lti_grade_sync_events").insert({ deployment_id: launch.deployment.id, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, grade_item_mapping_id: mapping.id, student_grade_id: grade.id, user_mapping_id: userMapping.id, initiated_by: launch.user.ednotebook_user_id, idempotency_key: idempotencyKey, score_given: grade.score, score_maximum: mapping.score_maximum, activity_progress: activityProgress, grading_progress: gradingProgress, status: "queued" }).select().single();
        if (error) throw error; syncEvent = created;
      }
    }
    if (!mapping || !grade || !userMapping || !syncEvent) throw new HttpError(500, "Grade-sync records could not be prepared.");
    if (mapping.release_mode === "held" || userMapping.ednotebook_user_id !== grade.student_id || grade.grade_item_id !== mapping.ednotebook_grade_item_id) throw new HttpError(409, "Grade release mappings are no longer valid.");
    if (Number(grade.score) < 0 || Number(grade.score) > Number(mapping.score_maximum)) throw new HttpError(409, "Finalized grade is outside the mapped Blackboard point range.");
    if (action === "retry-score" && (Number(syncEvent.score_given) !== Number(grade.score) || Number(syncEvent.score_maximum) !== Number(mapping.score_maximum))) {
      await admin.from("lti_grade_sync_events").update({ status: "superseded", error_code: "source_grade_changed", error_summary: "The finalized grade changed after the failed attempt." }).eq("id", syncEvent.id);
      throw new HttpError(409, "The grade changed after the failed attempt. Start a new confirmed release.");
    }
    ensureServiceUrl(mapping.lti_line_item_url, launch.registration.allowed_service_hosts || [], "AGS line-item URL");
    const expectedAttempt = Number(syncEvent.attempt_count || 0);
    const nextAttempt = expectedAttempt + 1;
    if (nextAttempt > 25) throw new HttpError(409, "This grade release reached the retry limit.");
    const { data: freshGrade } = await admin.from("student_grades").select("score,status,updated_at").eq("id", grade.id).single();
    if (!freshGrade || freshGrade.status !== "finalized" || freshGrade.score !== grade.score || freshGrade.updated_at !== grade.updated_at) {
      await admin.from("lti_grade_sync_events").update({ status: "superseded", error_code: "source_grade_changed", error_summary: "The finalized grade changed before passback." }).eq("id", syncEvent.id);
      throw new HttpError(409, "The finalized grade changed before release. Review and confirm the current grade.");
    }
    const { data: claimed, error: claimError } = await admin.rpc("claim_lti_grade_sync_event", { p_event_id: syncEvent.id, p_expected_attempt: expectedAttempt });
    if (claimError || !claimed) throw new HttpError(409, "This grade release is already being processed or reached its retry limit.");
    const processingEvent = claimed as Record<string, unknown>;
    syncEvent = processingEvent;
    try {
      const token = await getPlatformAccessToken(launch.registration, [LTI_SCOPES.score]);
      const payload = { userId: userMapping.lti_subject, scoreGiven: Number(grade.score), scoreMaximum: Number(mapping.score_maximum), activityProgress: processingEvent.activity_progress, gradingProgress: processingEvent.grading_progress, timestamp: new Date().toISOString(), ...(typeof input.comment === "string" && input.comment.trim() ? { comment: input.comment.trim().slice(0, 4000) } : {}) };
      const { response } = await platformJson(childServiceUrl(mapping.lti_line_item_url, "scores"), token, { method: "POST", body: payload, contentType: "application/vnd.ims.lis.v1.score+json" });
      const { data: succeeded } = await admin.from("lti_grade_sync_events").update({ status: "succeeded", last_http_status: response.status, sent_at: new Date().toISOString(), succeeded_at: new Date().toISOString(), next_retry_at: null }).eq("id", processingEvent.id).select().single();
      await admin.from("audit_events").insert({ actor_id: launch.user.ednotebook_user_id, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, event_type: "lti.grade_released", target_type: "lti_grade_sync_event", target_id: processingEvent.id, details: { grade_item_mapping_id: mapping.id, attempt_count: nextAttempt }, event_hash: "" });
      return jsonResponse(req, { event: succeeded });
    } catch (sendError) {
      await admin.from("lti_grade_sync_events").update({ status: "failed", error_code: "ags_send_failed", error_summary: sendError instanceof Error ? sendError.message.slice(0, 500) : "Grade passback failed", next_retry_at: new Date(Date.now() + Math.min(60, 2 ** nextAttempt) * 60_000).toISOString() }).eq("id", processingEvent.id);
      throw sendError;
    }
  } catch (error) { return errorResponse(req, error); }
});
