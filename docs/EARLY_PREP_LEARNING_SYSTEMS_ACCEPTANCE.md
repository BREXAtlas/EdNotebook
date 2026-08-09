# Early Prep Synthetic OneRoster and Schoology Acceptance

## Outcome

This controlled unit adds a visible, deterministic rehearsal inside the Early Prep teacher workspace. It reuses the canonical learning-record and LTI foundations and does not connect to a live district, PowerSchool, Schoology, Supabase Edge Function, or production service.

## Reuse matrix

| Capability | Existing foundation | Acceptance action |
| --- | --- | --- |
| Canonical identities, courses, sections, enrollments, line items, and results | `learningRecordContract.js` | Reused unchanged |
| OneRoster 1.2 resources | Eight-resource Early Prep adapter contract | Preview all eight canonical CSV file names, row counts, sourced IDs, and deterministic hash |
| Synthetic district data | Existing `.invalid` Early Prep fixture | Reused without exposing names, emails, or identifiers in acceptance evidence |
| LTI 1.3 and OIDC | Existing LTI registration and launch contract | Rehearse fictional instructor and learner launch evidence |
| Deep Linking | Existing LTI capability contract | Rehearse one assignment selection without creating a vendor link |
| NRPS | Existing roster-sync contract | Rehearse a two-record fully reconciled roster summary |
| AGS | Existing reviewed, idempotent grade contract | Reconcile a reviewed no-op with an actual provider write count of zero |
| Supabase and Edge Functions | Existing protected database and server functions | Not called or changed |

## Acceptance boundaries

- `educationDivision` is always `k12`.
- Input classification must be `synthetic_test_data_only`.
- Schoology URLs must use the reserved `.invalid` domain.
- Fixtures containing secrets, tokens, passwords, private keys, or service-role credentials fail closed.
- The OneRoster preview always has `writeAuthorized: false`.
- Schoology evidence always has `liveConnectionAuthorized: false` and `providerWriteCount: 0`.
- A synthetic pass cannot approve production or claim a live PowerSchool or Schoology connection.
- The University student/professor route and commercial publishing system remain unchanged.
- No Grades 9–12 payment, checkout, seller, marketplace, bookstore, rental, refund, payout, or tax operation is added or invoked.

## Official compatibility references

- OneRoster 1.2: <https://standards.1edtech.org/oneroster/specifications/standards/v1p2>
- LTI 1.3: <https://www.imsglobal.org/spec/lti/v1p3/>
- Schoology external tools: <https://uc.powerschool-docs.com/en/schoology/latest/course-materials-external-tools>

## Required verification

```text
npm run test:early-prep
npm run test:lti
npm run test:student-data-safety
npm run build:staging
npm run audit:bundle
```

The complete JavaScript test suite and `git diff --check` must also pass before publication.
