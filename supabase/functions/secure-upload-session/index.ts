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

interface UploadSessionRequest {
  purpose: "private" | "course" | "submission" | "publication";
  originalName: string;
  safeName: string;
  mimeType?: string;
  sizeBytes: number;
  courseId?: string | null;
  assignmentId?: string | null;
  publicationId?: string | null;
  metadata?: Record<string, unknown>;
}

function validate(input: UploadSessionRequest): void {
  if (!input || typeof input !== "object") throw new HttpError(400, "Upload details are required.");
  if (!["private", "course", "submission", "publication"].includes(input.purpose)) {
    throw new HttpError(400, "Upload purpose is invalid.");
  }
  if (!input.originalName?.trim()) throw new HttpError(400, "Original filename is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(input.safeName || "")) {
    throw new HttpError(400, "The generated safe filename is invalid.");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new HttpError(400, "File size must be a positive integer.");
  }
  if (input.purpose === "course" && !input.courseId) throw new HttpError(400, "Course ID is required.");
  if (input.purpose === "submission" && (!input.courseId || !input.assignmentId)) {
    throw new HttpError(400, "Course and assignment IDs are required.");
  }
  if (input.purpose === "publication" && !input.publicationId) {
    throw new HttpError(400, "Publication ID is required.");
  }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { client } = await requireUser(req);
    const input = await parseJson<UploadSessionRequest>(req);
    validate(input);

    const { data, error } = await client.rpc("reserve_secure_upload", {
      p_purpose: input.purpose,
      p_original_name: input.originalName.trim(),
      p_safe_name: input.safeName,
      p_claimed_mime_type: input.mimeType || "application/octet-stream",
      p_size_bytes: input.sizeBytes,
      p_course_id: input.courseId || null,
      p_assignment_id: input.assignmentId || null,
      p_publication_id: input.publicationId || null,
      p_metadata: input.metadata || {},
    });

    if (error) {
      const status = /quota|limit|permission|ownership|access/i.test(error.message) ? 403 : 400;
      throw new HttpError(status, error.message);
    }

    const reservation = Array.isArray(data) ? data[0] : data;
    if (!reservation) throw new HttpError(500, "Upload reservation was not created.");

    const admin = adminClient();
    const { data: signedUpload, error: signedUploadError } = await admin.storage
      .from(reservation.quarantine_bucket)
      .createSignedUploadUrl(reservation.quarantine_path, { upsert: false });

    if (signedUploadError || !signedUpload?.token) {
      await admin.from("upload_quota_reservations").update({ status: "released" })
        .eq("secure_file_id", reservation.secure_file_id);
      await admin.from("secure_file_objects").update({
        upload_status: "failed",
        availability_status: "deleted",
        deleted_at: new Date().toISOString(),
      }).eq("id", reservation.secure_file_id);
      throw signedUploadError || new HttpError(500, "Signed resumable upload token was not created.");
    }

    return jsonResponse(req, {
      upload: {
        id: reservation.secure_file_id,
        bucket: reservation.quarantine_bucket,
        path: reservation.quarantine_path,
        signature: signedUpload.token,
        expiresAt: reservation.upload_expires_at,
      },
      destination: {
        bucket: reservation.destination_bucket,
        path: reservation.destination_path,
      },
      plan: {
        key: reservation.plan_key,
        quotaBytes: reservation.quota_bytes,
        maxFileBytes: reservation.max_file_bytes,
        usedBytes: reservation.used_bytes,
        reservedBytes: reservation.reserved_bytes,
      },
      retentionUntil: reservation.retention_until,
    }, 201);
  } catch (error) {
    return errorResponse(req, error);
  }
});
