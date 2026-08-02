# Accessibility approval evidence packet

Status: **AWAITING ACCOUNTABLE ACCESSIBILITY REVIEW — HOLD**

Prepared: 2026-08-02

Gate: `accessibilityApproval`

This packet prepares an independent human accessibility decision for the existing EdNotebook staging environment. It is not a conformance claim, legal opinion, Accessibility Conformance Report (ACR), or production approval. It does not activate production student intake, authorize real student data, or change the production Supabase project.

## Decision requested

An accountable accessibility reviewer must record `PASS`, `HOLD`, or `FAIL` for the exact candidate below. The decision must cover the tested student, professor, publisher/library, writing, media, authentication, and administration journeys—not a single page or automated scan. A merge, successful CI run, feature label, or media-caption test must never be treated as accessibility approval.

## Candidate and environment binding

| Field | Bound value |
| --- | --- |
| Repository | `BREXAtlas/EdNotebook` |
| Protected staging candidate | `04927a1a6a286aeee0c0c6b273325521f1754727` (PR #109 merge) |
| Protected validation | GitHub Actions run `30767094365` — passed |
| Staging deployment | GitHub Actions run `30767158381` — passed |
| Live staging release record | `/staging/environment.json` reported source commit `04927a1a6a286aeee0c0c6b273325521f1754727` on 2026-08-02 |
| Staging frontend | `https://ednotebook.com/staging/` |
| Staging Supabase | `gfalgonektwdylsxsgzc`, `us-east-1` |
| Hosted candidate migration | `20260802210945_govern_security_approval_decision` |
| Production Supabase | `didwxihufueqbpfnfdmm` — out of scope and unchanged |
| Permitted data | Public and synthetic staging data only |

This packet becomes stale if the protected source commit, hosted migration, primary user journeys, theme behavior, media pipeline, or evidence expiration changes without reconciliation.

## Review target and limits

EdNotebook uses [WCAG 2.2 Level A and AA](https://www.w3.org/TR/WCAG22/) as its forward-looking internal web target. W3C recommends WCAG 2.2 as the current conformance target, while the U.S. Department of Justice's Title II web rule uses [WCAG 2.1 Level AA](https://www.ada.gov/resources/2024-03-08-web-rule/) for covered state and local government web content and mobile apps. Applicability, exceptions, procurement terms, and institutional obligations require qualified institutional/legal review; this repository does not decide them.

Section508.gov also describes accessibility testing as a combination of manual and automated methods performed and reported by knowledgeable testers. The approval workflow therefore rejects automated checks as a substitute for human keyboard, assistive-technology, visual, media, and complete-process review.

## Repository evidence already present

1. The feature catalog makes keyboard navigation, reduced motion, and meaningful text alternatives always-on controls. They cannot be switched off by an institution.
2. The catalog accurately marks high-contrast appearance as only `built_in_part` and accessibility reporting as `planned`; neither is represented as complete.
3. The media workflow requires verified provider captions, a reviewed transcript, WebVTT captions, or a documented no-speech exception before publication. Replacement media produces a new version instead of rewriting prior evidence.
4. Student media stays in EdNotebook, exposes captions/transcripts, and records bounded aggregate viewing evidence without IP addresses, device identity, or second-by-second history.
5. Primary React journeys contain native labels, named regions, alerts/status regions, dialog semantics, progress semantics, accessible tab patterns, and decorative-image treatment in multiple reviewed components.
6. Reduced-motion handling and visible focus styles exist in reviewed application surfaces, but repository presence alone does not prove complete coverage.
7. The academic writing workspace names its document canvas, grouped tools, review regions, notices, and feedback areas for assistive technology. Its full editing workflow still requires manual keyboard and screen-reader testing.

The baseline command `npm run test:media-accessibility` passed 6 of 6 tests on 2026-08-02. The baseline `npm run test:admin-control` passed 55 of 55 tests. These checks prove narrow implementation contracts only; they do not establish WCAG conformance.

## Open findings and required evidence

The current evidence is insufficient for PASS. An accountable reviewer must resolve or explicitly condition all of the following:

1. No complete manual keyboard walkthrough is recorded for authentication, student course/lesson/calendar/notification/writing flows, professor course building/review/grading, publisher/library/checkout, and the Control Center.
2. No current screen-reader matrix is recorded for the complete processes above. At minimum, the reviewer must identify the assistive technology, browser, operating system, tested version, and observed results.
3. No current whole-product color, non-color cue, focus visibility, reflow, zoom, target-size, and responsive-layout report is attached. High-contrast appearance remains partial.
4. Central accessibility findings, owners, remediation status, retest dates, and regression history remain planned rather than fully implemented.
5. Uploaded course content, instructor-authored alternatives, third-party embeds, YouTube captions, imported Word documents, generated lessons, and exported documents need content-level review in addition to platform review.
6. The writing canvas, rich formatting controls, tables, citations, professor inline feedback, and imported-document continuation need complete assistive-technology and keyboard evidence.
7. Captions and transcripts are governed, but their accuracy, speaker identification, meaningful audio description, and equivalent learning experience remain human content-review responsibilities.
8. No public ACR/VPAT is produced by this packet. If an institution or purchaser requires one, it must be created from completed testing by a qualified reviewer and kept current with the tested release.

## Minimum evidence for PASS

A PASS decision requires every item below. Conditional or incomplete evidence is HOLD.

- [ ] The exact protected candidate and hosted staging environment were reviewed.
- [ ] Complete-process keyboard navigation and visible-focus review passed, including no keyboard trap and no focus obscured by sticky or overlay content.
- [ ] Screen-reader review covered structure, names/roles/values, status messages, errors, dialogs, tables, rich editing, media, and navigation.
- [ ] Visual review covered text/non-text contrast, non-color cues, zoom, reflow, responsive layouts, target size, and reduced motion.
- [ ] Captions, transcripts, audio alternatives, image alternatives, and third-party media boundaries were reviewed.
- [ ] Authentication, student, professor, publisher/library, writing, commerce test-mode, and administration journeys were tested as complete processes.
- [ ] Every unresolved finding has a severity, owner, remediation or accepted condition, retest date, and user-impact statement.
- [ ] The reviewer accepted the content-authoring and third-party responsibility boundary without treating it as a waiver of platform defects.
- [ ] Evidence is stored in a durable institution-controlled location and contains no student data, credentials, or confidential findings in public metadata.
- [ ] The decision has a bounded expiration no later than the earliest underlying readiness evidence.

## Human decision record

Complete this record in an institution-controlled ticket or signed decision artifact. Do not put private reviewer contact information, disability information, student data, or confidential findings in the public repository.

| Decision field | Required reviewer entry |
| --- | --- |
| Decision | `PASS`, `HOLD`, or `FAIL` |
| Reviewer name |  |
| Title, unit, and accessibility authority |  |
| Timestamp and timezone |  |
| Exact protected staging commit |  |
| Hosted migration accepted |  |
| Environment accepted | `gfalgonektwdylsxsgzc`, `us-east-1` |
| Testing methods and assistive-technology matrix |  |
| Durable evidence/ticket reference |  |
| Open findings and remediation owners |  |
| Effective date |  |
| Review/expiry date |  |
| Revocation/retest trigger |  |
| Attestation | “I reviewed the exact candidate and complete-process accessibility evidence, am authorized to make this accessibility decision, and understand that this record is not a blanket legal certification.” |

## Recording and safety boundary

Only an authorized, signed-in human with an active institutional oversight membership and documented accessibility authority may append this decision. Platform ownership alone is insufficient. A PASS must bind the exact candidate, hosted migration, staging project, packet, durable institution evidence, manual review confirmations, remediation ownership, and bounded expiration.

The decision is append-only. A changed release, expired evidence, new critical accessibility finding, or broken complete process requires a superseding HOLD or FAIL until retested. No decision from this gate enables production student intake.

## Current outcome

**HOLD pending accountable manual review and remediation evidence.** The technical accessibility foundation is meaningful, but the current record does not yet support a complete-product conformance claim or PASS. Production student intake remains disabled, and ASU/Blackboard items remain parked as separate external work.
