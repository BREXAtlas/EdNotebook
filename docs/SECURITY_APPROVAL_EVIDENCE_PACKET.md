# Security approval evidence packet

Status: **AWAITING ACCOUNTABLE SECURITY REVIEW — HOLD**

Prepared: 2026-08-02

Gate: `securityApproval`

This packet prepares the independent human security decision for the existing EdNotebook staging environment. It is not a security approval, does not activate production student intake, does not authorize real student data, and does not change the production Supabase project.

## Decision requested

An accountable security reviewer must decide whether the exact candidate, deployed staging state, documented controls, residual risks, rollback plan, and incident boundary are acceptable. The reviewer may record `PASS`, `HOLD`, or `FAIL`. The `securityApproval` result must not be inferred from a merge, a platform-owner decision, successful CI, an advisor snapshot, or another institution gate.

## Candidate and environment binding

| Field | Bound value |
| --- | --- |
| Repository | `BREXAtlas/EdNotebook` |
| Protected staging baseline | `1a126227874f6ac7a6c570f85de8972bd1d6856f` (PR #106 merge) |
| Candidate | The exact commit containing this packet and `20260802190000_scope_catalog_review_previews.sql`; record the protected merge commit after review |
| Staging frontend | `https://ednotebook.com/staging/` |
| Staging Supabase | `gfalgonektwdylsxsgzc`, `us-east-1` |
| Live migration before candidate deployment | `20260802075349` |
| Production Supabase | `didwxihufueqbpfnfdmm` — out of scope and unchanged |
| Permitted data | Public and synthetic staging data only |
| Prohibited data | Real student records, grades, private messages, credentials, confidential institutional content, and human-subjects research data |

This packet becomes stale if the protected commit, migration inventory, Edge Function versions, Auth setting, branch protection, workflow permissions, provider boundary, or advisor result changes without reconciliation.

## Findings and candidate remediation

The live pre-candidate database review found one avoidable metadata exposure. `list_alex_morrison_catalog(text)` correctly excluded review-stage listings for anonymous users, but allowed any authenticated account to see another professor's review-stage title, description, pricing, and creator metadata. No book content, answer key, entitlement, bank data, or checkout authorization was exposed.

Migration `20260802190000_scope_catalog_review_previews.sql` narrows review-stage course metadata to `published_course_directory.professor_id = auth.uid()` or the platform owner, and review-stage EduBook metadata to `publications.owner_id = auth.uid()` or the platform owner. Published catalog behavior remains unchanged. The rollback-safe hosted safety harness now proves that the owner retains the preview and another signed-in account cannot see it.

The same migration adds explicit RLS and a restrictive browser deny policy to `private.publication_learning_author_versions`, the answer-key-bearing author layer. Before the candidate, the private-schema table had no browser table grants and neither browser role had direct access; the additional policy supplies defense in depth without opening a new interface.

## Live staging security snapshot before candidate deployment

| Control | Verified result |
| --- | --- |
| Supabase Security Advisor | 103 `WARN` findings and no other finding type in the current snapshot |
| Warning composition | One anonymous and 102 authenticated SECURITY DEFINER RPCs |
| Application SECURITY DEFINER functions | 116 total; 0 executable by `PUBLIC` |
| Anonymous exception | Exactly `list_alex_morrison_catalog(text)` |
| Authenticated definer search paths | 0 missing a pinned `search_path` |
| Request-identity binding | 0 authenticated definer RPCs missing `auth.uid()`, `auth.jwt()`, or request-claim binding |
| Dynamic SQL | 0 authenticated definer RPCs using `EXECUTE` |
| Application tables | 160 total; 159 with RLS before the candidate; 0 RLS-enabled tables without a policy |
| Single non-RLS table | Private answer-key table, with no `anon` or `authenticated` table privilege; candidate adds explicit RLS and deny policy |
| Storage | Six buckets; all six private |
| Edge Functions | Ten active; eight require platform JWT; two use separately tested custom authentication |
| Hosted migration | `20260802075349` |

The 103 advisor warnings are an inventory of privileged RPC entry points, not a blanket waiver. Existing executable contracts reject `PUBLIC` execution, constrain the sole anonymous projection, require fixed search paths, require request identity, reject dynamic SQL, and rehearse cross-tenant behavior. After the candidate migration is deployed, the advisor and hosted SQL contracts must be rerun. Any new category, count drift without explanation, PUBLIC grant, missing identity binding, dynamic SQL, or policyless RLS surface is a HOLD.

## Edge Function boundary

JWT remains enabled for:

- `ai-learning-router` v222;
- `ai-learning-router-browser` v170;
- `marketplace-seller-onboarding` v18;
- `marketplace-checkout` v17;
- `marketplace-refund` v14;
- `secure-upload-session` v2;
- `secure-upload-complete` v2; and
- `secure-file-delete` v2.

The two expected non-JWT exceptions are `stripe-webhook` v16, which verifies the raw Stripe signature, and `staging-lifecycle-evidence` v3, which is manual, staging-bound, shared-secret protected, production-project rejecting, synthetic-only, metadata-only, and cleanup-tested. A third exception, a weakened check, a browser-exposed secret, or a production target is a HOLD.

## Repository and software-supply-chain evidence

- `staging` and `main` require a pull request, strict current success of `Validate current change`, `Test security services`, and `Rehearse student-data database gates`, resolved conversations, stale-review dismissal, administrator enforcement, and prohibit force pushes and deletion.
- All external GitHub Actions in the candidate are pinned to full 40-character commit SHAs, with readable release comments. CI rejects a mutable action reference.
- Workflow defaults are read-only. Write permissions are isolated to the container publish job, Pages deploy job, and deployment-status branch job that require them.
- `npm audit --json` reported 0 of 161 dependencies with known vulnerabilities: 0 critical, 0 high, 0 moderate, 0 low, and 0 informational.
- The protected security job tests archive inspection, EduBook conversion, Edge Function type checks, LTI claims and cryptography, deletion failure handling, and staging-evidence guardrails.
- Native GitHub secret scanning, push protection, Dependabot security updates, and repository-enforced action SHA pinning are currently disabled. The prior exact-tree/full-history credential-scan fallback remains the accepted preparation evidence; do not treat it as equivalent to continuous native scanning.

## Authentication, authorization, and data boundary

1. The browser receives only the environment Supabase URL and publishable browser key. Service-role credentials, AI provider keys, Stripe secret keys, webhook secrets, and evidence-runner secrets remain server-side.
2. Supabase Auth supplies request identity. Explicit grants and RLS are separate controls; privileged RPCs must perform their own tenant and capability checks.
3. The current Security Advisor snapshot has no leaked-password-protection warning. The setting must be checked again at the final decision because it is dashboard-controlled rather than repository-controlled.
4. The six Storage buckets are private. Object access remains purpose-scoped and signed/download-mediated; bucket privacy does not replace `storage.objects` policies or server authorization.
5. AI provider selection, credentials, quotas, and fallback policy stay in the TOS governed router. Human review remains mandatory, and prompt/provider response bodies must not be persisted.
6. Stripe remains test mode. Stripe Connect collects seller identity and bank details; EdNotebook must not collect or log bank credentials. Live charging and payout activation require their separate controls.

## Required post-merge evidence

The candidate is not decision-ready until all items below are captured against the same protected staging commit:

- [ ] All three protected GitHub checks pass on the pull request and merge commit.
- [ ] Migration `20260802190000_scope_catalog_review_previews.sql` is applied only to `gfalgonektwdylsxsgzc`.
- [ ] The complete rollback-safe `institution_student_data_safety.sql` harness passes with zero fixture residue.
- [ ] `security_advisor_contract.sql` passes against hosted staging.
- [ ] Live database summary is 160 of 160 application tables with RLS, 0 policyless-RLS surfaces, 0 PUBLIC-executable definers, exactly one anonymous catalog definer, 0 missing fixed search paths, 0 missing request-identity bindings, and 0 authenticated dynamic-SQL definers.
- [ ] Live Security Advisor is rerun; every remaining warning is reconciled by exact function and role.
- [ ] The anonymous catalog excludes review-stage data; the professor/author and platform owner retain governed review access; a different authenticated account does not.
- [ ] All Storage buckets remain private and the Edge Function JWT/custom-auth inventory is unchanged or explicitly reconciled.
- [ ] Dependency audit remains zero known vulnerabilities and the action-pin test passes.
- [ ] No production project, production credential, live charge, or real student record was used.

## Residual risks requiring an explicit reviewer decision

1. GitHub native secret scanning and push protection are disabled; the repository relies on a time-bound manual fallback.
2. Dependabot security updates are disabled. Dependency review is periodic rather than continuous.
3. Repository action-SHA enforcement is disabled. The candidate pins every current action, but the repository does not prevent a future reviewed pull request from changing a pin unless the static test remains required.
4. Required approving reviews remain zero because the repository currently has a single-owner deadlock exception. CI and branch protection do not substitute for independent security review.
5. Two Edge Functions intentionally use custom authentication instead of platform JWT; their signature/shared-secret contracts require continued tests and monitoring.
6. The 102 authenticated SECURITY DEFINER RPCs are a large privileged surface. The executable contract provides broad invariants, but each new or materially changed RPC still needs tenant-specific review and negative tests.
7. The scheduled retention workflow targets the existing production retention endpoint. It is outside this staging candidate and must not be represented as production validation or modified from this gate.
8. Supabase, GitHub, Stripe, Blackboard, AI providers, and email/calendar providers retain provider-controlled logs, backups, caches, and operational copies under their own controls.
9. `blackboardRoundTrip` and ASU-specific institution review remain parked external items; they do not authorize or block synthetic staging security work, but they remain independent production-intake blockers.

## Rollback, revocation, and incident boundary

- Revert frontend/workflow code only through a protected pull request; never rewrite protected history.
- Correct database behavior through a separately reviewed forward migration. A frontend revert does not reverse a deployed migration.
- Disable an affected Edge Function or governed feature, rotate the specific server secret, and preserve sanitized metadata if authentication, authorization, or provider integrity drifts.
- Keep AI output in human review and disable the affected provider/route rather than using an ungoverned browser fallback.
- Keep Stripe in test mode and disable commerce routes if webhook, entitlement, refund, dispute, tax, or payout controls drift.
- Production student intake remains disabled. Stop synthetic testing and escalate immediately if real student data, a credential, cross-tenant access, or production-project use is suspected.
- Append a superseding HOLD or FAIL evidence version when facts change; never rewrite or delete the earlier evidence record.

Do not place credentials, signatures, prompt bodies, provider response bodies, student content, private security findings, or confidential institution records in GitHub, logs, artifacts, SQL output, or chat.

## Human decision record

Complete this record in an institution-controlled ticket or signed decision artifact. Do not put a signature or private reviewer contact information in the public repository.

| Decision field | Required reviewer entry |
| --- | --- |
| Decision | `PASS`, `HOLD`, or `FAIL` |
| Reviewer name |  |
| Title, unit, and security authority |  |
| Timestamp and timezone |  |
| Exact protected staging merge commit |  |
| Hosted migration accepted |  |
| Environment accepted | `gfalgonektwdylsxsgzc`, `us-east-1` |
| Evidence/ticket reference |  |
| Advisor and RPC reconciliation accepted |  |
| Residual risks accepted or conditioned |  |
| Incident owner and escalation route |  |
| Effective date |  |
| Review/expiry date |  |
| Revocation trigger |  |
| Attestation | “I reviewed the exact candidate, environment, evidence, residual risks, and incident boundary and am authorized to make this security decision.” |

## Recording rule after a valid decision

Only an authorized, signed-in human may append the decision through `record_student_data_intake_evidence(...)`. A PASS must use `gate_key = securityApproval`, bind the exact protected merge commit and hosted migration, use a durable institution-controlled evidence reference, contain metadata only, expire no later than the earliest underlying evidence, and set the human attestation. An incomplete or conditional review is HOLD. Production student intake remains disabled even after this single gate passes.

## Current outcome

**HOLD.** The candidate closes the identified catalog and private answer-layer issues and assembles the evidence, but it is not yet merged, deployed, or rerun against hosted staging, and no accountable security reviewer has accepted the residual risk and incident boundary.
