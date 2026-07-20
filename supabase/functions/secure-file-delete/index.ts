import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";
import { recordAudit } from "../_shared/security.ts";
import { removeStorageObject } from "../_shared/storage.ts";

interface DeleteRequest {
  secureFileId: string;
  reason?: string;
}

async function removeObjects(admin: ReturnType<typeof adminClient>, file: Record<string, unknown>) {
  const removals: Promise<"removed" | "not_found">[] = [];
  if (file.quarantine_bucket && file.quarantine_path) {
    removals.push(removeStorageObject(
      admin,
      String(file.quarantine_bucket),
      String(file.quarantine_path),
    ));
  }
  if (file.destination_bucket && file.destination_path) {
    removals.push(removeStorageObject(
      admin,
      String(file.destination_bucket),
      String(file.destination_path),
    ));
  }
  const { data: previews, error: previewError } = await admin
    .from("file_previews")
    .select("bucket_id,storage_path")
    .eq("secure_file_id", file.id);
  if (previewError) throw previewError;
  for (const preview of previews || []) {
    removals.push(removeStorageObject(admin, preview.bucket_id, preview.storage_path));
  }
  await Promise.all(removals);
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { user, client } = await requireUser(req);
    const input = await parseJson<DeleteRequest>(req);
    if (!input.secureFileId) throw new HttpError(400, "secureFileId is required.");

    const { data: requestData, error: requestError } = await client.rpc("request_secure_file_deletion", {
      p_secure_file_id: input.secureFileId,
      p_reason: input.reason || "",
    });
    if (requestError) throw new HttpError(403, requestError.message);
    const deletion = Array.isArray(requestData) ? requestData[0] : requestData;
    if (!deletion) throw new HttpError(500, "Deletion request was not created.");

    if (deletion.status !== "eligible") {
      return jsonResponse(req, {
        requestId: deletion.request_id,
        status: deletion.status,
        eligibleAt: deletion.eligible_at,
        deleted: false,
      }, 202);
    }

    const admin = adminClient();
    const { data: file, error: fileError } = await admin
      .from("secure_file_objects")
      .select("*")
      .eq("id", input.secureFileId)
      .single();
    if (fileError || !file) throw new HttpError(404, "Secure file was not found.");

    const { error: processingError } = await admin
      .from("file_deletion_requests")
      .update({ status: "processing" })
      .eq("id", deletion.request_id);
    if (processingError) throw processingError;
    try {
      await removeObjects(admin, file);
      const now = new Date().toISOString();
      const { error: fileUpdateError } = await admin.from("secure_file_objects").update({
        availability_status: "deleted",
        deleted_at: now,
        worker_callback_token_hash: null,
      }).eq("id", file.id);
      if (fileUpdateError) throw fileUpdateError;
      const { error: quotaError } = await admin
        .from("upload_quota_reservations")
        .update({ status: "released" })
        .eq("secure_file_id", file.id);
      if (quotaError) throw quotaError;
      const { error: completedError } = await admin.from("file_deletion_requests").update({
        status: "completed",
        processed_at: now,
      }).eq("id", deletion.request_id);
      if (completedError) throw completedError;
      await recordAudit(admin, req, {
        actorId: user.id,
        institutionId: file.institution_id,
        courseId: file.course_id,
        assignmentId: file.assignment_id,
        secureFileId: file.id,
        eventType: "delete.completed",
        targetType: "secure_file",
        targetId: file.id,
        details: { requestId: deletion.request_id, reason: input.reason || "" },
      });
      return jsonResponse(req, {
        requestId: deletion.request_id,
        status: "completed",
        deleted: true,
      });
    } catch (deleteError) {
      await admin.from("file_deletion_requests").update({
        status: "failed",
        last_error: deleteError instanceof Error ? deleteError.message : String(deleteError),
      }).eq("id", deletion.request_id);
      throw deleteError;
    }
  } catch (error) {
    return errorResponse(req, error);
  }
});
