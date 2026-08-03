# EdNotebook Early Prep — Grades 9–12 foundation audit

Date: 2026-08-03
Implementation branch: `codex/early-prep-foundation`
Base: `origin/staging` at `e39c17b`
Internal division identifier: `education_division = 'k12'`

This unit extends the shared EdNotebook foundation. It does not create a second LMS, a second Digital Literacy catalog, or a production Supabase project.

## Reuse and gap matrix

| Domain | Existing foundation reused | Gap closed in this unit | Deferred controlled unit |
| --- | --- | --- | --- |
| Public experience | `#/students/k12`, shared student landing and dashboard | Early Prep name, Grades 9–12 copy, public `#/early-prep` alias, distinct student and high-school teacher account paths, main landing/footer link | Design refinements after review |
| Identity and roles | Shared Supabase Auth, canonical profile/onboarding trigger, educator verification queue | Teacher-specific language and a fixed `k12` request on the Early Prep teacher path; no claimed affiliation before approval | District SSO pilots |
| Course creation | Shared Course Builder and `courses.education_division` | Stable `education_subjects` taxonomy; exact “What subject is this for?” prompt; immutable course division; subject-aware assignment templates | Per-subject content adapters |
| Digital Literacy | Canonical `Digital-Literacy-Course` release, one standard enrollment per student, release-versioned progress, teacher assignment references | Presented as Digital Literacy Class in Early Prep navigation; no catalog or progress duplication | Content-release upgrades remain in canonical repository |
| Control plane | EdNotebook/TOS feature catalog, policies, connections, account/course search, audit events | University / Early Prep selector; server-filtered center/search; division-aware policy resolution, previews, application, statistics, integrations, and selector audit | TOS UI parity in a companion PR if requested |
| Social safety | Division-scoped profiles, groups and campus social; anonymous K–12 discovery already denied; enrolled-course communication authorization | Verified as the reused baseline; static gate coverage added | District moderation escalation integrations |
| Commerce | Governed seller, listing, checkout, rental, order and refund foundation | UI removal plus database triggers and Edge checks that reject Early Prep seller onboarding, listings, buying, renting and refunds | No Early Prep commerce work planned |
| Learning systems | Provider-neutral canonical records, Blackboard CSV, LTI 1.3/Deep Linking/NRPS/AGS | OneRoster 1.2 resource contract, synthetic PowerSchool mapper, Schoology LTI capability contract, stable crosswalk/run tables, reviewed idempotent grade-export plan | Live district credentials and connector writes |
| Continuity | `student_education_paths` already separates current division | Review-only transition request/evidence table and explicit protected-record/social boundaries | Approved Move to University workflow |
| Data plane | Current shared staging Supabase model and RLS | Additive migration path with conditional division enforcement | Separate project only if legal, operational, or district isolation evidence requires it |

## Repository and staging evidence

- EdNotebook staging already exposed a K–12 route and shared dashboard, but the primary landing/footer did not expose a first-class high-school program and the route offered only a student CTA.
- `BREXAtlas/Digital-Literacy-Course` remains the canonical source. Its documented validation passed with 40 stable units in release `2026.08.01.1`; no content was copied here.
- `BREXAtlas/TOS-Platform` and `BREXAtlas/TOS-Platform-Blueprint` already document EdNotebook coexistence, staged controls, and governance. This EdNotebook unit consumes those boundaries and records the companion impact below; it does not silently modify either companion repository.

## Safety decisions

- `k12` remains the only internal database/API identifier. “Early Prep” is audience-facing language.
- Browser filters are not security controls. Admin lists/searches, feature resolution and commerce denial are enforced in SQL; direct Edge-function calls are checked again before Stripe activity.
- Existing anonymous profile policies already limit public discovery to University profiles. Existing course communication authorization remains enrollment- and educator-scoped.
- Digital Literacy enrollment, assignments and progress continue to reference one canonical release. Research consent and data collection remain separately governed.
- No production credentials, projects, deployments, DNS, billing switches or production data were touched.

## Known risks and review points

- Apply both new migrations to a disposable/local database before shared staging. They extend central policy and marketplace tables and therefore require migration review.
- Existing feature policies and connections are backfilled as `both`. Reviewers should decide whether any legacy item should be explicitly University-only before staging promotion.
- PowerSchool and Schoology work is contract/synthetic only. Live writes remain blocked until district-owned credentials, roster reconciliation, preview review and rollback evidence exist.
- The transition table records requests and evidence only; it deliberately cannot change a student's current division.

## Recommended next controlled unit

Run an Early Prep staging pilot with synthetic district data: apply migrations, verify the Control Center selector under platform and institution roles, exercise negative commerce API cases, import a small OneRoster/PowerSchool fixture, and reconcile a reviewed no-op grade export. Do not start a live district connector or Move to University application until that evidence is approved.
