# EdNotebook

Paste your content. EdNotebook turns it into an interactive University or K–12 learning experience.

## Live app

- Portal chooser: https://ednotebook.com/
- Student path chooser: https://ednotebook.com/#/students
- University student portal: https://ednotebook.com/#/students/university
- K–12 student portal: https://ednotebook.com/#/students/k12
- Educator portal: https://ednotebook.com/#/professors
- Publishing portal: https://ednotebook.com/#/publishers
- Educator builder: https://ednotebook.com/#/app
- Master admin: https://ednotebook.com/#/admin

The production build and GitHub Pages deployment were verified on July 18, 2026.

## Repository map

- `src/portal/` — audience chooser, shared University/K–12 student experience, educator dashboard, admin verification queue, publishing landing, and live directory adapter
- `src/Landing.jsx` — professor marketing page, playable mini-demo, pricing, and teacher onboarding
- `src/Builder.jsx` — Learner, Professor, Admin, and Mastermind product prototype
- `src/main.jsx` — hash router for the public portals, student dashboard, professor dashboard, studio, and builder
- `supabase/migrations/` — row-level data boundaries for directory, identity linking, rosters, grades, authorized grade sharing, profiles, groups, and announcements
- `vite.config.js` — root base path for the `ednotebook.com` custom domain
- `.github/workflows/deploy.yml` — pull-request builds and automatic production deployment

## GitHub Pages deployment

Every push to `main` runs the production workflow:

1. Check out the repository.
2. Install dependencies on Node.js 22.
3. Run `vite build`.
4. Configure GitHub Pages.
5. Upload `dist/` as the Pages artifact.
6. Deploy it to the `github-pages` environment.

Pull requests run the install and build steps without publishing. Production results are also recorded in `pages-status.json` on the `automation/pages-status` branch, including the deployed URL, source commit, and Actions run.

There is no `gh-pages` branch and no manual deploy script. The Vite base path is `/`, and `public/CNAME` routes the deployment through `ednotebook.com`.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## AI connection status

The interface, course editor, student player, demo fallback, and role views are deployed. The current prototype still attempts to call Anthropic directly from the browser, so the live Claude path is **not yet production-connected** on GitHub Pages.

GitHub Pages is static and cannot safely hold an Anthropic API key. Do not place a provider key in a `VITE_*` variable, frontend source, or any other value that is bundled for the browser.

The production-safe next step is tracked in [issue #3](https://github.com/BREXAtlas/EdNotebook/issues/3): add a small authenticated server-side proxy that keeps the key secret, validates operations, enforces rate and cost limits, restricts CORS, and preserves the sample-course fallback when the provider is unavailable.

## Digital Literacy template sync

The Ram Ready template in Course Forge currently copies the six-question structure from `Digital-Literacy-Course`; it is not yet a live dependency.

A clean sync path is to publish the section schema from that repository as versioned JSON or a small package, then import it into `TEMPLATES.ramready`. Its own GitHub Action can publish a new schema version whenever the source structure changes.

## Verified status

- React/Vite dependencies install successfully in GitHub Actions.
- `npm run build` completes successfully.
- The Pages artifact contains root-based `/assets/...` URLs for the custom domain.
- The production Pages deployment completes successfully.
- The built artifact was exercised headlessly for the landing page, first-run prompt, Professor fallback course generation, course map, Learner view, Admin view, and data-control copy without JavaScript errors.
