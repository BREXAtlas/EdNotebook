# Early Prep learning-system and continuity contracts

## Learning-system boundary

EdNotebook's canonical records remain the integration center. Provider records map into institutions, people, courses/classes, enrollments, line items and results; provider IDs are preserved in explicit crosswalks rather than being used as EdNotebook primary keys.

### OneRoster 1.2

The supported foundation surface is `orgs`, `academicSessions`, `courses`, `classes`, `users`, `enrollments`, `lineItems` and `results` over CSV or REST. Import sequence is organization/session, course/class, user, enrollment, then grade resources. Every run first produces a preview with counts, unmatched IDs and a stable hash.

### PowerSchool

The synthetic adapter maps course number/section, DCID/student number, enrollment role and term into the shared contract. Email can assist review but is not the only crosswalk key. A live connector requires district-owned credentials in server-managed secret references, a reviewed crosswalk, replay-safe idempotency and reconciliation evidence.

### Schoology

Schoology reuses the existing LTI 1.3 launch, Deep Linking, NRPS and AGS foundation. Credentials remain server-only. Grade export follows preview → human review → idempotent write → reconciliation; a launch or roster role never grants broader EdNotebook course access by itself.

## Import and export invariants

- Preview rows cannot write.
- Export rows must be finalized and valid against the shared canonical grade-result contract.
- Approval identifies the reviewer and the exact preview hash.
- The idempotency key is unique per institution/provider and must match the reviewed preview.
- Applied runs retain reconciliation status and timestamps; secrets and raw credentials are never stored in run evidence.
- Synthetic fixtures contain no real minors or institution identifiers.

## Move to University contract

The foundation table `education_path_transition_requests` records a student-owned request and a versioned manifest. It does not change `student_education_paths.current_division`.

A future reviewed application may transfer only specifically approved learning artifacts, such as course completion summaries, selected notes, badges and portfolio items. It must not automatically copy or merge Early Prep social profiles/posts/groups, educator verification evidence, district roster identifiers, guardian/minor safety records, research data, or institutional grades outside an approved records process.

The eventual apply step must require explicit student confirmation, authorized institutional review, an immutable manifest/hash, before/after audit events, replay protection and rollback evidence. Until that unit is approved, transitions remain request/evidence records only.
