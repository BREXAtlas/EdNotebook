# EdNotebook

EdNotebook is a student-controlled learning workspace for school, class, and academic-life management. It brings syllabi, assignments, due dates, calendars, notes, sources, conversations, AI memory, verified academic identity, and professor organization into one accessible web application.

## Live application

- Portal chooser: https://ednotebook.com/
- Interactive product tour: https://ednotebook.com/#/tour
- Brooke university-student demo: https://ednotebook.com/#/tour/student
- Jaylen K–12 student demo: https://ednotebook.com/#/tour/k12
- Atlas professor demo: https://ednotebook.com/#/tour/professor
- Demonstration presentation: https://ednotebook.com/#/presentation
- About and values: https://ednotebook.com/#/about
- Work with us: https://ednotebook.com/#/careers
- Student path chooser: https://ednotebook.com/#/students
- University student portal: https://ednotebook.com/#/students/university
- K–12 student portal: https://ednotebook.com/#/students/k12
- Educator portal: https://ednotebook.com/#/professors
- Publishing portal: https://ednotebook.com/#/publishers
- Educator builder: https://ednotebook.com/#/app
- Master admin: https://ednotebook.com/#/admin
- LTI owner setup: https://ednotebook.com/#/admin/integrations/lti

## Interactive demonstration accounts

The public tour uses three fictional accounts with realistic mock data:

- **Brooke Mercer** — a verified university student and the tour-mode AI guide.
- **Jaylen Carter** — a verified K–12 senior preparing for college, accounting, investing, and continued MMA training.
- **Atlas Reed** — a verified professor, former high-school teacher, Ed.D. student, mentor, and AI-forward educator.

The profiles, grades, relationships, schools, assignments, conversations, schedules, and posts are demonstration data. They are not official educational records.

The existing generated Atlas and Jaylen portraits are committed as optimized data assets under `src/demo/portrait-data/` and assembled by `src/demo/portraits.js`. Brooke’s portrait remains in `public/mascots/brooke.svg`.

## Student planning features

The demonstration workspace includes:

- Homework and assignment command center
- Course-connected titles, descriptions, due dates, times, and estimated work hours
- Cross-class due-date calendar
- Overlapping-deadline and workload detection
- Missed-assignment recovery queue that remains visible until action is recorded
- Seven-day, 48-hour, two-hour, and recovery reminder settings
- Personal to-do list
- Calendar time-zone and 12/24-hour display settings
- Downloadable `.ics` calendar export
- Product demonstrations for future authenticated Google Calendar and Outlook sync

## Syllabus intelligence

Students can use the syllabus workspace without waiting for a teacher account. The current front-end demonstration can read pasted text and text-based files, then prepare a human-reviewed extraction containing:

- Course title and code
- Course themes
- Key learning objectives
- Required books, readings, and materials
- Assignment titles and descriptions
- Due dates and times
- Estimated project effort
- Reminder windows

Extracted information stays in draft state until the student or professor approves it. Production PDF and DOCX parsing requires a protected document-processing service.

## Notes, sources, and learning memory

The demo provides:

- Class-connected notes
- Source cabinet and citation-status coaching
- Searchable document previews
- Prior-conversation memory
- Role-separated university, K–12, and professor workspaces
- A deterministic document-aware AI chat demonstration that searches only the seeded workspace data

A production AI connection must use authenticated server-side retrieval, provider routing, privacy controls, evaluation, cost controls, and institutional access boundaries. Provider keys must never be included in browser bundles or `VITE_*` variables.

## Open literacy courses

Digital literacy and financial literacy learning paths are visible to all students, including independent students whose teachers have not joined EdNotebook.

The public presentation links to official Texas Education Agency guidance covering technology applications, digital citizenship, accessibility, equitable access, safety, and personal financial literacy, along with research on Blackboard usability, course layout, accessibility, engagement, and the need for clearer learning interfaces.

## Verification model

Verification is manual and completed by a human.

- A verified university student represents confirmed active enrollment.
- A verified K–12 student may be confirmed through a teacher, counselor, or school contact.
- A verified professor represents confirmed faculty identity.
- Verified educators may help confirm active student enrollment.
- Additional verification may require the EdNotebook liaison team to contact an educator, school, or institution.

Verification does not automatically publish grades or private class records. Students control which social-profile cards are visible.

## Repository map

