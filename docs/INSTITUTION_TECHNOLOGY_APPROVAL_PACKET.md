# Institution technology approval packet

Status: **AWAITING ACCOUNTABLE INSTITUTION REVIEW — HOLD**

Prepared: 2026-08-02

Gate: `technologyApproval`

This packet prepares a human technology decision for the existing EdNotebook staging environment. It is not an institutional approval, does not record an immutable evidence row, does not enable production student intake, and does not authorize a production promotion.

## Decision requested

An accountable institution technology reviewer must decide whether the exact staging environment and technical candidate below are acceptable for continued synthetic staging and, subject to all other independent gates, later production-promotion review.

The reviewer may choose:

- **PASS** — accept the documented technology boundary and residual risks for the stated scope and period;
- **HOLD** — require named conditions before a decision; or
- **FAIL** — reject the candidate and identify the required remediation.

A repository merge or platform-owner approval is not a substitute for this decision. Only an authorized human reviewer who can accept technology risk for the institution may attest to `technologyApproval`.

## Candidate and environment binding

| Field | Bound value |
| --- | --- |
| Repository | `BREXAtlas/EdNotebook` |
| Technical evidence candidate | `9d6ecb1b878ef9445307a42bc1a86ee60abf84a9` |
| Current protected staging head at preparation | `7c9ffa83096835bf1cc1a73230354940e2502726` |
| Candidate relationship | The technical evidence candidate is an ancestor of the current staging head. The only intervening files are the 61-domain lifecycle matrix Markdown and CSV. |
| Current staging CI | GitHub Actions run `30741780208`, successful on 2026-08-02; all three protected checks passed. |
| Frontend staging route | `https://ednotebook.com/staging/` |
| Supabase staging project | `gfalgonektwdylsxsgzc` — EdNotebook TOS AI Staging |
| Supabase organization | `fzxjzpirfvhegpbpogww` |
| Region | `us-east-1` |
| Project health at preparation | `ACTIVE_HEALTHY` |
| Hosted PostgreSQL | `17.6.1.147`, PostgreSQL 17 GA |
| Latest hosted migration | `20260802075349_make_rls_deny_surfaces_explicit` |
| Recovery project | `pxicbctxmokbafynklhv`, isolated staging recovery evidence only |
| Production project | `didwxihufueqbpfnfdmm` — explicitly out of scope and unchanged |

At decision time, the reviewer must record the then-current protected `staging` head. If any application, migration, function, workflow, environment, or protection rule changed after this packet, the reviewer must reconcile that delta or place the decision on HOLD.

## Architecture boundary

1. GitHub Pages builds the production root from `main` and the sandbox at `/staging/` from protected `staging`. The environments share repository code but use separate Supabase projects and separate Auth users.
2. The browser receives only the staging Supabase URL and publishable browser key. Service-role credentials, AI provider keys, Stripe secret keys, webhook secrets, and evidence-runner secrets remain server-side.
3. Supabase Auth supplies the request identity. RLS, explicit grants, tenant-scoped SECURITY DEFINER RPCs, and Edge Function checks enforce authorization. The student-data governance tables are append-only and have no direct `anon` or `authenticated` write path.
4. The TOS AI Learning Router owns model policy, provider selection, quotas, and provider credentials. AI output remains draft material requiring human review; prompt and provider response bodies must not be persisted.
5. Stripe Connect test mode owns seller identity and bank-account collection. EdNotebook does not collect bank credentials. Live charging and payouts remain outside this approval packet.
6. Synthetic/public staging data only is authorized. Student records, grades, private messages, credentials, confidential institutional content, and human-subjects research data remain prohibited.

## Deployed server-function inventory

The following versions were active in staging when the packet was prepared:

| Function | Version | Platform JWT | Authentication boundary |
| --- | ---: | --- | --- |
| `ai-learning-router` | 222 | required | Authenticated server-side governed AI route |
| `ai-learning-router-browser` | 170 | required | Authenticated browser gateway; no provider secret in the client |
| `marketplace-seller-onboarding` | 18 | required | Authenticated seller and Stripe Connect onboarding |
| `marketplace-checkout` | 17 | required | Authenticated test-mode checkout |
| `marketplace-refund` | 14 | required | Authenticated governed refund route |
| `secure-upload-session` | 2 | required | Authenticated private upload reservation |
| `secure-upload-complete` | 2 | required | Authenticated checksum-bound upload completion |
| `secure-file-delete` | 2 | required | Authenticated request surface; worker permissions remain separate |
| `stripe-webhook` | 16 | not used | Expected exception: verifies the raw request with `STRIPE_WEBHOOK_SECRET` and Stripe's signature constructor before processing. |
| `staging-lifecycle-evidence` | 3 | not used | Expected exception: manual staging-only workflow, constant-time shared-secret check, production-project rejection, synthetic fixtures, metadata-only output, and cleanup. |

