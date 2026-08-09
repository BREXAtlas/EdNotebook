# Early Prep high-school pilot readiness

This final controlled Early Prep unit prepares a synthetic technical-readiness packet for authorized institution review. It does not approve or activate a high-school pilot.

Before any proposal to promote Early Prep toward `main`, EdNotebook must complete a full end-to-end walkthrough in staging with separate synthetic high-school teacher and student accounts. This is a required next gate, not evidence already completed by this unit.

## Outcome

The institution-gated review surface reports eight repository evidence areas and seven decisions that remain with authorized humans. Even after every local acknowledgement is checked, the packet status is only `ready_for_authorized_institution_review` and the institution decision remains `not_recorded`.

The surface cannot:

- approve or activate a pilot;
- assign a Beta or Pilot data lane;
- authorize real minor or education-record data;
- connect PowerSchool, Schoology, OneRoster, or another live SIS/LMS;
- accept credentials, roster records, grades, or provider writes;
- activate research collection or production student intake;
- process payments or change marketplace behavior;
- modify University, professor, or publisher records or routes.
- claim the end-to-end staging walkthrough is complete or authorize promotion toward `main`.

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

## Required staging walkthrough

The next controlled gate must use synthetic teacher and student accounts to exercise every Early Prep roadmap surface end to end:

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

The walkthrough begins at 0 of 16 checks complete. Evidence must come from the deployed staging candidate after this work is merged. Until then, `stagingWalkthroughCompleted` and `mainPromotionAuthorized` remain `false`.

## Human decisions still required

An authorized school or district team must independently record all of the following in the existing governed controls:

1. Institution sponsor and district authority, including purpose, population, dates, and accountable owners.
2. Privacy and education-records review for the exact high-school scope.
3. Independent security review of the exact release and residual risks.
4. Manual accessibility acceptance across the complete pilot workflow.
5. Minor-data, notices, consent or guardian requirements, minimization, retention, access, dispute, and deletion authority.
6. Support, incident, stop-condition, recovery, and rollback ownership.
7. Exact institution, course, or account Pilot-lane assignment by an authorized human.

No repository test, CI run, developer, or synthetic packet can substitute for those decisions.

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
