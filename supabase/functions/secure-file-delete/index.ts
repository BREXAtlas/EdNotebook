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
import {
  removeStorageTargets,
  requireSupabaseRow,
  requireSupabaseSuccess,
  storageTargetsForFile,
} from "../_shared/deletion.ts";

interface DeleteRequest {
  secureFileId: string;
  reason?: string;
}

interface DeletionClaim {
  request_id: string;
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
type PreRemovalDisposition =
  | "blocked_legal_hold"
  | "deferred_retention"
  | "partial_deletion_blocked_legal_hold"
  | "partial_deletion_deferred_retention";

const CLAIM_TTL = "10 minutes";

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null;
  return data;
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

async function removeObjects(
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

  // Process targets one at a time. Each irreversible Storage call gets its own
  // same-token renewal, which also performs the final database legal-hold and
  // retention check immediately before that object is removed.
  for (const target of storageTargetsForFile(file, previews)) {
    await beforeEachRemoval();
    await removeStorageTargets(
      [target],
      (bucket, path) => admin.storage.from(bucket).remove([path]),
      (bucket, path) => admin.storage.from(bucket).exists(path),
    );
  }
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
  const scopedResult = await admin
    .from("legal_holds")
    .select("id")
    .eq("active", true)
    .is("released_at", null)
    .or(clauses.join(","))
    .limit(1);
  const scoped =
    requireSupabaseSuccess(scopedResult, "Check scoped legal holds") || [];
  return scoped.length > 0;
}

async function finishClaim(
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
    `Finish deletion claim as ${status}`,
  );
  if (row.status !== status) {
    throw new Error(
      `Finish deletion claim returned ${
        String(row.status)
      } instead of ${status}`,
    );
  }
  return row;
}

async function renewClaim(
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
    "Renew and fence the deletion claim",
  ));
  if (!renewed) throw new Error("Renew deletion claim failed: no row returned");
  return renewed as DeletionClaim;
}

async function finishCurrentPreRemovalDisposition(
  admin: ReturnType<typeof adminClient>,
  claim: DeletionClaim,
  workerId: string,
): Promise<PreRemovalDisposition | null> {
  const latest = await loadFile(admin, claim.secure_file_id);
  if (await onLegalHold(admin, latest)) {
    const finished = await finishClaim(
      admin,
      claim,
      workerId,
      "blocked_legal_hold",
      null,
      null,
      false,
    );
    return finished.completion_outcome === "partial_deletion"
      ? "partial_deletion_blocked_legal_hold"
      : "blocked_legal_hold";
  }
  const eligibleAt = futureRetention(latest);
  if (eligibleAt) {
    const finished = await finishClaim(
      admin,
      claim,
      workerId,
      "deferred_retention",
      eligibleAt,
      null,
      false,
    );
    return finished.completion_outcome === "partial_deletion"
      ? "partial_deletion_deferred_retention"
      : "deferred_retention";
  }
  return null;
}

