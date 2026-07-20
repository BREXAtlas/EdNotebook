import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  requirePost,
} from "../_shared/runtime.ts";
import {
  constantTimeEqual,
  decodeBase64,
  recordAudit,
  sha256,
} from "../_shared/security.ts";
import { removeStorageObject } from "../_shared/storage.ts";

interface WorkerPreview {
  kind: "thumbnail" | "page" | "text" | "html" | "cover" | "slides" | "metadata";
  mimeType: string;
  base64: string;
  pageNumber?: number | null;
  metadata?: Record<string, unknown>;
}

interface WorkerCallback {
  fileId: string;
  verdict: "clean" | "infected" | "suspicious" | "error";
  actualSizeBytes?: number;
  sha256?: string;
  detectedMimeType?: string;
  scan?: {
    provider?: string;
    engineVersion?: string;
    signatureVersion?: string;
    details?: Record<string, unknown>;
  };
  archive?: {
    status?: "pending" | "not_archive" | "clean" | "suspicious" | "blocked" | "error";
    details?: Record<string, unknown>;
  };
  previews?: WorkerPreview[];
  eduBookManifest?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  error?: string | null;
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/html": "html",
    "application/json": "json",
  };
  return map[mimeType] || "bin";
}

async function markJob(
  admin: ReturnType<typeof adminClient>,
  fileId: string,
  status: "succeeded" | "failed",
  result: Record<string, unknown>,
  error?: string,
) {
  const { data: job } = await admin
    .from("processing_jobs")
    .select("id")
    .eq("secure_file_id", fileId)
    .in("status", ["queued", "dispatched", "processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return;
  await admin.from("processing_jobs").update({
    status,
    result,
    last_error: error || null,
    completed_at: new Date().toISOString(),
  }).eq("id", job.id);
}

async function destinationExists(
  admin: ReturnType<typeof adminClient>,
  bucket: string,
  path: string,
): Promise<boolean> {
  const parts = path.split("/");
  const filename = parts.pop() || "";
  const folder = parts.join("/");
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 20, search: filename });
  if (error) throw error;
  return Boolean(data?.some((item) => item.name === filename));
}

async function persistPreviews(
  admin: ReturnType<typeof adminClient>,
  fileId: string,
  previews: WorkerPreview[],
): Promise<number> {
  let totalBytes = 0;
  let saved = 0;
  for (const preview of previews.slice(0, 24)) {
    const bytes = decodeBase64(preview.base64);
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > 5 * 1024 * 1024 || totalBytes > 8 * 1024 * 1024) {
      throw new Error("Preview payload exceeds the callback safety limit.");
    }
    const page = preview.pageNumber || 0;
    const path = `${fileId}/${preview.kind}-${page}.${extensionForMime(preview.mimeType)}`;
    const { error: uploadError } = await admin.storage.from("ed-previews").upload(path, bytes, {
      contentType: preview.mimeType,
      cacheControl: "3600",
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { error: rowError } = await admin.from("file_previews").upsert({
      secure_file_id: fileId,
      kind: preview.kind,
      bucket_id: "ed-previews",
      storage_path: path,
      mime_type: preview.mimeType,
      size_bytes: bytes.byteLength,
      page_number: preview.pageNumber || null,
      metadata: preview.metadata || {},
    }, { onConflict: "storage_path" });
    if (rowError) throw rowError;
    saved += 1;
  }
  return saved;
}

function validateCallback(input: WorkerCallback, file: Record<string, unknown>) {
  if (!["clean", "infected", "suspicious", "error"].includes(input.verdict)) {
    throw new HttpError(400, "Worker verdict is invalid.");
  }
  const archiveStatus = input.archive?.status || "not_archive";
  if (!["pending", "not_archive", "clean", "suspicious", "blocked", "error"].includes(archiveStatus)) {
    throw new HttpError(400, "Archive inspection status is invalid.");
  }

  const sizeValue = input.actualSizeBytes as unknown;
  const hasSize = typeof sizeValue === "number";
  if (sizeValue !== undefined && sizeValue !== null && !hasSize) {
    throw new HttpError(400, "actualSizeBytes must be a number.");
  }
  if (hasSize && (!Number.isSafeInteger(sizeValue) || sizeValue <= 0)) {
    throw new HttpError(400, "actualSizeBytes must be a positive safe integer.");
  }
  if (input.sha256 !== undefined && input.sha256 !== null && typeof input.sha256 !== "string") {
    throw new HttpError(400, "Worker SHA-256 must be a string.");
  }
  const actualHash = input.sha256?.trim().toLowerCase() || null;
  if (actualHash && !/^[a-f0-9]{64}$/.test(actualHash)) {
    throw new HttpError(400, "Worker SHA-256 is invalid.");
  }
  if (input.verdict === "clean" && (!hasSize || !actualHash)) {
    throw new HttpError(400, "Clean results require actualSizeBytes and a SHA-256 digest.");
  }

  const expectedSize = Number(file.expected_size_bytes);
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
    throw new HttpError(500, "Secure file has an invalid expected byte count.");
  }
  const expectedHash = file.checksum_sha256
    ? String(file.checksum_sha256).toLowerCase()
    : null;
  if (expectedHash && !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new HttpError(500, "Secure file has an invalid expected SHA-256 digest.");
  }

  const actualSize = hasSize ? sizeValue : null;
  return {
    actualHash,
    actualSize,
    archiveStatus,
    expectedHash,
    expectedSize,
  };
}

