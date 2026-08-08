# Early Prep Digital Literacy Class — controlled staging acceptance

Date: 2026-08-08
Branch: `codex/early-prep-digital-literacy-upgrade`
Base: merged `origin/staging` at `71391ab`
Supabase staging project: `gfalgonektwdylsxsgzc`

## Outcome

The Early Prep Grades 9–12 Digital Literacy Class prototype now carries the existing 40-unit canonical course into a class-specific experience. Teachers can assign units, inspect student completion, send private unit feedback, and see acknowledgement. Students can review and acknowledge that feedback and receive one private milestone after completing all 40 units in a release.

This is a staging acceptance result, not production approval. It does not authorize real student data, live district connections, research collection, or automated Move to University.

## Canonical course decision

The maintained `BREXAtlas/Digital-Literacy-Course` repository was audited and validated with zero failures and zero warnings. It already provides 40 stable units, achievements, stars, streaks, accessible controls, reduced-motion behavior, private optional usefulness ratings, and the origin-bound EdNotebook progress bridge. No canonical curriculum files were changed. Usefulness ratings remain local and are not synchronized into EdNotebook.

EdNotebook continues to reference that single governed release. It does not duplicate or fork the curriculum.

## Experience added

- Early Prep teacher screens say **Digital Literacy Class**, **teacher**, **class**, and **classwork** while the University/professor wording remains available on University paths.
- Feedback is append-only and private. It is attached to one assigned unit and one assignment recipient.
- Student notifications say only that feedback is ready; the feedback body is excluded from notifications and audit metadata.
- Students can acknowledge feedback and optionally mark it helpful.
- The completion milestone is issued only for a learner whose current education division is `k12` and who completed every unit in the release.
- The milestone uses a separate private table. It does not insert into or update University `course_completion_badges`.
- Existing class communication and moderation remain the social path; no new Digital Literacy social feed was created.

## Database boundary

Staging received these additive migrations:

- `20260808221507_early_prep_digital_literacy_feedback.sql`
- `20260808221644_index_early_prep_digital_literacy_feedback.sql`
- `20260808222049_route_early_prep_digital_literacy_feedback.sql`

The new feedback and milestone tables live in the private schema, have RLS enabled, explicitly deny direct authenticated table access, and are reachable only through signed-in RPCs that validate the current user. Anonymous execution is revoked for all five new public RPCs. The teacher write/read RPCs additionally require course-management access and `courses.education_division='k12'`.

Supabase's security advisor reports the expected generic warning for signed-in `SECURITY DEFINER` RPCs. Those endpoints are intentional authenticated API surfaces; each performs its own user, recipient, course, and division checks. The performance advisor reported four missing foreign-key indexes after the first migration; the second migration added all four, and the follow-up advisor returned no new feedback/milestone index findings.

## Rollback acceptance evidence

`supabase/tests/early_prep_digital_literacy_acceptance.sql` passed twice against staging inside a transaction that rolls back every fixture. It proves:

- an Early Prep course manager can send feedback only to a recipient and unit in the managed assignment;
- a University professor cannot use the Early Prep write or course-read path;
- another student cannot acknowledge someone else's feedback;
- the recipient can read, acknowledge, and mark their feedback helpful;
- notification and audit records exclude the feedback-text sentinel;
- completing the 40-unit release issues exactly one private K–12 milestone and notification;
- rerunning the progress trigger does not duplicate that milestone;
- authenticated clients cannot directly select the private tables;
- the test leaves zero synthetic users, feedback records, or milestone records.

After the migration and rollback gate, staging remained at:

- University courses: 5
- Published library entries: 3
- Existing University completion badges: 1
- Synthetic acceptance users remaining: 0
- Synthetic acceptance feedback rows remaining: 0
- Synthetic acceptance milestone rows remaining: 0

Production project `didwxihufueqbpfnfdmm` and recovery project `pxicbctxmokbafynklhv` were not queried or changed.

## Verification

- Canonical Digital Literacy repository validation: 0 failures, 0 warnings.
- EdNotebook Digital Literacy tests: 29 passing after the indexed and exact-notification-route contracts were added.
- Early Prep tests: 17 passing.
- Production bundle build: passing.
- The deployment workflow now runs the new rollback database gate in its disposable Supabase database.

## Decision boundary

This controlled unit is ready for owner review and CI confirmation. Production promotion, persistent pilot enrollment, real teacher/student feedback, district roster activation, research activation, and Move to University automation each remain separate future decisions.
