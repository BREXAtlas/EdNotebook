# Early Prep Grades 9–12 Beta promotion packet

Date prepared: 2026-08-09 (America/Chicago)

## Decision requested

This packet supports one future accountable-owner decision: whether to promote the exact protected `staging` candidate into `main`, where the existing live service operates in the Beta lane. It does not make that decision and does not authorize a merge to `main`.

The promotion candidate must be resolved from the protected `staging` head and confirmed against `https://ednotebook.com/staging/environment.json` immediately before the promotion pull request is approved. It must contain deployed PR #137 commit `135ad94f4bc1d3ad4e74a76769769cdfbaf6495d` and this closeout packet.

## Technical closeout

- Eight repository evidence areas are ready.
- All 16 synthetic teacher/student staging walkthrough checks passed.
- The final PR #137 display-isolation replay passed with zero browser console entries.
- Required staging CI, disposable-database, security-service, build, and deployment workflows passed.
- Early Prep commerce remains denied and payments remain disabled.
- Digital Literacy research collection remains disabled.
- Synthetic OneRoster, PowerSchool, Schoology, and grade-export acceptance remains zero-write and credential-free.
- University, professor, publisher, marketplace, and payment routes and records remain preserved.
- No real minor data or live institutional record was used.

## Permitted live Beta scope after a separate owner approval

A promotion approval may authorize only a synthetic or adult-controlled Early Prep Beta evaluation on the existing live service. It does not authorize:

- real minor or education-record data;
- a school/district pilot claim;
- live SIS/LMS credentials, roster import, grade passback, or provider writes;
- research recruitment, consent, intake, collection, or export;
- Early Prep checkout, marketplace access, seller onboarding, refunds, or payments;
- University, professor, or publisher workflow replacement or rerouting;
- an unlabeled Production operating lane.

## Protected promotion procedure

1. Resolve and record the exact `origin/staging` commit and deployed staging environment marker.
2. Confirm the four protected local work directories remain untracked and excluded.
3. Audit `origin/main...origin/staging` and confirm every change belongs to the reviewed Early Prep release or its fail-closed cross-cutting boundary.
4. Open a protected pull request from `staging` to `main`; do not copy files, force-push, or bypass branch protection.
5. Require all validation, security-service, disposable-database, production build, staging build, and bundle-audit checks to pass.
6. Require the accountable owner to record the explicit Beta-promotion decision on the exact commit.
7. Merge only after that decision. Confirm the live environment marker reports the approved commit and the operating lane remains `beta`.
8. Run a live-root smoke test with synthetic/adult-controlled teacher and student accounts before inviting any external tester.
9. If acceptance fails, stop enrollment and revert the main merge commit through a protected pull request. Do not rewrite staging or production history.

## Live Beta acceptance

The post-promotion smoke test must verify public routes, separate Early Prep teacher/student authentication, the one synthetic class, all 11 subject adapters, assignments, Digital Literacy, Financial Literacy, learning workspace recovery, communication, school-social isolation, rewards, college/career tools, portfolio transition, responsive/keyboard behavior, session recovery, RLS isolation, payment denial, research-off state, no University crossover, and zero browser console errors.

Record only sanitized counts, the exact live commit, workflow links, and pass/fail results. Do not record credentials or real identifiers.

## Human gates before any real-student pilot

The following remain independent authorized-human decisions: institution/district authority; privacy and education-records review; independent security review; manual accessibility acceptance; minor-data/notices/consent/retention/deletion authority; support/incident/stop/rollback ownership; and exact bounded institution/course/account lane assignment.

Technical readiness is complete. Owner Beta promotion authority and all real-student pilot authority remain unrecorded.
