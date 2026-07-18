# EdNotebook

Paste your content. We transform it into an interactive, gamified university course.

Two pages, one Vite/React app:
- `src/Landing.jsx` — marketing page + live demo + free-teacher onboarding
- `src/Builder.jsx` — the platform (Learner / Professor / Admin / Mastermind)
- `src/main.jsx` — hash router: `#/` is the landing page, `#/app` is the builder

## Push this to BREXAtlas/EdNotebook

From inside this folder:

```bash
git init
git add .
git commit -m "EdNotebook: landing page + builder, Vite + GitHub Actions deploy"
git branch -M main
git remote add origin https://github.com/BREXAtlas/EdNotebook.git
git push -u origin main
```

## Turn on GitHub Actions deployment

You're already at the right screen:
`https://github.com/BREXAtlas/EdNotebook/settings/pages`

1. Under **Build and deployment → Source**, choose **GitHub Actions** (not "Deploy from a branch").
2. Push to `main` (above). The workflow at `.github/workflows/deploy.yml` runs automatically —
   it installs dependencies, runs `vite build`, and deploys `dist/` to Pages.
3. Watch it run under the repo's **Actions** tab. First run takes ~1–2 minutes.
4. Once it's green, your site is live at **https://brexatlas.github.io/EdNotebook/**

No manual `gh-pages` branch, no `npm run deploy` script — every push to `main` redeploys automatically.

## If you use a custom domain instead

Edit `vite.config.js` and change `base: "/EdNotebook/"` to `base: "/"`, then add a `CNAME` file
in `public/` with your domain. Project-page paths (`base: "/EdNotebook/"`) only apply to the
default `brexatlas.github.io/EdNotebook` URL.

## Local development

```bash
npm install
npm run dev
```

## Connecting the Digital Literacy template for real

Right now the "Ram Ready" template inside Course Forge is hand-mapped from
`Digital-Literacy-Course`'s six-question structure — it's a copy, not a live link.
To make it a real sync: publish the section schema from `Digital-Literacy-Course` as a
small JSON or npm package, then have EdNotebook's `TEMPLATES.ramready` import it instead
of the hard-coded array in `src/Builder.jsx`. A GitHub Action in `Digital-Literacy-Course`
that publishes that schema on every push is the cleanest way to keep both repos in sync
without a manual copy-paste step.

## Status

Syntax-checked locally (both components parse and import cleanly under Node + esbuild).
Not yet build-tested end-to-end with the real npm registry — that happens automatically
on the first push, inside the GitHub Actions runner.
