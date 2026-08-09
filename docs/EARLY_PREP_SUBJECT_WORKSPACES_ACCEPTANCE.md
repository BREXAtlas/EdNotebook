# Early Prep Subject-Adaptive Workspaces — Acceptance Evidence

## Controlled scope

This unit extends the existing Early Prep assignment-template workspace. It does not add a dashboard, database table, Supabase project, AI router, curriculum repository, commerce path, or University workflow.

The internal division identifier remains `k12`. The existing 11 stable `education_subjects` identifiers remain authoritative.

## Reuse matrix

| Area | Before this unit | Action in this unit |
| --- | --- | --- |
| Early Prep subject taxonomy | Implemented and database-governed | Reused unchanged |
| Teacher assignment templates | Implemented and persisted in `assignment_form_templates` | New templates receive an editable subject starter |
| Student guided assignments | Implemented and persisted in the shared submission system | Displays the matching subject workflow and evidence tools |
| Template release history | Existing templates and submissions remain independent records | Adapter version is recorded in `editor_config.subject_workspace`; historical work is not rewritten |
| Division authorization | RLS remains authoritative | Course reads now also request the selected division explicitly as defense in depth |
| University professor/student workspace | Existing production path | No adaptive guide or Early Prep starter is activated outside `track === "k12"` |
| Commerce and publishing | Already prohibited for Early Prep | No commerce code, calls, controls, or migrations added |

## Eleven workspace adapters

1. English Language Arts
2. Mathematics
3. Science
4. Social Studies / History
5. World Languages
6. Fine Arts
7. Physical Education / Health
8. Career and Technical Education
9. Computer Science / Digital Literacy
10. Financial Literacy / Personal Finance
11. Other Approved Elective

Each adapter supplies a standards label, teacher evidence tools, a student workflow, and an editable three-part starter. The resulting template continues through the existing save, publish, submission, feedback, grading, and export paths.

## Safety boundaries

- No payment, checkout, seller, bookstore, rental, payout, refund, tax, marketplace, or commercial publishing operation is added or invoked.
- No production or recovery Supabase project is changed.
- No schema migration is required; versioned adapter metadata is stored in the existing JSON editor configuration.
- Supabase RLS remains the authorization boundary. Explicit `education_division` filters reduce accidental cross-division mixing in the browser workspace but do not replace RLS.
- Health prompts tell students not to provide private medical details.
- Financial prompts tell students not to provide account numbers or private financial information.
- Digital-literacy prompts prohibit passwords and identifying student records.

## Verification commands

```text
npm run test:early-prep
npm run test:student-experience
npm run test:student-data-safety
npm run build:staging
npm run audit:bundle
```

The complete JavaScript test suite and `git diff --check` are also required before publication.
