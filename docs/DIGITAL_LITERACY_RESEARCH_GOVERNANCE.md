# Digital Literacy research-governance gate

Status: planning foundation only — **NOT ACTIVATED**

This boundary supports planning for a Digital Literacy pilot without treating ordinary EdNotebook use as human-subjects research. It does not create a survey, collect a response, record an approval, or activate a study.

## Angelo State boundary

Reviewed July 28, 2026:

- [ASU Protection of Human Subjects](https://www.angelo.edu/research/compliance/protection/human-subjects.php) says covered human-subjects research must undergo IRB review and approval before data collection. It also identifies required CITI human-subjects training.
- [ASU Guidelines for Classroom Projects](https://www.angelo.edu/live/files/17315-guidelines-for-classroom-projects) says faculty should evaluate student data using the same standards as data collected outside the classroom because students are a captive participant group. Its classroom-project criteria require data to be disconnected from grades, bounded to one semester, and low risk; the IRB chair decides questions about the boundary.
- [ASU IRB Policy and Procedures](https://www.angelo.edu/live/files/17314-policy-and-procedure-for-the-protection-of-human) describes the institution’s submission and review process.

EdNotebook therefore requires a written ASU IRB/HRPP determination for the exact project version before any pre/post assessment, qualitative interview, open-ended research survey, learning-effectiveness analysis, or research export can turn on. The application does not decide whether a project is exempt.

## What remains ordinary product testing

`product_feedback` and `course_feedback` remain independent paths under `docs/TESTING_AND_DATA_MODES.md`. A usability report, bug report, feature vote, or course-improvement survey does not inherit research fields or blocks. Responses from those paths cannot later become a research dataset without a new research version and the participant choices required by that version.

## Versioned contract

The Supabase migration creates:

- `research_pilot_projects` — stable institution/course identity.
- `research_pilot_versions` — immutable purpose, activities, data owner, dates, notice/consent, minimization, retention, export, and deletion rules.
- `research_pilot_instruments` — append-only instrument definitions and content hashes.
- `research_pilot_approval_records` — append-only written determination and revocation records.
- `research_participation_states` — explicit choice, withdrawal, export, and deletion status.
- `research_subject_requests` — auditable withdrawal/export/deletion requests.
- `research_response_records` — protected response envelopes; a participant can read only their own rows, while course managers must use the governed pseudonymized export.

Changing the purpose or any instrument/configuration creates a new project version. Approval of one version never carries forward automatically.

## Independent activation gates

The database accepts a response only when all of these remain true at submission time:

1. Institution and course scope match.
2. A named data owner remains authorized for the course.
3. The project and written determination are effective and unexpired.
4. The latest determination is approved, not revoked.
5. Notice and consent configuration match the determination.
6. The exact instrument version is present and declares minimized response fields.
7. Retention, export, and deletion rules are complete.
8. `research.human_subjects_collection` is enabled for the course; its default is `false`.
9. An institution governor explicitly activates the exact version.
10. The learner has current course membership and makes an explicit participation choice.
11. No withdrawal or pending deletion request blocks collection.

The response trigger repeats the gate even if a future service bypasses the intended RPC. Direct table writes are revoked from browser roles, every exposed table has RLS, public functions revoke default `PUBLIC` execution, and audit events exclude response content.

## Deployment and operations

Do not deploy this migration or activate the feature until an authorized reviewer has:

- reviewed the migration and RLS with the Supabase database advisors;
- applied it to the existing staging project only;
- run `npm run test:research-gate` and the full release suite;
- run negative database tests as unauthenticated, unrelated-institution, professor, participant, and institution-governor roles;
- recorded the real ASU determination through an approved restricted workflow;
- verified participant notice, consent/waiver language, withdrawal, export, deletion, incident response, and retention handling;
- confirmed no grade, enrollment, reward, or account consequence is tied to participation.

Production activation is a separate authorization and is not part of this change.