async function transitionFromScanning(
  admin: ReturnType<typeof adminClient>,
  fileId: string,
  tokenHash: string,
  terminalValues: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await admin
    .from("secure_file_objects")
    .update({
      ...terminalValues,
      worker_callback_token_hash: null,
    })
    .eq("id", fileId)
    .eq("security_status", "scanning")
    .eq("availability_status", "quarantined")
    .eq("worker_callback_token_hash", tokenHash)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new HttpError(409, "Worker callback was already consumed or the file is no longer scanning.");
  }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const callbackToken = req.headers.get("x-ednotebook-worker-token") || "";
    if (!callbackToken) throw new HttpError(401, "Worker callback token is required.");
    const input = await parseJson<WorkerCallback>(req, 12 * 1024 * 1024);
    if (!input.fileId || !input.verdict) throw new HttpError(400, "fileId and verdict are required.");

    const admin = adminClient();
    const { data: file, error: fileError } = await admin
      .from("secure_file_objects")
      .select("*")
      .eq("id", input.fileId)
      .single();
    if (fileError || !file) throw new HttpError(404, "Secure file was not found.");

    const tokenHash = await sha256(callbackToken);
    if (!file.worker_callback_token_hash || !constantTimeEqual(tokenHash, file.worker_callback_token_hash)) {
      throw new HttpError(401, "Worker callback token is invalid.");
    }

    const {
      actualHash,
      actualSize,
      archiveStatus,
      expectedHash,
      expectedSize,
    } = validateCallback(input, file);
    let sizeMismatch = actualSize !== null && actualSize !== expectedSize;
    const checksumMismatch = Boolean(expectedHash && actualHash && expectedHash !== actualHash);
    let finalVerdict = sizeMismatch || checksumMismatch ? "suspicious" : input.verdict;
    let source: Blob | null = null;
    let storageSize: number | null = null;

    if (finalVerdict === "clean" && !["pending", "suspicious", "blocked", "error"].includes(archiveStatus)) {
      const { data, error: downloadError } = await admin.storage
        .from(file.quarantine_bucket)
        .download(file.quarantine_path);
      if (downloadError || !data) throw downloadError || new Error("Quarantined object could not be read.");
      source = data;
      storageSize = data.size;
      if (storageSize !== actualSize || storageSize !== expectedSize) {
        sizeMismatch = true;
        finalVerdict = "suspicious";
      }
    }

    if (finalVerdict !== "clean" || ["pending", "suspicious", "blocked", "error"].includes(archiveStatus)) {
      const securityStatus = finalVerdict === "infected"
        ? "infected"
        : finalVerdict === "error"
        ? "error"
        : "suspicious";
      await transitionFromScanning(admin, file.id, tokenHash, {
        actual_size_bytes: actualSize ?? file.actual_size_bytes,
        checksum_sha256: actualHash || file.checksum_sha256,
        detected_mime_type: input.detectedMimeType || file.claimed_mime_type,
        security_status: securityStatus,
        archive_status: archiveStatus,
        availability_status: "blocked",
        scanner_provider: input.scan?.provider || "document-security-worker",
        scanner_engine_version: input.scan?.engineVersion || null,
        scanner_signature_version: input.scan?.signatureVersion || null,
        scan_result: {
          verdict: finalVerdict,
          details: input.scan?.details || {},
          sizeMismatch,
          storageSize,
          checksumMismatch,
          workerError: input.error || null,
        },
        archive_result: input.archive?.details || {},
        preview_status: "error",
        conversion_status: file.conversion_status === "not_requested" ? "not_requested" : "error",
      });
      await markJob(admin, file.id, finalVerdict === "error" ? "failed" : "succeeded", {
        verdict: finalVerdict,
        archiveStatus,
        sizeMismatch,
        storageSize,
        checksumMismatch,
      }, input.error || undefined);
      await recordAudit(admin, req, {
        actorId: null,
        institutionId: file.institution_id,
        courseId: file.course_id,
        assignmentId: file.assignment_id,
        secureFileId: file.id,
        eventType: finalVerdict === "infected" ? "security.malware_blocked" : "security.file_blocked",
        targetType: "secure_file",
        targetId: file.id,
        details: { verdict: finalVerdict, archiveStatus, sizeMismatch, storageSize, checksumMismatch },
      });
      return jsonResponse(req, { secureFileId: file.id, status: "blocked", verdict: finalVerdict });
    }

    if (!source || actualSize === null || !actualHash) {
      throw new HttpError(500, "Clean callback integrity validation did not complete.");
    }

    if (!(await destinationExists(admin, file.destination_bucket, file.destination_path))) {
      const { error: uploadError } = await admin.storage.from(file.destination_bucket).upload(
        file.destination_path,
        source,
        {
          contentType: input.detectedMimeType || file.claimed_mime_type || "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        },
      );
      if (uploadError) throw uploadError;
    }

    const previewCount = await persistPreviews(admin, file.id, input.previews || []);
    if (file.publication_id && input.eduBookManifest) {
      const { error: publicationError } = await admin.from("publications").update({
        edubook_manifest: input.eduBookManifest,
        conversion_status: "ready",
        preview_status: previewCount > 0 ? "ready" : "unsupported",
      }).eq("id", file.publication_id);
      if (publicationError) throw publicationError;
    }

    await transitionFromScanning(admin, file.id, tokenHash, {
      actual_size_bytes: actualSize,
      checksum_sha256: actualHash,
      detected_mime_type: input.detectedMimeType || file.claimed_mime_type,
      security_status: "clean",
      archive_status: archiveStatus,
      availability_status: "released",
      scanner_provider: input.scan?.provider || "document-security-worker",
      scanner_engine_version: input.scan?.engineVersion || null,
      scanner_signature_version: input.scan?.signatureVersion || null,
      scan_result: { verdict: "clean", details: input.scan?.details || {} },
      archive_result: input.archive?.details || {},
      preview_status: file.preview_status === "not_requested"
        ? "not_requested"
        : previewCount > 0 ? "ready" : "unsupported",
      conversion_status: file.conversion_status === "not_requested"
        ? "not_requested"
        : input.eduBookManifest ? "ready" : "error",
      released_at: new Date().toISOString(),
      metadata: { ...file.metadata, ...(input.metadata || {}) },
    });

    try {
      await removeStorageObject(admin, file.quarantine_bucket, file.quarantine_path);
    } catch (cleanupError) {
      console.error("released quarantine cleanup failed", cleanupError);
    }
    await markJob(admin, file.id, "succeeded", {
      verdict: "clean",
      previewCount,
      eduBookConverted: Boolean(input.eduBookManifest),
    });
    await recordAudit(admin, req, {
      actorId: null,
      institutionId: file.institution_id,
      courseId: file.course_id,
      assignmentId: file.assignment_id,
      secureFileId: file.id,
      eventType: "security.file_released",
      targetType: "secure_file",
      targetId: file.id,
      details: { previewCount, eduBookConverted: Boolean(input.eduBookManifest) },
    });

    return jsonResponse(req, {
      secureFileId: file.id,
      status: "released",
      previewCount,
      eduBookConverted: Boolean(input.eduBookManifest),
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
