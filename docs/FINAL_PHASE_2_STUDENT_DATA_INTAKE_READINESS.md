# Final Phase 2 of 5 — student-data intake readiness

## Decision

**HOLD. Production student intake remains disabled.**

Phase 2 prepares evidence and closes identified staging security gaps. It does not promote a deployment, change the production Supabase project, create a parallel router or staging site, enable real student intake, or execute an account/data-subject lifecycle action.

## Controlled implementation

- Version 2.5 captures 50 EdNotebook-linked student-data domains, including governed subject requests and their per-domain plans.
- The lifecycle registry covers 61 domains: the 50 linked domains plus 11 Auth, Storage, backup, Stripe, Blackboard/LTI, unlinked-form, and shared-authoring domains.
- Thirteen evidence gates cover repository validation, database and private-object recovery, tenant isolation, Blackboard reconciliation, deletion/retention, advisors, release protection, and four human approvals.
- Lifecycle policies and intake evidence are append-only, institution-scoped, human-attested, versioned records. Browser roles have no direct table writes.
- The Control Center adds an institution-scoped, read-only readiness view. It has no activation control.
- A student may request access, correction, account closure, deletion, or anonymization. The RPC creates only a tenant-bound plan, marks missing policies, fixes `intake_decision` to `hold`, and returns `production_action_executed: false`.
- Eight privileged LTI/social RPCs lose unintended anonymous execution. Authenticated product access remains.
- The signed-out Morrison Library catalog remains available, but its SECURITY DEFINER projection excludes every review-stage course or book. A signed-in student may still see the established safe commercial preview with checkout disabled; this grants no book content, checkout, or entitlement.
- Supabase 2026 explicit-grant behavior is adopted for future public tables, sequences, and functions. The trusted deletion/retention worker tables receive narrow, explicit service-role grants rather than depending on historical defaults.

## Repository evidence

The existing local Supabase database accepted migration `20260802023831_govern_student_data_intake_readiness.sql`. The rollback-safe SQL harness then passed the complete repository rehearsal, including:

- a blocked 61-item account-closure plan with no production action;
- the canonical 50-domain capture and exact restore reconciliation;
- cross-institution request, record, course, message, grade, and administration denials;
- anonymous privileged-RPC revocation;
- runtime denial of anonymous review-stage catalog content while preserving the signed-in, no-checkout preview contract;
- Blackboard reconciliation and tamper negatives; and
- deletion, retention, legal-hold, fencing, retry, audit, and partial-failure behavior.

The final SQL notice remains intentionally conservative:

```text
PASS repository rehearsal; operational student-data gates remain HOLD
```

## Existing-staging acceptance

PR #96 merged into `staging` as commit `f268d374de857057d41d6d6a216e8a0b2f777898` after all three required checks passed. On August 1, 2026 Central time, the exact reviewed migration was applied only to existing staging project `gfalgonektwdylsxsgzc`; Supabase recorded it as hosted migration `20260802033014_govern_student_data_intake_readiness`. Production project `didwxihufueqbpfnfdmm` was not changed.

The staging migration has 61 lifecycle domains, 13 active evidence gates, RLS on all six new tables, and zero direct `anon` or `authenticated` table grants. The complete 113,751-character synthetic SQL harness executed without an assertion error and rolled back. Follow-up queries confirmed that zero fixture users and zero fixture subject requests remained.

The anonymous RPC boundary now has one intentional SECURITY DEFINER exception: `list_alex_morrison_catalog(text)`. The eight privileged LTI/social RPCs reject anonymous execution, and the rollback harness proved the catalog excludes review-stage content while preserving the established signed-in safe preview.

The post-migration security advisor reported 14 `INFO` and 104 `WARN` items. Six new `INFO` items are the deliberately service-only Phase 2 tables: RLS is enabled, no browser policy exists, and browser roles have no grants. Five new authenticated SECURITY DEFINER warnings correspond to the institution/subject-scoped Phase 2 RPCs and are covered by the merged authorization and cross-tenant tests. The sole anonymous warning is the intentionally public, runtime-constrained catalog. Leaked-password protection remains a human-owned staging setting and therefore remains a HOLD item.

The performance advisor identified three new lookup-side foreign keys without covering indexes. Migration `20260802033711_index_student_data_governance_foreign_keys.sql` closes those findings through this reviewed follow-up; it must merge and receive the same staging-only migration/advisor check before Phase 2 repository/staging acceptance is closed.

The `staging` and `main` branches now enforce pull requests, strict successful execution of all three release checks, conversation resolution, administrator enforcement, and no force push or deletion. The approval count remains zero only to avoid deadlocking the current single-owner repository; the owner still makes the explicit merge decision.

## Remaining operational evidence after staging acceptance

Use only the existing staging environment. Do not create a second staging project.

1. Enable leaked-password protection or record the accountable human exception, and preserve formal acceptance for each intentional advisor finding.
2. Demonstrate provider database/PITR recovery and separately restore private Storage bytes with count, byte-length, and SHA-256 reconciliation.
3. Exercise real synthetic private-object deletion, retention, legal hold, and partial-failure recovery through the deployed workers.
4. Complete a synthetic Blackboard round trip in an institution-controlled non-production course.
5. Record current human-approved lifecycle decisions for all 61 domains and the accountable technology, privacy/records, accessibility, and security approvals.

Only after every item passes may the result be labeled `ready_for_human_promotion_review`. That label still does not enable production intake; production promotion is a separate reviewed action in a later final phase.

## Parallel TOS status boundary

This Phase 2 is part of the consolidated five-phase closeout and remains inside the existing Stage 10B work. It does not rename TOS Stage 11 or Stage 12. TOS Stage 11 commercial go-live still depends on its own human approvals; Stage 12 begins only after the formal Stage 11 gate is satisfied.

The existing staging environment remains the permanent integration sandbox after this phase. All later changes follow the feature branch → `staging` PR → staging acceptance → separately approved `staging` to `main` promotion workflow in `docs/STAGING_DEPLOYMENT.md`.
