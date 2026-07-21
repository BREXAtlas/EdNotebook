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
import { recordAuditRequired } from "../_shared/security.ts";

interface DownloadRequest {
  secureFileId?: string;
  previewId?: string;
  disposition?: "download" | "inline";
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { user, client } = await requireUser(req);
    const input = await parseJson<DownloadRequest>(req);
    if (!input.secureFileId && !input.previewId) {
      throw new HttpError(400, "secureFileId or previewId is required.");
    }

    let file: Record<string, unknown> | null = null;
    let bucket: string;
    let path: string;
    let filename: string;
    let eventType = "file.downloaded";
    let previewId: string | null = null;

    if (input.previewId) {
      const { data: preview, error: previewError } = await client
        .from("file_previews")
        .select("*")
        .eq("id", input.previewId)
        .single();
      if (previewError || !preview) {
        throw new HttpError(404, "Preview was not found.");
      }
      const { data: parent, error: parentError } = await client
        .from("secure_file_objects")
        .select("*")
        .eq("id", preview.secure_file_id)
        .single();
      if (parentError || !parent) {
        throw new HttpError(404, "Preview source file was not found.");
      }
      file = parent;
      bucket = preview.bucket_id;
      path = preview.storage_path;
      filename = `${parent.safe_name || "preview"}-${preview.kind}${
        preview.page_number ? `-${preview.page_number}` : ""
      }`;
      previewId = preview.id;
      eventType = "preview.downloaded";
    } else {
      const { data, error } = await client
        .from("secure_file_objects")
        .select("*")
        .eq("id", input.secureFileId)
        .single();
      if (error || !data) {
        throw new HttpError(
          404,
          "File was not found or you do not have access.",
        );
      }
      file = data;
      bucket = data.destination_bucket;
      path = data.destination_path;
      filename = data.safe_name || data.original_name || "download";
    }

    if (!file) throw new HttpError(404, "File was not found.");
    if (
      file.availability_status === "deleted" ||
      file.availability_status === "pending_delete"
    ) {
      throw new HttpError(
        410,
        "The file is pending deletion or has been deleted.",
      );
    }
    // Apply the same release gate to original objects and previews. A preview
    // can contain the full substance of a document and must never bypass the
    // quarantine/security decision of its parent file.
    if (
      file.availability_status !== "released" ||
      file.security_status !== "clean"
    ) {
      throw new HttpError(
        423,
        "The file is not available until security processing is complete.",
        {
          securityStatus: file.security_status,
          availabilityStatus: file.availability_status,
        },
      );
    }

    const admin = adminClient();
    const expiresIn = 60;
    const { data: signed, error: signedError } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn, {
        download: input.disposition === "inline" ? false : filename,
      });
    if (signedError || !signed?.signedUrl) {
      throw signedError || new Error("Signed URL could not be created.");
    }

    await recordAuditRequired(admin, req, {
      actorId: user.id,
      institutionId: file.institution_id as string | null,
      courseId: file.course_id as string | null,
      assignmentId: file.assignment_id as string | null,
      secureFileId: file.id as string,
      eventType,
      targetType: previewId ? "file_preview" : "secure_file",
      targetId: previewId || String(file.id),
      details: {
        disposition: input.disposition || "download",
        expiresInSeconds: expiresIn,
        bucket,
      },
    });

    return jsonResponse(req, {
      url: signed.signedUrl,
      filename,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      securityStatus: file.security_status,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