`verify_jwt=false` is not blanket anonymous trust. The two exceptions require their named custom authentication contracts. Any additional non-JWT function, weakened secret check, production target, scheduled evidence execution, or browser-exposed secret invalidates this packet.

## Evidence available to the reviewer

The append-only staging readiness registry currently contains eight passed technical gates and one external HOLD:

| Gate | Current result | Evidence boundary |
| --- | --- | --- |
| `repositoryValidation` | PASS | Candidate `9d6ecb1`; protected run `30738634823`; all required CI jobs, builds, migration rehearsal, focused tests, and accepted manual credential scan passed. |
| `protectedReleaseBranch` | PASS | `staging` and `main` require pull requests, strict current checks, resolved conversations, stale-review dismissal, admin enforcement, and prohibit force pushes/deletion. |
| `securityAdvisors` | PASS | No error, unexpected, policyless-RLS, PUBLIC-execute, leaked-password, dynamic-SQL, or request-identity-binding exception remained; the intentional public catalog projection was reviewed. |
| `performanceAdvisors` | PASS | Zero warnings after resolving the 13 auth RLS init-plan findings; remaining INFO items require workload/query-plan evidence before index changes. |
| `databaseRestore` | PASS | 50 canonical domains and 23 rows reconciled by counts and SHA-256 after restore to the recovery project; Auth/password data excluded; temporary access and raw dumps removed. |
| `storageRestore` | PASS | Three synthetic private objects, 232 bytes, reconciled by path, length, and SHA-256; anonymous reads denied; fixtures removed. |
| `crossTenantAccess` | PASS | Twelve hosted synthetic isolation groups passed; all fixtures rolled back and residue was zero. |
| `storageDeletionRetention` | PASS | Ten real synthetic upload, delete, retain, legal-hold, audit, and cleanup checks passed with zero independent residue. |
| `blackboardRoundTrip` | HOLD | ASU request `REQ0330327` is pending. No institution-controlled Blackboard import/re-download, LTI deployment, or AGS sync has occurred. |

The eight PASS records expire on 2026-10-31 UTC. A decision made after an evidence expiry, material configuration drift, or an unresolved new advisor finding must be HOLD until refreshed.

## Current branch controls

At preparation, `staging` enforced:

- strict success of `Validate current change`, `Test security services`, and `Rehearse student-data database gates`;
- pull-request updates and resolved review conversations;
- stale-review dismissal and administrator enforcement;
- no force pushes and no branch deletion; and
- a zero approving-review count solely for the documented single-owner deadlock exception.

The zero-review exception preserves a deliberate owner merge but is not institutional technology approval. Add an accountable required reviewer when a second maintainer is available.

## Data governance and fail-closed status

- All 61 active lifecycle domains are inventoried.
- Current immutable institution-approved lifecycle policies: **0 of 61**.
- The preparation matrix proposes 45 review candidates and leaves 16 blocked pending institutional, provider, technical, legal, research, finance, or records decisions.
- Current accountable human approvals: Technology, Privacy/Records, Accessibility, and Security are all missing.
- The readiness function therefore returns HOLD, and `production_student_intake_enabled` remains hard-coded `false`.
- The subject-request planner may inventory a request but cannot approve a worker, delete an Auth user, or execute a lifecycle disposition.
- Digital Literacy ordinary coursework and optional human-subjects research are separate. Research remains off without an exact written IRB/HRPP determination and separately activated project version.

Technology PASS alone cannot satisfy the missing lifecycle policies, Blackboard round trip, Privacy/Records approval, Accessibility approval, Security approval, research authorization, or later production-promotion decision.

## Residual risks requiring explicit acceptance or conditions

1. **Institutional integration pending.** Blackboard/LTI round-trip evidence is missing and remains an external HOLD.
2. **Lifecycle execution incomplete.** The 61-domain matrix is preparation only; no institution-approved retention/disposition versions or full lifecycle worker exist.
3. **Single-owner repository.** Branch protection has no mandatory approving reviewer today. Required checks and administrator enforcement remain active.
4. **Credential scanning fallback.** GitHub native secret scanning is disabled; repository validation accepted an exact-tree and full-history manual scan fallback.
5. **Custom-auth endpoints.** Stripe webhooks and manual lifecycle evidence intentionally bypass platform JWT and depend on their separately tested signature/secret boundaries.
6. **Provider-controlled copies.** Supabase logs/backups/caches, Stripe events, Blackboard copies, and LTI-platform copies cannot be represented as deleted without provider evidence.
7. **Performance INFO inventory.** Remaining index findings are not defects by themselves, but must be monitored with real workload and query-plan evidence before production intake.
8. **Monitoring API maintenance.** Operational scripts must not depend on the retired Supabase Management API `logs.all` endpoint; new monitoring work must use the current logs API.
9. **Evidence freshness.** Technical evidence is time-bound and must be refreshed after material drift or no later than its recorded expiry.

## Required technology-review checks

