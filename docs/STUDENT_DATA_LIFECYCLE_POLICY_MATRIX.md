# Student-data lifecycle policy matrix

Status: **platform-owner approved for governed review; lifecycle policies are not institutionally approved or recorded in Supabase**

Artifact approval: platform owner authorized publication on 2026-08-02

Scope: EdNotebook staging institution `22222222-2222-4222-8222-222222222222`

Registry source: the 61 active rows deployed in `public.student_data_lifecycle_domains`

Matrix: [`student-data-lifecycle-policy-matrix.csv`](student-data-lifecycle-policy-matrix.csv)

Institution decision workbook: [`privacy-records-lifecycle-decision-workbook.csv`](privacy-records-lifecycle-decision-workbook.csv)

Privacy/records gate: [`PRIVACY_RECORDS_LIFECYCLE_DECISION_PACKET.md`](PRIVACY_RECORDS_LIFECYCLE_DECISION_PACKET.md)

## Review outcome

The matrix covers all 61 deployed lifecycle domains exactly once. It proposes 45 policies that are sufficiently bounded to enter institutional review and leaves 16 domains blocked pending an explicit institutional, provider, technical, legal, or research decision.

| Outcome | Count | Meaning |
| --- | ---: | --- |
| `candidate_ready` | 45 | A disposition, day count, trigger, authority, owner, and exception boundary are proposed. This is not approval. |
| `blocked_pending_review` | 16 | One day count would be unsafe, provider behavior is not yet evidenced, or the record's official-copy/content role is unresolved. |
| **Total** | **61** | Must match the deployed active registry before any approval session. |

The production-readiness decision remains **HOLD**. No immutable `student_data_lifecycle_policy_versions` rows were inserted. The database accepts only append-only `approved` or `blocked` human-attested versions; it has no draft state, so a review document is the safe preparation surface.

## Blocking decisions

1. **Official record-copy designation.** ASU must state whether EdNotebook is the official copy, a convenience copy, or a reconstruction aid for grades, rosters, progress, course work, and Blackboard/LTI transfers. The distinction changes retention materially: for example, the ASU schedule lists grade books at end-of-semester plus four years while original grade sheets are permanent.
2. **Mixed domains must be split or use the longest applicable rule.** `auditEvents`, `learningMessages`, `learningResources`, `secureFiles`, `storageObjectVersions`, `studentLearningRecords`, and `userEntitlements` each contain records with incompatible triggers or periods.
3. **Identity lifecycle is status-aware.** ASU publishes different technology-account periods for applicants, admitted students, undergraduates, graduate students, and graduates. `profile`, `authIdentities`, and `studentPublicProfile` cannot safely use one global number until that status logic and field-level anonymization exist.
4. **Provider copies need operational evidence.** Supabase Auth logs, Blackboard copies, LTI-tool copies, Storage versions/caches, backups, and Stripe events have provider-controlled behavior. A local policy cannot claim those copies were destroyed without a verified provider outcome.
5. **Legal, dispute, access-request, and research overrides are mandatory.** No expiration may destroy a record under litigation, claim, audit, public-information request, administrative review, grade dispute, outstanding FERPA access request, or approved IRB/research protocol.
6. **Research is not silently folded into ordinary learning retention.** The Digital Literacy pilot must route consent, identifiable study data, de-identified exports, raw research data, and IRB records to the approved protocol. ASU requires IRB approval before human-subject data collection; its schedule lists raw research data and IRB records at project completion plus three years, while published research data may be permanent.
7. **Calendar and fiscal periods cannot be shortened by fixed-day conversion.** Thirty-five candidate rows currently express one, two, three, four, five, or ten years as a fixed number of days. The records reviewers must approve a calendar-aware representation or a conservative no-earlier-than guardrail before those candidates can become institution-approved policies.

## Governing interpretation

- The ASU certified schedule controls official university record copies. ASU describes convenience copies as disposable earlier but never retainable longer than the record copy. Destruction or archival transfer of an official copy must be documented on a disposition log.
- FERPA covers records directly related to a student and maintained by the institution or a party acting for it. An outstanding access request prevents destruction. Disclosure/access records stay with the underlying education record as long as that record is maintained.
- A lifecycle day count is measured only after its stated trigger. Legal holds and the longer applicable record class suspend or supersede the proposed clock.
- `delete` means verified deletion across canonical rows, Storage bytes, derivatives, and governed downstream copies. `retain` means retain for the stated minimum and then perform the authorized terminal action; it does not mean retain forever. `block` means no automated terminal action.
- De-identification is not assumed merely because direct identifiers are removed. The research/privacy reviewer must approve the de-identification method and re-identification risk before a separate aggregate dataset is retained.

## Evidence-key index

