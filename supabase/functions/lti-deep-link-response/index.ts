import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, errorResponse, HttpError, jsonResponse, parseJson, preflight, requirePost } from "../_shared/runtime.ts";
import { isInstructorRole, LTI_CLAIMS, LTI_MESSAGES, LTI_VERSION } from "../_shared/lti/constants.ts";
import { randomToken, signRs256Jwt } from "../_shared/lti/crypto.ts";
import { edgeFunctionUrl } from "../_shared/lti/request.ts";
import { requireLaunchSession } from "../_shared/lti/session.ts";

interface Selection { targetType: "course" | "publication" | "lesson" | "assignment"; targetId?: string | null; lessonKey?: string | null; title: string; text?: string | null; gradeItemId?: string | null }

Deno.serve(async (req) => {
  const options = preflight(req); if (options) return options;
  try {
    requirePost(req);
    const admin = adminClient();
    const launch = await requireLaunchSession(admin, req);
    if (launch.session.message_type !== LTI_MESSAGES.deepLinkRequest || !isInstructorRole(launch.session.canonical_role) || !launch.session.return_url) throw new HttpError(403, "An instructor Deep Linking launch is required.");
    if (!launch.context?.ednotebook_course_id || launch.context.mapping_status !== "mapped") throw new HttpError(409, "Map this LMS course to an EdNotebook course before selecting content.");
    const input = await parseJson<{ selections?: Selection[] }>(req, 50_000);
    const maximumItems = launch.session.deep_link_accept_multiple ? 25 : 1;
    if (!Array.isArray(input.selections) || input.selections.length < 1 || input.selections.length > maximumItems) throw new HttpError(400, `Select between 1 and ${maximumItems} EdNotebook items.`);
    const items = [];
    for (const selection of input.selections) {
      if (!["course", "publication", "lesson", "assignment"].includes(selection.targetType) || !selection.title?.trim()) throw new HttpError(400, "A selected item is invalid.");
      if (selection.targetType === "publication" || selection.targetType === "lesson") {
        const { data } = await admin.from("course_publications").select("id,status").eq("id", selection.targetId).eq("course_id", launch.context.ednotebook_course_id).eq("status", "published").maybeSingle();
        if (!data) throw new HttpError(403, "A selected publication is not published in this course.");
      }
      if (selection.targetType === "assignment") {
        const { data } = await admin.from("assignments").select("id").eq("id", selection.targetId).eq("course_id", launch.context.ednotebook_course_id).maybeSingle();
        if (!data) throw new HttpError(403, "A selected assignment does not belong to this course.");
      }
      let lineItem;
      if (selection.gradeItemId) {
        const { data: gradeItem } = await admin.from("grade_items").select("id,title,max_points,due_at,publish_state").eq("id", selection.gradeItemId).eq("course_id", launch.context.ednotebook_course_id).eq("publish_state", "published").maybeSingle();
        if (!gradeItem) throw new HttpError(403, "A selected grade item is not published in this course.");
        lineItem = { label: gradeItem.title, scoreMaximum: Number(gradeItem.max_points), resourceId: gradeItem.id, tag: "ednotebook", ...(gradeItem.due_at ? { endDateTime: gradeItem.due_at } : {}) };
      }
      items.push({
        type: "ltiResourceLink",
        title: selection.title.trim().slice(0, 500),
        text: selection.text?.trim().slice(0, 2000) || undefined,
        url: edgeFunctionUrl("lti-launch"),
        custom: { ednotebook_target_type: selection.targetType, ednotebook_target_id: selection.targetId || launch.context.ednotebook_course_id, ednotebook_lesson_key: selection.lessonKey || "" },
        ...(lineItem ? { lineItem } : {}),
      });
    }
    const now = Math.floor(Date.now() / 1000);
    const jwt = await signRs256Jwt({
      iss: launch.registration.client_id,
      aud: launch.registration.issuer,
      iat: now,
      exp: now + 300,
      nonce: randomToken(24),
      [LTI_CLAIMS.deploymentId]: launch.deployment.deployment_id,
      [LTI_CLAIMS.messageType]: LTI_MESSAGES.deepLinkResponse,
      [LTI_CLAIMS.version]: LTI_VERSION,
      [LTI_CLAIMS.contentItems]: items,
      ...(launch.session.deep_link_data ? { [LTI_CLAIMS.deepLinkData]: launch.session.deep_link_data } : {}),
    });
    await admin.from("audit_events").insert({ actor_id: launch.user.ednotebook_user_id, institution_id: launch.deployment.institution_id, course_id: launch.context.ednotebook_course_id, event_type: "lti.deep_link_response_created", target_type: "lti_context_mapping", target_id: launch.context.id, details: { item_count: items.length }, event_hash: "" });
    return jsonResponse(req, { returnUrl: launch.session.return_url, formField: "JWT", jwt });
  } catch (error) { return errorResponse(req, error); }
});
