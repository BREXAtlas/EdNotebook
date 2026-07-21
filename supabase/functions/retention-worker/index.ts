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
  removeStorageTargets,
  requireSupabaseRow,
  requireSupabaseSuccess,
  storageTargetsForFile,
} from "../_shared/deletion.ts";
import { constantTimeEqual } from "../_shared/security.ts";

interface WorkerRequest {
  limit?: number;
}

interface DeletionClaim {
  request_id: string;
  secure_file_id: string;
  claim_token: string;
  claimed_at: string;
  file_data: Record<string, unknown>;
}

interface ExpiredUploadClaim {
  secure_file_id: string;
  claim_token: string;
  claimed_at: string;
  file_data: Record<string, unknown>;
}

type FinishStatus =
  | "blocked_legal_hold"
  | "deferred_retention"
  | "completed"
  | "failed";
type DeletionOutcome =
  | "deleted"
  | "deferred"
  | "held"
  | "governance_conflict"
  | "partial_deletion";
type ExpiredOutcome = "expired" | "held" | "failed" | "governance_conflict";

const CLAIM_TTL = "10 minutes";

function rows<T>(data: T | T[] | null): T[] {
  if (data === null) return [];
  return Array.isArray(data) ? data : [data];
}

function firstRow<T>(data: T | T[] | null): T | null {
  return rows(data)[0] || null;
}

