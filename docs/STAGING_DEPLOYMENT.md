# EdNotebook GitHub Staging Deployment

EdNotebook uses one source repository and one GitHub Pages artifact with two independently built environments:

- Production: `https://ednotebook.com/`
- Staging: `https://ednotebook.com/staging/`

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
7. Merge only after owner approval.
8. GitHub Actions rebuilds production from `main` and staging from `staging` in the same Pages artifact.

Do not manually copy buttons, layouts, or service calls between environments. Promote the exact reviewed commits so the two shells remain traceable.

## Staging safety

- Staging is visibly labeled `EDNOTEBOOK STAGING · TEST DATA ONLY`.
- Staging uses the dedicated staging Supabase project.
- Staging pages set `noindex`, `nofollow`, and `noarchive` at runtime and publish a blocking `robots.txt` under `/staging/`.
- Production credentials, service-role keys, provider secrets, and private router keys must never appear in frontend variables.
- Only Supabase publishable browser configuration is committed in `.env.staging`.
- The TOS AI Learning Router continues to hold provider selection, model policy, quotas, and credentials server-side.

## URLs for testing

- Professor dashboard: `https://ednotebook.com/staging/#/professor/dashboard`
- Course setup: `https://ednotebook.com/staging/#/app`
- Course outline builder: `https://ednotebook.com/staging/#/app/builder`
- Course output: `https://ednotebook.com/staging/#/app/course-output`

A staging user cannot sign into the production root, and a production user is not automatically present in staging. Supabase Auth users remain isolated by project.

## Rollback

- Staging rollback: move the `staging` branch back to the last approved staging commit and let GitHub Actions redeploy.
- Production rollback: revert the production merge on `main`; do not overwrite the staging branch.
- Database changes require separately reviewed Supabase migrations and rollback procedures. Frontend branch rollback does not reverse database migrations.
