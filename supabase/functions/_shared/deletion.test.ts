import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  removeStorageTargets,
  requireSupabaseRow,
  requireSupabaseSuccess,
  storageTargetsForFile,
} from "./deletion.ts";
import { recordAuditRequired } from "./security.ts";

Deno.test("builds a deduplicated list of every stored file object", () => {
  const targets = storageTargetsForFile(
    {
      quarantine_bucket: "ed-quarantine",
      quarantine_path: "files/example",
      destination_bucket: "ed-private",
      destination_path: "files/example",
    },
    [
      { bucket_id: "ed-previews", storage_path: "files/example/page-1" },
      { bucket_id: "ed-previews", storage_path: "files/example/page-1" },
      { bucket_id: "", storage_path: "ignored" },
    ],
  );

  assertEquals(targets, [
    {
      bucket: "ed-quarantine",
      path: "files/example",
      label: "quarantine object",
    },
    { bucket: "ed-private", path: "files/example", label: "released object" },
    {
      bucket: "ed-previews",
      path: "files/example/page-1",
      label: "preview object",
    },
  ]);
});

Deno.test("treats Supabase response errors and missing changed rows as failures", () => {
  assertEquals(
    requireSupabaseSuccess({ data: { id: "ok" }, error: null }, "Save row"),
    { id: "ok" },
  );
  assertThrows(
    () =>
      requireSupabaseSuccess({
        data: null,
        error: { message: "database unavailable" },
      }, "Save row"),
    Error,
    "Save row failed: database unavailable",
  );
  assertThrows(
    () => requireSupabaseRow({ data: null, error: null }, "Update row"),
    Error,
    "Update row failed: no row was changed",
  );
});

Deno.test("does not accept completed Storage deletion when a response contains an error", async () => {
  const attempted: string[] = [];
  const targets = storageTargetsForFile({
    quarantine_bucket: "ed-quarantine",
    quarantine_path: "files/example",
    destination_bucket: "ed-private",
    destination_path: "files/example",
  });

  await assertRejects(
    () =>
      removeStorageTargets(targets, async (bucket, path) => {
        attempted.push(`${bucket}/${path}`);
        return bucket === "ed-private"
          ? { data: null, error: { message: "object store rejected removal" } }
          : { data: [], error: null };
      }, async () => ({ data: false, error: { message: "not found" } })),
    AggregateError,
    "Storage deletion failed for 1 object",
  );
  assertEquals(attempted.sort(), [
    "ed-private/files/example",
    "ed-quarantine/files/example",
  ]);
});

Deno.test("does not accept completed Storage deletion when a removal throws", async () => {
  await assertRejects(
    () =>
      removeStorageTargets(
        [{
          bucket: "ed-private",
          path: "files/example",
          label: "released object",
        }],
        async () => {
          throw new Error("network failed");
        },
        async () => ({ data: false, error: { message: "not found" } }),
      ),
    AggregateError,
    "Storage deletion failed for 1 object",
  );
});

Deno.test("completes only after every Storage target reports success", async () => {
  const attempted: string[] = [];
  await removeStorageTargets(
    [
      { bucket: "ed-private", path: "files/example", label: "released object" },
      {
        bucket: "ed-previews",
        path: "files/example/page-1",
        label: "preview object",
      },
    ],
    async (bucket, path) => {
      attempted.push(`${bucket}/${path}`);
      return { data: [], error: null };
    },
    async () => ({ data: false, error: { message: "not found" } }),
  );
  assertEquals(attempted.length, 2);
});

Deno.test("does not report deletion while Storage still exposes the object", async () => {
  await assertRejects(
    () =>
      removeStorageTargets(
        [{
          bucket: "ed-private",
          path: "files/example",
          label: "released object",
        }],
        async () => ({ data: [], error: null }),
        async () => ({ data: true, error: null }),
      ),
    AggregateError,
    "Storage deletion failed for 1 object",
  );
});

Deno.test("required deletion audit rejects a resolved database error response", async () => {
  const admin = {
    from: () => ({
      insert: async () => ({
        data: null,
        error: { message: "audit table unavailable" },
      }),
    }),
  };
  await assertRejects(
    () =>
      recordAuditRequired(admin as never, null, {
        eventType: "delete.completed",
        targetType: "secure_file",
        targetId: "file-1",
      }),
    Error,
    "Audit insert failed: audit table unavailable",
  );
});
