import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

import {
  adminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  parseJson,
  preflight,
  projectUrl,
  publishableKey,
  requirePost,
} from "../_shared/runtime.ts";
import { constantTimeEqual, randomToken, sha256 } from "../_shared/security.ts";
import {
  assertStagingEvidenceRequest,
  evaluateStagingLifecycleEvidence,
  STAGING_EVIDENCE_CONFIRMATION,
  STAGING_PROJECT_REF,
} from "../_shared/staging-lifecycle-evidence.ts";

interface EvidenceRequest {
  confirmation?: string;
}

interface FixtureFile {
  id: string;
  bucket: string;
  path: string;
  destinationBucket: string;
  destinationPath: string;
  checksumSha256: string;
  byteLength: number;
  bytesVerified: boolean;
  anonymousReadDenied: boolean;
}

interface FixtureState {
  userId: string | null;
  institutionId: string | null;
  holdId: string | null;
  files: FixtureFile[];
}

const encoder = new TextEncoder();
const REQUIRED_AUDITS = [
  "upload.reserved",
  "upload.completed",
  "delete.requested",
  "retention.delete_completed",
];

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} did not return an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

async function invokeFunction(
  client: SupabaseClient,
  name: string,
  body: Record<string, unknown>,
) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) throw new Error(`${name} invocation failed.`);
  return objectValue(data, name);
}

