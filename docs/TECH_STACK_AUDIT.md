# EdNotebook technology stack audit

## Executive view

EdNotebook is a React web application with Supabase providing the authenticated data plane and server-side functions. GitHub holds source code and runs CI/deployment. A separate Python document-security container is designed for Railway. Blackboard currently has a professor-controlled CSV grade export; LTI 1.3/LTI Advantage is the standards-based next integration, while Blackboard REST remains an optional Blackboard-specific extension.

Status labels in this audit are deliberate:

- **Active in code:** implemented and used by the application or deployment workflow.
- **Deployment required:** implemented, but an operator must deploy/configure it.
- **Pilot foundation:** a secure workflow exists but still needs institutional test data and approval.
- **Demonstration only:** visible prototype behavior; not a production integration.
- **Planned:** architecture is reserved, but it must not be represented as active.

## Systems and connections

### GitHub repository and GitHub Actions — active in code

- **Connected to:** source control, pull-request review, locked dependency installation, Vite build, bundle audit, Python security tests, Deno checks for Supabase functions, GitHub Pages deployment, container image publication, and the scheduled retention-worker call.
- **Stores:** application source, migrations, workflows, documentation, and public build artifacts. It must not contain student records, uploaded documents, private keys, database secrets, LMS credentials, or production `.env` files.
- **Security:** branch protection, required pull-request checks, dependency review, CodeQL/secret scanning, environment approvals, and least-privilege `GITHUB_TOKEN` permissions should be enabled. GitHub recommends storing sensitive workflow values as scoped secrets and granting the minimum permissions possible: [GitHub Actions secrets](https://docs.github.com/en/actions/concepts/security/secrets).
- **Institution alternatives:** GitHub Enterprise Cloud/Server, GitLab, Azure DevOps Repos, or Bitbucket. GitHub Actions can be replaced by Azure Pipelines, GitLab CI, Jenkins, or institution-hosted runners.
- **Handoff requirement:** transfer repository ownership to an institution-controlled organization, require at least two maintainers, document protected branches/environments, and replace founder-owned service credentials with service accounts.

### GitHub Pages and Vite frontend — active in code

- **Connected to:** the React application, static assets, Supabase's public URL/publishable key, and hash-based client routes.
- **Stores:** public compiled HTML, JavaScript, CSS, images, and other intentionally public assets. GitHub Pages does not store EdNotebook database rows or uploaded private files.
- **Privacy boundary:** anything embedded with a `VITE_` variable becomes browser-visible. Only public configuration, such as the Supabase URL and publishable key, belongs there. LTI private keys, Stripe secrets, service-role keys, and Railway worker tokens must remain server-side.
- **Institution alternatives:** an institutional web server/CDN, Azure Static Web Apps, Cloudflare Pages, Netlify, Vercel, AWS S3/CloudFront, or a containerized Nginx deployment.
- **Handoff requirement:** institution-owned DNS, TLS, content-security policy, environment configuration, uptime monitoring, accessibility checks, and a documented rollback path.

### React 18 and Vite 8 — active in code

- **Connected to:** professor/student portals, course builder/runtime, document and syllabus tools, demonstration workspaces, and the Blackboard export interface.
- **Stores:** no server data itself. Component state is memory-only unless a feature deliberately uses browser storage or Supabase.
- **Alternatives:** Next.js, Remix, Angular, Vue/Nuxt, or an institution standard design system. A framework change is not required for LTI because LTI endpoints remain server-side.
- **Handoff requirement:** Node 22-compatible build tooling, locked `package-lock.json`, browser support policy, accessibility regression tests, and dependency update ownership.

### Supabase Auth — active in code

- **Connected to:** email/account authentication, PKCE sign-in, persisted browser sessions, user profiles, RLS authorization, and authenticated Edge Function calls.
- **Stores:** account identities, password hashes managed by Supabase Auth, sessions/tokens on the user device, and profile/account metadata in Postgres.
- **Privacy:** browser sessions persist so users do not have to sign in on every page. Shared-device sign-out and session-duration policy must be part of the pilot. Authorization must come from protected database membership/role records—not editable user metadata.
- **Alternatives:** institution Microsoft Entra ID, Okta, Auth0, Keycloak, CAS, Shibboleth/SAML, or another OIDC provider. Microsoft documents both OIDC and SAML as institutional SSO options: [SAML versus OIDC](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/saml-vs-oidc-decision-guide).
- **Handoff requirement:** use institution-owned auth configuration, MFA/conditional-access policy where supported, break-glass administrator accounts, account lifecycle/deprovisioning, and approved email/domain rules. LTI launch identity complements normal EdNotebook sign-in; it should not silently merge accounts by email.

### Supabase Postgres and Row Level Security — active in code

- **Connected to:** institutions, profiles, courses, memberships, assignments, publications, grade categories/items/results, storage metadata, billing metadata, audit events, retention/legal holds, and Blackboard reconciliation.
- **Stores:** the authoritative production application records, including education records. Course and grade access is enforced by RLS and server functions that recheck `auth.uid()` and course/institution authority.
- **Privacy:** new exposed tables must have RLS and explicit grants. Supabase describes RLS as the control layer that permits browser access while enforcing row-by-row authorization: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- **Alternatives:** institution-managed PostgreSQL, Azure Database for PostgreSQL, AWS RDS/Aurora PostgreSQL, Google Cloud SQL, Neon, or another managed Postgres. If the browser must not access a data API, an institution API layer can mediate every request.
- **Handoff requirement:** institution-owned project/organization, regional/data-residency review, DPA/security review, point-in-time recovery, restore exercises, RLS regression tests, audit-log retention, incident response, and a schema migration owner.

### Supabase Storage and secure upload functions — active in code; deployment configuration required

- **Connected to:** private learning resources, resumable browser uploads, signed access, checksum/metadata records, the document-security worker, and conversion/preview results.
- **Stores:** private source files and approved derived artifacts. Public repositories and public buckets are not acceptable for student documents.
- **Security:** browser uploads are finalized through authenticated functions; the worker receives a scoped job and calls back through an allowlisted endpoint/token. Supabase recommends keeping custom server logic and secrets in Edge Functions rather than the browser: [securing Supabase data](https://supabase.com/docs/guides/database/secure-data).
- **Alternatives:** Azure Blob Storage, AWS S3, Google Cloud Storage, MinIO, Box, or institution-managed object storage. Signed short-lived URLs and private-by-default buckets are required in every option.
- **Handoff requirement:** file-size/type limits, malware-response runbook, lifecycle rules, legal holds, retention/deletion verification, backup/versioning policy, and proof that direct public reads are disabled.

### Supabase Edge Functions — active in code; individual functions require deployment/secrets

- **Connected to:** link preview, secure upload completion, retention processing, Stripe webhooks, audit helpers, and future LTI server endpoints.
- **Stores:** normally no durable state outside Postgres/Storage; function secrets live in the Supabase secret store. Functions may use a service-role key only server-side and only after request-specific authorization.
- **Security:** authenticated functions receive user JWTs; webhooks/LTI launches require their own signature/state validation; service-to-service functions require a dedicated secret. Supabase documents Edge Functions as server-side TypeScript intended for webhooks and third-party integrations: [Edge Functions](https://supabase.com/docs/guides/functions).
- **Alternatives:** Azure Functions, AWS Lambda/API Gateway, Google Cloud Functions/Run, Cloudflare Workers, Netlify Functions, Vercel Functions, Railway, Render, Fly.io, or an institutional application server.
- **Handoff requirement:** environment-specific secrets, strict CORS, rate limits, timeouts, structured redacted logs, alerting, idempotency, replay protection, and CI type checks.

### Railway document-security worker — deployment required; operator-reported platform

- **Connected to:** Supabase secure-upload completion through an authenticated server-to-server request. The repository includes a production-style Dockerfile, but no Railway project file; the exact Railway project, variables, region, scaling, and volume settings must therefore be captured during handoff.
- **Runtime:** Python 3.12, FastAPI/Uvicorn, ClamAV, `libmagic`, LibreOffice, Poppler, archive inspection, and EduBook conversion.
- **Stores:** files should exist only in job-scoped temporary storage while they are downloaded, inspected, converted, and returned. Durable originals/outputs belong in private object storage; logs must not include document text or signed URLs.
- **Security:** dedicated worker token, allowed callback/source hosts, concurrency and byte limits, non-root container process, health check, patched malware definitions, network egress restrictions, and temp-file cleanup.
- **Alternatives:** institution Kubernetes/OpenShift, Azure Container Apps, AWS ECS/Fargate, Google Cloud Run, Render, Fly.io, or a secured campus VM. Railway maps a repository Dockerfile and environment variables into a service deployment: [Railway Docker deployment](https://docs.railway.com/guides/docker-compose).
- **Handoff requirement:** institution-owned project, container registry, secret rotation, ClamAV update monitoring, job queue/back-pressure, persistent quarantine policy if approved, vulnerability/SBOM review, and recovery testing.

### Blackboard manual CSV grade export — pilot foundation

- **Connected to:** protected professor Grades area, selected EdNotebook course/roster/grade items, finalized grades, uploaded Blackboard template, Supabase reconciliation/audit metadata, and a direct professor download.
- **Stores:** the raw Blackboard file in browser memory for the workflow; course-scoped confirmed identity/column mappings, filenames, counts, hashes, and export history in Supabase; the generated file on the professor's device. No Blackboard password or token is collected.
- **Shared data:** course/section/term, institution and LMS identifiers, learner identifiers and role, grade category/line item, points possible, grade status, result, timestamps, and provenance follow `docs/integrations/LEARNING_SYSTEM_DATA_MODEL.md`.
- **Alternatives:** Blackboard's own manual spreadsheet workflow, LTI Advantage AGS, Blackboard REST APIs, or OneRoster gradebook exchange. The manual path should remain available as a controlled fallback even after LTI.
- **Handoff requirement:** non-production Blackboard import test, institution-specific template examples, FERPA handling guidance, mapping/history retention, an identified reconciliation owner, and audit review.

### Blackboard LTI 1.3/LTI Advantage — planned secure integration

- **Connected to when configured:** institution/LMS registration, OIDC login and signed launch, course context/resource link, user role, Deep Linking, Names and Roles Provisioning Service (NRPS), Assignment and Grade Services (AGS), and the shared EdNotebook record contract.
- **Required identifiers:** issuer, client ID, deployment ID, platform JWKS/auth/token endpoints, tool key ID/public JWKS, LTI subject, roles, context ID, resource-link ID, line-item URL/ID, NRPS/AGS service URLs, scopes, nonce/state, and launch/message timestamps.
- **Stores:** connection/configuration metadata, encrypted/private signing material in server secrets, one-time state/nonce records, course/user/resource/line-item mappings, service scopes, grade-release decisions, response status, retry/reconciliation metadata, and redacted audits.
- **Security:** all launch and service work is server-side; verify signature, issuer, audience/authorized party, deployment, nonce, state, expiry, message type/version, target link, HTTPS endpoints, role, context, and service scopes. Access tokens are short-lived and never enter browser storage.
- **Institution alternatives:** another standards-compliant LMS using the same LTI 1.3 adapter; Blackboard REST for Blackboard-only operations; OneRoster/SIS for roster authority. Anthology explains that LTI provides portable launches/NRPS/AGS while REST exposes Blackboard-specific objects: [LTI or REST](https://docs.anthology.com/docs/blackboard/rest-apis/getting-started/lti-or-rest).
- **Handoff requirement:** Blackboard developer registration, institution administrator deployment, privacy review, permitted data fields/scopes, test course, Deep Linking/NRPS/AGS acceptance tests, key rotation, incident/revocation process, and certification review. Status remains setup/testing until the real client and deployment IDs pass live institutional tests.

### Blackboard REST API — optional future connector

- **Connected to when approved:** Blackboard-specific courses, terms, users/memberships, content, assessments, grade columns/results, and other objects not covered by LTI.
- **Stores:** application/deployment IDs and short-lived OAuth tokens server-side; durable Blackboard object IDs in the same canonical mapping layer used by CSV/LTI.
- **Security:** institution administrator must enable the application and assign only necessary entitlements. Browser-to-Blackboard calls are not appropriate; Anthology notes REST uses registered application credentials and OAuth tokens: [Blackboard REST first steps](https://docs.anthology.com/docs/blackboard/rest-apis/getting-started/first-steps).
- **Alternatives:** LTI Advantage for launch, roster, line items, and grades; OneRoster/SIS for standardized roster/grade exchange; remain with manual CSV when automation is not approved.
- **Handoff requirement:** endpoint/entitlement inventory, rate-limit/retry plan, idempotency, token caching/rotation, data-source ownership, and reconciliation reports.

### Stripe — server-side webhook foundation; production billing not yet complete

- **Connected to:** a Supabase Edge Function and billing/subscription/entitlement tables. The professor-facing builder explicitly describes current charge controls as prototype UI.
- **Stores:** Stripe customer, subscription, price/product, checkout/payment references, webhook IDs/status, and derived EdNotebook entitlements. Card data should remain with Stripe and never enter EdNotebook.
- **Security:** signed raw-body webhook verification, idempotent event processing, server-only secret/webhook keys, restricted price mapping, and no secrets with a `VITE_` prefix.
- **Alternatives:** institution procurement/invoicing, TouchNet/Transact/Nelnet if institution-standard, PayPal/Braintree, Adyen, or no self-service payment during an institution pilot.
- **Handoff requirement:** decide whether billing is in pilot scope; if not, disable the production webhook and payment UI. If used, complete finance/legal review, tax/refund policy, customer support ownership, webhook monitoring, and live-mode test controls.

### AI/course-generation providers — demonstration only

- **Connected to:** the builder contains direct Anthropic request attempts without production credentials and falls back to synthetic demonstration content. Account settings reserve built-in, OpenAI, Anthropic, and gateway choices; connector tokens use session storage for the current prototype.
- **Stores:** demonstration settings/preferences in browser storage. Production prompts, uploaded course documents, student work, and provider tokens must not be sent from or stored in the browser.
- **Required correction before pilot AI:** move every provider call to an institution-approved server gateway, keep provider secrets server-side, define allowed data classes, redact/minimize prompts, disable provider training/retention where contractually available, log only metadata, and require professor review before generated content is published.
- **Alternatives:** institution Azure OpenAI, AWS Bedrock, Google Vertex AI, a reviewed OpenAI/Anthropic enterprise connection, or institution-hosted models through vLLM/Ollama. “No external AI” must remain a supported mode.
- **Handoff requirement:** AI acceptable-use policy, model/provider inventory, DPA, data-retention/training terms, prompt-injection controls, evaluation, human review, copyright/accessibility policy, spending limits, and incident shutdown.

### Browser storage and browser memory — active, deliberately limited

- **Connected to:** Supabase session persistence, demonstration workspaces, device preferences/account settings, temporary connector tokens, and in-memory Blackboard parsing.
- **Stores:** auth session tokens and non-authoritative settings on the device; demonstration-only records may use local storage; temporary connector tokens use session storage; the Blackboard CSV and generated output remain in volatile memory until download/navigation.
- **Does not replace:** Postgres for production courses, memberships, grades, audit history, institution records, or integration mappings.
- **Alternatives:** server-stored preferences, encrypted IndexedDB for approved offline use, or no offline persistence. Sensitive education records should default to the authenticated server.
- **Handoff requirement:** inventory every storage key, shared-device sign-out behavior, clear-data control, storage expiry/versioning, XSS/content-security policy, and automated proof that grades/files are not placed in URLs or browser logs.

### Calendar, email, messaging, analytics, and monitoring — not production-connected

- Current Google/Outlook buttons and community communications are demonstration workflows unless a separate authenticated connector is explicitly deployed.
- There is no approved production analytics/advertising tracker in this audit. Adding one requires a data inventory, consent/notice review, student-privacy review, and a “no behavioral advertising” rule.
- Production alternatives should follow institution standards: Microsoft Graph/Exchange, Google Workspace APIs, SMTP/transactional email service, Teams/Slack connectors, and institution observability such as Azure Monitor, Splunk, Datadog, or Sentry.
- Do not add these connectors directly from the browser. Use institution-owned OAuth registrations, server-side token storage, narrow scopes, revocation, and auditable jobs.

## Where data lives

| Data | Current or intended location | Access boundary | Retention decision |
| --- | --- | --- | --- |
| Public site/code | GitHub and GitHub Pages | Public by design | Source/project policy |
| Account/session | Supabase Auth plus browser session persistence | User and Auth service | Institution auth/session policy |
| Profiles, institutions, courses, rosters, grades | Supabase Postgres | RLS and course/institution roles | Education-record schedule/legal holds |
| Private documents/derived files | Supabase private Storage | Signed/scoped access plus RLS metadata | File-class lifecycle/legal holds |
| Document-processing copies | Railway/container temp storage | Worker token and allowlists | Delete after job; quarantine only by approved policy |
| Blackboard CSV source | Browser memory | Professor's active session | Not retained by EdNotebook |
| Generated Blackboard CSV | Professor device | Local device/Blackboard import controls | Institution handling policy |
| Blackboard mapping/export history | Supabase Postgres | Course and institution managers | Reconciliation/audit retention |
| LTI keys/tokens | Server secret store/memory | Integration service only | Rotate/expire; never application tables unless encrypted design is approved |
| Audit events | Supabase Postgres | Authorized administrators | Approved audit/legal-hold schedule |
| Demo settings | Browser local/session storage | Current browser profile | User clear/reset; not authoritative |

## Angelo State handoff/integration patterns

### Pattern A: managed pilot with the current stack

- Institution-owned GitHub organization/repository and Pages domain.
- Institution-owned Supabase project/organization for Auth, Postgres, Storage, and Edge Functions.
- Institution-owned Railway project for the document worker.
- Blackboard test deployment for manual CSV first, then LTI setup/testing.
- Fastest pilot path, but requires vendor/DPA/data-residency and account-ownership review.

### Pattern B: Microsoft/institution-hosted equivalent

- Static frontend on Azure Static Web Apps or institutional hosting.
- Entra ID OIDC/SAML for primary EdNotebook SSO, with LTI launch identity mapped separately.
- Azure Database for PostgreSQL, Blob Storage, Functions/API Management, Key Vault, and Container Apps/AKS for document processing.
- Azure Monitor/Sentinel or campus observability.
- Strong alignment if those are already institution standards; higher migration and operations effort.

### Pattern C: hybrid

- Keep React/Vite and the canonical integration adapters unchanged.
- Move identity, database, storage, worker, or monitoring one service at a time behind documented interfaces.
- Preserve the manual Blackboard CSV fallback while LTI/REST/SIS connections are reviewed.
- Use the shared data contract so a hosting/vendor change does not create new course, roster, or grade models.

## Decisions the technology department should make before a live pilot

1. System owner, support owner, security contact, and records/privacy owner.
2. Approved hosting region, vendors, DPAs, subprocessors, backup, recovery, and breach-notification terms.
3. Institution SSO method and account provisioning/deprovisioning.
4. Authoritative roster source: EdNotebook enrollment, Blackboard NRPS, SIS/OneRoster, or an approved combination.
5. Blackboard scope: manual CSV only, LTI launch/Deep Linking, NRPS, AGS grade passback, and/or REST.
6. Required course, section, term, learner, grade-item, and result identifiers from the shared data model.
7. Education-record, audit, mapping, file, backup, and legal-hold retention schedules.
8. Private document malware scanning, quarantine, conversion, and deletion ownership.
9. Whether AI, payments, calendar, email, analytics, or community messaging are out of scope or separately approved.
10. Pilot test plan, accessibility review, incident shutdown, key rotation, data export, and complete vendor-exit/handoff procedure.

## Recommended minimum pilot boundary

- Keep GitHub source/build artifacts free of private data and secrets.
- Use institution-controlled test users and a non-production Blackboard course.
- Use Supabase Auth/Postgres/Storage with reviewed RLS and private buckets.
- Deploy the document worker with rotating service credentials and restricted hosts.
- Begin grades with the reviewed manual CSV workflow.
- Enable LTI only after real registration values and security tests pass; enable NRPS/AGS scopes separately.
- Leave Blackboard REST, AI, payment, calendar, messaging, and analytics disabled unless each receives explicit institutional approval.
- Complete a restore test, access-control test, export/reconciliation test, and deletion/retention test before production student data enters the system.
