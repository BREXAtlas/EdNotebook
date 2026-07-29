# Student-data safety gates

## Purpose and release rule

EdNotebook must not receive production student data until all four gates below pass in a disposable environment built from the same migrations and application commit intended for the pilot:

1. student-record restore and reconciliation;
2. cross-institution access control;
3. Blackboard export and reconciliation; and
4. deletion, retention, and legal hold.

The automated application tests and the transaction-safe PostgreSQL rehearsal are in the repository. A code-only pass is not a production approval. The database rehearsal must also pass on a non-production Supabase branch, and the institution must review the resulting evidence and its own retention requirements.

## Automated files

- `src/admin-control/studentDataSafetyModel.js` defines the version 2.3, 47-domain linked-record snapshot contract, including append-only student learning records, student-owned course-communication read/preference state, deterministic reconciliation, tenant-aware access decisions, Blackboard grade reconciliation, and deletion-state evaluation.
- `src/admin-control/studentDataSafety.test.js` exercises each model, checks that damaged restores and mismatched Blackboard records fail, and verifies that the required database policies and SQL gates remain present.
- `supabase/functions/_shared/deletion.test.ts` proves that a thrown removal or a resolved Supabase Storage error fails the deletion operation, every stored target is attempted, missing database state changes fail, and required audit errors are not ignored.
- `supabase/functions/deletion-workers.static.test.js` keeps both deletion workers on the checked removal, legal-hold recheck, state-change, and required-audit path.
- `supabase/tests/institution_student_data_safety.sql` creates two institutions and isolated test users, rehearses the four database contracts, and ends with `rollback`. The test addresses use the reserved `.invalid` domain and cannot be used to sign in.
- `.github/workflows/deploy.yml` starts a fresh PostgreSQL 17 local Supabase database, applies every migration, runs the rollback-safe SQL harness with `ON_ERROR_STOP=1`, and blocks deployment if that rehearsal fails.

Run the application layer:

```sh
npm run test:student-data-safety
```

The same application and deletion-worker safety checks run in GitHub Actions for every pull request. Edge Function type checks and the focused Deno deletion tests also run in the security job. A separate database job uses a disposable Docker-backed local Supabase instance so the migration and RLS assertions are executed, not merely inspected as text.

Run the PostgreSQL file only after all repository migrations have been applied to a disposable Supabase branch. Use a protected connection method approved by the technology team; do not paste a database password into source code, documentation, issue comments, or shell history.

```sh
psql --set=ON_ERROR_STOP=1 --file=supabase/tests/institution_student_data_safety.sql
```

The expected final notice is `PASS repository rehearsal; operational student-data gates remain HOLD`. Any exception is a failed repository rehearsal. The notice is intentionally not a production approval. Because the file starts a transaction and ends with `rollback`, its fixture rows are not retained. The disposable environment should still be removed after evidence is recorded.

## Gate 1: restore and reconciliation

The application and SQL contracts use the same version 2.3 list of 47 student/learner linked-record domains. Capture fails closed if any named domain is omitted. The SQL harness retains each canonical JSON payload, row count, and SHA-256 digest, deliberately damages a non-cascading representative subset, restores those rows in dependency order, and requires exact JSON and digest equality. Learner-created groups are captured separately from the learner's memberships and authored posts so another student's group data is not treated as the subject's row. Course-communication reads and notification preferences are captured by their server-derived `user_id`; shared message and announcement content remains governed by its own participant and course scope.

This is a representative logical row-restore rehearsal within the current linked-record contract. It does not delete and reconstruct all 47 domains. Grades with LTI history, affiliations with transfer history, shared messages/grade links, secure-file parents and objects, audits, billing, Blackboard/LTI history, and other retained/shared records require purpose-specific restore or lifecycle treatment. Empty-domain capture proves fail-closed inventory shape, not recovery of a populated production table.

The 47-domain list is not a complete account/data-subject inventory. Auth identities, sessions and provider logs; learner-created professor/publisher records; Stripe webhook payloads; and unlinked portal-interest submissions still require classification, linkage, exclusion from student intake, or a separately approved recovery/lifecycle procedure.

Before a live pilot, the Supabase project owner must demonstrate the contracted database backup or point-in-time recovery procedure and separately restore the underlying private Storage objects from a versioned/off-site source. Record recovery point/time, exact canonical row/object counts, byte lengths, SHA-256 manifests, and all differences. A database restore can recover Storage metadata without proving that deleted object bytes are recoverable.

## Gate 2: access control

The database rehearsal uses the authenticated database role and four distinct user identities across two institutions. It asserts that:

- a student cannot read another institution's course, grade, profile, or affiliation;
- a student cannot add themself to another institution's course;
- an institution professor/administrator cannot read another institution's membership or grade;
- an institution professor cannot change another institution's grade; and
- an institution administrator cannot use the control-center search against another institution.

