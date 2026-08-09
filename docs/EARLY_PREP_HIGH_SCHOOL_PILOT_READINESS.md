# Early Prep high-school pilot readiness

This controlled Early Prep closeout prepares a synthetic technical-readiness and Beta-promotion packet for owner and authorized institution review. It does not approve a staging-to-main promotion or activate a high-school pilot.

EdNotebook completed the full end-to-end walkthrough in staging with separate synthetic high-school teacher and student accounts. All 16 checks passed, and the targeted post-merge replay passed against deployed PR #137 commit `135ad94f4bc1d3ad4e74a76769769cdfbaf6495d` while production remained unchanged.

## Outcome

The institution-gated review surface reports eight repository evidence areas, 16 completed staging checks, and seven decisions that remain with authorized humans. Even after every local acknowledgement is checked, the packet status is only `ready_for_beta_promotion_review`; both the owner Beta-promotion decision and the institution decision remain `not_recorded`.

The surface cannot:

- approve or activate a pilot;
- assign a Beta or Pilot data lane;
- authorize real minor or education-record data;
- connect PowerSchool, Schoology, OneRoster, or another live SIS/LMS;
- accept credentials, roster records, grades, or provider writes;
- activate research collection or production student intake;
- process payments or change marketplace behavior;
- modify University, professor, or publisher records or routes.
- turn completed technical evidence into owner promotion authority or institution approval.

## Technical evidence ready for review

1. The Early Prep foundation, division isolation, K–12 social boundaries, and commerce denial.
2. Versioned teacher/student adapters for all 11 stable Grades 9–12 subjects.
3. The governed Digital Literacy release.
4. The governed K–12-only Financial Literacy release.
5. Synthetic OneRoster 1.2 and Schoology acceptance with zero provider writes.
6. Private college and career practice tools without ranking, matching, applications, recording, or scoring.
7. The item-by-item portfolio-transition preview with protected records excluded.
8. Disposable staging database gates for RLS, tenant isolation, commerce denial, idempotency, and zero-write reconciliation.

Technical evidence is not an institution approval.

## Completed staging walkthrough

Separate synthetic teacher and student accounts exercised every Early Prep roadmap surface end to end:

- public routes, account creation, sign-in, recovery, and logout;
- teacher class creation, publication, reopening, and all 11 subject adapters;
- student discovery, enrollment handoff, dashboard, assignments, writing, and recovery;
- Digital Literacy assignment, completion, private feedback, and evidence;
- Financial Literacy without personal financial data;
- notes, sources, documents, files, citations, portable export, and non-destructive restore;
- course communication, notifications, read state, and audience controls;
- school-only social spaces, profiles, groups, rewards, badges, and corrections;
- college/career planning, resume, interview, and portfolio tools;
- synthetic OneRoster, PowerSchool, and Schoology acceptance with zero provider writes;
- the item-by-item portfolio-transition preview;
- responsive and keyboard behavior, institution isolation, payment denial, and no University crossover.

The walkthrough is complete at 16 of 16 checks passed. `stagingWalkthroughCompleted` is `true`; `betaPromotionAuthorized` and `mainPromotionAuthorized` remain `false`. The complete sanitized evidence is recorded in [`EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE.md`](./EARLY_PREP_STAGING_WALKTHROUGH_EVIDENCE.md).

## Beta promotion boundary

The exact controlled release process is recorded in [`EARLY_PREP_BETA_PROMOTION_PACKET.md`](./EARLY_PREP_BETA_PROMOTION_PACKET.md). The technical candidate is ready for the accountable owner's separate protected `staging` to `main` decision. Until that decision is recorded, this packet authorizes no live-root change. A synthetic/adult-controlled Beta promotion would still authorize no real minor data, live SIS/LMS write, research collection, or Early Prep payment.

## Human decisions still required

An authorized school or district team must independently record all of the following in the existing governed controls:

1. Institution sponsor and district authority, including purpose, population, dates, and accountable owners.
2. Privacy and education-records review for the exact high-school scope.
3. Independent security review of the exact release and residual risks.
4. Manual accessibility acceptance across the complete pilot workflow.
5. Minor-data, notices, consent or guardian requirements, minimization, retention, access, dispute, and deletion authority.
6. Support, incident, stop-condition, recovery, and rollback ownership.
7. Exact institution, course, or account Pilot-lane assignment by an authorized human.

No repository test, CI run, developer, or synthetic packet can substitute for those decisions. They are required before a real-student institutional pilot, even if the owner separately promotes the synthetic technical candidate into the live Beta lane.

## Supabase boundary

This unit adds no database object, migration, Edge Function, RPC, Data API grant, policy, or client call. It reuses the existing fail-closed controls as evidence references only. Existing exposed objects remain protected by explicit grants and RLS; current Supabase guidance requires both layers for Data API security.

## Verification

```powershell
npm run test:early-prep
npm run test:student-data-safety
npm run test:student-experience
npm run build:staging
npm run audit:bundle
```
