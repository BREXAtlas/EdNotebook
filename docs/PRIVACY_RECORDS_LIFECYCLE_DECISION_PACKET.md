# Privacy/records approval and lifecycle-policy decision packet

Status: **AWAITING ACCOUNTABLE INSTITUTION REVIEW — HOLD**

Prepared: 2026-08-02

Gate: `privacyRecordsApproval`

Institution scope: EdNotebook staging institution `22222222-2222-4222-8222-222222222222`

This packet prepares the institution's privacy/records decision for all 61 active lifecycle domains. It does not provide legal advice, does not substitute for the institution's Records Management Officer, Registrar, Privacy/FERPA official, legal counsel, or other named record owner, and does not record a Supabase policy or evidence row.

Substantive review recommendations: [`PRIVACY_RECORDS_INSTITUTIONAL_REVIEW.md`](PRIVACY_RECORDS_INSTITUTIONAL_REVIEW.md) and [`privacy-records-institutional-review-recommendations.json`](privacy-records-institutional-review-recommendations.json). These recommendations do not populate or replace the institution's decision fields.

## Decision requested

The accountable institution reviewers must:

1. classify each lifecycle domain's privacy and official-record role;
2. accept, amend, or block the proposed disposition, trigger, retention period, authority, and exceptions;
3. resolve every mixed, permanent, provider-controlled, calendar/fiscal-year, legal-hold, research, and external-LMS boundary;
4. authorize the resulting 61 append-only policy versions; and
5. decide `privacyRecordsApproval` as PASS, HOLD, or FAIL only after the 61 decisions reconcile exactly.

The decision workbook is [`privacy-records-lifecycle-decision-workbook.csv`](privacy-records-lifecycle-decision-workbook.csv). It is derived from the governed proposal in [`student-data-lifecycle-policy-matrix.csv`](student-data-lifecycle-policy-matrix.csv) and contains blank institution-decision fields. Blank fields are intentional and cannot be treated as approval.

## Exact readiness boundary

| Field | Value at preparation |
| --- | --- |
| Protected staging head | `4d4463927063f3de6ccc0127d6293112af272e8f` |
| Existing staging project | `gfalgonektwdylsxsgzc` |
| Region | `us-east-1` |
| Production project | `didwxihufueqbpfnfdmm` — out of scope and unchanged |
| Active lifecycle domains | 61 |
| Current lifecycle policy rows | 0 |
| Current approved lifecycle policies | 0 of 61 |
| Current passed evidence gates | 9 of 13 |
| Missing evidence gates | `privacyRecordsApproval`, `accessibilityApproval`, `securityApproval`, `blackboardRoundTrip` |
| Production student intake | disabled |

The technology gate passed for this synthetic-only staging boundary. That decision did not approve record classifications or retention periods and cannot be reused as Privacy/Records approval.

## Authority hierarchy

The reviewer must use the following order and document any conflict:

1. **Litigation, investigation, audit, public-information, FERPA access/correction, dispute, and research holds.** A hold prevents normal disposition until the authorized release and underlying record rule are satisfied.
2. **Federal and state law.** FERPA access, disclosure-record, correction-statement, re-disclosure, authentication, and studies requirements apply where EdNotebook maintains education records for the institution.
3. **The current certified ASU retention schedule.** The institution identifies the exact series, official-copy role, trigger, minimum period, archival review, and disposition-log requirement.
4. **Current Texas university minimums.** TSLAC's University Records Retention Schedule is a floor for Texas public universities and does not replace ASU's certified schedule.
5. **Institution contracts and approved policies.** Blackboard, LTI tools, Supabase, Stripe, research protocols, author agreements, and other processors may add restrictions; a vendor default cannot shorten an institutional minimum.
6. **Data minimization.** A governed convenience, processor, cache, preview, or operational copy should not outlive the need and must never outlive the applicable record copy unless separately reclassified.

### Authoritative source set checked on 2026-08-02