| Evidence key | Authoritative source and relevant point |
| --- | --- |
| `ASU-RRP` | [ASU University Records Retention Program](https://www.angelo.edu/community/west-texas-collection/university-records-retention-program.php): certified schedule, official versus convenience copy, disposition log, and archival review. |
| `ASU-RRS-*` | [ASU certified Records Retention Schedule](https://www.angelo.edu/live/files/25124-angelo-state-university-737-records-retentio): litigation/audit hold caution; course records 6.3/67; student course work 6.6/375; research/IRB 6.4/285-287; class rolls 6.3/66; academic progress 6.6/311; grade books 6.6/347; original grade sheets 6.6/350; disposition logs 1.2/010; security access 5.4/012; financial records 4.1-4.4. |
| `ASU-ACCOUNT-RETENTION` | [ASU Student Technology Access Accounts](https://www.angelo.edu/administrative-support/information-technology/network/accounts/student/): status-specific 30/60/90/365-day account windows and permanent deletion after notice. |
| `ASU-IRB` | [ASU Protection of Human Subjects](https://www.angelo.edu/research/compliance/protection/human-subjects.php): IRB review and approval before human-subject data collection and required CITI training. |
| `FERPA-99.10(e)` / `FERPA-99.32` / `FERPA-DIRECTORY` | [U.S. Department of Education FERPA regulations](https://studentprivacy.ed.gov/ferpa): no destruction during an outstanding access request; disclosure-record retention; directory-information conditions. |
| `FERPA-THIRD-PARTY` | [U.S. Department of Education third-party provider responsibilities](https://studentprivacy.ed.gov/resources/responsibilities-third-party-service-providers-under-ferpa): service-provider handling of education-record PII. |
| `FERPA-DATA-DESTRUCTION` | [U.S. Department of Education data retention and destruction](https://studentprivacy.ed.gov/training/data-retention-and-data-destruction): governed minimization and destruction across the data lifecycle. |
| `SUPABASE-BACKUPS` | [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups): Pro daily-backup access for seven days; database backups exclude Storage object bytes. |
| `SUPABASE-AUTH-AUDIT` / `SUPABASE-LOGS` | [Supabase Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs) and [Logging](https://supabase.com/docs/guides/telemetry/logs): database versus external audit-log storage and plan-controlled log retention. |
| `SUPABASE-STORAGE-DELETE` / `SUPABASE-SMART-CDN` | [Supabase Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects) and [Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn): use the Storage API for byte deletion; cache invalidation and browser-TTL boundaries. |
| `STRIPE-EVENT-RETENTION` / `STRIPE-DPA` | [Stripe event destinations](https://docs.stripe.com/event-destinations) and [Stripe DPA](https://stripe.com/legal/dpa): full event payload access window, processor/controller obligations, and legally permitted residual retention. |
| `ANTHOLOGY-FERPA` / `ANTHOLOGY-ARCHIVES` | [Anthology Blackboard FERPA guidance](https://help.anthology.com/blackboard/administrator/en/security/privacy/u-s--privacy-definitions-and-regulations-relevant-to-blackboard.html) and institutional archive guidance: Blackboard course participation is education-record data; the institution controls archive policy. |
| `1EDTECH-SECURITY` | [1EdTech Security Framework](https://www.1edtech.org/standards/security-framework): LTI authentication/authorization and protected PII exchange boundaries. |

## Approval sequence

1. Records/Registrar marks the record-copy role and exact ASU series/trigger for every academic domain.
2. Privacy reviews FERPA access, directory opt-out, minimization, subject requests, and de-identification.
3. Technology and Security verify scheduled deletion, anonymization, cache invalidation, provider TTLs, exports, legal holds, and evidence capture.
4. LMS owner completes the pending Blackboard round-trip and documents Blackboard/LTI provider retention.
5. IRB/research owner approves a separate protocol-specific policy before Digital Literacy pilot data collection.
6. Finance/Tax and Library/Publishing approve commerce, entitlement, rights, refund/dispute, and financial-record triggers.
7. Only after those decisions should an authorized human record immutable `approved` or `blocked` versions through `record_student_data_lifecycle_policy(...)` with attestation. A second reviewer should reconcile the resulting 61 current versions against this matrix and the readiness report.

## Mechanical acceptance checks

- Exactly 61 unique domain keys and no key outside the deployed active registry.
- Each candidate has one allowed disposition, a schema-valid day count, a non-empty trigger, purpose, evidence reference, review note, and accountable owner.
- Each blocked domain uses `block` with no day count and states the decision needed to unblock it.
- No policy bypasses an outstanding FERPA access request, legal hold, dispute, audit, public-information request, research protocol, or longer applicable series.
- No provider-controlled row claims verified deletion without provider evidence.
- No fixed-day value can expire a calendar-year, fiscal-year, permanent, archival, or linked-record obligation early.
- No production change, student-data intake, or automatic lifecycle execution occurs merely because this preparation matrix exists.
