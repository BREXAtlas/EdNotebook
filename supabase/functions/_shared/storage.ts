import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

interface StorageErrorLike {
  error?: string;
  message?: string;
  status?: number | string;
  statusCode?: number | string;
}

function storageErrorMessage(error: StorageErrorLike): string {
  return String(error.message || error.error || "Storage object removal failed.");
}

export function isStorageObjectNotFound(error: StorageErrorLike): boolean {
  const status = Number(error.statusCode ?? error.status);
  if (status === 404) return true;
  return /\b(?:not found|does not exist|no such (?:file|object))\b/i.test(storageErrorMessage(error));
}

/**
 * Remove one Storage object and surface the error embedded in the Supabase
 * response. Missing objects are an idempotent success; all other failures stop
 * the caller before its database row can be marked deleted.
 */
export async function removeStorageObject(
  admin: SupabaseClient,
  bucket: string,
  path: string,
): Promise<"removed" | "not_found"> {
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (!error) return "removed";
  if (isStorageObjectNotFound(error)) return "not_found";
  throw new Error(`Unable to remove ${bucket}/${path}: ${storageErrorMessage(error)}`);
}