async function createSyntheticUser(
  admin: SupabaseClient,
  runTag: string,
) {
  const password = `Aa1!${randomToken(36)}`;
  const email = `phase3-${runTag}@synthetic.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Phase 3 Synthetic Evidence",
      requested_role: "learner",
      affiliation_choice: "independent",
    },
    app_metadata: { synthetic_evidence: true },
  });
  if (error || !data.user) {
    throw new Error("The temporary synthetic account could not be created.");
  }

  const client = createClient(projectUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error("The temporary synthetic account could not sign in.");
  }
  return { userId: data.user.id, client };
}

async function createSyntheticInstitution(
  admin: SupabaseClient,
  userId: string,
  runTag: string,
) {
  const { data, error } = await admin.from("institutions").insert({
    owner_id: userId,
    name: `Phase 3 Synthetic Evidence ${runTag}`,
    slug: `phase3-evidence-${runTag}`,
    default_retention_days: 30,
    settings: { synthetic_evidence: true },
  }).select("id").single();
  if (error || !data?.id) {
    throw new Error("The temporary evidence institution could not be created.");
  }
  return String(data.id);
}

function encodedObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function anonymousReadDenied(bucket: string, path: string) {
  const response = await fetch(
    `${projectUrl()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${
      encodedObjectPath(path)
    }`,
    { method: "GET", redirect: "manual" },
  );
  return !response.ok;
}

async function objectExists(
  admin: SupabaseClient,
  bucket: string,
  path: string,
) {
  const result = await admin.storage.from(bucket).exists(path);
  if (result.data === true && !result.error) return true;
  if (result.data === false) return false;
  throw new Error("Storage existence verification failed.");
}

async function uploadFixture(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  runTag: string,
  label: "eligible" | "retained" | "held",
): Promise<FixtureFile> {
  const bytes = encoder.encode(
    `EdNotebook Phase 3 public synthetic lifecycle evidence. ${runTag}. ${label}.`,
  );
  const checksumSha256 = await sha256(bytes);
  const safeName = `phase3-${label}-${runTag}.txt`;
  const session = await invokeFunction(userClient, "secure-upload-session", {
    purpose: "private",
    originalName: safeName,
    safeName,
    mimeType: "text/plain",
    sizeBytes: bytes.byteLength,
    metadata: { syntheticEvidence: true, evidenceKind: label },
  });
  const upload = objectValue(session.upload, "secure-upload-session.upload");
  const destination = objectValue(
    session.destination,
    "secure-upload-session.destination",
  );
  const id = stringValue(upload.id, "secure file ID");
  const bucket = stringValue(upload.bucket, "quarantine bucket");
  const path = stringValue(upload.path, "quarantine path");
  const signature = stringValue(upload.signature, "signed upload token");

  const uploadResult = await userClient.storage.from(bucket).uploadToSignedUrl(
    path,
    signature,
    bytes,
    { contentType: "text/plain", upsert: false },
  );
  if (uploadResult.error) {
    throw new Error("The signed synthetic upload failed.");
  }
  await invokeFunction(userClient, "secure-upload-complete", {
    secureFileId: id,
    checksumSha256,
  });

  const retentionUntil = label === "retained"
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: updated, error: updateError } = await admin
    .from("secure_file_objects")
    .update({ retention_until: retentionUntil })
    .eq("id", id)
    .select("id")
    .single();
  if (updateError || !updated) {
    throw new Error("The synthetic retention fixture could not be configured.");
  }

  const downloaded = await admin.storage.from(bucket).download(path);
  if (downloaded.error || !downloaded.data) {
    throw new Error("The uploaded synthetic bytes could not be read back.");
  }
  const downloadedBytes = new Uint8Array(await downloaded.data.arrayBuffer());

  return {
    id,
    bucket,
    path,
    destinationBucket: stringValue(destination.bucket, "destination bucket"),
    destinationPath: stringValue(destination.path, "destination path"),
    checksumSha256,
    byteLength: bytes.byteLength,
    bytesVerified: downloadedBytes.byteLength === bytes.byteLength &&
      await sha256(downloadedBytes) === checksumSha256,
    anonymousReadDenied: await anonymousReadDenied(bucket, path),
  };
}

async function attachLegalHold(
  admin: SupabaseClient,
  state: FixtureState,
  userId: string,
  institutionId: string,
  fileId: string,
) {
  const { data: hold, error: holdError } = await admin.from("legal_holds")
    .insert({
      institution_id: institutionId,
      name: "Phase 3 synthetic file hold",
      reason: "Temporary public synthetic lifecycle evidence",
      scope: { syntheticEvidence: true },
      active: true,
      created_by: userId,
    }).select("id").single();
  if (holdError || !hold?.id) {
    throw new Error("The temporary legal hold could not be created.");
  }
  state.holdId = String(hold.id);
  const { error: linkError } = await admin.from("legal_hold_files").insert({
    legal_hold_id: state.holdId,
    secure_file_id: fileId,
    added_by: userId,
  });
  if (linkError) {
    throw new Error("The temporary legal hold could not be attached.");
  }
}

async function deletionResult(
  userClient: SupabaseClient,
  fileId: string,
) {
  return invokeFunction(userClient, "secure-file-delete", {
    secureFileId: fileId,
    reason: "Phase 3 public synthetic lifecycle evidence",
  });
}

async function requiredAuditsPresent(admin: SupabaseClient, fileId: string) {
  const { data, error } = await admin.from("audit_events")
    .select("event_type")
    .eq("secure_file_id", fileId)
    .in("event_type", REQUIRED_AUDITS);
  if (error) throw new Error("Synthetic lifecycle audit verification failed.");
  const actual = new Set((data || []).map((row) => row.event_type));
  return REQUIRED_AUDITS.every((eventType) => actual.has(eventType));
}

async function cleanupFixtures(admin: SupabaseClient, state: FixtureState) {
  const failures: string[] = [];
  for (const file of state.files) {
    for (
      const target of [
        { bucket: file.bucket, path: file.path },
        { bucket: file.destinationBucket, path: file.destinationPath },
      ]
    ) {
      const removal = await admin.storage.from(target.bucket).remove([
        target.path,
      ]);
      if (removal.error) failures.push("storage_cleanup");
    }
  }
  if (state.holdId) {
    const linkDelete = await admin.from("legal_hold_files").delete().eq(
      "legal_hold_id",
      state.holdId,
    );
    if (linkDelete.error) failures.push("hold_link_cleanup");
    const holdDelete = await admin.from("legal_holds").delete().eq(
      "id",
      state.holdId,
    );
    if (holdDelete.error) failures.push("hold_cleanup");
  }
  if (state.files.length) {
    const fileDelete = await admin.from("secure_file_objects").delete()
      .in("id", state.files.map((file) => file.id));
    if (fileDelete.error) failures.push("file_metadata_cleanup");
  }
  if (state.institutionId) {
    const institutionDelete = await admin.from("institutions").delete().eq(
      "id",
      state.institutionId,
    );
    if (institutionDelete.error) failures.push("institution_cleanup");
  }
  if (state.userId) {
    const userDelete = await admin.auth.admin.deleteUser(state.userId);
    if (userDelete.error) failures.push("auth_cleanup");
  }

  const storageAbsent = (await Promise.all(state.files.flatMap((file) => [
    objectExists(admin, file.bucket, file.path),
    objectExists(admin, file.destinationBucket, file.destinationPath),
  ]))).every((present) => !present);
  const fileRows = state.files.length
    ? await admin.from("secure_file_objects").select("id").in(
      "id",
      state.files.map((file) => file.id),
    )
    : { data: [], error: null };
  const profileRows = state.userId
    ? await admin.from("profiles").select("id").eq("id", state.userId)
    : { data: [], error: null };
  const databaseAbsent = !fileRows.error && !profileRows.error &&
    (fileRows.data || []).length === 0 && (profileRows.data || []).length === 0;
  return failures.length === 0 && storageAbsent && databaseAbsent;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;

  const state: FixtureState = {
    userId: null,
    institutionId: null,
    holdId: null,
    files: [],
  };
  let primaryError: unknown = null;
  let operationalChecks:
    | Omit<
      Parameters<typeof evaluateStagingLifecycleEvidence>[0],
      "fixtureCleanupCompleted"
    >
    | null = null;
  let runReferenceSha256 = "";

  try {
    requirePost(req);
    const expectedSecret = Deno.env.get("STAGING_LIFECYCLE_EVIDENCE_SECRET") ||
      "";
    const suppliedSecret = req.headers.get("x-staging-evidence-secret") || "";
    if (
      expectedSecret.length < 32 ||
      !constantTimeEqual(expectedSecret, suppliedSecret)
    ) {
      throw new HttpError(
        401,
        "The staging lifecycle evidence secret is invalid.",
      );
    }
    const input = await parseJson<EvidenceRequest>(req, 2048);
    assertStagingEvidenceRequest(projectUrl(), input.confirmation || "");

    const runId = crypto.randomUUID();
    const runTag = runId.replaceAll("-", "").slice(0, 12);
    runReferenceSha256 = await sha256(runId);
    const admin = adminClient();

    try {
      const synthetic = await createSyntheticUser(admin, runTag);
      state.userId = synthetic.userId;
      state.institutionId = await createSyntheticInstitution(
        admin,
        synthetic.userId,
        runTag,
      );

      const eligible = await uploadFixture(
        admin,
        synthetic.client,
        runTag,
        "eligible",
      );
      const retained = await uploadFixture(
        admin,
        synthetic.client,
        runTag,
        "retained",
      );
      const held = await uploadFixture(admin, synthetic.client, runTag, "held");
      state.files.push(eligible, retained, held);
      await attachLegalHold(
        admin,
        state,
        synthetic.userId,
        state.institutionId,
        held.id,
      );

      const eligibleDeletion = await deletionResult(
        synthetic.client,
        eligible.id,
      );
      const retainedDeletion = await deletionResult(
        synthetic.client,
        retained.id,
      );
      const heldDeletion = await deletionResult(synthetic.client, held.id);

      operationalChecks = {
        uploadChecksumsMatch: state.files.every((file) =>
          file.bytesVerified && file.byteLength > 0
        ),
        anonymousReadsDenied: state.files.every((file) =>
          file.anonymousReadDenied
        ),
        eligibleDeletionCompleted: eligibleDeletion.status === "completed" &&
          eligibleDeletion.deleted === true,
        eligibleObjectAbsent:
          !(await objectExists(admin, eligible.bucket, eligible.path)),
        retainedRequestDeferred:
          retainedDeletion.status === "deferred_retention" &&
          retainedDeletion.deleted === false,
        retainedObjectPresent: await objectExists(
          admin,
          retained.bucket,
          retained.path,
        ),
        heldRequestBlocked: heldDeletion.status === "blocked_legal_hold" &&
          heldDeletion.deleted === false,
        heldObjectPresent: await objectExists(admin, held.bucket, held.path),
        requiredAuditsPresent: await requiredAuditsPresent(admin, eligible.id),
      };
    } catch (error) {
      primaryError = error;
    }

    const cleanupCompleted = await cleanupFixtures(admin, state).catch(() =>
      false
    );
    if (primaryError) {
      throw new Error(
        "The synthetic staging lifecycle exercise failed before reconciliation.",
      );
    }
    if (!operationalChecks) {
      throw new Error(
        "The synthetic staging lifecycle exercise produced no checks.",
      );
    }

    const evaluation = evaluateStagingLifecycleEvidence({
      ...operationalChecks,
      fixtureCleanupCompleted: cleanupCompleted,
    });
    return jsonResponse(req, {
      version: "1.0",
      environment: "staging",
      projectRef: STAGING_PROJECT_REF,
      runReferenceSha256,
      syntheticObjectCount: state.files.length,
      checks: {
        ...operationalChecks,
        fixtureCleanupCompleted: cleanupCompleted,
      },
      ...evaluation,
    }, evaluation.technicallyReconciled ? 200 : 409);
  } catch (error) {
    if (state.userId || state.files.length) {
      try {
        await cleanupFixtures(adminClient(), state);
      } catch {
        // The response remains failed; cleanup errors stay in protected logs.
      }
    }
    return errorResponse(req, error);
  }
});
