# Final Phase 3 — operational recovery evidence

## Current decision

**HOLD.** The repository has deterministic, fail-closed reconciliation tooling. It does not yet contain evidence of an actual provider-managed database recovery or a separate recovery of private Supabase Storage object bytes. Neither `databaseRestore` nor `storageRestore` may be marked passed from local tests alone.

This unit is restricted to the permanent public/synthetic staging environment:

- site: `https://ednotebook.com/staging/`
- source Supabase project: `gfalgonektwdylsxsgzc`
- protected release branch: `staging`

The production project `didwxihufueqbpfnfdmm` is forbidden. Do not run a restore, delete records, upload test objects, change backup settings, or deploy migrations there.

## What the evidence tool proves

`scripts/reconcile-recovery-manifests.mjs` compares two versioned, metadata-only manifests:

1. a source inventory captured at an exact recovery point; and
2. an inventory captured after a real recovery exercise.

Database evidence must include all 50 canonical linked student-data domains exactly once. Each entry contains only a domain key, row count, and SHA-256 digest. Storage evidence contains only the private bucket identifier, SHA-256 of the object key, byte length, object checksum, and optional SHA-256 of a provider version reference. Raw rows, object paths, file bytes, student identifiers, names, grades, messages, credentials, and provider payloads are unsupported fields and are rejected.

The comparison fails closed for:

- a missing, extra, or duplicate item;
- a row-count, byte-length, content-hash, or version-reference mismatch;
- a different recovery point, source commit, or migration version;
- an invalid capture order;
- a non-staging environment, unapproved project, or the production project; and
- a recovery method that does not match the database or Storage exercise.

A perfect comparison returns `eligible_for_human_review`. It always returns `gatePassed: false`, `productionStudentIntakeEnabled: false`, and `productionActionExecuted: false`. A human reviewer must inspect the provider evidence and separately append the existing `databaseRestore` or `storageRestore` gate record.

## Controlled database exercise

Do not improvise an in-place restore. Before execution, the owner must approve the provider recovery method, maintenance window, recovery target, cost, rollback plan, and evidence location. A provider-created recovery target counts as new hosted infrastructure and therefore requires explicit owner authorization.

For an approved exercise:

1. Confirm the source is staging and record its exact source commit, latest applied migration, recovery point, operator reference, and provider job/reference.
2. Use public and synthetic records only.
3. Capture the 50-domain source manifest without exporting raw rows.
4. Perform the approved Supabase database backup/PITR recovery procedure.
5. Capture the restored 50-domain manifest.
6. Reconcile the two manifests with the CLI below.
7. Retain the manifests and provider job evidence in the restricted evidence store, not GitHub, chat, CI artifacts, browser storage, or a public bucket.
8. A human reviewer records the result against the existing `databaseRestore` gate. Technical equality alone is insufficient.

Supabase database backups cover database records and Storage metadata; they do not restore deleted Storage object bytes. Storage therefore remains a separate exercise and gate.

## Controlled private Storage exercise

Before execution, approve an independent object-byte backup/versioning source and restoration destination. Then:

1. Upload uniquely named synthetic objects through the real staging secure-upload path.
2. Record byte lengths and SHA-256 checksums before the recovery point. Hash object keys; do not place raw paths in the manifest.
3. Capture the provider/offsite version reference as a SHA-256 digest when available.
4. Remove or isolate only the approved synthetic exercise objects through the governed deletion process.
5. Restore the bytes through the approved private Storage recovery procedure.
6. Download through the authenticated secure-delivery path and independently recompute bytes and checksums.
7. Reconcile source and restored manifests.
8. Verify anonymous/public reads remain denied and retained/legal-hold objects were not removed.
9. A human reviewer records the result against the existing `storageRestore` gate.

## Reconciliation command

Keep both input files outside the repository and run:

```powershell
node scripts/reconcile-recovery-manifests.mjs C:\restricted-evidence\source.json C:\restricted-evidence\restored.json
```

Exit code `0` means the safe metadata reconciled and is eligible for human review. Exit code `2` means a discrepancy produced a HOLD. Exit code `1` means a manifest or invocation was invalid. No exit code passes a governance gate.

## Remaining Phase 3 gates after this unit merges

1. Owner-approved real hosted staging database recovery evidence.
2. Owner-approved private Storage byte recovery evidence.
3. Real synthetic staging deletion/retention/legal-hold worker evidence, including partial-failure reconciliation.
4. Institution-controlled non-production Blackboard round-trip evidence.
5. Human review and append-only evidence decisions in the existing Control Center governance model.

Production intake and production promotion remain separate, later decisions.
