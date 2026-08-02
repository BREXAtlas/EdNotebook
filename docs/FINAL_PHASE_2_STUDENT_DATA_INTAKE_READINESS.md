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

## Evidence still required after merge

Use only the existing staging environment. Do not create a second staging project.

1. Apply the merged migration to staging project `gfalgonektwdylsxsgzc` and record the exact merge commit and migration version.
2. Rerun focused/full CI and the rollback-safe SQL gate for that exact candidate.
3. Prove the eight privileged RPCs reject signed-out execution and the public catalog excludes review rows.
4. Rerun Supabase security/performance advisors; resolve or formally accept every remaining item. Enable leaked-password protection or record the accountable human exception.
5. Demonstrate provider database/PITR recovery and separately restore private Storage bytes with count, byte-length, and SHA-256 reconciliation.
6. Exercise real synthetic private-object deletion, retention, legal hold, and partial-failure recovery through the deployed workers.
7. Complete a synthetic Blackboard round trip in an institution-controlled non-production course.
8. Record current human-approved lifecycle decisions for all 61 domains and the accountable technology, privacy/records, accessibility, and security approvals.
9. Confirm required checks protect the exact deployment branch.

Only after every item passes may the result be labeled `ready_for_human_promotion_review`. That label still does not enable production intake; production promotion is a separate reviewed action in a later final phase.

## Parallel TOS status boundary

This Phase 2 is part of the consolidated five-phase closeout and remains inside the existing Stage 10B work. It does not rename TOS Stage 11 or Stage 12. TOS Stage 11 commercial go-live still depends on its own human approvals; Stage 12 begins only after the formal Stage 11 gate is satisfied.