The reviewer must verify and document all applicable items:

- [ ] Reviewer is authorized to accept technology risk for the institution.
- [ ] Exact repository commits, migration, project references, region, and function versions are reconciled.
- [ ] Production project `didwxihufueqbpfnfdmm` was not used or changed for this gate.
- [ ] Browser configuration contains no server credential or provider secret.
- [ ] JWT-required functions remain JWT-required and the two custom-auth exceptions remain narrowly bounded.
- [ ] RLS, explicit grants, tenant isolation, request-identity binding, and append-only evidence behavior are acceptable.
- [ ] Database recovery and private-object recovery evidence are acceptable and operational ownership is assigned.
- [ ] Deletion, retention, legal-hold, audit, retry, cleanup, and incident escalation boundaries are acceptable.
- [ ] Branch protection, CI checks, credential scanning fallback, deployment ownership, and rollback procedures are acceptable.
- [ ] Advisor residuals, provider dependencies, monitoring, evidence expiry, and single-owner risk are explicitly accepted or conditioned.
- [ ] Synthetic-only staging remains the permitted data classification.
- [ ] Missing Blackboard, lifecycle-policy, Privacy/Records, Accessibility, Security, research, and production-promotion decisions remain independent blockers.

Any unchecked item must be listed as a condition or produce HOLD/FAIL.

## Rollback, revocation, and incident boundary

- **Frontend/code:** revert the exact staging change through a protected pull request and allow CI to redeploy. Do not rewrite protected history.
- **Database:** use a separately reviewed forward-fix migration. A frontend revert does not reverse a migration, and a database downgrade/restore is not the normal schema rollback path.
- **Edge Functions:** redeploy the last reviewed source as a new function version; restore JWT/custom-auth settings and verify the live version before reopening the route.
- **AI:** disable the affected feature/provider in the governed TOS router; retain human review and do not fall back to ungoverned browser calls.
- **Commerce:** keep Stripe test mode; disable checkout/onboarding routes if reconciliation, signature validation, entitlement, refund, dispute, tax, or payout controls drift.
- **Data intake:** remains disabled. Stop synthetic testing, revoke temporary access, preserve required evidence, and investigate any suspected real-data or cross-tenant event.
- **Approval:** append a superseding HOLD or FAIL evidence version if facts change. Never update or delete the prior evidence row.

Incident escalation must preserve sanitized metadata and audit references without placing credentials, prompt bodies, provider response bodies, student content, or confidential records in GitHub, logs, artifacts, or chat.

## Human decision record

Complete this section in an institution-controlled decision artifact or signed ticket. Do not place a signature, private contact information, or confidential security detail in the public repository.

| Decision field | Required reviewer entry |
| --- | --- |
| Decision | `PASS`, `HOLD`, or `FAIL` |
| Reviewer name |  |
| Title and authority |  |
| Institution/unit |  |
| Decision timestamp and timezone |  |
| Exact protected staging head |  |
| Technical evidence candidate | `9d6ecb1b878ef9445307a42bc1a86ee60abf84a9` |
| Hosted migration accepted | `20260802075349_make_rls_deny_surfaces_explicit` |
| Environment accepted | `gfalgonektwdylsxsgzc`, `us-east-1` |
| Evidence/ticket reference |  |
| Accepted residual risks |  |
| Conditions or prohibited actions |  |
| Operational owners and escalation route |  |
| Effective date |  |
| Review/expiry date |  |
| Revocation/rollback trigger |  |
| Attestation | “I reviewed the exact environment and evidence identified above and am authorized to make this institution technology decision.” |

## Evidence-recording rule after a valid PASS

Only after the accountable reviewer supplies a complete PASS decision may an authorized, signed-in human use the governed `record_student_data_intake_evidence(...)` RPC to append `technologyApproval` with:

- the institution ID;
- `gate_key = technologyApproval`;
- `status = passed`;
- a durable institution-controlled evidence/ticket reference;
- a summary of scope, decision, conditions, and prohibited actions;
- the exact protected staging commit and hosted migration;
- `environment_reference = supabase:gfalgonektwdylsxsgzc;github:BREXAtlas/EdNotebook;branch:staging`;
- `region = us-east-1`;
- a metadata-only evidence summary containing reviewer role/unit, decision timestamp, accepted component versions, residual-risk/condition counts, production untouched, and production intake disabled;
- an expiry no later than the earliest underlying evidence expiry or institution review date; and
- `attestation = true` entered by that authorized human.

Do not store a reviewer signature, email, private phone number, credential, student data, raw scan, prompt/response body, or confidential security finding in `evidence_summary`. If the decision is conditional or incomplete, append HOLD rather than PASS.

## Gate outcome at packet preparation

**HOLD.** The technology evidence is assembled and decision-ready, but no accountable institution technology reviewer has yet supplied the required decision. Production student intake remains disabled, production is untouched, and no `technologyApproval` evidence row has been recorded.
