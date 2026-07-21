import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  helper: new URL("./_shared/deletion.ts", import.meta.url),
  direct: new URL("./secure-file-delete/index.ts", import.meta.url),
  retention: new URL("./retention-worker/index.ts", import.meta.url),
  audit: new URL("./_shared/security.ts", import.meta.url),
  migration: new URL(
    "../migrations/20260721220000_student_data_safety_hardening.sql",
    import.meta.url,
  ),
};

const load = (name) => readFile(files[name], "utf8");

test("shared deletion helper rejects errors and verifies post-remove absence", async () => {
  const source = await load("helper");
  assert.match(source, /if \(result\.error\)/u);
  assert.match(source, /Promise\.allSettled/u);
  assert.match(source, /outcome\.status === "rejected"/u);
  assert.match(source, /throw new AggregateError/u);
  assert.match(source, /const verification = await exists/u);
  assert.match(source, /verification\.data !== false/u);
});

test("direct deletion uses a unique worker and token-fenced claim lifecycle", async () => {
  const source = await load("direct");
  assert.match(source, /secure-file-delete:\$\{crypto\.randomUUID\(\)\}/u);
  assert.match(source, /"claim_file_deletion_request"/u);
  assert.match(source, /"renew_file_deletion_claim"/u);
  assert.match(source, /"finish_file_deletion_claim"/u);
  assert.match(source, /p_claim_token: claim\.claim_token/u);
  assert.match(source, /p_worker_id: workerId/u);
  assert.match(
    source,
    /p_storage_removal_started: storageRemovalStarted/u,
  );
  assert.match(
    source,
    /for \(const target of storageTargetsForFile[\s\S]*await beforeEachRemoval\(\);[\s\S]*await removeStorageTargets/u,
  );
  assert.match(source, /\.exists\(path\)/u);
  assert.match(source, /file\.availability_status === "deleted"/u);
  assert.match(source, /reconciled: true/u);
  assert.match(source, /finished\.completion_outcome/u);
  assert.match(source, /completed_with_late_governance_conflict/u);
  assert.match(source, /status: "partial_deletion"/u);
  assert.match(source, /fileIntegrity: "damaged"/u);
  assert.match(source, /governanceGate:/u);
});

test("retention uses atomic batch claims and fences deletion before every Storage call", async () => {
  const source = await load("retention");
  assert.match(source, /retention-worker:\$\{crypto\.randomUUID\(\)\}/u);
  assert.match(source, /"claim_file_deletion_requests"/u);
  assert.match(source, /"renew_file_deletion_claim"/u);
  assert.match(source, /"finish_file_deletion_claim"/u);
  assert.match(source, /p_claim_token: claim\.claim_token/u);
  assert.match(
    source,
    /p_storage_removal_started: storageRemovalStarted/u,
  );
  assert.match(
    source,
    /for \(const target of storageTargetsForFile[\s\S]*await beforeEachRemoval\(\);[\s\S]*await removeStorageTargets/u,
  );
  assert.match(
    source,
    /await renewDeletionClaim\(admin, claim, workerId\);\s*storageRemovalStarted = true/u,
  );
  assert.match(source, /\.exists\(path\)/u);
});

test("expired-upload cleanup is claimed, renewed, finished, and retried with an error", async () => {
  const source = await load("retention");
  assert.match(source, /"claim_expired_uploads"/u);
  assert.match(source, /"renew_expired_upload_claim"/u);
  assert.match(source, /"finish_expired_upload_claim"/u);
  assert.match(source, /p_claim_token: claim\.claim_token/u);
  assert.match(source, /p_succeeded: succeeded/u);
  assert.match(source, /p_last_error: lastError/u);
  assert.match(source, /row\.upload_status !== "expired"/u);
  assert.match(source, /row\.availability_status !== "deleted"/u);
  assert.match(source, /finished\.expiration_completion_outcome/u);
  assert.match(source, /summary\.governanceConflicts \+= 1/u);
  assert.match(source, /summary\.partialDeletions \+= 1/u);
  assert.match(
    source,
    /finished\.completion_outcome === "partial_deletion"/u,
  );
  assert.match(
    source,
    /await renewExpiredUploadClaim\(admin, claim, workerId\);\s*storageRemovalStarted = true;\s*await removeStorageTargets/u,
  );
  assert.match(source, /if \(await onLegalHold/u);
});

test("workers never directly rewrite deletion-request statuses or downgrade completed work", async () => {
  for (const name of ["direct", "retention"]) {
    const source = await load(name);
    assert.doesNotMatch(source, /\.from\("file_deletion_requests"\)/u);
    assert.doesNotMatch(
      source,
      /file_deletion_requests[\s\S]{0,300}\.update\(/u,
    );
    assert.match(source, /finish_file_deletion_claim/u);
    assert.match(source, /p_claim_token: claim\.claim_token/u);
    assert.doesNotMatch(source, /\.from\("upload_quota_reservations"\)/u);
    assert.doesNotMatch(
      source,
      /\.update\(\{ availability_status: "deleted"/u,
    );
  }
});

test("finish RPCs enforce token ownership, preserve holds, and audit atomically", async () => {
  const source = await load("migration");
  assert.match(
    source,
    /create or replace function public\.finish_file_deletion_claim/u,
  );
  assert.match(
    source,
    /status='processing' and claim_token=p_claim_token and claimed_by=left\(trim\(p_worker_id\),200\)/u,
  );
  assert.match(source, /claim_expires_at>now\(\)/u);
  assert.match(
    source,
    /r\.status='failed' and \(r\.next_attempt_at is null or r\.next_attempt_at<=now\(\)\)/u,
  );
  assert.match(source, /failure_count=case when p_status='failed'/u);
  assert.match(source, /next_attempt_at=case when p_status='failed'/u);
  assert.match(
    source,
    /completion_outcome=case[\s\S]{0,350}when p_status='completed'/u,
  );
  assert.match(source, /p_storage_removal_started boolean default false/u);
  assert.match(source, /'delete\.partial_failure'/u);
  assert.match(source, /prepared_partial_files as/u);
  assert.match(
    source,
    /c\.completion_outcome='partial_deletion'[\s\S]{0,180}f\.availability_status='blocked'/u,
  );
  assert.match(source, /'deletion_completion_outcome',c\.completion_outcome/u);
  assert.match(
    source,
    /v_request\.completion_outcome='partial_deletion' and p_status in \('blocked_legal_hold','deferred_retention','failed'\)/u,
  );
  assert.match(
    source,
    /p_status not in \('blocked_legal_hold','deferred_retention','completed','failed'\)/u,
  );
  assert.match(source, /'retention\.delete_completed'/u);
  assert.match(source, /'retention\.delete_failed'/u);
  assert.match(source, /'delete\.completed_with_late_governance_conflict'/u);
  assert.match(
    source,
    /create or replace function public\.finish_expired_upload_claim/u,
  );
  assert.match(source, /'upload\.expiration_blocked_hold'/u);
  assert.match(
    source,
    /'upload\.expiration_completed_with_late_governance_conflict'/u,
  );
  assert.match(source, /expiration_claim_expires_at>now\(\)/u);
  assert.match(
    source,
    /expiration_completion_outcome=case when v_active_hold/u,
  );
  assert.match(source, /expiration_next_attempt_at=now\(\)\+/u);
  assert.match(source, /'upload\.expiration_failed'/u);
});

test("required standalone audits still reject resolved database errors", async () => {
  const source = await load("audit");
  assert.match(source, /export async function recordAuditRequired/u);
  assert.match(source, /throw new Error\(`Audit insert failed:/u);
});
