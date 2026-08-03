# Final Phase 4 of 5 — student-data promotion preflight

This unit freezes a compact, append-only snapshot of the current student-data
readiness result. It is a production-promotion control, not a testing kill
switch.

## Testing and promotion boundary

- Staging beta testing: allowed for administrative staff, investors,
  librarians, and other authorized walkthrough participants using
  demonstration accounts rather than official institutional records.
- Staging pilot testing: allowed for the actual authorized pilot cohort, with
  the applicable consent, research, privacy, and institutional boundaries
  recorded for that pilot; it is still not production.
- Production promotion: HOLD until all lifecycle domains and evidence gates
  satisfy the governed production standard.
- Production student-data intake: disabled.
- Automatic lifecycle execution: disabled.
- Production Supabase project: untouched.

The current staging baseline is 61 of 61 lifecycle domains recorded, with 33
approved and 28 explicitly blocked. Nine of thirteen evidence gates pass. The
four current HOLD gates are accessibility approval, Blackboard round trip,
privacy and records approval, and security approval.

Blocked lifecycle decisions and HOLD evidence do not prevent bounded beta or
pilot learning tests in staging. They prevent those tests from being
misrepresented as production approval and prevent production records from
entering an unapproved lifecycle.

Beta, Pilot, and Production are data lanes rather than separate pages,
workflows, or databases. Staging pages display a persistent Beta or Pilot
banner. Production deliberately displays no lane banner. Changing a staging
scope from Beta to Pilot appends a governance version and does not move,
recreate, or delete accounts, courses, or work. The protected version records
the previous lane, the carried account and course IDs, their counts, and a
checksum; the general audit event records the prior/new lane, counts, and
checksum without duplicating those protected identifiers.

## Recorded evidence

The migration adds append-only governance tables and authorized RPCs. The
promotion RPCs are:

- `get_student_data_promotion_preflight` returns the compact current state and
  the latest immutable snapshot.
- `record_student_data_promotion_preflight` records only after the authorized
  human submits the checksum obtained from the current preflight.

The snapshot includes domain and gate keys, versions, statuses, counts,
expiration ceilings, and the source commit. It excludes student work, grades,
messages, credentials, provider payloads, and response bodies. Direct browser
access to the table remains revoked, RLS remains enabled, and every accepted
record creates an audit event.

The lane RPCs resolve the authenticated user's institution, account, and
accessible-course labels on the server, append a Beta/Pilot label change, and
return lane-filtered audit metadata to authorized reviewers. They cannot move
records, create accounts, or assign the Production lane.

## What this unit cannot do

It cannot turn a HOLD into a PASS, enable production intake, deploy to the
production Supabase project, execute deletion or retention, change an
institutional policy decision, or infer institutional approval from a beta or
pilot test.
