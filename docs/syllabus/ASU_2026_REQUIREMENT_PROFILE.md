# Angelo State 2026 Syllabus Requirement Profile

## Purpose

This profile is the initial institutional syllabus shell for EdNotebook Phase 3. It is derived from the faculty-facing documents supplied for implementation:

- `Syllabus Checklist 2026`, Section 1, effective February 3, 2026 through February 3, 2027, modified June 26, 2026.
- `Syllabus Content Guidelines 2022`, Section 1, effective July 1, 2025 through June 30, 2026, modified July 22, 2026.

The profile is versioned as `angelo-state-2026` / `2026.1`. It must not be treated as a permanent universal policy. Institutions, colleges, departments, programs, and later policy revisions can supply different profiles.

## Requirement classes

EdNotebook separates syllabus content into four governance classes:

1. **Professor-managed required** — content the faculty member must provide or verify.
2. **Institution-managed required** — approved policy and handbook blocks supplied and versioned by the institution rather than rewritten by each professor.
3. **Conditional** — information required only when the course delivery or assessment design makes it applicable.
4. **Optional by program or department** — content that can become required through a narrower program profile.

Operational course and Blackboard identifiers are stored separately from the institution's syllabus-content checklist. They support LMS mapping but are not presented as requirements from the two source documents.

## Profile sections

| Section | Governance | Required content represented in EdNotebook |
| --- | --- | --- |
| Description and requisites | Professor-managed required | Aligned catalog or ACGM description; prerequisite courses or knowledge; technical skills and competencies |
| Contact information | Professor-managed required | Instructor title and name; phone; ASU email; office location; office hours; optional other contact |
| Course delivery | Professor-managed required with conditional fields | Modality; meeting times and location when applicable; Blackboard/LMS use; regular and substantive interaction for online courses |
| Texts and materials | Professor-managed required | Required and recommended readings; hardware; software; subscriptions; supplemental materials; where materials are obtained |
| Course-level outcomes | Professor/program required | Measurable outcomes and methods used to assess them; ACGM alignment where applicable |
| Course-level objectives | Optional by program or department | Measurable and attainable objectives using observable student actions |
| Grading criteria | Professor-managed required with conditional fields | ASU grading scale; grade breakdown; grading policies; major assignments and examinations; final examination or culminating experience; final date, time, and location when applicable |
| Course expectations | Professor-managed required | Attendance; participation; communication; academic behavior; online conduct; course-specific AI policy; accessibility and accommodation process |
| Program information | Optional by program or department | Program, degree, accreditation, or departmental information |
| Institutional policies and procedures | Institution-managed required | Academic integrity/Honor Code; students with disabilities; Title IX; religious holy day absence; Student Handbook link |
| Additional items | Optional by program or department | Course evaluation, TurnItIn, plagiarism, copyright, incomplete grades, drops, appeals, basic needs, syllabus changes, technical interruptions, and support services |
| Course outline | Professor-managed required | General description of each lecture or discussion, major assignments, and examinations, at the most accurate detail reasonably possible |

## Authority references represented

The requirement profile records authority labels so the UI can explain why a field exists. These include HB 2504, Texas Administrative Code Title 19, THECB, SACSCOC, applicable AACSB standards, ACGM, the ASU Catalog, and ASU operating policies identified in the supplied guidelines.

EdNotebook does not determine that a syllabus is legally compliant merely because text is present. The profile reports presence, missing information, conditional review, source evidence, extraction method, and institutional ownership. Final approval remains a human and institutional decision.

## Extraction rules

1. Read PDF, DOCX, or text locally before any governed AI task.
2. Detect explicit labels and recognized section headings deterministically.
3. Preserve source excerpts and confidence for every extracted field.
4. Show all profile fields, including missing fields, in the structured editor.
5. Lock institution-managed blocks against professor editing.
6. Send only unresolved sections to the approved TOS task after the prompt, model, policy hash, and staging feature flag are approved.
7. Ignore AI-returned fields that are not defined in the active profile.
8. Save the result as a professor-reviewed draft, not as an approved or published syllabus.

## Cloud record and version boundary

A professor-reviewed save creates or updates one `course_syllabi` record for the EdNotebook course and appends an immutable `course_syllabus_versions` record. The saved payload contains the active requirement profile, structured fields, compliance summary, extraction evidence, and LMS mapping status. RLS limits course syllabus access to authorized course managers, while a future published syllabus can be read only by users who can access the course.

Institution approval and publication are deliberately excluded from the professor save function. Those states require a separate governed workflow and cannot be selected through the current professor interface.

## Blackboard shell boundary

Phase 3 stores Blackboard mapping metadata separately from syllabus content. The initial shell records a Blackboard course identifier and a `course_syllabus_lms_links` record. LTI 1.3 deep linking, course-context resolution, section-specific syllabus links, version notification, and SIS/OneRoster provisioning remain separate activation gates.

## Current implementation state

- Requirement profile: implemented in the Phase 3 branch.
- Deterministic extraction: implemented and tested against the profile.
- Structured professor editor: implemented in the Phase 3 branch.
- Cloud persistence and immutable professor-reviewed syllabus versions: implemented in the Phase 3 branch.
- Blackboard mapping record: implemented as a governed draft mapping; no Blackboard content link is published yet.
- Institution-managed policy injection: shell and locked fields implemented; approved institutional policy content store not yet implemented.
- TOS uncertain-section task: governed prompt PR created; task remains disabled pending merge, hash, model evaluation, and staging approval.
- Blackboard/LTI syllabus deep link: planned after institutional policy injection and approval-state workflow.
