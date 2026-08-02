# Student-data safety test report

## Release decision

**HOLD - do not enter production student data.**

The Phase 2 focused tests, migration application, and transaction-safe PostgreSQL rehearsal passed locally on August 1, 2026. That result is not a production approval. Pull-request CI and existing-staging acceptance are still pending, and no provider database restore, separate Storage-object restore, real private-object deletion, or Blackboard sandbox round trip has been completed for this candidate.

No blank, inferred, parsed-only, or untested evidence field is treated as a pass.

## Candidate tested

- Branch: `codex/final-phase2-student-data-readiness`
- Base staging commit: `86f1257cddf8a61c0d6a77929405436b87817748`
- Migration: `20260802023831_govern_student_data_intake_readiness.sql`
- Local verification time: August 1, 2026, 10:09 p.m. Central
- Final candidate commit: pending commit and pull-request CI
- Existing staging migration applied: no
- Production database migrations applied: none
- Production student records created for this work: none
- Hosted PostgreSQL version observed read-only: 17.6
- Local/CI database target: PostgreSQL 17

## Gate results

| Gate | Repository evidence | Database/external evidence | Decision |
| --- | --- | --- | --- |
| Restore and reconciliation | PASS - version 2.5 fail-closed snapshot model and rollback-safe SQL cover the current 50-domain linked-record contract; the separate 61-domain lifecycle registry names linked and external system copies, and the local SQL rehearsal reconciled exact JSON, row counts, and SHA-256 digests | NOT RUN - provider database/PITR restore and a separate versioned Storage-object restore and reconciliation are required | HOLD |
| Access control | PASS - local policy tests and executable SQL deny cross-institution and former-institution access; eight unintended anonymous privileged RPC grants are revoked; the one anonymous Morrison catalog exception excludes review rows at runtime while preserving the signed-in safe preview with no checkout or entitlement | NOT RUN - merged-candidate execution against the existing staging project and advisor rerun are required | HOLD |
| Export and reconciliation | PASS - 32 Blackboard tests pass; the real confirmation RPC executed in SQL with wrong-row, wrong-column, stale-source, score, duplicate, scaling, and output-hash negatives | NOT RUN - an institution-controlled Blackboard import, REST, or LTI AGS reconciliation round trip is required | HOLD |
| File deletion, retention, and legal hold | PASS - Node/static checks and executable SQL cover claims, token/worker fencing, retries, normal and partial completion, late holds/retention, quota release, atomic audit records, and a 61-item account-closure plan that remains blocked and executes no production action | NOT RUN - real synthetic Storage-object removal/preservation tests are required; a full account/data-subject lifecycle worker remains intentionally absent | HOLD |

## Commands and observed results

```text
npm.cmd run test:student-data-safety
39 passed, 0 failed

npm.cmd run test:blackboard
32 passed, 0 failed

npm.cmd run test:lti
11 passed, 0 failed

npm.cmd run <all 19 Node contract scripts from deploy.yml>
passed

npm.cmd run build
passed

npm.cmd run audit:bundle
passed

npm.cmd run build:staging && npm.cmd run audit:bundle
passed

npx supabase db reset --local
all migrations, including Phase 2, applied successfully from a clean database

psql --set=ON_ERROR_STOP=1 --file=supabase/tests/institution_student_data_safety.sql
PASS repository rehearsal; operational student-data gates remain HOLD

all remaining PostgreSQL gates from deploy.yml
passed, including 42 Digital Literacy pilot-readiness assertions
```

The local machine did not have the CI Python 3.12/pytest or Deno runtimes. The document-security worker pytest job and Deno type/claim/deletion jobs are therefore **NOT RUN locally** for this candidate and remain mandatory pull-request checks. No local dependency substitution is counted as evidence.

The local database result proves the migration and rollback-safe assertions execute against PostgreSQL; it does not prove provider backup recovery, private object recovery, or existing-staging behavior. Pull-request CI must repeat the exact candidate checks before merge.

## Scope limits that block intake

The 50-domain contract covers EdNotebook-linked records. The new 61-domain registry adds Auth identities/sessions/logs, Storage versions/caches, provider backups, learner-created professor or publisher content, Stripe webhook payloads, Blackboard/LTI provider copies, and unlinked portal-interest forms. The registry is complete as an inventory, but no institution-specific disposition is inferred: every domain remains missing until a human reviewer records an approved delete/anonymize/retain/block policy.

Supabase database backups restore database records and Storage metadata; they do not by themselves prove restoration of the underlying Storage objects. Database/PITR recovery and versioned or off-site object recovery therefore require separate rehearsals.

The pre-migration staging security review found eight privileged LTI/social SECURITY DEFINER RPCs executable by `anon`, one deliberately public catalog SECURITY DEFINER RPC, and leaked-password protection disabled. Phase 2 revokes the eight unintended grants and constrains the public catalog projection, but those corrections are not staging evidence until this pull request is merged, migrated, and the advisors/runtime negatives are rerun. Protected release-branch evidence also remains required.

## Required evidence before the HOLD can be removed

- Commit the exact candidate, run all three pull-request jobs, and preserve the successful database-safety log.
- After merge, apply the migration only to the existing staging project and run the rollback-safe SQL harness with `ON_ERROR_STOP=1`; do not create another staging project.
- Restore a provider database backup or PITR copy; record recovery point/time, exact row counts, SHA-256 manifests, and differences.
- Restore separately backed-up private Storage objects; reconcile bucket/path, object count, byte length, and SHA-256 without exposing student content.
- Delete synthetic private objects through the real worker and prove eligible objects are absent while retained and legally held objects remain present and access-controlled.
- Record a current human-approved disposition for all 61 lifecycle domains, then separately design, review, and test the worker that performs those dispositions. The Phase 2 request planner cannot execute them.
- Reconcile a synthetic Blackboard export through a non-production course using CSV import, REST, or LTI AGS as approved by the institution.
- Run Supabase security/performance advisors and resolve or formally accept every finding.
- Require the release checks on the protected deployment branch.
- Record platform-owner, institution technology, privacy/records, accessibility, and security approvals.

The detailed procedure and evidence fields are in `docs/STUDENT_DATA_SAFETY_GATES.md`.
