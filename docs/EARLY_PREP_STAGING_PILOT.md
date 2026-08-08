# EdNotebook Early Prep — synthetic staging pilot

Date: 2026-08-08
Branch: `codex/early-prep-staging-pilot`
Base: merged `origin/staging` at `7c5339e`
Supabase staging project: `gfalgonektwdylsxsgzc`

## Outcome

The Early Prep Grades 9–12 foundation completed its first controlled staging pilot with synthetic district data. The result is eligible for owner review. It is not a production approval, a live district integration, or authorization to use real student data.

## Scope and isolation

- The staging project alone received the two reviewed Early Prep migrations and the persistent synthetic pilot evidence.
- Production project `didwxihufueqbpfnfdmm` and recovery project `pxicbctxmokbafynklhv` were not queried or changed during pilot execution.
- No live provider credentials, secrets, real students, real minors, purchases, refunds, or provider writes were used.
- University, professor, and publisher data paths remain in place. After the staging migration and fixture work, University still has five courses and three published library entries.
- Early Prep has zero published or purchase/rental-enabled library entries.

## Migration evidence

The repository migration filenames match the versions recorded by staging:

- `20260808211028_early_prep_foundation.sql`
- `20260808211036_scope_admin_controls_by_education_division.sql`

The Windows Supabase CLI executable is blocked by the workstation's Device Guard policy. The reviewed migrations were therefore applied through the connected Supabase staging tool. GitHub CI continues to use the pinned Supabase CLI version in its disposable database job.

## Browser verification

The deployed staging site was inspected without console errors:

- `#/early-prep` presents separate student and teacher paths, school-only social language, and no commerce offer.
- `#/students/k12` resolves to the Early Prep landing experience.
- `#/` exposes Early Prep in the main page and footer.
- `#/early-prep/teacher` scopes the signed-in workspace to Early Prep classes. This branch also adds K–12-only class, teacher, and school terminology while leaving the University labels unchanged.
- `#/admin/control-center` exposes University and Early Prep Grades 9–12 division choices. The browser account did not have an approved administration workspace, so role-specific visibility was verified transactionally in SQL instead of broadening that account's permissions.

## Synthetic fixture and reconciliation evidence

The persistent staging fixture is intentionally hidden and non-enrollment-selectable:

- District: `35000000-0000-4000-8000-000000000010`
- Teacher: `teacher@early-prep-staging-pilot.invalid`
- Draft class: `35000000-0000-4000-8000-000000000020`
- PowerSchool crosswalks: 3
- Reconciled exchange runs: 2
- OneRoster/PowerSchool import preview hash: `fnv1a-0dc64990`
- Reviewed grade-export no-op hash: `fnv1a-b9e1ec51`
- Expected writes: 0
- Actual writes: 0
- Provider receipt: none
- `write_authorized`: false
- Export `applied_at`: null

The fixture covers all eight OneRoster 1.2 resource groups used by this foundation: organizations, academic sessions, courses, classes, users, enrollments, line items, and results. Adapter tests prove deterministic preview hashing and reject any no-op reconciliation that reports a provider write.

## Database safety gate

`supabase/tests/early_prep_staging_pilot.sql` passed against staging inside a transaction that rolls back all test records. It verifies:

- institution and platform roles can see the authorized K–12 control-plane scope without receiving University records;
- an unaffiliated authenticated user cannot read or insert integration evidence;
- direct K–12 seller onboarding fails;
- a K–12 course cannot be changed into a University course;
- duplicate exchange idempotency keys fail;
- a reviewed no-op export remains reconciled with zero expected and actual writes and no application timestamp.

The deployment workflow now runs both the Early Prep foundation database gate and this staging-pilot gate in its disposable Supabase environment, in addition to the Node Early Prep tests.

## Decision boundary

This pilot is ready for review and CI confirmation. The next controlled unit is the Early Prep Digital Literacy Class prototype experience upgrade in staging. Live district connectors, real data, production promotion, and Move to University automation remain out of scope until separately reviewed and approved.
