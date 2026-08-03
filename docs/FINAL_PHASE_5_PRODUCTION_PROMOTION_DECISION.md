# Final Phase 5 of 5 — production-promotion owner decision

## Current decision

**HOLD. Production is not activated.**

The fifth unit closes the consolidated review workflow with an immutable,
human-owned decision over the exact Phase 4 promotion preflight. It does not
deploy an application, link or migrate a Supabase project, enable production
student-data intake, execute retention/deletion, or change a Beta/Pilot lane.

The existing staging environment remains usable for:

- Beta demonstrations with authorized administrative staff, librarians,
  investors, and other approved walkthrough participants using test data; and
- an explicitly authorized Pilot cohort under its recorded consent, research,
  privacy, and institutional boundaries.

Beta and Pilot remain data and audit labels over the same staging accounts,
courses, work, URLs, and database. Production has no page label and remains a
separate environment.

## Governed decision contract

The Phase 5 review is derived from the current Phase 4 checksum and the latest
recorded Phase 4 preflight. The candidate remains `hold` unless:

1. the current and recorded preflight checksums match;
2. all 61 lifecycle domains are currently approved;
3. all 13 evidence gates currently pass;
4. neither the policy nor evidence validity ceiling has expired; and
5. the preflight itself is `ready_for_human_promotion_review`.

The accountable platform owner may record either:

- `hold`; or
- `approved_for_manual_promotion`, only when every condition above is true.

Even `approved_for_manual_promotion` is evidence for a later, separately
executed release action. It does not perform that action. The record always
stores `production_student_intake_enabled: false`,
`production_action_executed: false`, and
`automatic_lifecycle_execution_enabled: false`.

## Security and records boundary

- The version table is append-only and has RLS enabled.
- `anon` and `authenticated` have no direct table privileges and an explicit
  restrictive deny policy.
- The recording RPC is limited to the platform owner and the synthetic TOS
  staging institution.
- The browser sends references, summary text, the exact merge commit, and the
  expected checksum. It never sends the readiness snapshot or blocker bodies.
- The record contains metadata only. Student work, grades, messages,
  credentials, provider payloads, and private institutional content are
  prohibited.
- The target is stored as a SHA-256 fingerprint. The function cannot connect
  to or alter the target project.
- Every accepted decision appends a lane-stamped audit event with no production
  action.

The Supabase security advisor is expected to identify the two authenticated
`SECURITY DEFINER` RPCs. That access is intentional: direct table access is
closed, the reader repeats institution capability checks, and the recorder
requires an authenticated platform owner, exact institution, checksum, and
human attestation. The repository rollback gate verifies these boundaries.

## Required evidence before a future manual production promotion

Before production can move from HOLD, all current blockers must be replaced by
valid human-approved versions and the following must be attached to the exact
staging release candidate:

- exact-merge CI and hosted staging acceptance;
- current security, accessibility, privacy/records, recovery, Blackboard, and
  release evidence;
- a reviewed rollback plan and accountable rollback operator;
- the production target fingerprint and deployment/change references; and
- an explicit owner decision that has not expired or been superseded.

After that record, a separate controlled deployment must still verify the
production result before production student-data intake can be considered.
No part of this migration authorizes that deployment.

## Staging continuity

Staging stays active as the permanent sandbox after this five-phase closeout.
Future work continues through feature branch → protected `staging` pull
request → hosted staging acceptance → separately approved production
promotion. Switching Beta to Pilot appends an audit version and preserves the
same accounts, courses, and work.
