# Early Prep Grades 9–12 staging walkthrough evidence

- Date: 2026-08-08 (America/Chicago)
- Staging candidate: `36797433fedce7c9fafef8a96d7bb69a0d375566`
- Source PR: <https://github.com/BREXAtlas/EdNotebook/pull/135>
- Staging: <https://ednotebook.com/staging/>
- Validation: <https://github.com/BREXAtlas/EdNotebook/actions/runs/31287682688>
- Deployment: <https://github.com/BREXAtlas/EdNotebook/actions/runs/31287745995>

## Result

The complete 16-check Early Prep staging walkthrough passed with separate synthetic Grades 9–12 teacher and student accounts. The walkthrough used one synthetic institution, class, and body of work. It did not use real minor data, live provider credentials, live SIS/LMS writes, research intake, production changes, payments, or University records.

This is technical staging evidence only. It is **not** institution approval and does not authorize a real pilot or promotion to `main`.

## Walkthrough checks

| # | Check | Persona | Result | Sanitized evidence |
|---:|---|---|---|---|
| 1 | Public paths | Both | Pass | Landing, student, teacher, and institution-readiness routes opened; the readiness route remained sign-in gated. |
| 2 | Teacher account | Teacher | Pass | A separate confirmed synthetic teacher entered the K–12-scoped workspace; no professor access was granted. |
| 3 | Student account | Student | Pass | A separate confirmed synthetic student entered the Grades 9–12 workspace with no University feed/profile crossover. |
| 4 | Class lifecycle | Teacher | Pass | One class was created, generated, reviewed, published as Version 1, reopened, and left in the governed K–12 lifecycle. |
| 5 | Subject workspaces | Both | Pass | 11 subjects, 11 unique adapters, 11 teacher toolsets, 11 student workflows, and 11 assignment starters were enumerated under `early-prep-subject-workspace-v1`; ELA was exercised live. |
| 6 | Discovery and enrollment | Both | Pass | The published class was discovered; one request was created and approved by its teacher. |
| 7 | Assignments and writing | Both | Pass | One assignment with three guided answers and one 28-word document was submitted, privately reviewed, and marked complete; Word and PDF exports succeeded. |
| 8 | Digital Literacy | Both | Pass | EP01 was assigned, completed, privately reviewed, acknowledged, and marked helpful. |
| 9 | Financial Literacy | Both | Pass | EP01 completed with 1 of 40 bounded activities and no personal financial data. |
| 10 | Learning workspace | Student | Pass with tooling note | Four latest records and five retained versions covered notes, sources, citations, documents, and feedback; counts recovered after logout/login. HTML and JSON exports downloaded. Native file-picker restore could not be driven by the browser adapter; deterministic validation/non-destructive merge tests passed. |
| 11 | Communication | Both | Pass | One announcement, one course question, one student reply, and visible read state remained course scoped. |
| 12 | Social and rewards | Both | Pass | Unverified school posting was denied for both personas; a private reflection and hidden profile were saved. The reward ledger remained at zero with no purchase or grade coupling. |
| 13 | College and career | Student | Pass | Six private tool modules were exercised, including a plan, resume, interview notes, and readiness checklists; no ranking, matching, contact, application, or payment occurred. |
| 14 | Synthetic learning systems | Teacher | Pass | OneRoster 1.2 accepted 8 files/10 rows with 0 writes. Synthetic Schoology OIDC/LTI launch, role mapping, Deep Linking, NRPS, and AGS no-op checks passed. No PowerSchool or Schoology endpoint was contacted. |
| 15 | Portfolio transition | Student | Pass | Exactly 3 synthetic categories and 3 confirmations produced a preview with 0 copied records, no request, no division change, no University account, and no social merge. |
| 16 | Cross-cutting boundaries | Both | Pass | Mobile-sized viewport was 639×552 with 624px content width and no horizontal overflow; browser console errors were 0. Session recovery passed. Synthetic RLS impersonation returned 0 student-learning rows to the teacher and 5 own rows to the student. Payment denial and University isolation remained explicit. Keyboard focus was exercised live and complemented by the keyboard/ARIA gates. |

## Verification gates

