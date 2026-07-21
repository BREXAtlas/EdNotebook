# Student-data safety test report

## Release decision

**HOLD - do not enter production student data.**

Repository-level unit, static, type, parse, build, and bundle checks passed on July 21, 2026. That result is not a production approval. The transaction-safe database harness has not yet executed in a fresh Supabase database, and no provider database restore, separate Storage-object restore, real private-object deletion, or Blackboard sandbox round trip has been completed for this candidate.

No blank, inferred, parsed-only, or untested evidence field is treated as a pass.

## Candidate tested

- Branch: `agent/institution-admin-control-center`
- Base commit: `cbaea6c2df0502cf440a512618d686e1c7d8afdf`
- Local verification time: July 21, 2026, 4:40 p.m. Central
- Final candidate commit: pending commit and pull-request CI
- Production database migrations applied: none
- Production student records created for this work: none
- Hosted PostgreSQL version observed read-only: 17.6
- Local/CI database target: PostgreSQL 17

## Gate results

| Gate | Repository evidence | Database/external evidence | Decision |
| --- | --- | --- | --- |
| Restore and reconciliation | PASS - version 2.1 fail-closed snapshot model covers the current 44-domain linked-record contract; SQL retains exact canonical JSON, row counts, and SHA-256 digests and rehearses a non-cascading representative row restore | NOT RUN - fresh-database SQL execution, provider database/PITR restore, and a separate versioned Storage-object restore and reconciliation are required | HOLD |
| Access control | PASS - local policy tests deny cross-institution and former-institution access; browser grade writes are revoked; messages, files, profiles, groups, grades, and admin capabilities are resource- and tenant-bound in the candidate migration | NOT RUN - authenticated SQL harness execution and hosted disposable-environment RLS rehearsal are required | HOLD |
| Export and reconciliation | PASS - 32 Blackboard tests pass; the real confirmation RPC is exercised in SQL with wrong-row, wrong-column, stale-source, score, duplicate, scaling, and output-hash negatives | NOT RUN - the SQL harness and an institution-controlled Blackboard import, REST, or LTI AGS reconciliation round trip are required | HOLD |
| File deletion, retention, and legal hold | PASS - Node/static checks, seven Deno tests, Edge Function type checks, and SQL worker lifecycle assertions cover claims, token/worker fencing, retries, normal and partial completion, late holds/retention, quota release, and atomic audit records | NOT RUN - the SQL harness and real disposable Storage-object removal/preservation tests are required; full account/data-subject deletion and retention is not implemented | HOLD |

## Commands and observed results

```text
npm.cmd run test:student-data-safety
32 passed, 0 failed

npm.cmd run test:blackboard
32 passed, 0 failed

npm.cmd run test:lti
11 passed, 0 failed

deno test --node-modules-dir=none --no-lock --cached-only \
  supabase/functions/_shared/deletion.test.ts
7 passed, 0 failed

deno check --node-modules-dir=none --no-lock \
  supabase/functions/secure-file-delete/index.ts \
  supabase/functions/retention-worker/index.ts \
  supabase/functions/secure-file-download/index.ts
passed

deno fmt --no-config --check <five changed deletion/download files>
passed

npm.cmd run build
passed

npm.cmd run audit:bundle
passed

pglast parse: every migration plus the SQL safety harness
passed
```

The focused Deno checks used cached Deno 2.2.7 with `--no-lock` because that runtime cannot read the repository's newer lockfile format. Pull-request CI must repeat these checks with its configured current Deno release.

SQL parsing proves syntax only. It does not prove migrations apply cleanly, policies behave correctly, or the assertions pass against PostgreSQL. The workflow now creates a PostgreSQL 17 local Supabase database and runs `supabase/tests/institution_student_data_safety.sql` with `ON_ERROR_STOP=1`; its first successful pull-request run remains required evidence.

## Scope limits that block intake

The 44-domain contract is the current student/learner linked-record contract, not a complete account or data-subject inventory. It does not yet classify every person-associated record, including Auth identities/sessions/logs, learner-created professor or publisher content, Stripe webhook payloads, and unlinked portal-interest forms. Those records must be excluded from student intake or added to an institution-approved delete/anonymize/retain/block matrix.

Supabase database backups restore database records and Storage metadata; they do not by themselves prove restoration of the underlying Storage objects. Database/PITR recovery and versioned or off-site object recovery therefore require separate rehearsals.

The hosted security review also found outstanding deployment controls: direct execution privileges on several security-definer course functions require review, leaked-password protection is disabled, and the GitHub `main` branch currently has no required-check protection. These findings must be resolved or formally accepted before intake.

## Required evidence before the HOLD can be removed

- Commit the exact candidate, run all three pull-request jobs, and preserve the successful database-safety log.
- Apply all migrations to an approved disposable Supabase environment and run the rollback-safe SQL harness with `ON_ERROR_STOP=1`.
- Restore a provider database backup or PITR copy; record recovery point/time, exact row counts, SHA-256 manifests, and differences.
- Restore separately backed-up private Storage objects; reconcile bucket/path, object count, byte length, and SHA-256 without exposing student content.
- Delete synthetic private objects through the real worker and prove eligible objects are absent while retained and legally held objects remain present and access-controlled.
- Complete the institution-approved full account/data-subject lifecycle for Auth, records, LMS identifiers, billing/webhooks, audits, unlinked forms, and user-authored content.
- Reconcile a synthetic Blackboard export through a non-production course using CSV import, REST, or LTI AGS as approved by the institution.
- Run Supabase security/performance advisors and resolve or formally accept every finding.
- Require the release checks on the protected deployment branch.
- Record platform-owner, institution technology, privacy/records, accessibility, and security approvals.

The detailed procedure and evidence fields are in `docs/STUDENT_DATA_SAFETY_GATES.md`.
