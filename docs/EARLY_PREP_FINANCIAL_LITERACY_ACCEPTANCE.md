# Early Prep Financial Literacy acceptance

Date: 2026-08-08

Environment: staging only (`gfalgonektwdylsxsgzc`)

Canonical source: `BREXAtlas/Financial-Literacy-Course`

Canonical commit: `237301955de36d335d3d15858258b57fbc63f1b9`

## Accepted scope

Financial Literacy / Personal Finance is a free, platform-standard Early Prep class for Grades 9–12. It references the canonical **Ram Ready Financial Futures** repository instead of copying or rewriting its curriculum.

- 20 Financial Foundations episodes are the starter class.
- 20 Future Wealth quests are optional enrichment.
- Students open canonical source lessons inside EdNotebook and explicitly confirm completion.
- EdNotebook stores only the release, unit ID, evidence source, and timestamps.
- Private milestones are issued after 20 Foundations units and after all 40 units.
- Teachers see progress only for current learners in a K–12 class they manage.

## Explicit exclusions

This unit does not create or call checkout, payment, seller, payout, rental, refund, tax, or marketplace functions. Financial Literacy is not a publisher listing and never enters the Alex B. Morrison commercial catalog.

The migration does not insert into or update:

- `public.course_completion_badges`
- `public.published_course_directory`
- `public.marketplace_orders`
- University course or publisher-owned content records

The course also does not collect bank credentials, account numbers, tax documents, exact balances, or individualized financial advice.

## Canonical course evidence

The canonical repository contains 20 Foundations episodes and 20 Wealth quests with centralized government and primary-source references, deterministic content, bounded personalization, privacy documentation, accessibility support, and no product sales.

Its validation completed with **0 failures and 0 warnings**. The repository validator required a disposable Windows-only `pathToFileURL` normalization for dynamic imports; that audit-only adjustment was not made to the canonical repository.

## Staging migrations

- `20260808230030_early_prep_financial_literacy`
- `20260808230221_harden_early_prep_financial_literacy`

Both migrations passed transaction-only preflight before being added to staging migration history.

## Rollback-safe staging gate

`supabase/tests/early_prep_financial_literacy_acceptance.sql` passed inside a transaction and rolled back all synthetic fixtures. It proved:

- a K–12 student receives exactly 40 canonical units;
- a K–12 teacher sees exactly the current learner in the managed class;
- a University student cannot receive or write Early Prep Financial Literacy progress;
- a University professor cannot open the Early Prep teacher-progress RPC;
- Foundations and full-course milestones issue exactly once;
- authenticated clients have no direct access to private progress or badge tables;
- University course, University badge, publisher library, and marketplace-order counts remain unchanged outside the one rolled-back University fixture.

Post-gate staging state:

- University courses: 5
- University completion badges: 1
- Published library entries: 3
- Marketplace orders: 5
- Canonical Financial Literacy units: 40
- Synthetic Financial Literacy enrollments remaining: 0

## Advisor disposition

The hardening migration added the two missing foreign-key indexes and explicit deny policies on all three private Financial Literacy tables. No Financial Literacy foreign-key advisory remains.

Three security-definer advisories remain intentional for authenticated RPC endpoints. Each endpoint validates the caller and then enforces one of these scopes before reading or writing private rows:

- current Early Prep (`k12`) student pathway;
- the authenticated student's own progress;
- managed K–12 class plus current course membership.

The public catalog RPC was changed to security-invoker because it reads only authenticated, RLS-protected catalog rows.

## Next controlled unit

Subject-adaptive teacher and student workspaces, beginning with adapter behavior for the existing eleven stable Early Prep subjects. No University or publisher route is modified by that unit.