The application model also requires a record-specific capability or course-management authority. Merely belonging to the same institution does not grant access to another student's record.

## Gate 3: Blackboard export and reconciliation

The database rehearsal joins the protected Blackboard identity mapping, grade-column mapping, EdNotebook grade item, and finalized student grade. It requires one—and only one—export row with the expected:

- EdNotebook student and course relationship;
- Blackboard username, student ID, and SIS ID;
- Blackboard column key and external line-item ID;
- score, maximum points, and finalized status.

The application model rejects tenant, course, student, grade-item, maximum-point, score-range, identifier, or finalization mismatches before an export record can be produced. This does not replace a re-import test in an institution-controlled non-production Blackboard course.

## Gate 4: file deletion, retention, and legal hold

The database rehearsal creates synthetic eligible, retained, held, normal-completion, partial-failure, late-retention, and expired-upload metadata. It calls the same request, claim, renew, and finish RPCs as the application and workers. The harness verifies:

- browser roles cannot execute worker RPCs and `service_role` can;
- repeated requests reuse one active request;
- legal hold takes priority over retention and eligibility;
- claim overlap, wrong-token, wrong-worker, expired-lease, and stale-worker fencing;
- retry counters and bounded backoff;
- normal completion atomically updates request/file metadata, releases quota, and writes the required audit;
- partial deletion remains visibly blocked and carries a recovery marker;
- legal hold or retention added after removal starts is recorded as a high-severity governance conflict;
- held expired uploads are excluded, retry safely, release quota only on completion, and are re-evaluated after hold release.

The direct-delete and retention workers treat Supabase Storage response errors, thrown removals, post-removal existence checks that still find an object, database update errors, missing changed rows, and audit insert errors as failures. Both recheck active file, course, and institution legal holds immediately before object removal. A deletion request is not marked completed until every object is confirmed absent and the required metadata, quota, audit, and request updates have succeeded.

The SQL harness models the database side of verified removal; it does not delete a real Storage object. A pre-pilot operational test must upload synthetic private objects, prove the eligible objects are absent after the real worker runs, and prove retained and legally held objects remain present and access-controlled.

Database rows and object storage cannot be committed in one PostgreSQL transaction. If object removal succeeds and a later database write fails, the request remains failed for reconciliation rather than being reported as a successful deletion. The operational test and monitoring procedure must exercise this condition and verify the reconciliation response.

### Account closure and database-record retention are a separate release blocker

Deleting a stored file is not the same as completing a student data-subject request. The current schema contains several profile foreign keys that cascade, restrict, or set identifiers to null in different ways. Directly deleting a profile could erase grades, progress, submissions, or shared communications, while file, legal-hold, publication, ownership, and audit references can prevent the deletion partway through. EdNotebook must not use profile deletion as its data-lifecycle workflow.

Before production student intake, an institution-approved lifecycle design must classify every student-linked domain as one of the following:

- **Delete:** transient or student-controlled data that may be removed after applicable holds and retention rules are resolved.
- **Anonymize:** shared or institutional records that remain useful but no longer need the student's live account, name, email, SIS ID, Blackboard ID, or LTI subject identifier.
- **Retain:** records that the institution has explicitly approved for a defined purpose and period, attached to a tenant-scoped surrogate rather than an active login.
- **Block:** data subject to a legal hold, unresolved ownership transfer, active dispute, or another documented reason that prevents the requested operation.

The database rehearsal may verify mechanics such as complete inventory, immediate access termination, hold priority, tenant boundaries, idempotency, counts, hashes, anonymization, and audit survival. It cannot decide the legally correct retention period for a school. Supabase Auth records and logs, Storage versions and delivery caches, provider backups, Stripe, Blackboard, and LTI provider copies require separate operational evidence from the responsible system owner.

The lifecycle matrix must also classify webhook payloads, unlinked forms, user-authored professor/publisher content, Auth identities/sessions/logs, Storage versions/caches, provider backups, Stripe, Blackboard, and LTI provider copies. Until that complete account-closure workflow and retention matrix exist and pass, the student-data deletion/retention gate remains **HOLD** even when the file-deletion worker tests pass.

## Evidence record

For each release candidate, record:

- application commit and migration version;
- disposable Supabase branch identifier and region;
- test start/end time and operator;
- pass/fail output for all four gates;
- restored row/object counts, byte lengths, SHA-256 manifests, and any difference report;
- Blackboard test course, template version, export checksum, re-import result, and reviewer;
- retention dates, legal-hold evidence, eligible-object deletion result, and audit event;
- security/performance advisor output and unresolved findings;
- approving platform owner, institution technology reviewer, privacy/records reviewer, and approval date.

Never include student content, full institutional identifiers, access tokens, passwords, service-role keys, or database credentials in the evidence package.