- `npm run test:early-prep` — 66/66 passed.
- `npm run test:digital-literacy-pilot` — 29/29 passed.
- `npm run test:financial-literacy` — 15/15 passed.
- `npm run test:student-learning` — 31/31 passed, including portable restore validation and non-destructive merge.
- `npm run test:student-experience` — 44/44 passed.
- `npm run test:course-communication` — 9/9 passed.
- `npm run test:social-learning` — 21/21 passed.
- `npm run test:ai-outline` — 5/5 passed.
- `npm run test:environment-storage` — 4/4 passed.
- `npm run test:research-gate` — 7/7 passed.
- `npm run test:commercial-publishing` — 10/10 passed without exercising a live commerce endpoint.
- `npm run build:staging` — passed.
- `npm run audit:bundle` — passed.

The walkthrough also identified K–12 screens that displayed University-oriented educator wording. The accompanying source changes make those labels track-aware (`Teacher` for Early Prep and `Professor` for University) and scope the Early Prep teacher reward panel to the teacher's K–12 classes. The stored University content and University contracts are unchanged.

## Protected-state verification

Before and after the walkthrough, the four protected untracked work areas retained the same file counts and SHA-256 aggregate fingerprints:

| Directory | Files | Aggregate SHA-256 |
|---|---:|---|
| `.codex-live-lanes` | 767 | `1CCD965B6260AA897869B6AE575576182C85B8E6ABD0E5924132748B6146DDCE` |
| `.codex-tos-final-phase1` | 1,851 | `558A44AEF0AB82B738866AD955C910F9EC30186305ADB348DC619321A1784D59` |
| `.codex-tos-ops-final-phase1` | 1,759 | `D5050A7E77BF604F9450D2096D199261A034431AD4109FD794CE85339830F381` |
| `.codex-unverified-access` | 761 | `B26262D5F1D9DB404F6D97C57F4455DF1FCE480A8E6E172AFFAB787C04035157` |

No files from those directories are part of this change. University, professor, publisher, marketplace, and payment flows were not added, called, rerouted, or modified.

## Decision boundary

- Institution decision: **not recorded**.
- Real-minor-data authority: **not granted**.
- Live SIS/LMS connection or write authority: **not granted**.
- Research activation: **off**.
- Early Prep payments: **disabled**.
- Production activation: **off**.
- Promotion to `main`: **not authorized**.

Authorized institution owners must independently record every required security, privacy/records, accessibility, minor-data/consent, support/incident/rollback, and bounded-pilot decision before any real pilot. A separate explicit owner decision is required before promotion to `main`.

## Post-merge targeted replay

PR #136 merged as `a8aba26ef0ce7b24400057c9753a724aea9705a9`. The exact commit was confirmed on the staging environment marker while production remained on its prior commit. A synthetic teacher/student replay confirmed Digital Literacy teacher instructions and feedback, K–12 runtime/media/lesson labels, assignment feedback, one-class teacher reward scope, payment-free boundaries, research-off state, and zero browser console errors.

The replay found two remaining display-only uses of internal University-oriented role wording in the Early Prep account bubble and course package rail. Static review found the same raw role presentation in school-social profile/post labels. The controlled follow-up adapts those K–12 display labels to `teacher` while preserving the internal role contract and all University wording. The focused verification passed:

- `npm run test:early-prep` — 66/66 passed.
- `npm run test:social-learning` — 21/21 passed.
- `npm run test:student-experience` — 44/44 passed.
- `npm run test:media-resources` — 9/9 passed.
- `npm run build:staging` — passed.

The four protected work areas retained their recorded file counts and aggregate fingerprints. No production, University, professor, publisher, marketplace, payment, live integration, research, or real-minor-data operation was performed.

PR #137 merged as `135ad94f4bc1d3ad4e74a76769769cdfbaf6495d`. Validation run [31290837949](https://github.com/BREXAtlas/EdNotebook/actions/runs/31290837949) and deployment run [31290902432](https://github.com/BREXAtlas/EdNotebook/actions/runs/31290902432) succeeded. The staging environment marker reported that exact commit while production remained at `3205d37c96a63323cfe4078e072e8126ab494669`.

The final deployed replay passed: the Early Prep educator account bubble displayed `teacher`; the K–12 course rail displayed `Teacher-published package` while the conditional University contract remained `Professor-published`; school-social teacher role presentation was scoped to K–12; Digital Literacy retained teacher-facing instructions and `RESEARCH OFF`; the recognition panel exposed only the teacher's one synthetic K–12 class; and the browser console reported zero entries. Both synthetic sessions were signed out. No corrective source PR was required after #137.
