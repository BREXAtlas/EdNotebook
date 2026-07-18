import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  projectUrl,
  requirePost,
  requireUser,
} from "../_shared/runtime.ts";
import { randomToken, recordAudit, sha256 } from "../_shared/security.ts";

interface CompleteRequest {
  secureFileId: string;
  checksumSha256?: string | null;
}

async function findObject(admin: ReturnType<typeof adminClient>, bucket: string, path: string) {
  const parts = path.split("/");
  const filename = parts.pop() || "";
  const folder = parts.join("/");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 20,
      search: filename,
    });
    if (error) throw error;
    const object = data?.find((item) => item.name === filename);
    if (object) return object;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return null;
}

async function dispatchWorker(
  admin: ReturnType<typeof adminClient>,
  file: Record<string, unknown>,
  jobId: string,
  callbackToken: string,
) {
  const workerUrl = Deno.env.get("DOCUMENT_SECURITY_WORKER_URL");
  const workerToken = Deno.env.get("DOCUMENT_SECURITY_WORKER_TOKEN");
  if (!workerUrl || !workerToken) {
    await admin.from("secure_file_objects").update({
      security_status: "manual_review",
      scanner_provider: "not_configured",
      scan_result: { message: "Document security worker is not configured." },
    }).eq("id", file.id);
    await admin.from("processing_jobs").update({
      status: "failed",
      attempts: 1,
      last_error: "DOCUMENT_SECURITY_WORKER_URL or token is not configured",
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return;
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(String(file.quarantine_bucket))
    .createSignedUrl(String(file.quarantine_path), 30 * 60);
  if (signedError || !signed?.signedUrl) throw signedError || new Error("Unable to sign quarantined object.");

  const response = await fetch(`${workerUrl.replace(/\/$/, "")}/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId: file.id,
      sourceUrl: signed.signedUrl,
      originalName: file.original_name,
      safeName: file.safe_name,
      claimedMimeType: file.claimed_mime_type,
      expectedSizeBytes: file.expected_size_bytes,
      expectedSha256: file.checksum_sha256,
      purpose: file.purpose,
      previewRequested: file.preview_status === "pending",
      eduBookRequested: file.conversion_status === "queued",
      callbackUrl: `${projectUrl()}/functions/v1/secure-worker-callback`,
      callbackToken,
      limits: {
        maxArchiveEntries: 5000,
        maxExpandedBytes: 262144000,
        maxCompressionRatio: 100,
        maxArchiveDepth: 2,
        maxPreviewBytes: 8388608,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Document worker rejected the job (${response.status}): ${text.slice(0, 500)}`);
  }

  await admin.from("processing_jobs").update({
    status: "dispatched",
    attempts: 1,
    locked_at: new Date().toISOString(),
    locked_by: "document-security-worker",
  }).eq("id", jobId);
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { user, client } = await requireUser(req);
    const input = await parseJson<CompleteRequest>(req);
    if (!input.secureFileId) throw new HttpError(400, "secureFileId is required.");
    if (input.checksumSha256 && !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
      throw new HttpError(400, "SHA-256 checksum is invalid.");
    }

    const { data: file, error: fileError } = await client
      .from("secure_file_objects")
      .select("*")
      .eq("id", input.secureFileId)
      .single();
    if (fileError || !file) throw new HttpError(404, "Secure upload reservation was not found.");
    if (file.owner_id !== user.id) throw new HttpError(403, "Only the uploader can complete this upload.");
    if (!["reserved", "uploading"].includes(file.upload_status)) {
      if (file.upload_status === "uploaded") {
        return jsonResponse(req, { secureFileId: file.id, status: file.security_status, alreadyCompleted: true });
      }
      throw new HttpError(409, `Upload cannot be completed from status ${file.upload_status}.`);
    }
    if (new Date(file.upload_expires_at).getTime() <= Date.now()) {
      throw new HttpError(410, "The resumable upload reservation expired.");
    }

    const admin = adminClient();
    const object = await findObject(admin, file.quarantine_bucket, file.quarantine_path);
    if (!object) throw new HttpError(409, "The resumable upload has not finished reaching quarantine storage.");

    const objectSize = Number(object.metadata?.size || file.expected_size_bytes);
    if (objectSize !== Number(file.expected_size_bytes)) {
      await admin.from("secure_file_objects").update({
        upload_status: "failed",
        security_status: "suspicious",
        availability_status: "blocked",
        actual_size_bytes: objectSize,
        scan_result: { reason: "uploaded_size_mismatch", expected: file.expected_size_bytes, actual: objectSize },
      }).eq("id", file.id);
      throw new HttpError(409, "Uploaded byte count does not match the reserved size.");
    }

    const callbackToken = randomToken(36);
    const callbackTokenHash = await sha256(callbackToken);
    const { data: updated, error: updateError } = await admin
      .from("secure_file_objects")
      .update({
        upload_status: "uploaded",
        security_status: "scanning",
        actual_size_bytes: objectSize,
        checksum_sha256: input.checksumSha256?.toLowerCase() || null,
        worker_callback_token_hash: callbackTokenHash,
      })
      .eq("id", file.id)
      .select()
      .single();
    if (updateError) throw updateError;

    await admin.from("upload_quota_reservations").update({ status: "committed" }).eq("secure_file_id", file.id);
    const { data: job, error: jobError } = await admin.from("processing_jobs").insert({
      secure_file_id: file.id,
      job_type: "malware_scan",
      status: "queued",
      payload: {
        archiveInspection: true,
        previewRequested: file.preview_status === "pending",
        eduBookRequested: file.conversion_status === "queued",
      },
    }).select().single();
    if (jobError) throw jobError;

    await recordAudit(admin, req, {
      actorId: user.id,
      institutionId: file.institution_id,
      courseId: file.course_id,
      assignmentId: file.assignment_id,
      secureFileId: file.id,
      eventType: "upload.completed",
      targetType: "secure_file",
      targetId: file.id,
      details: { sizeBytes: objectSize, processingJobId: job.id },
    });

    EdgeRuntime.waitUntil(
      dispatchWorker(admin, updated, job.id, callbackToken).catch(async (error) => {
        console.error("worker dispatch failed", error);
        await admin.from("secure_file_objects").update({
          security_status: "error",
          scan_result: { message: error instanceof Error ? error.message : String(error) },
        }).eq("id", file.id);
        await admin.from("processing_jobs").update({
          status: "failed",
          attempts: 1,
          last_error: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        await recordAudit(admin, null, {
          actorId: user.id,
          secureFileId: file.id,
          courseId: file.course_id,
          assignmentId: file.assignment_id,
          eventType: "security.dispatch_failed",
          targetType: "processing_job",
          targetId: job.id,
          details: { error: error instanceof Error ? error.message : String(error) },
        });
      }),
    );

    return jsonResponse(req, {
      secureFileId: file.id,
      status: "scanning",
      availability: "quarantined",
      jobId: job.id,
    }, 202);
  } catch (error) {
    return errorResponse(req, error);
  }
});