- [ASU University Records Retention Program](https://www.angelo.edu/community/west-texas-collection/university-records-retention-program.php): official versus convenience copies, certified schedule use, archival review, and disposition logs.
- [ASU certified Records Retention Schedule](https://www.angelo.edu/live/files/25124-angelo-state-university-737-records-retentio): the exact ASU series and triggers cited by the proposal.
- [Texas State Library University Records Retention Schedule](https://www.tsl.texas.gov/slrm/urrs): mandatory university minimums and FERPA disclosure-record series.
- [Texas certified agency and university schedule registry](https://www.tsl.texas.gov/slrm/state/schedules): current certification and recertification source.
- [FERPA regulations](https://studentprivacy.ed.gov/ferpa): 34 CFR §§99.10, 99.20–99.22, 99.30–99.32, 99.33, and 99.35.
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups): plan-based database recovery and the separate Storage-byte boundary.
- [Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs): database and external log copies that require separate configuration and retention review.
- [Stripe event destinations](https://docs.stripe.com/event-destinations): full-payload and summary availability windows; EdNotebook still must minimize its own webhook copy.
- [Blackboard course management](https://help.anthology.com/blackboard/administrator/en/courses-and-organizations/manage-courses.html) and [archive/restore guidance](https://help.anthology.com/blackboard/administrator/en/courses-and-organizations/create-courses/export%2C-archive%2C-and-restore-courses.html): institution-controlled completion, deletion, and archive copies.

Source links support review; they do not select a policy automatically. The accountable reviewer must verify that each source remains current when signing.

## Non-negotiable privacy and records rules

- An outstanding FERPA inspection request prevents destruction of the requested education record.
- A student's correction statement remains with the contested record and accompanies later disclosure for as long as that record is maintained.
- FERPA disclosure/request logs remain with the underlying education record for as long as that record is maintained.
- Directory information remains subject to the institution's annual notice and the student's opt-out; “public profile” does not mean unregulated.
- A research or studies disclosure requires the approved purpose, scope, duration, access limitation, and destruction period. Ordinary coursework cannot silently become research data.
- Legal holds, grade appeals, grievances, accommodations, audits, payment disputes, public-information requests, and investigations override routine expiration.
- De-identification requires a reasonable determination that identity is not recoverable from single or combined releases. Removing direct identifiers alone is not sufficient.
- Provider, backup, archive, cache, and downstream LMS copies require an outcome record. EdNotebook must not claim that an external copy was deleted without evidence.
- Content location is not a record class. Every production file, message, resource, learning event, and entitlement must inherit a governed type and owner before automatic disposition.
- No production deletion or anonymization worker may rely on the preparation matrix or this packet.

## Review workbook values

The institution completes these blank fields for every row:

| Field | Allowed or required value |
| --- | --- |
| `official_copy_role` | `institution_record_copy`, `governed_convenience_copy`, `processor_copy`, `transitory_derivative`, `provider_external_copy`, or `mixed_unresolved` |
| `privacy_classification` | `ferpa_education_record`, `directory_opt_out`, `financial_transaction`, `security_authentication`, `research_irb`, `public_non_education`, or `mixed_unresolved` |
| `reviewer_decision` | `approve_candidate`, `approve_amended`, or `block` |
| `approved_disposition` | `delete`, `anonymize`, `retain`, or `block` |
| `approved_retention_days` | Schema-valid integer for a final `delete`, `anonymize`, or time-bounded `retain`; blank for `block` |
| `approved_trigger` | Exact event from which the period is calculated, including “later of” conditions |
| `approved_authority_reference` | Exact ASU/TSLAC/FERPA/contract/protocol series or decision reference |
| `conditions_and_exceptions` | Holds, disputes, access requests, official-copy, provider, research, archive, and terminal-action rules |
| `reviewer_unit_role` | Accountable institutional role; do not place private contact details in the repository |
| `decision_date` | ISO date |
| `review_due_at` | ISO timestamp later than approval time |

For `approve_candidate`, the approved fields must still repeat the final values; the recorder may not infer them from the candidate columns. For `block`, use disposition `block`, leave days blank, identify the decision owner, and describe the evidence needed. A blocked policy records accountable review but does not count toward 61 approved domains.

## Calendar and fiscal-year encoding decision

Thirty-five of the 45 candidate-ready proposals translate one, two, three, four, five, or ten calendar/fiscal years to `365`, `730`, `1095`, `1460`, `1825`, or `3650` days. The deployed registry stores `retention_days` as an integer; it does not natively encode:

- calendar years and leap days;
- fiscal-year-end plus a number of years;
- academic-term or academic-year calculations;
- permanent retention;
- archival review or transfer; or
- “as long as the underlying record is maintained.”

The institution must choose and document one safe approach before approving those rows:

1. extend the policy/executor contract with calendar, fiscal, permanent, and linked-record bases; or
2. approve a conservative no-earlier-than day guardrail while requiring the eventual worker to calculate the authoritative calendar/fiscal due date and use the later date.

The worker must never delete on a fixed-day deadline that is earlier than the schedule's true due date. Permanent or linked-record retention cannot be approximated by the schema maximum. Until this issue is resolved, no calendar/fiscal-year candidate should be recorded as institution-approved.

## Sixteen unresolved domains

These rows remain `blocked_pending_review` in the proposal. Each needs the named evidence or product split before it can become an approved lifecycle policy.

| Domain | Required resolution |
| --- | --- |
| `auditEvents` | Separate FERPA disclosures, disposition logs, security audits, governance actions, and transitory events—or approve a safe longest-applicable rule. |
| `authIdentities` | Add status-aware account triggers and decide whether identity metadata is an official access record. |
| `authProviderLogs` | Record current Supabase log copies/TTLs, export path, security hold procedure, and deletion limit. |
| `blackboardProviderCopies` | Complete the ASU Blackboard round trip and obtain the institution's archive/deletion policy. |
| `learningMessages` | Classify routine, academic, accommodation, grievance, research, and legal messages at creation. |
| `learningResources` | Add type, owner, license, official-copy, publication, and archival-review metadata. |
| `legalHoldFiles` | Require written release, underlying series, and records-authorized post-release disposition. |
| `ltiProviderCopies` | Inventory every LTI tool, contract/DPA, retention rule, export path, and deletion confirmation. |
| `profile` | Design status-aware deprovisioning and field-level anonymization without breaking retained academic references. |
| `secureFiles` | Require a record class and reject unclassified production uploads. |
| `storageObjectVersions` | Inherit the source series, trigger, legal hold, archive rule, and verified byte-deletion outcome. |
| `studentGrades` | Decide whether EdNotebook is the permanent original grade sheet, a four-year grade book, or a governed convenience copy. |
| `studentLearningRecords` | Split permanent achievement, five-year progress, short-lived attempts/coursework, and separately governed research measures. |
| `studentPublicProfile` | Implement directory opt-out, status-aware lifecycle, field-level visibility, and anonymization. |
| `userAuthoredProfessorPublisherContent` | Approve authorship/rights, version, withdrawal, archive, purchase-access, and interactive learner-data rules. |
| `userEntitlements` | Split academic, free-public, purchase, rental, refund, and continuing/perpetual access. |

Do not mark these rows `approved` merely to satisfy the readiness count.

## Mechanical completion criteria

Before recording any policy batch:

- exactly 61 unique domain keys match the active staging registry, with no extra or missing key;
- all 61 institution-decision rows are completed by accountable roles;
- each approved row has an allowed disposition, schema-valid day guardrail where applicable, exact trigger, authority, conditions, reviewer role, decision date, and future review date;
- every calendar/fiscal/permanent/linked basis has an approved representation and no possible early-deletion path;
- each official or convenience copy designation is explicit;
- each `mixed_unresolved` classification remains blocked;
- each provider-controlled domain states what EdNotebook can delete, what the provider controls, how results are verified, and what residual copy remains;
- no policy overrides an access request, correction statement, disclosure log, legal hold, dispute, audit, public-information request, research protocol, or longer record series;
- the responsible second reviewer reconciles the completed workbook hash, Supabase rows, counts, versions, and statuses; and
- production, real student data, and automatic lifecycle execution remain disabled.

## Controlled recording procedure

After the institution signs the complete workbook:

1. Capture a SHA-256 digest and durable institution-controlled decision/ticket reference. Do not place signatures, student data, private contact information, or confidential legal/security details in GitHub or Supabase evidence metadata.
2. Re-read the live 61-domain registry and stop on any drift.
3. For each row, have an authorized signed-in human call `record_student_data_lifecycle_policy(...)` with the exact institution decision and `p_attestation = true`.
4. Use `status = approved` only for a complete final policy. Use `status = blocked` for an unresolved decision; do not combine `status = approved` with disposition `block`.
5. Verify that the append-only row, supersession link, audit event, reviewer identity, version, dates, and content match the signed workbook.
6. Reconcile exactly 61 current approved rows, zero missing/expired rows, allowed dispositions, and the workbook hash through a second human review.
7. Only then may the accountable Privacy/Records reviewer separately append `privacyRecordsApproval` through `record_student_data_intake_evidence(...)`, binding the exact protected commit, hosted migration, environment, workbook digest, 61-policy reconciliation, residual risks, expiry, and attestation.

Direct table inserts, service-role browser calls, automatic approval, inferred blank values, and bulk recording before the signed decision are prohibited.

## Privacy/records human decision record

Complete this in an institution-controlled signed artifact or ticket:

| Decision field | Required entry |
| --- | --- |
| Decision | `PASS`, `HOLD`, or `FAIL` |
| Reviewer roles and authority |  |
| Institution/unit |  |
| Decision timestamp and timezone |  |
| Exact protected staging head |  |
| Hosted migration |  |
| Completed workbook SHA-256 |  |
| Approved current policies | Must be 61 of 61 for PASS |
| Blocked/missing/expired policies | Must be 0 for PASS |
| Official-copy determinations |  |
| Calendar/fiscal/permanent encoding decision |  |
| FERPA access/correction/disclosure controls accepted |  |
| Provider residuals accepted |  |
| Research/IRB boundary accepted |  |
| Conditions or prohibited actions |  |
| Effective date |  |
| Review/expiry date |  |
| Evidence/ticket reference |  |
| Attestation | “We reviewed all 61 current domains and are authorized to approve the institution's privacy, records, retention, and disposition decisions for this scope.” |

## Gate outcome at packet preparation

**HOLD.** The 61-domain proposal is complete enough for accountable institutional review, but no lifecycle policy has been approved or recorded. The 16 unresolved domains and the 35 calendar/fiscal-year encodings require explicit resolution. `privacyRecordsApproval` must remain unrecorded until the completed workbook and 61 current policies reconcile. Production student intake remains disabled and production is untouched.