function dispositionPayload(
  requestId: string,
  disposition: PreRemovalDisposition,
  eligibleAt: string | null,
) {
  if (disposition.startsWith("partial_deletion_")) {
    return {
      requestId,
      status: "partial_deletion",
      deleted: false,
      availability: "blocked",
      fileIntegrity: "damaged",
      governanceGate: disposition.endsWith("legal_hold")
        ? "legal_hold"
        : "retention",
      eligibleAt,
      requiresReview: true,
    };
  }
  return {
    requestId,
    status: disposition,
    eligibleAt,
    deleted: false,
  };
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  try {
    requirePost(req);
    const { client } = await requireUser(req);
    const input = await parseJson<DeleteRequest>(req);
    if (!input.secureFileId) {
      throw new HttpError(400, "secureFileId is required.");
    }

    const { data: requestData, error: requestError } = await client.rpc(
      "request_secure_file_deletion",
      {
        p_secure_file_id: input.secureFileId,
        p_reason: input.reason || "",
      },
    );
    if (requestError) throw new HttpError(403, requestError.message);
    const deletion = firstRow(requestData);
    if (!deletion) {
      throw new HttpError(500, "Deletion request was not created.");
    }

    if (deletion.status !== "eligible") {
      return jsonResponse(req, {
        requestId: deletion.request_id,
        status: deletion.status,
        eligibleAt: deletion.eligible_at,
        deleted: false,
      }, 202);
    }

    const admin = adminClient();
    const workerId = `secure-file-delete:${crypto.randomUUID()}`;
    const claim = firstRow<DeletionClaim>(requireSupabaseSuccess(
      await admin.rpc("claim_file_deletion_request", {
        p_request_id: deletion.request_id,
        p_worker_id: workerId,
        p_claim_ttl: CLAIM_TTL,
      }),
      "Atomically claim the deletion request",
    ));

    // An overlapping invocation won the claim. It alone may touch Storage or
    // finish the request, so this invocation reports an accepted in-flight job.
    if (!claim) {
      return jsonResponse(req, {
        requestId: deletion.request_id,
        status: "processing",
        deleted: false,
      }, 202);
    }

    let storageRemovalStarted = false;
    try {
      // Refresh even a newly issued claim before making any file-state change.
      // This also protects retries if this invocation was delayed after claim.
      const activeClaim = await renewClaim(admin, claim, workerId);
      let file = activeClaim.file_data;
      // A stale processing claim may be recovered after a prior worker removed
      // Storage and committed the file metadata but crashed before finishing.
      // Do not repeat irreversible work; the fenced finish creates the required
      // completion audit evidence in the same database transaction.
      if (file.availability_status === "deleted") {
        const finished = await finishClaim(
          admin,
          claim,
          workerId,
          "completed",
          null,
          null,
          false,
        );
        const governanceConflict =
          finished.completion_outcome === "late_governance_conflict";
        return jsonResponse(req, {
          requestId: claim.request_id,
          status: governanceConflict
            ? "completed_with_late_governance_conflict"
            : "completed",
          deleted: true,
          reconciled: true,
          governanceConflict,
        });
      }

      const disposition = await finishCurrentPreRemovalDisposition(
        admin,
        claim,
        workerId,
      );
      if (disposition) {
        const eligibleAt = disposition.endsWith("deferred_retention")
          ? futureRetention(await loadFile(admin, claim.secure_file_id))
          : null;
        return jsonResponse(
          req,
          dispositionPayload(claim.request_id, disposition, eligibleAt),
          202,
        );
      }

      file = requireSupabaseRow(
        await admin.from("secure_file_objects").update({
          availability_status: "pending_delete",
          delete_requested_at: new Date().toISOString(),
        }).eq("id", claim.secure_file_id).in(
          "availability_status",
          ["released", "pending_delete"],
        ).select("*").single(),
        "Quarantine the claimed file before deletion",
      );

      const secondDisposition = await finishCurrentPreRemovalDisposition(
        admin,
        claim,
        workerId,
      );
      if (secondDisposition) {
        const eligibleAt = secondDisposition.endsWith("deferred_retention")
          ? futureRetention(await loadFile(admin, claim.secure_file_id))
          : null;
        return jsonResponse(
          req,
          dispositionPayload(claim.request_id, secondDisposition, eligibleAt),
          202,
        );
      }

      await removeObjects(admin, file, async () => {
        await renewClaim(admin, claim, workerId);
        storageRemovalStarted = true;
      });

      const finished = await finishClaim(
        admin,
        claim,
        workerId,
        "completed",
        null,
        null,
        storageRemovalStarted,
      );
      const governanceConflict =
        finished.completion_outcome === "late_governance_conflict";
      return jsonResponse(req, {
        requestId: claim.request_id,
        status: governanceConflict
          ? "completed_with_late_governance_conflict"
          : "completed",
        deleted: true,
        governanceConflict,
      });
    } catch (deleteError) {
      if (!storageRemovalStarted) {
        try {
          const disposition = await finishCurrentPreRemovalDisposition(
            admin,
            claim,
            workerId,
          );
          if (disposition) {
            return jsonResponse(
              req,
              dispositionPayload(claim.request_id, disposition, null),
              202,
            );
          }
        } catch (dispositionError) {
          console.error("Could not resolve the pre-removal disposition", {
            requestId: claim.request_id,
            error: dispositionError,
          });
        }
      }

      try {
        const failed = await finishClaim(
          admin,
          claim,
          workerId,
          "failed",
          null,
          errorMessage(deleteError),
          storageRemovalStarted,
        );
        if (failed.completion_outcome === "partial_deletion") {
          return jsonResponse(req, {
            requestId: claim.request_id,
            status: "partial_deletion",
            deleted: false,
            availability: "blocked",
            fileIntegrity: "damaged",
            requiresReview: true,
          }, 500);
        }
      } catch (statusError) {
        throw new AggregateError(
          [deleteError, statusError],
          "Deletion failed and its token-fenced failure could not be recorded",
        );
      }
      throw deleteError;
    }
  } catch (error) {
    return errorResponse(req, error);
  }
});
