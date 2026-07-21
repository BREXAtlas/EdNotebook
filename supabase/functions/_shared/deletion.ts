export interface SupabaseOperationResult<T = unknown> {
  data: T | null;
  error: unknown | null;
}

export interface StorageTarget {
  bucket: string;
  path: string;
  label: string;
}

type StorageRemove = (
  bucket: string,
  path: string,
) => Promise<SupabaseOperationResult<unknown>>;

type StorageExists = (
  bucket: string,
  path: string,
) => Promise<SupabaseOperationResult<boolean>>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(
      (error as { message?: unknown }).message || "Unknown Supabase error",
    );
  }
  return String(error || "Unknown Supabase error");
}

export function requireSupabaseSuccess<T>(
  result: SupabaseOperationResult<T>,
  operation: string,
): T | null {
  if (result.error) {
    throw new Error(`${operation} failed: ${errorMessage(result.error)}`);
  }
  return result.data;
}

export function requireSupabaseRow(
  result: SupabaseOperationResult<unknown>,
  operation: string,
): Record<string, unknown> {
  const data = requireSupabaseSuccess(result, operation);
  if (data === null || data === undefined) {
    throw new Error(`${operation} failed: no row was changed`);
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${operation} failed: expected one changed row`);
  }
  return data as Record<string, unknown>;
}

export function storageTargetsForFile(
  file: Record<string, unknown>,
  previews: Array<Record<string, unknown>> = [],
): StorageTarget[] {
  const candidates: StorageTarget[] = [];
  const append = (bucket: unknown, path: unknown, label: string) => {
    if (
      typeof bucket !== "string" || !bucket || typeof path !== "string" || !path
    ) return;
    candidates.push({ bucket, path, label });
  };

  append(file.quarantine_bucket, file.quarantine_path, "quarantine object");
  append(file.destination_bucket, file.destination_path, "released object");
  for (const preview of previews) {
    append(preview.bucket_id, preview.storage_path, "preview object");
  }

  const seen = new Set<string>();
  return candidates.filter((target) => {
    const key = `${target.bucket}\u0000${target.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function removeStorageTargets(
  targets: StorageTarget[],
  remove: StorageRemove,
  exists: StorageExists,
): Promise<void> {
  const outcomes = await Promise.allSettled(targets.map(async (target) => {
    const result = await remove(target.bucket, target.path);
    requireSupabaseSuccess(
      result,
      `Remove ${target.label} ${target.bucket}/${target.path}`,
    );
    const verification = await exists(target.bucket, target.path);
    // supabase-js returns data=false together with a 400/404 Storage error when
    // an object is absent. That is the expected result after deletion. A
    // successful remove response by itself is not enough: the Storage API may
    // return an empty deleted-file array, so confirm the object cannot be read.
    if (verification.data !== false) {
      if (verification.error) {
        throw new Error(
          `Verify ${target.label} removal failed: ${
            errorMessage(verification.error)
          }`,
        );
      }
      throw new Error(
        `Verify ${target.label} removal failed: ${target.bucket}/${target.path} still exists`,
      );
    }
  }));
  const failures = outcomes
    .filter((outcome): outcome is PromiseRejectedResult =>
      outcome.status === "rejected"
    )
    .map((outcome) => outcome.reason);
  if (failures.length) {
    throw new AggregateError(
      failures,
      `Storage deletion failed for ${failures.length} object${
        failures.length === 1 ? "" : "s"
      }`,
    );
  }
}