function requiredRpcRow(
  result: { data: unknown; error: unknown },
  operation: string,
): Record<string, unknown> {
  const data = firstRow(requireSupabaseSuccess(result, operation));
  return requireSupabaseRow({ data, error: null }, operation);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function futureRetention(file: Record<string, unknown>): string | null {
  if (typeof file.retention_until !== "string") return null;
  const value = new Date(file.retention_until);
  return Number.isFinite(value.getTime()) && value.getTime() > Date.now()
    ? value.toISOString()
    : null;
}

async function loadFile(
  admin: ReturnType<typeof adminClient>,
  fileId: string,
): Promise<Record<string, unknown>> {
  return requireSupabaseRow(
    await admin.from("secure_file_objects").select("*").eq("id", fileId)
      .single(),
    "Reload the claimed secure file",
  );
}

async function onLegalHold(
  admin: ReturnType<typeof adminClient>,
  file: Record<string, unknown>,
) {
  const directResult = await admin
    .from("legal_hold_files")
    .select("legal_holds!inner(id,active,released_at)")
    .eq("secure_file_id", file.id)
    .eq("legal_holds.active", true)
    .is("legal_holds.released_at", null)
    .limit(1);
  const direct =
    requireSupabaseSuccess(directResult, "Check file-specific legal holds") ||
    [];
  if (direct.length) return true;

  const clauses: string[] = [];
  if (file.institution_id) {
    clauses.push(`institution_id.eq.${file.institution_id}`);
  }
  if (file.course_id) clauses.push(`course_id.eq.${file.course_id}`);
  if (!clauses.length) return false;
  const scopedResult = await admin.from("legal_holds").select("id").eq(
    "active",
    true,
  ).is("released_at", null).or(clauses.join(",")).limit(1);
  const scoped =
    requireSupabaseSuccess(scopedResult, "Check scoped legal holds") || [];
  return scoped.length > 0;
}

async function finishDeletionClaim(
  admin: ReturnType<typeof adminClient>,
  claim: DeletionClaim,
  workerId: string,
  status: FinishStatus,
  eligibleAt: string | null,
  lastError: string | null,
  storageRemovalStarted: boolean,
) {
  const row = requiredRpcRow(
    await admin.rpc("finish_file_deletion_claim", {
      p_request_id: claim.request_id,
      p_claim_token: claim.claim_token,
      p_worker_id: workerId,
      p_status: status,
      p_eligible_at: eligibleAt,
      p_last_error: lastError,
      p_storage_removal_started: storageRemovalStarted,
    }),
    `Finish retention deletion claim as ${status}`,
  );
  if (row.status !== status) {
    throw new Error(
      `Finish retention deletion claim returned ${
        String(row.status)
      } instead of ${status}`,
    );
  }
  return row;
}

async function renewDeletionClaim(
  admin: ReturnType<typeof adminClient>,
  claim: DeletionClaim,
  workerId: string,
) {
  const renewed = firstRow(requireSupabaseSuccess(
    await admin.rpc("renew_file_deletion_claim", {
      p_request_id: claim.request_id,
      p_claim_token: claim.claim_token,
      p_worker_id: workerId,
    }),
    "Renew and fence the retention deletion claim",
  ));
  if (!renewed) {
    throw new Error("Renew retention deletion claim failed: no row returned");
  }
  return renewed as DeletionClaim;
}

async function finishPreRemovalDisposition(
  admin: ReturnType<typeof adminClient>,
  claim: DeletionClaim,
  workerId: string,
): Promise<DeletionOutcome | null> {
  const latest = await loadFile(admin, claim.secure_file_id);
  if (await onLegalHold(admin, latest)) {
    const finished = await finishDeletionClaim(
      admin,
      claim,
      workerId,
      "blocked_legal_hold",
      null,
      null,
      false,
    );
    return finished.completion_outcome === "partial_deletion"
      ? "partial_deletion"
      : "held";
  }
  const eligibleAt = futureRetention(latest);
  if (eligibleAt) {
    const finished = await finishDeletionClaim(
      admin,
      claim,
      workerId,
      "deferred_retention",
      eligibleAt,
      null,
      false,
    );
    return finished.completion_outcome === "partial_deletion"
      ? "partial_deletion"
      : "deferred";
  }
  return null;
}

async function removeFileObjects(
  admin: ReturnType<typeof adminClient>,
  file: Record<string, unknown>,
  beforeEachRemoval: () => Promise<void>,
) {
  const previewResult = await admin
    .from("file_previews")
    .select("bucket_id,storage_path")
    .eq("secure_file_id", file.id);
  const previews =
    requireSupabaseSuccess(previewResult, "Load file previews") || [];

  for (const target of storageTargetsForFile(file, previews)) {
    await beforeEachRemoval();
    await removeStorageTargets(
      [target],
      (bucket, path) => admin.storage.from(bucket).remove([path]),
      (bucket, path) => admin.storage.from(bucket).exists(path),
    );
  }
}

async function processDeletionClaim(
  admin: ReturnType<typeof adminClient>,
  claim: DeletionClaim,
  workerId: string,
): Promise<DeletionOutcome> {
  let storageRemovalStarted = false;
  try {
    // Batch claims may wait while earlier rows are processed. Refresh this
    // specific token before changing file state so an expired claim cannot
    // overlap another worker.
    const activeClaim = await renewDeletionClaim(admin, claim, workerId);
    let file = activeClaim.file_data;
    // Reconcile a prior worker crash after Storage and file metadata committed.
    // The fenced finish writes completion audit evidence transactionally and
    // cannot downgrade a request another worker already completed.
    if (file.availability_status === "deleted") {
      const finished = await finishDeletionClaim(
        admin,
        claim,
        workerId,
        "completed",
        null,
        null,
        false,
      );
      return finished.completion_outcome === "late_governance_conflict"
        ? "governance_conflict"
        : "deleted";
    }

    const disposition = await finishPreRemovalDisposition(
      admin,
      claim,
      workerId,
    );
    if (disposition) return disposition;

    file = requireSupabaseRow(
      await admin.from("secure_file_objects").update({
        availability_status: "pending_delete",
        delete_requested_at: new Date().toISOString(),
      }).eq("id", claim.secure_file_id).in(
        "availability_status",
        ["released", "pending_delete"],
      ).select("*").single(),
      "Quarantine the file immediately before retention deletion",
    );

    const secondDisposition = await finishPreRemovalDisposition(
      admin,
      claim,
      workerId,
    );
    if (secondDisposition) return secondDisposition;

    await removeFileObjects(admin, file, async () => {
      // The renewal is a token fence plus a database legal-hold/retention
      // decision. It immediately precedes every irreversible Storage call.
      await renewDeletionClaim(admin, claim, workerId);
      storageRemovalStarted = true;
    });

    const finished = await finishDeletionClaim(
      admin,
      claim,
      workerId,
      "completed",
      null,
      null,
      storageRemovalStarted,
    );
    return finished.completion_outcome === "late_governance_conflict"
      ? "governance_conflict"
      : "deleted";
  } catch (error) {
    if (!storageRemovalStarted) {
      try {
        const disposition = await finishPreRemovalDisposition(
          admin,
          claim,
          workerId,
        );
        if (disposition) return disposition;
      } catch (dispositionError) {
        console.error("Could not resolve the pre-removal disposition", {
          requestId: claim.request_id,
          error: dispositionError,
        });
      }
    }

    try {
      const failed = await finishDeletionClaim(
        admin,
        claim,
        workerId,
        "failed",
        null,
        errorMessage(error),
        storageRemovalStarted,
      );
      if (failed.completion_outcome === "partial_deletion") {
        return "partial_deletion";
      }
    } catch (statusError) {
      throw new AggregateError(
        [error, statusError],
        "Retention deletion failed and its token-fenced failure could not be recorded",
      );
    }
    throw error;
  }
}

async function renewExpiredUploadClaim(
  admin: ReturnType<typeof adminClient>,
  claim: ExpiredUploadClaim,
  workerId: string,
) {
  const renewed = firstRow(requireSupabaseSuccess(
    await admin.rpc("renew_expired_upload_claim", {
      p_secure_file_id: claim.secure_file_id,
      p_claim_token: claim.claim_token,
      p_worker_id: workerId,
    }),
    "Renew and fence the expired-upload claim",
  ));
  if (!renewed) {
    throw new Error("Renew expired-upload claim failed: no row returned");
  }
  return renewed as ExpiredUploadClaim;
}

async function finishExpiredUploadClaim(
  admin: ReturnType<typeof adminClient>,
  claim: ExpiredUploadClaim,
  workerId: string,
  succeeded: boolean,
  lastError: string | null = null,
) {
  const row = requiredRpcRow(
    await admin.rpc("finish_expired_upload_claim", {
      p_secure_file_id: claim.secure_file_id,
      p_claim_token: claim.claim_token,
      p_worker_id: workerId,
      p_succeeded: succeeded,
      p_last_error: lastError,
    }),
    `Finish expired-upload claim as ${succeeded ? "expired" : "failed"}`,
  );
  if (
    succeeded &&
    (row.upload_status !== "expired" || row.availability_status !== "deleted")
  ) {
    throw new Error(
      "Expired-upload finish did not commit truthful expired/deleted state.",
    );
  }
  return row;
}

async function processExpiredUploadClaim(
  admin: ReturnType<typeof adminClient>,
  claim: ExpiredUploadClaim,
  workerId: string,
): Promise<ExpiredOutcome> {
  let storageRemovalStarted = false;
  try {
    // Refresh a batch claim when processing begins; a later worker may have
    // reclaimed it while this run handled earlier rows.
    const activeClaim = await renewExpiredUploadClaim(admin, claim, workerId);
    if (await onLegalHold(admin, activeClaim.file_data)) {
      await finishExpiredUploadClaim(
        admin,
        claim,
        workerId,
        false,
        "An active legal hold blocks expired-upload cleanup.",
      );
      return "held";
    }

    const targets = storageTargetsForFile({
      quarantine_bucket: activeClaim.file_data.quarantine_bucket,
      quarantine_path: activeClaim.file_data.quarantine_path,
    });
    for (const target of targets) {
      await renewExpiredUploadClaim(admin, claim, workerId);
      storageRemovalStarted = true;
      await removeStorageTargets(
        [target],
        (bucket, path) => admin.storage.from(bucket).remove([path]),
        (bucket, path) => admin.storage.from(bucket).exists(path),
      );
    }
    const finished = await finishExpiredUploadClaim(
      admin,
      claim,
      workerId,
      true,
    );
    return finished.expiration_completion_outcome ===
        "late_governance_conflict"
      ? "governance_conflict"
      : "expired";
  } catch (error) {
    let held = false;
    if (!storageRemovalStarted) {
      try {
        held = await onLegalHold(
          admin,
          await loadFile(admin, claim.secure_file_id),
        );
      } catch (holdError) {
        console.error("Could not re-check an expired upload legal hold", {
          secureFileId: claim.secure_file_id,
          error: holdError,
        });
      }
    }

    try {
      // False clears only this token's claim. If a hold appeared, the RPC
      // records a blocked-hold audit and preserves the file instead.
      await finishExpiredUploadClaim(
        admin,
        claim,
        workerId,
        false,
        errorMessage(error),
      );
    } catch (statusError) {
      throw new AggregateError(
        [error, statusError],
        "Expired-upload cleanup failed and its token-fenced failure could not be recorded",
      );
    }
    return held ? "held" : "failed";
  }
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

    const input = await parseJson<WorkerRequest>(req).catch(
      () => ({} as WorkerRequest),
    );
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 25));
    const admin = adminClient();
    const workerId = `retention-worker:${crypto.randomUUID()}`;
    const summary = {
      deleted: 0,
      deferred: 0,
      held: 0,
      expiredUploads: 0,
      governanceConflicts: 0,
      partialDeletions: 0,
      failed: 0,
    };

    const deletionClaims = rows<DeletionClaim>(requireSupabaseSuccess(
      await admin.rpc("claim_file_deletion_requests", {
        p_worker_id: workerId,
        p_limit: limit,
        p_claim_ttl: CLAIM_TTL,
      }),
      "Atomically claim retention deletion requests",
    ));

    for (const claim of deletionClaims) {
      try {
        const outcome = await processDeletionClaim(admin, claim, workerId);
        if (outcome === "deleted") summary.deleted += 1;
        else if (outcome === "deferred") summary.deferred += 1;
        else if (outcome === "held") summary.held += 1;
        else if (outcome === "governance_conflict") {
          summary.governanceConflicts += 1;
        } else summary.partialDeletions += 1;
      } catch (error) {
        summary.failed += 1;
        console.error("retention deletion request failed", {
          requestId: claim.request_id,
          error,
        });
      }
    }

    const expiredClaims = rows<ExpiredUploadClaim>(requireSupabaseSuccess(
      await admin.rpc("claim_expired_uploads", {
        p_worker_id: workerId,
        p_limit: limit,
        p_claim_ttl: CLAIM_TTL,
      }),
      "Atomically claim expired upload reservations",
    ));

    for (const claim of expiredClaims) {
      try {
        const outcome = await processExpiredUploadClaim(admin, claim, workerId);
        if (outcome === "expired") summary.expiredUploads += 1;
        else if (outcome === "held") summary.held += 1;
        else if (outcome === "failed") summary.failed += 1;
        else summary.governanceConflicts += 1;
      } catch (error) {
        summary.failed += 1;
        console.error("expired upload cleanup failed", {
          secureFileId: claim.secure_file_id,
          error,
        });
      }
    }

    return jsonResponse(req, summary);
  } catch (error) {
    return errorResponse(req, error);
  }
});
