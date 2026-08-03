# Final Phase 4 of 5 — student-data promotion preflight

This unit freezes a compact, append-only snapshot of the current student-data
readiness result. It is a production-promotion control, not a testing kill
switch.

## Testing and promotion boundary

- Live Beta testing: allowed on the normal EdNotebook site for administrative
  staff, investors, librarians, and other authorized walkthrough participants
  using demonstration accounts rather than official institutional records.
- Live Pilot testing: allowed on that same live site for the actual authorized pilot cohort, with
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

Blocked lifecycle decisions and HOLD evidence do not prevent bounded Beta or
Pilot learning tests on the live service. They prevent those tests from being
misrepresented as production approval and prevent production records from
entering an unapproved lifecycle.

The deployment surface and operating lane are separate controls. `/staging/`
is the permanent upgrade sandbox and always displays a staging/test-data
banner. Beta and Pilot are labels on the normal live site; Production
deliberately displays no lane banner. Changing the live site from Beta to
Pilot appends a governance version and does not move, recreate, or delete
accounts, courses, work, URLs, or databases. The protected version records
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
accessible-course labels on the server, append a Beta/Pilot audit-label change, and
return lane-filtered audit metadata to authorized reviewers. They cannot move
records, create accounts, or assign the Production lane.

## What this unit cannot do

It cannot turn a HOLD into a PASS, enable production intake, deploy to the
production Supabase project, execute deletion or retention, change an
institutional policy decision, or infer institutional approval from a beta or
pilot test. The historical Phase 4 snapshot field names beginning with
`staging_` are retained only for immutable schema compatibility; the active
release model is defined in `LIVE_OPERATING_LANES.md`.
