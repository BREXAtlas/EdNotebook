# Privacy and records institutional review

Status: **PLATFORM BASELINE REVIEW COMPLETE — ASU ADOPTION PENDING**

Review date: 2026-08-02

Protected staging boundary: `0398bbb2b1237d93bd287b02d3c76e1dea81bebc`

Institution scope: EdNotebook staging institution `22222222-2222-4222-8222-222222222222`

This is an evidence-based institutional review recommendation, not a legal opinion or institutional signature. Codex reviewed all 61 active lifecycle domains, their proposed record series, triggers, dispositions, product behavior, provider boundaries, and FERPA implications. Only an authorized Angelo State University Records Management Officer, Registrar, FERPA/Privacy official, counsel, and the named functional owners can adopt or amend these recommendations and attest for the institution.

Machine-readable recommendations: [`privacy-records-institutional-review-recommendations.json`](privacy-records-institutional-review-recommendations.json)

Institution decision workbook, still intentionally unsigned: [`privacy-records-lifecycle-decision-workbook.csv`](privacy-records-lifecycle-decision-workbook.csv)

## Review decision

**Continue the EdNotebook staging workflow. Do not record ASU lifecycle policies or `privacyRecordsApproval` yet.**

The unresolved ASU records questions are a separate institutional-adoption track. They do not block continued synthetic-only staging work, the security and accessibility gates, Blackboard round-trip evidence, or product improvements. They do block ASU-specific policy recording, real student-data intake, and production promotion.

The review produced:

| Recommendation | Domains | Meaning |
| --- | ---: | --- |
| Accept candidate | 10 | The proposed short-lived operational/provider boundary is reasonable if the listed condition is confirmed. |
| Accept with amended no-earlier-than guardrail | 23 | The record series is reasonable, but fixed-day values must be lengthened and the exact calendar/fiscal/academic trigger preserved. |
| Hold | 28 | The domain combines record classes, lacks an official-copy decision, depends on external-provider evidence, or requires a product/data split. |
| **Total reviewed** | **61** | Exact match to the active governed registry. |

All 33 acceptance recommendations are provisional. They are not institution-approved policies until the accountable roles adopt them in the signed workbook.

## ASU-specific pending item: operative schedule confirmation

The Texas State Library and Archives Commission's current certified-schedule registry links the posted Angelo State University schedule as approved on 2017-11-14 and shows `2022-11` as the next recertification date. The registry does not display a later approval or amendment. This review therefore cannot represent the linked schedule as currently recertified without confirmation from ASU's Records Management Officer or TSLAC.

Before any ASU policy is recorded, ASU must provide one of the following:

1. the current recertified ASU schedule and effective date;
2. written confirmation from the ASU Records Management Officer that the posted schedule remains the operative certified schedule while recertification is pending; or
3. an authorized crosswalk to the current Texas URRS and any approved ASU-specific extensions.

Texas requires public universities to meet the current URRS minimums, and a record series absent from a certified schedule cannot be destroyed without special permission. Track this ambiguity as an ASU adoption dependency rather than a blocker for unrelated staging gates.

## Authorities applied

