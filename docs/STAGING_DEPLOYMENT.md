# EdNotebook GitHub Staging Deployment

EdNotebook uses one source repository and one GitHub Pages artifact with two independently built environments:

- Production: `https://ednotebook.com/`
- Staging: `https://ednotebook.com/staging/`

Staging is the permanent, active integration sandbox for EdNotebook. It is not removed after a gate, repurposed as production, or replaced by feature-specific test sites. Every normal upgrade, fix, migration, and user-experience change is accepted here before it can be proposed for production.

## Environment boundary

| Environment | Source branch | Supabase project | Purpose |
| --- | --- | --- | --- |
| Production | `main` | `didwxihufueqbpfnfdmm` | Live accounts and approved features |
| Staging | `staging` | `gfalgonektwdylsxsgzc` | Layout, routing, authentication, AI, and feature testing |

The frontend shell is built from the same repository. Staging changes do not reach production until the reviewed commits are merged from `staging` into `main`.

## Promotion workflow

1. Create a focused feature branch from `staging`.
2. Open a pull request into `staging`.
3. Pass CI and deploy automatically to `/staging/`.
4. Test the real staging route with staging Supabase accounts.
5. Fix issues on the feature branch or a follow-up staging branch.
6. Open a promotion pull request from `staging` into `main`.
7. Merge only after the staging evidence is attached and the owner approves production promotion.
8. GitHub Actions rebuilds production from `main` and staging from `staging` in the same Pages artifact.

Do not manually copy buttons, layouts, or service calls between environments. Promote the exact reviewed commits so the two shells remain traceable.

## Branch enforcement

Both `staging` and `main` are protected. Merges require a pull request with an up-to-date branch, resolved review conversations, and successful `Validate current change`, `Test security services`, and `Rehearse student-data database gates` checks. Protection applies to administrators; force pushes and branch deletion are disabled.

The required approving-review count is intentionally zero for the current single-owner repository. This prevents a self-review deadlock while preserving the owner's deliberate merge action as the approval. Add a required reviewer when another accountable maintainer is available.

## Staging safety

- Staging is visibly labeled `EDNOTEBOOK STAGING SANDBOX · TEST DATA ONLY`.
- Staging uses the dedicated staging Supabase project.
- Staging pages set `noindex`, `nofollow`, and `noarchive` at runtime and publish a blocking `robots.txt` under `/staging/`.
- Production credentials, service-role keys, provider secrets, and private router keys must never appear in frontend variables.
- Only Supabase publishable browser configuration is committed in `.env.staging`.
- The TOS AI Learning Router continues to hold provider selection, model policy, quotas, and credentials server-side.
- Staging uses public or synthetic test data only. Real student records, grades, private messages, and confidential institutional content are prohibited.
- A database migration is first merged and applied to `gfalgonektwdylsxsgzc`, then tested and recorded. Applying the same reviewed migration to production requires a separate promotion decision, backup/rollback evidence, and explicit approval.
- Ordinary staging work must never link the checkout to or run a Supabase write command against `didwxihufueqbpfnfdmm`.

## URLs for testing

- Professor dashboard: `https://ednotebook.com/staging/#/professor/dashboard`
- Course setup: `https://ednotebook.com/staging/#/app`
- Course outline builder: `https://ednotebook.com/staging/#/app/builder`
- Course output: `https://ednotebook.com/staging/#/app/course-output`

A staging user cannot sign into the production root, and a production user is not automatically present in staging. Supabase Auth users remain isolated by project.

Beta and Pilot acceptance is not performed by renaming or replacing this
sandbox. After an exact approved `staging` candidate is merged to `main`, the
normal live root is labeled Beta or Pilot and records that operating lane. See
`LIVE_OPERATING_LANES.md`.

## Rollback

- Staging rollback: move the `staging` branch back to the last approved staging commit and let GitHub Actions redeploy.
- Production rollback: revert the production merge on `main`; do not overwrite the staging branch.
- Database changes require separately reviewed Supabase migrations and rollback procedures. Frontend branch rollback does not reverse database migrations.
