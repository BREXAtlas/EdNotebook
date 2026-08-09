# Early Prep College, Career, Trade, and First-Work Readiness

## Outcome

This controlled unit turns the existing Early Prep student `Opportunities` surface into a private College & Career practice workspace and adds a matching Early Prep-only teacher tool. It covers career exploration, trade research, resume drafting, interview practice, summer-job readiness, and college readiness without creating an employer marketplace, application system, admissions predictor, or automated decision service.

## Reuse matrix

| Need | Existing foundation reused | Controlled extension |
| --- | --- | --- |
| Career and trade assignments | Governed `career-technical-education` subject adapter | Six stable readiness modules produce review-only CTE assignment starters |
| Resume drafting | Existing Academic Writing Studio | Private in-memory practice resume with existing Word/PDF-capable editor |
| Portfolio awareness | Existing private-by-default student page | Readiness workspace links back to the existing page; it does not publish work |
| Student planning | Existing Learning Workspace | Readiness workspace links back to the existing private learning-record surface |
| Student opportunity navigation | Existing student `Opportunities` tab | Early Prep label and contents become `College & Career`; University contents remain unchanged |
| Teacher assignment workflow | Existing Assignment Template Workspace | Teacher previews a readiness starter, then returns to the governed assignment workflow |

## Stable modules

1. Career exploration
2. Trade pathway
3. Resume practice
4. Interview practice
5. Summer-job readiness
6. College readiness

## Safety and product boundaries

- The tools are available only when `educationDivision = k12` / Early Prep 9–12.
- Plans preserve explicit student choices and never rank, recommend, or match a person to a career, trade, employer, college, or military path.
- No employability, personality, interview, admissions-likelihood, or eligibility score is produced.
- No camera, microphone, recording, biometric inference, or AI provider is used.
- No application, resume, message, or student record is submitted to an employer, college, trade program, recruiter, or outside organization.
- Practice resume drafts omit sensitive identifiers and remain in the open browser workspace unless the student explicitly exports them through the existing writing tools.
- Teacher assignment starters require human review and begin with `publishAuthorized: false`.
- Real job, training, credential, deadline, admissions, financial-aid, wage, and age/work-rule facts must be checked against current official sources outside this synthetic unit.
- Grades 9–12 tools add no payment, seller, marketplace, checkout, rental, refund, payout, tax, commercial publishing, or University operation.
- No Supabase migration, Edge Function, production service, live opportunity feed, or external credential is added or called.

## Required verification

```text
npm run test:early-prep
npm run test:student-experience
npm run test:student-learning
npm run test:financial-literacy
npm run test:student-data-safety
npm run build:staging
npm run audit:bundle
```

The complete JavaScript test suite, React quality review, and `git diff --check` must also pass before publication.