- [ASU Records Retention Program](https://www.angelo.edu/community/west-texas-collection/university-records-retention-program.php): official records follow the ASU schedule, archival items require transfer or review, and disposition must be logged. Convenience copies cannot outlive the record copy.
- [Posted ASU schedule](https://www.angelo.edu/live/files/25124-angelo-state-university-737-records-retentio): source for the ASU record-series proposals, including one-year coursework, four-year grade books, permanent original grade sheets, five-year academic progress, and research/IRB rules.
- [TSLAC certified-schedule registry](https://www.tsl.texas.gov/slrm/state/schedules): confirmation source for ASU schedule status and recertification.
- [Texas University Records Retention Schedule](https://www.tsl.texas.gov/slrm/urrs): mandatory minimum floor, official-record terminology, calendar/fiscal triggers, permanent records, archival review, FERPA disclosures, correction statements, and nondisclosure requests.
- [FERPA regulations](https://studentprivacy.ed.gov/ferpa): an outstanding access request prevents destruction; correction statements and disclosure records follow the underlying education record; studies require written scope, limited access, and destruction when no longer needed.
- [Supabase changelog](https://supabase.com/changelog?types=breaking-change): current provider-change review. No current platform change authorizes or executes these lifecycle recommendations.

## Institutional interpretations recommended

### EdNotebook's default academic role

Treat EdNotebook as a **governed convenience/processor copy**, not the permanent system of record, unless the Registrar explicitly designates a domain otherwise. This is especially important for grades, rosters, academic outcomes, and Blackboard/LTI exports. A convenience copy must not survive the official record and must not be the only place the institution can reconstruct a required record.

### FERPA and records overrides

Every accepted policy must use the later of its ordinary due date and any applicable:

- outstanding FERPA inspection or amendment request;
- correction statement or disclosure-log linkage;
- grade appeal, grievance, accommodation, or academic dispute;
- litigation, audit, investigation, public-information, or administrative hold;
- IRB protocol or written studies/evaluation agreement;
- financial audit, refund, chargeback, tax, or payment dispute;
- archival review or transfer; and
- longer official-record or provider-contract obligation.

### Calendar and fiscal periods

For the 23 provisionally accepted calendar/fiscal rows, use these conservative minimum day guardrails:

| Proposed period | Recommended minimum guardrail |
| ---: | ---: |
| 365 days / one year | 366 days |
| 730 days / two years | 731 days |
| 1095 days / three years | 1096 days |
| 1460 days / four years | 1461 days |
| 1825 days / five years | 1827 days |
| 3650 days / ten years | 3653 days |

These values prevent a fixed-day conversion from expiring before a calendar-year minimum. They do not replace the official trigger. Any eventual executor must calculate and store the authoritative calendar, fiscal, academic, permanent, archival, or linked-record due date and use whichever date is later. Automatic execution remains prohibited until that behavior is implemented and tested.

### Classification vocabulary

The preparation workbook's privacy vocabulary is too narrow for all 61 domains. Add these governed classifications before institutional adoption:

- `inherited_from_source` for derivatives, backups, and caches;
- `records_governance` for disposition and privacy-request evidence;
- `operational_system` for payload-free jobs and quotas;
- `personal_information_non_education` for pre-affiliation inquiries; and
- `intellectual_property_commercial` for professor/publisher works and rights.

These additions prevent operational, publishing, and governance records from being mislabeled as public or FERPA records merely to fit the form.

## Ten candidate policies recommended without period amendment

| Domain | Recommended role/classification | Required condition |
| --- | --- | --- |
| `authSessions` | Transitory / security authentication | Expiry or revocation controls and separate incident evidence. |
| `filePreviews` | Transitory / inherit source | Seven-day outer bound and every source hold/access rule. |
| `linkPreviews` | Transitory / inherit source | No private-source snapshots and seven-day deletion. |
| `ltiLaunchSessions` | Transitory / security authentication | Thirty-day outer bound; incidents classified separately. |
| `processingJobs` | Transitory / operational | No payload copies in queues, retries, dead letters, or logs. |
| `providerBackups` | Provider copy / inherit source | Verify plan, seven-day rolling period, and Storage separately. |
| `storageDeliveryCaches` | Transitory / inherit source | One-day purge and CDN deletion evidence. |
| `stripeWebhookPayloads` | Processor / financial | Thirty-day payload limit after normalized reconciliation. |
| `unlinkedPortalInterestSubmissions` | Processor / non-education personal information | Thirty-day limit and minimal lawful suppression handling. |
| `uploadQuotaReservations` | Transitory / operational | One-day limit and abandoned-upload cleanup. |

## Twenty-three policies recommended with amended guardrails

| Guardrail | Domains |
| ---: | --- |
| 366 days | `assignmentDrafts`, `courseCommunicationReads` |
| 731 days | `blackboardIdentityMappings`, `courseCommunicationPreferences`, `educatorVerificationRequests`, `gradeShareLinks`, `identityOnboardingRequests`, `institutionAccessApplications`, `learningSystemIdentifiers`, `ltiUserMappings`, `userFeaturePolicies` |
| 1096 days | `billingCustomers`, `billingSubscriptions` |
| 1827 days | `courseLessonProgress`, `courseMemberships`, `courseProgress`, `institutionTransferRequests`, `ltiContextMemberships`, `studentEnrollmentRequests`, `studentRosterEntries` |
| 3653 days | `fileDeletionRequests`, `studentDataSubjectRequestItems`, `studentDataSubjectRequests` |

The exact trigger and domain-specific condition in the recommendation artifact remain mandatory. The guardrail alone is not a complete policy.

## Twenty-eight domains held after review

The original 16 holds remain valid:

- `auditEvents`
- `authIdentities`
- `authProviderLogs`
- `blackboardProviderCopies`
- `learningMessages`
- `learningResources`
- `legalHoldFiles`
- `ltiProviderCopies`
- `profile`
- `secureFiles`
- `storageObjectVersions`
- `studentGrades`
- `studentLearningRecords`
- `studentPublicProfile`
- `userAuthoredProfessorPublisherContent`
- `userEntitlements`

The substantive review adds 12 holds that the initial matrix treated as candidate-ready:

| Domain | Reason for added hold |
| --- | --- |
| `assignmentDocumentFeedback` | Graded-performance reconstruction may be a four-year grade book; ordinary coursework feedback may be one year. |
| `assignmentFormSubmissions` | Graded, ungraded, and research-routed submissions require separate policies. |
| `blackboardGradeExportSnapshots` | Blackboard round trip and original-grade-sheet designation remain unresolved. |
| `institutionAffiliations` | Student, employee, contractor, guest, and publisher relationships have different rules. |
| `institutionMemberships` | Academic and nonacademic memberships require separate triggers and owners. |
| `ltiGradeSyncEvents` | Grade-book evidence and reconciliation telemetry are not the same record. |
| `publicationEntitlements` | Free academic, purchase, rental, refund, and continuing access must be separated. |
| `readingAnnotations` | Private notes, assessed annotations, accommodations, and research measures differ. |
| `studentEducationPath` | Temporary planning, advisement, progress, and permanent outcomes differ. |
| `studentGroupMemberships` | Academic, assessed, optional social, and official-organization memberships differ. |
| `studentGroups` | Disposable course structures and historically significant organizations differ. |
| `studentPosts` | Public/social posts, assessed discussions, grievances, and research posts differ. |

## Required accountable adoption

The authorized reviewers must now:

1. confirm the operative ASU retention schedule;
2. accept or amend the five added classifications;
3. adopt, amend, or reject each of the 61 recommendations in the institution workbook;
4. name the official system of record for grades, rosters, outcomes, Blackboard/LTI exports, privacy requests, disposition logs, research records, and commercial entitlements;
5. authorize the 12 additional domain splits and the 16 existing unresolved controls;
6. sign the exact workbook digest with roles, decision date, review date, conditions, and ticket/reference; and
7. return the completed artifact for a second-person mechanical reconciliation.

Only after those steps may an authorized signed-in human record append-only ASU staging policies. `privacyRecordsApproval` requires 61 of 61 current approved policies and must remain unrecorded while any domain is held. Other controlled staging gates may proceed independently with synthetic data.

## Environment outcome

- No lifecycle policy was recorded.
- No privacy/records evidence row was recorded.
- No automatic deletion or anonymization was enabled.
- Production student intake remains disabled.
- Production project `didwxihufueqbpfnfdmm` was not accessed or changed.
