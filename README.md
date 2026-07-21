# EdNotebook

[![Build and deploy](https://github.com/BREXAtlas/EdNotebook/actions/workflows/deploy.yml/badge.svg)](https://github.com/BREXAtlas/EdNotebook/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

EdNotebook is a web-based learning workspace and course-publishing platform for students, educators, and publishers. This repository contains the public site, interactive demonstrations, authenticated student and educator workflows, the course builder and runtime, Supabase backend resources, and the document-security worker.

> **Project status:** EdNotebook is under active development. The public tour uses fictional people and seeded demonstration data. Authenticated features use the connected Supabase project, while secure file release, document conversion, billing, and other production workflows require separately deployed services and secrets.

## Live site

- [EdNotebook](https://ednotebook.com/)
- [Interactive product tour](https://ednotebook.com/#/tour)
- [Student portals](https://ednotebook.com/#/students)
- [Educator portal](https://ednotebook.com/#/professors)
- [Publishing portal](https://ednotebook.com/#/publishers)
- [Business presentation](https://ednotebook.com/#/business-presentation)

## What is included

- University and K–12 student portals
- Student dashboards for courses, assignments, calendars, notes, sources, and progress
- Educator authentication, course creation, publishing, grading, and roster workflows
- Course-package authoring and student course runtime
- Publishing, reading, document, OCR, and accessibility tools
- Public product tours with fictional student and professor accounts
- Supabase migrations, private-storage policies, and Edge Functions
- A Python document-security worker for malware scanning, archive inspection, previews, and conversion
- GitHub Pages deployment with build, bundle, Python, and Deno checks

## Architecture

```text
Browser
  └─ React + Vite single-page application
       ├─ Public tours and marketing routes
       ├─ Authenticated student and educator workspaces
       └─ Supabase client using a public publishable key
            ├─ Auth
            ├─ Postgres + row-level security
            ├─ Private Storage
            └─ Edge Functions
                 └─ Document-security worker
                      ├─ ClamAV scanning
                      ├─ Archive inspection
                      ├─ LibreOffice/Poppler previews
                      └─ EduBook conversion
```

The frontend is a hash-routed static application deployed to GitHub Pages. Private records and uploaded educational files belong in Supabase, not in the repository. Secure cloud uploads are reserved into quarantine and are released only after the server-side security pipeline returns a clean result.

## Technology

| Area | Technology |
|---|---|
| Frontend | React 18, Vite 8, JavaScript, CSS |
| Routing | Lightweight hash router in `src/main.jsx` |
| Data and identity | Supabase Auth, Postgres, Row Level Security |
| File storage | Supabase private Storage and TUS resumable uploads |
| Document tooling | PDF.js, Tesseract.js, OpenCV.js, Mammoth, jsPDF |
| Edge services | Supabase Edge Functions with Deno |
| Security worker | Python 3.12, FastAPI, ClamAV, LibreOffice, Poppler |
| Hosting and CI | GitHub Pages and GitHub Actions |

## Quick start

### Requirements

- Node.js 22
- npm

Clone and start the development server:

```bash
git clone https://github.com/BREXAtlas/EdNotebook.git
cd EdNotebook
npm ci
npm run dev
```

Vite serves the application at `http://localhost:5173` by default.

Create a production build and inspect it locally:

```bash
npm run build
npm run audit:bundle
npm run preview
```

`npm run audit:bundle` must run after `npm run build`; it verifies that heavy document and OCR libraries remain outside the initial JavaScript bundle.

## Configuration

The frontend reads these optional browser variables:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

Add them to a local `.env.local` file when working against another Supabase project. The current client falls back to the public URL and publishable key in `src/supabaseClient.js`, so the interface can start without a local environment file.

Everything prefixed with `VITE_` is included in the browser bundle. **Never place service-role keys, Stripe secrets, worker tokens, salts, or other private credentials in a `VITE_*` variable.**

Server-side Edge Function variable names are documented in [`supabase/functions/.env.example`](supabase/functions/.env.example). Configure those values as Supabase secrets rather than committing real values.

The repository includes migrations and Edge Functions under `supabase/`, but it does not currently include a root `supabase/config.toml`. Frontend development can use the configured remote project; a fully isolated local backend requires adding and maintaining a separate Supabase local-project configuration.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the production site into `dist/` |
| `npm run audit:bundle` | Verify core/feature code splitting and bundle-size limits |
| `npm run preview` | Serve the production build locally |

There is currently no frontend unit-test script. Pull requests are validated through the production build, bundle audit, Python worker tests, and Deno type checks.

## Backend and security checks

### Document-security worker tests

Requirements:

- Python 3.12
- `libmagic1`
- Python packages from the worker requirements file
- `pytest==8.4.1`

```bash
python -m pip install -r services/document-security-worker/requirements.txt pytest==8.4.1
PYTHONPATH=services/document-security-worker \
  pytest -q services/document-security-worker/tests
```

The deployable worker image additionally installs ClamAV, LibreOffice, Poppler, and archive utilities from [`services/document-security-worker/Dockerfile`](services/document-security-worker/Dockerfile).

### Supabase Edge Function type checks

Requirements:

- Deno 2

```bash
deno check \
  --config supabase/functions/deno.json \
  supabase/functions/_shared/*.ts \
  supabase/functions/*/index.ts
```

## Application routes

| Route | Purpose |
|---|---|
| `#/` | Portal chooser |
| `#/tour` | Interactive demonstration |
| `#/students` | Student audience chooser |
| `#/students/university` | University student landing page |
| `#/students/k12` | K–12 student landing page |
| `#/student/university/app` | Authenticated university workspace |
| `#/student/k12/app` | Authenticated K–12 workspace |
| `#/professors` | Educator landing page |
| `#/professor/dashboard` | Authenticated educator dashboard |
| `#/app` | Authenticated course-building entry point |
| `#/app/builder` | Course builder |
| `#/app/studio` | Learning and publishing studio |
| `#/app/course-output` | Course-package output |
| `#/publishers` | Publishing landing page |
| `#/admin` | Role-restricted platform administration |
| `#/business-presentation` | Business presentation |

## Repository layout

```text
.
├── src/
│   ├── demo/             # Public product tour and fictional demo accounts
│   ├── portal/           # Student, educator, publisher, and admin portals
│   ├── studio/           # Learning, document, assignment, and publishing tools
│   ├── course-runtime/   # Course packages and student course experience
│   ├── AuthGate.jsx      # Supabase authentication and account bootstrap
│   └── main.jsx          # Lazy-loaded hash routing
├── public/               # Static assets and custom-domain configuration
├── scripts/              # Build and bundle validation
├── services/
│   └── document-security-worker/
├── supabase/
│   ├── functions/        # Deno Edge Functions
│   └── migrations/       # Database schema, RLS, storage, and service migrations
├── docs/                 # Architecture, security, rollout, and product documentation
└── .github/workflows/    # CI and GitHub Pages deployment
```

## Deployment

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on pull requests and pushes to `main`.

Pull requests run:

1. `npm ci`
2. `npm run build`
3. `npm run audit:bundle`
4. Python document-worker tests
5. Deno Edge Function type checks

A successful push to `main` runs the same checks, uploads `dist/`, and deploys the site to GitHub Pages. `public/CNAME` maps the Pages deployment to `ednotebook.com`. Deployment results are recorded on the `automation/pages-status` branch.

## Security and data handling

- Treat the Supabase publishable key as public and rely on authentication plus row-level security for authorization.
- Never expose a Supabase service-role key or any server secret in frontend code.
- Do not commit student submissions, grade exports, identity records, private course materials, database backups, or restricted publications.
- Cloud educational files belong in private storage buckets; GitHub Pages contains only the static application.
- The upload pipeline is fail-closed: files remain quarantined unless the security worker reports a clean result.
- Demonstration profiles and records are fictional and are not official educational records.

Read the detailed runbooks before changing storage or upload behavior:

- [`docs/STORAGE_ARCHITECTURE.md`](docs/STORAGE_ARCHITECTURE.md)
- [`docs/PRODUCTION_SECURITY_1_10.md`](docs/PRODUCTION_SECURITY_1_10.md)
- [`docs/PORTAL_ROLLOUT.md`](docs/PORTAL_ROLLOUT.md)

## Contributing

1. Create a branch from `main`.
2. Keep each change focused and avoid committing generated `dist/` or local environment files.
3. Run the frontend checks and any relevant Python or Deno checks.
4. Open a pull request describing the behavior changed and how it was validated.

Security-sensitive changes should preserve row-level boundaries, private-storage defaults, quarantine behavior, audit logging, and the rule that browser bundles contain no private credentials.

## License

EdNotebook is available under the [MIT License](LICENSE).