- `src/demo/` — interactive tour, three demonstration accounts, presentation, About page, careers page, syllabus tools, calendar, alerts, notes, sources, chat, social pages, and responsive card design system
- `src/demo/portrait-data/` — optimized Atlas and Jaylen portrait data modules
- `src/portal/` — audience chooser, University/K–12 student experience, educator dashboard, admin verification queue, publishing landing, and directory adapter
- `src/Landing.jsx` — professor marketing page, mini-demo, pricing, and teacher onboarding
- `src/Builder.jsx` — Learner, Professor, Admin, and Mastermind product prototype
- `src/main.jsx` — hash router for public portals, interactive demonstrations, presentation, dashboards, studio, and builder
- `services/document-security-worker/` — document-security and conversion service with Python tests
- `supabase/functions/` — server-side edge functions checked with Deno
- `supabase/migrations/` — row-level data boundaries for directory, identity linking, rosters, grades, profiles, groups, and announcements
- `vite.config.js` — root base path for the `ednotebook.com` custom domain
- `.github/workflows/deploy.yml` — pull-request build/security checks and production deployment

## Technology and integration documentation

- [`docs/TECH_STACK_AUDIT.md`](docs/TECH_STACK_AUDIT.md) — current systems, connections, privacy/storage boundaries, alternatives, and institutional handoff options
- [`docs/integrations/LEARNING_SYSTEM_DATA_MODEL.md`](docs/integrations/LEARNING_SYSTEM_DATA_MODEL.md) — shared institution/LMS/course/roster/grade identifiers and records used across CSV, LTI, REST, and future SIS adapters
- [`docs/integrations/BLACKBOARD_GRADE_EXPORT.md`](docs/integrations/BLACKBOARD_GRADE_EXPORT.md) — professor workflow, matching/scaling rules, validation, privacy, deployment, rollback, and acceptance testing
- [`docs/integrations/LTI_1_3_OWNER_SETUP.md`](docs/integrations/LTI_1_3_OWNER_SETUP.md) — owner deployment, fields, secrets, course binding, activation gate, and key rotation
- [`docs/integrations/BLACKBOARD_LTI_ADMIN_SETUP.md`](docs/integrations/BLACKBOARD_LTI_ADMIN_SETUP.md) — values and test sequence for the Blackboard administrator
- [`docs/integrations/LTI_1_3_SECURITY.md`](docs/integrations/LTI_1_3_SECURITY.md) — launch, service-call, database, privacy, and residual-risk controls
- [`docs/integrations/LTI_1_3_TEST_PLAN.md`](docs/integrations/LTI_1_3_TEST_PLAN.md) — automated, negative, launch, Deep Linking, NRPS, AGS, and activation acceptance tests
- [`docs/integrations/LTI_1_3_TROUBLESHOOTING.md`](docs/integrations/LTI_1_3_TROUBLESHOOTING.md) — safe operator diagnosis and rollback without collecting tokens or records

## Local development

Requirements:

- Node.js 22
- npm
- Python 3.12 and `libmagic1` for the document-security test suite
- Deno 2 for Supabase function type checks

Install and run:

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Security-service checks used by CI:

```bash
python -m pip install -r services/document-security-worker/requirements.txt pytest==8.4.1
PYTHONPATH=services/document-security-worker pytest -q services/document-security-worker/tests
deno check --config supabase/functions/deno.json supabase/functions/_shared/*.ts supabase/functions/*/index.ts
deno test --config supabase/functions/deno.json supabase/functions/_shared/lti/*.test.ts
```

## GitHub Pages deployment and CI

Pull requests targeting `main` run two required jobs:

1. **Build Vite app**
   - Install locked dependencies on Node.js 22 with `npm ci`
   - Run `npm run build`
2. **Test security services**
   - Run the Python document-worker test suite
   - Type-check Supabase Edge Functions with Deno

Pushes to `main` run the same checks, upload `dist/`, and deploy to the `github-pages` environment. Production status is recorded in `pages-status.json` on the `automation/pages-status` branch.

There is no `gh-pages` source branch and no manual deploy script. The Vite base path is `/`, and `public/CNAME` routes the deployment through `ednotebook.com`.

## Product boundaries

The interactive tour is a working product demonstration, but several integrations remain intentionally separated from the static browser build:

- Secure generative-AI provider calls
- Production PDF/DOCX extraction
- Google Calendar and Microsoft Outlook OAuth sync
- Live institution registrations, SIS/OneRoster feeds, and production-approved LTI deployments (the LTI pilot foundation is in code but is not a live institutional connection)
- Moderated persistent photo uploads
- Production hiring and ambassador application processing
- Institution-specific contracts, policy review, and accessibility validation

Those capabilities require authenticated server-side services and should not be simulated with exposed credentials in a static deployment.
