# Early Prep portfolio-transition acceptance

This controlled unit adds a student-visible, synthetic preview of a possible Early Prep-to-University portfolio transition. It is a review tool, not a transfer mechanism.

## Reused foundations

- `student_education_paths` remains the authoritative education-division boundary.
- `education_path_transition_requests` remains the existing owner-scoped, RLS-protected request-evidence table. This unit does not insert into it or add an apply path.
- The existing private Learning Workspace, student page, student-created files, projects, learning badges, and release-pinned Digital Literacy and Financial Literacy completion evidence define the selectable categories.
- Existing University, professor, publisher, marketplace, payment, social, and official-record flows remain unchanged.

## Student-selectable categories

Nothing is selected automatically. The student may choose individual synthetic categories for a future review manifest:

1. A selected writing document.
2. A selected private learning note.
3. A selected source-library entry.
4. A selected student-created file, subject to rights and institution review.
5. A selected project or portfolio artifact, subject to privacy, ownership, and collaborator review.
6. Digital Literacy completion evidence, without responses, grades, feedback, or research data.
7. Financial Literacy completion evidence, without private financial scenarios or account data.
8. A selected versioned learning badge.
9. Selected non-sensitive display or learning preferences.

## Records that remain behind

The preview cannot select or carry:

- official high-school grades or transcripts;
- disciplinary, safeguarding, or safety records;
- private school messages or teacher feedback;
- school profiles, posts, groups, connections, or other social audiences;
- district identifiers, roster crosswalks, or research data.

Official records continue through their separate lawful institutional process. Early Prep and University social audiences never merge automatically.

## Fail-closed behavior

- The route must be `k12` to `university`.
- Unknown and archive-only item identifiers are rejected.
- A preview is deterministic and integrity-checked before a manifest can be confirmed.
- A manifest requires at least one explicit item selection and all three boundary confirmations.
- The output remains `synthetic_test_data_only`, requires later institution review and student reconfirmation, and has `applyAuthorized: false`.
- Building the preview submits no request, copies zero records, creates no University account, changes no current division, modifies no University record, and merges no social audience.

## Scope and verification

This unit adds no migration, Edge Function, Supabase call, network request, production data, payment processing, marketplace action, professor workflow, or publisher workflow. It is exposed only on the Early Prep (`k12`) student My Page surface.

Run:

```powershell
npm run test:early-prep
npm run test:student-learning
npm run test:student-experience
npm run test:student-data-safety
npm run build:staging
npm run audit:bundle
```
