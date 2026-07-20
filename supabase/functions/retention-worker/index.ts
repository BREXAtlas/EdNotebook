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
import { constantTimeEqual, recordAudit } from "../_shared/security.ts";
import { removeStorageObject } from "../_shared/storage.ts";

interface WorkerRequest {
  limit?: number;
  inactiveDays?: number;
  dryRun?: boolean;
}

async function onLegalHold(admin: ReturnType<typeof adminClient>, file: Record<string, unknown>) {
  const { data: direct } = await admin
    .from("legal_hold_files")
    .select("legal_holds!inner(id,active,released_at)")
    .eq("secure_file_id", file.id)
    .eq("legal_holds.active", true)
    .is("legal_holds.released_at", null)
    .limit(1);
  if (direct?.length) return true;

  let query = admin.from("legal_holds").select("id").eq("active", true).is("released_at", null);
  const clauses: string[] = [];
  if (file.institution_id) clauses.push(`institution_id.eq.${file.institution_id}`);
  if (file.course_id) clauses.push(`course_id.eq.${file.course_id}`);
  if (!clauses.length) return false;
  const { data } = await query.or(clauses.join(",")).limit(1);
  return Boolean(data?.length);
}

async function removeFile(admin: ReturnType<typeof adminClient>, file: Record<string, unknown>) {
  const tasks: Promise<"removed" | "not_found">[] = [];
  if (file.quarantine_bucket && file.quarantine_path) {
    tasks.push(removeStorageObject(
      admin,
      String(file.quarantine_bucket),
      String(file.quarantine_path),
    ));
  }
  if (file.destination_bucket && file.destination_path) {
    tasks.push(removeStorageObject(
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
    tasks.push(removeStorageObject(admin, preview.bucket_id, preview.storage_path));
  }
  await Promise.all(tasks);
  const now = new Date().toISOString();
  const { error: fileUpdateError } = await admin
    .from("secure_file_objects")
    .update({
      availability_status: "deleted",
      deleted_at: now,
      worker_callback_token_hash: null,
    })
    .eq("id", file.id);
  if (fileUpdateError) throw fileUpdateError;
  const { error: quotaError } = await admin
    .from("upload_quota_reservations")
    .update({ status: "released" })
    .eq("secure_file_id", file.id);
  if (quotaError) throw quotaError;
  return now;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const expectedSecret = Deno.env.get("RETENTION_CRON_SECRET") || "";
    const suppliedSecret = req.headers.get("x-cron-secret") || "";
    if (!expectedSecret || !constantTimeEqual(expectedSecret, suppliedSecret)) {
      throw new HttpError(401, "Retention worker secret is invalid.");
    }

    const input = await parseJson<WorkerRequest>(req).catch(() => ({} as WorkerRequest));
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 25));
    const inactiveDays = Math.max(7, Math.min(365, Number(input.inactiveDays) || 30));
    const dryRun = input.dryRun !== false;
    const admin = adminClient();
    const summary = {
      dryRun,
      deleted: 0,
      deletionCandidates: 0,
      deferred: 0,
      held: 0,
      expiredUploads: 0,
      expiredUploadCandidates: 0,
      inactiveAccountsFlagged: 0,
      inactiveAccountCandidates: 0,
      failed: 0,
    };

    const { data: requests, error: requestError } = await admin
      .from("file_deletion_requests")
      .select("*,secure_file_objects(*)")
      .in("status", ["eligible", "deferred_retention"])
      .or(`eligible_at.is.null,eligible_at.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (requestError) throw requestError;

    for (const request of requests || []) {
      const file = request.secure_file_objects;
      if (!file) continue;
      try {
        if (await onLegalHold(admin, file)) {
          if (!dryRun) await admin.from("file_deletion_requests").update({ status: "blocked_legal_hold" }).eq("id", request.id);
          summary.held += 1;
          continue;
        }
        if (file.retention_until && new Date(file.retention_until).getTime() > Date.now()) {
          if (!dryRun) {
            await admin.from("file_deletion_requests").update({
              status: "deferred_retention",
              eligible_at: file.retention_until,
            }).eq("id", request.id);
          }
          summary.deferred += 1;
          continue;
        }
        if (dryRun) {
          summary.deletionCandidates += 1;
          continue;
        }
        await admin.from("file_deletion_requests").update({ status: "processing" }).eq("id", request.id);
        const processedAt = await removeFile(admin, file);
        await admin.from("file_deletion_requests").update({
          status: "completed",
          processed_at: processedAt,
        }).eq("id", request.id);
        await recordAudit(admin, req, {
          actorId: null,
          institutionId: file.institution_id,
          courseId: file.course_id,
          assignmentId: file.assignment_id,
          secureFileId: file.id,
          eventType: "retention.delete_completed",
          targetType: "secure_file",
          targetId: file.id,
          details: { deletionRequestId: request.id },
        });
        summary.deleted += 1;
      } catch (error) {
        summary.failed += 1;
        if (!dryRun) {
          await admin.from("file_deletion_requests").update({
            status: "failed",
            last_error: error instanceof Error ? error.message : String(error),
          }).eq("id", request.id);
        }
      }
    }

    const { data: expired } = await admin
      .from("secure_file_objects")
      .select("*")
      .in("upload_status", ["reserved", "uploading"])
      .lte("upload_expires_at", new Date().toISOString())
      .limit(limit);

    for (const file of expired || []) {
      if (dryRun) {
        summary.expiredUploadCandidates += 1;
        continue;
      }
      if (!file.quarantine_bucket || !file.quarantine_path) {
        throw new Error(`Expired upload ${file.id} has no quarantine Storage object.`);
      }
      await removeStorageObject(admin, file.quarantine_bucket, file.quarantine_path);
      const { error: expireError } = await admin.from("secure_file_objects").update({
        upload_status: "expired",
        availability_status: "deleted",
        deleted_at: new Date().toISOString(),
        worker_callback_token_hash: null,
      }).eq("id", file.id);
      if (expireError) throw expireError;
      const { error: reservationError } = await admin
        .from("upload_quota_reservations")
        .update({ status: "expired" })
        .eq("secure_file_id", file.id);
      if (reservationError) throw reservationError;
      await recordAudit(admin, req, {
        actorId: null,
        secureFileId: file.id,
        courseId: file.course_id,
        assignmentId: file.assignment_id,
        eventType: "upload.expired",
        targetType: "secure_file",
        targetId: file.id,
        details: {},
      });
      summary.expiredUploads += 1;
    }

    const inactiveCutoff = new Date(Date.now() - inactiveDays * 86_400_000).toISOString();
    const { data: inactiveAccounts, error: inactiveError } = await admin
      .from("profiles")
      .select("id,email,created_at")
      .in("role", ["learner", "professor"])
      .in("account_audit_status", ["unreviewed", "active"])
      .is("meaningful_activity_at", null)
      .lt("created_at", inactiveCutoff)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (inactiveError) throw inactiveError;

    for (const account of inactiveAccounts || []) {
      if (dryRun) {
        summary.inactiveAccountCandidates += 1;
        continue;
      }
      const { error: flagError } = await admin
        .from("profiles")
        .update({ account_audit_status: "inactive_review", inactive_flagged_at: new Date().toISOString() })
        .eq("id", account.id);
      if (flagError) {
        summary.failed += 1;
        continue;
      }
      summary.inactiveAccountsFlagged += 1;
    }

    return jsonResponse(req, summary);
  } catch (error) {
    return errorResponse(req, error);
  }
});
