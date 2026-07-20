# EdNotebook owner runbook

Updated: July 19, 2026

This is the operating checklist for the current repository. It separates features that work on the device, features whose code is ready but still needs deployment, previews that use sample or local data, and work that has not been connected yet.

## 1. Owner and secret-admin access - do this first

EdNotebook does not have a hidden password, hard-coded superuser, or browser-side "secret admin" switch. The secure model is a normal, verified Supabase account whose database-owned `public.profiles.role` is manually elevated to `owner` or `admin`.

- `owner` and `admin` can open `#/admin`.
- Public signup can create only `learner` or `professor` roles.
- Signup metadata is not an authorization source.
- Do not place a service-role key, Supabase secret key, LiveKit API secret, worker token, Stripe secret, or cron secret in the browser, a `VITE_*` variable, a screenshot, or this repository.
- Use a dedicated owner account with a unique password. Do not share the account.
- The current admin route is role-gated, but it does not yet require a second server-issued MFA or step-up capability. Sign out when the review session is finished.

Relevant code:

- Admin route gate: [`src/main.jsx`](../src/main.jsx)
- Profile role lookup: [`src/AuthGate.jsx`](../src/AuthGate.jsx)
- Admin dashboard: [`src/portal/PlatformAdminDashboard.jsx`](../src/portal/PlatformAdminDashboard.jsx)
- Server-side educator approval: [`supabase/migrations/20260719000739_education_divisions_and_educator_verification.sql`](../supabase/migrations/20260719000739_education_divisions_and_educator_verification.sql)

### Create the first owner safely

1. Create the account through the normal EdNotebook signup flow.
2. Verify its email.
3. In Supabase Dashboard, open Authentication > Users and copy the exact user UUID.
4. Open SQL Editor and verify that the UUID, email, and profile are the same account:

```sql
select u.id, u.email, u.email_confirmed_at, p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('OWNER_EMAIL_HERE');
```

5. Check that the remote `profiles` role constraint accepts `owner` before updating anything:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and contype = 'c';
```

6. Elevate only the verified UUID:

```sql
update public.profiles
set role = 'owner', updated_at = now()
where id = 'EXACT_AUTH_USER_UUID'
returning id, email, role;
```

7. Sign out, sign back in, and open `https://ednotebook.com/#/admin`.
8. Confirm that the verification queue and account-audit tab load. A visible admin page is not enough; the server RPCs must also succeed.

To remove admin access, update that exact profile back to `professor` or `learner`, then revoke the account sessions in Supabase Authentication.

## 2. Account audit - accounts are hidden, never deleted

The current retention worker does not delete inactive or test accounts. It defaults to dry-run mode. When an owner deliberately runs it with `dryRun: false`, it changes qualifying accounts to `inactive_review`; it still does not call Supabase user deletion.

Account states in [`20260719044500_account_referrals_and_activity.sql`](../supabase/migrations/20260719044500_account_referrals_and_activity.sql):

| State | Meaning | Public behavior | Owner action |
| --- | --- | --- | --- |
| `unreviewed` | New account with no recorded meaningful activity | Visible unless another visibility rule hides it | Wait for real use or review later |
| `active` | Account has recorded meaningful activity | Normal visibility rules apply | No action |
| `inactive_review` | Worker flagged the account for manual review | Hidden from public profile search, public class listings, and public course broadcasts | Reactivate or mark as test after review |
| `confirmed_user` | Owner confirmed it as a real account | Normal visibility rules apply; automatic inactivity scan does not target it | No action unless status changes |
| `test_account` | Owner identified a test or unused account | Hidden from public discovery and automatic inactivity scans | Keep for testing or reactivate manually |

Manual review lives at `#/admin` > Account audit. Available actions are:

- **Reactivate** -> `active`
- **Confirm real user** -> `confirmed_user`
- **Mark test account** -> `test_account`

The scheduled workflow sends no `dryRun` override, so it remains report-only with the current worker default. Use a dry run first and read the returned candidate counts. If the owner later chooses to flag candidates, send `dryRun: false` explicitly. Do not add automatic user deletion to the workflow.

Worker and admin references:

- [`supabase/functions/retention-worker/index.ts`](../supabase/functions/retention-worker/index.ts)
- [`.github/workflows/retention-worker.yml`](../.github/workflows/retention-worker.yml)
- [`src/portal/PlatformAdminDashboard.jsx`](../src/portal/PlatformAdminDashboard.jsx)
- [`src/portal/portalService.js`](../src/portal/portalService.js)

## 3. Hard stop: verify the Supabase baseline before any database push

The migration folder is not self-contained. Its earliest file is explicitly a follow-up migration and immediately indexes or changes tables that are not created anywhere in this repository. Production may already contain the missing baseline, but a new Supabase project cannot be recreated safely from this checkout.

Do not run `supabase db push` against a new or unknown project until this section passes.

### Missing baseline objects in the repository

Core and course tables:

- `profiles`
- `institutions`
- `institution_memberships`
- `courses`
- `course_memberships`
- `assignments`

Learning and editor tables:

- `assignment_drafts`
- `rubrics`
- `reading_annotations`
- `slide_decks`
- `publisher_applications`
- `learning_messages`
- `learning_resources`

Secure-file and processing tables:

- `audit_events`
- `secure_file_objects`
- `file_deletion_requests`
- `file_previews`
- `upload_quota_reservations`
- `processing_jobs`
- `link_previews`
- `publications`
- `retention_policies`

Billing and entitlement tables:

- `billing_customers`
- `billing_subscriptions`
- `stripe_price_plan_map`
- `stripe_webhook_events`
- `plan_entitlements`
- `entitlement_definitions`
- `publication_entitlements`
- `user_entitlements`

Required helpers and RPCs that are referenced but not defined in the checked-in migrations:

- `private.can_access_course(uuid)`
- `private.can_manage_course(uuid)`
- `private.can_manage_assignment(uuid)`
- `private.is_platform_manager()`
- `private.is_institution_manager(uuid, uuid)`
- `private.touch_updated_at()`
- `public.reserve_secure_upload(...)`
- `public.get_my_storage_usage()`
- `public.request_secure_file_deletion(...)`

The private storage bucket definitions and policies are also part of the missing baseline. The current code expects at least `ed-quarantine` and `ed-previews`, plus the destination buckets returned by the secure-upload reservation RPC.

### Safe preflight

From PowerShell in the repository root:

```powershell
supabase --version
supabase login
supabase link --project-ref didwxihufueqbpfnfdmm
supabase migration list
supabase db push --dry-run
```

The checkout currently has no linked project reference in `supabase/.temp`; linking is an owner action. Confirm the project name and organization in the CLI output before continuing.

Run this read-only SQL in Supabase SQL Editor:

```sql
select
  to_regclass('public.profiles') as profiles,
  to_regclass('public.courses') as courses,
  to_regclass('public.course_memberships') as course_memberships,
  to_regclass('public.assignments') as assignments,
  to_regclass('public.secure_file_objects') as secure_file_objects,
  to_regclass('public.processing_jobs') as processing_jobs,
  to_regclass('public.billing_customers') as billing_customers,
  to_regclass('public.stripe_webhook_events') as stripe_webhook_events;

select
  to_regprocedure('private.can_access_course(uuid)') as can_access_course,
  to_regprocedure('private.can_manage_course(uuid)') as can_manage_course,
  to_regprocedure('private.can_manage_assignment(uuid)') as can_manage_assignment,
  to_regprocedure('private.is_platform_manager()') as is_platform_manager,
  to_regprocedure('private.is_institution_manager(uuid,uuid)') as is_institution_manager,
  to_regprocedure('private.touch_updated_at()') as touch_updated_at,
  to_regproc('public.reserve_secure_upload') as reserve_secure_upload,
  to_regproc('public.get_my_storage_usage') as get_my_storage_usage,
  to_regproc('public.request_secure_file_deletion') as request_secure_file_deletion;

select id, public
from storage.buckets
where id in ('ed-quarantine', 'ed-previews')
order by id;
```

Every required result must be non-null and the buckets must remain private. If anything is absent:

1. Stop; do not push the follow-up migrations.
2. Create a current database backup from the Supabase dashboard.
3. Export the existing production schema for review.
4. Add a complete, ordered baseline migration without overwriting the later migrations.
5. Prove that the full migration chain can create a clean nonproduction project.
6. Run RLS and database advisors on that clean project before production.

The baseline repair is a repository task, not a dashboard-only workaround. Until it is committed, disaster recovery and clean environment setup remain incomplete.

## 4. Current release boundary

Verified again on July 19, 2026:

- Pull request [#11](https://github.com/BREXAtlas/EdNotebook/pull/11) is merged at commit `2749ab1cb6c2206f1fbb0fca899760c1109e70b7`.
- `https://ednotebook.com` and `https://www.ednotebook.com` route to the GitHub Pages site over HTTPS.
- `public/CNAME` contains `ednotebook.com`.
- The live root returns HTTP 200; `www` redirects to the HTTPS root; the current production metadata still points to the older share card until this branch deploys.

Still local in the current working tree:

- Account referrals, unique account numbers, reversible account audit, course broadcasts, and class signup links.
- LiveKit room schema, client, and token function.
- Activity Points, optional rewards, class groups, and quick classroom activities.
- Selected-class realtime views for assignments, announcements, messages, authorized group posts, points, rewards, groups, quizzes, and polls.
- Structured paper templates with a compact outline drawer, ordered section writing, cover/header/footer/reference/appendix controls, deterministic Word/print export, and free-style mode.
- Forward-only security corrections for directory verification, published-grade visibility, verification-file ownership, account-audit integrity, inactive/test discovery filtering, and social author identity.
- An on-device course-map and lesson-starter path that works from pasted material without placing a model-provider call or secret in the browser.
- An original professor creator landing flow with Create → Refine → Share sections, truthful Works now/Setup required/Coming soon labels, and matching university/K–12 connected-AI status copy.
- Course-draft isolation, current-lesson-only export payloads, explicit device-only presentation labels, and no inferred cloud class ID.
- Updated GitHub build variables and function configuration.
- Navigation finder, expanded footer, and Auto/Compact/Full layout switch.
- Capacitor-ready web-bundle configuration and the new Open Graph/Twitter share card.

Re-run every verification after the final branch is committed and deployed. A local pass is not a production pass.

## 5. GitHub and Pages setup

### Verify GitHub CLI before each release

The GitHub CLI credential is valid as of July 19, 2026 for `BREXAtlas` with repository and workflow access. Recheck it before each release:

```powershell
gh auth status
```

If that check later fails, run `gh auth login -h github.com`, choose GitHub.com, HTTPS, and browser sign-in. Do not paste a personal token into the repository.

### Configure Actions values

In GitHub > Repository settings > Secrets and variables > Actions, add:

| Name | Type expected by workflow | Value |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Repository variable | `https://didwxihufueqbpfnfdmm.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Repository secret | Current Supabase publishable key |
| `VITE_LIVE_ROOMS_ENABLED` | Repository variable | `false` until LiveKit acceptance passes; then `true` |
| `RETENTION_CRON_SECRET` | Repository secret | Same random value configured in Supabase |

The publishable key is designed for browser use, but the current workflow reads it from Actions secrets. All other server credentials must remain outside `VITE_*` values.

Workflow references:

- Pages build and security tests: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- Worker image: [`.github/workflows/document-security-worker.yml`](../.github/workflows/document-security-worker.yml)
- Retention audit: [`.github/workflows/retention-worker.yml`](../.github/workflows/retention-worker.yml)

After pushing the final branch:

1. Confirm `npm ci` succeeds from the lockfile.
2. Confirm the Vite build succeeds.
3. Confirm Python worker tests pass.
4. Confirm all Edge Functions pass `deno check`.
5. Confirm GitHub Pages deployment succeeds.
6. Open both the root and `www` domains in a private browser window.
7. Check the browser network panel for missing JavaScript, CSS, font, logo, portrait, or landing-image requests.

## 6. Supabase secrets, migrations, and functions

### Edge Function secrets

Set these in Supabase Dashboard > Edge Functions > Secrets, or use `supabase secrets set --env-file` with a temporary file stored outside the repository:

| Secret | Required now | Purpose |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | Yes | Exact browser origins allowed to call Edge Functions |
| `LINK_PREVIEW_ALLOWED_HOSTS` | Yes to enable link previews | Comma-separated exact remote hostnames the server is allowed to fetch; unset fails closed |
| `AUDIT_HASH_SALT` | Yes | Independent random audit salt |
| `DOCUMENT_SECURITY_WORKER_URL` | For cloud document release | Public HTTPS worker origin |
| `DOCUMENT_SECURITY_WORKER_TOKEN` | For cloud document release | Shared worker bearer token |
| `RETENTION_CRON_SECRET` | Yes for scheduled audit | Protects the retention worker |
| `LIVEKIT_URL` | For live rooms | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | For live rooms | Server-side LiveKit key |
| `LIVEKIT_API_SECRET` | For live rooms | Server-side LiveKit secret |
| `STRIPE_SECRET_KEY` | No; payments are off | Stripe webhook scaffold |
| `STRIPE_WEBHOOK_SECRET` | No; payments are off | Stripe signature verification |
| `STRIPE_PRICE_STARTER` | No; payments are off | Optional future price map |
| `STRIPE_PRICE_PROFESSOR` | No; payments are off | Optional future price map |
| `STRIPE_PRICE_INSTITUTION` | No; payments are off | Optional future price map |
| `STRIPE_PRICE_ENTERPRISE` | No; payments are off | Optional future price map |

Recommended current origin value:

```text
https://ednotebook.com,https://www.ednotebook.com,https://brexatlas.github.io,http://localhost:5173,http://127.0.0.1:5173
```

Generate separate high-entropy values for `AUDIT_HASH_SALT`, `DOCUMENT_SECURITY_WORKER_TOKEN`, and `RETENTION_CRON_SECRET`. Do not reuse one value for multiple purposes.

Set `LINK_PREVIEW_ALLOWED_HOSTS` only to operator-approved domains. Start with `ednotebook.com,www.ednotebook.com`; add a separate image/CDN hostname only when a trusted preview needs it. Arbitrary-site previews intentionally remain unavailable until you add a trusted egress/proxy service that can pin the validated destination and block DNS rebinding.

Supabase itself supplies `SUPABASE_URL`, the publishable-key map, and the secret-key map to hosted Edge Functions. Do not copy a Supabase secret key into GitHub Pages.

### Function JWT settings

[`supabase/config.toml`](../supabase/config.toml) now records the three non-user endpoints that authenticate with their own secret or signature:

- `retention-worker` -> `verify_jwt = false`
- `secure-worker-callback` -> `verify_jwt = false`
- `stripe-webhook` -> `verify_jwt = false`

Keep JWT verification enabled for:

- `link-preview`
- `live-room-session`
- `secure-file-delete`
- `secure-file-download`
- `secure-upload-complete`
- `secure-upload-session`

### Apply current migrations only after the baseline gate passes

Current local migrations that still require production verification:

- `20260719044500_account_referrals_and_activity.sql`
- `20260719083000_live_office_hours_and_study_rooms.sql`
- `20260719160000_engagement_points_groups_activities.sql`
- `20260719185200_enable_core_course_realtime.sql`
- `20260719213000_release_security_data_integrity_hardening.sql`

Before validating the final hardening migration, audit existing directory rows, grade rows, educator-verification file links, and social-post authorship. The same-course grade-item foreign key is intentionally `NOT VALID` so new writes are protected without pretending historical rows have already been reconciled.

Safe order:

```powershell
supabase migration list
supabase db push --dry-run
supabase db push
supabase db lint --linked --level warning
```

Then open Supabase Dashboard and run both database advisors. Resolve new errors before inviting external testers.

### Deploy functions

For this branch, deploy the new/changed functions after their secrets and migrations exist:

```powershell
supabase functions deploy retention-worker
supabase functions deploy live-room-session
```

For a full repair deployment, the repository contains nine functions:

```text
link-preview
live-room-session
retention-worker
secure-file-delete
secure-file-download
secure-upload-complete
secure-upload-session
secure-worker-callback
stripe-webhook
```

Deploy them individually and verify each response path. Do not activate Stripe events simply because the webhook code is deployed.

## 7. Document security worker

The document worker is code-complete enough for deployment testing but is not hosted by GitHub Pages. The GitHub workflow builds and publishes a container image to GitHub Container Registry. The owner must deploy that image to an always-on TLS container service.

Container requirements:

- HTTPS public origin
- Port `8080` or the host-provided `PORT`
- Health check at `/healthz`
- Enough memory and temporary disk for LibreOffice, Poppler, archive inspection, and ClamAV
- Outbound access to the allowed Supabase signed URLs and callback host
- No public processing access without the worker bearer token

Required worker environment:

| Variable | Requirement |
| --- | --- |
| `WORKER_API_TOKEN` | Required; at least 24 characters; must exactly match Supabase `DOCUMENT_SECURITY_WORKER_TOKEN` |
| `SUPABASE_PROJECT_REF` | Recommended: `didwxihufueqbpfnfdmm` |
| `ALLOWED_SOURCE_HOSTS` | Optional explicit allowlist when project-ref derivation is not used |
| `ALLOWED_CALLBACK_HOSTS` | Optional explicit allowlist when project-ref derivation is not used |
| `MAX_CONCURRENT_JOBS` | Optional; default `1` |
| `MAX_SCANNABLE_BYTES` | Optional; default 512 MiB |
| `MAX_SOURCE_BYTES` | Optional; default 5 GiB hard source limit |
| `CLAMAV_DATABASE` | Optional; default `/var/lib/clamav` |
| `CLAMAV_TIMEOUT_SECONDS` | Optional; default `300` |
| `FRESHCLAM_INTERVAL_SECONDS` | Optional; default `21600` |
| `PORT` | Optional; default `8080` |
| `WEB_CONCURRENCY` | Optional; default `1` |

After the container is healthy:

1. Set its HTTPS origin as `DOCUMENT_SECURITY_WORKER_URL` in Supabase.
2. Set the matching token in Supabase and the worker host.
3. Upload a harmless PDF and confirm it remains quarantined until the callback returns clean.
4. Confirm the clean file moves to its private destination and downloads only through a signed application request.
5. In an isolated test class, upload the standard EICAR test artifact and confirm it remains blocked.
6. Confirm previews are private and expire.
7. Confirm oversized, encrypted, malformed, and unsupported archives fail with a useful message.

References:

- Worker application: [`services/document-security-worker/app`](../services/document-security-worker/app)
- Container: [`services/document-security-worker/Dockerfile`](../services/document-security-worker/Dockerfile)
- Worker dependencies: [`services/document-security-worker/requirements.txt`](../services/document-security-worker/requirements.txt)
- Secure upload client: [`src/studio/resumableUpload.js`](../src/studio/resumableUpload.js)
- Security pipeline runbook: [`docs/PRODUCTION_SECURITY_1_10.md`](./PRODUCTION_SECURITY_1_10.md)

## 8. LiveKit Cloud setup

LiveKit Cloud is the selected provider. Provider selection is complete; account setup and deployment are not.

1. Create or select the production LiveKit Cloud project.
2. Copy the WebSocket URL, API key, and API secret.
3. Add all three only to Supabase Edge Function secrets.
4. Set a LiveKit budget alert.
5. Apply `20260719083000_live_office_hours_and_study_rooms.sql`.
6. Deploy `live-room-session`.
7. Test while `VITE_LIVE_ROOMS_ENABLED=false` in the public build.
8. After the acceptance matrix passes, change the GitHub variable to `true` and redeploy Pages.

The browser receives only a short-lived token from the Edge Function. It never receives the LiveKit API secret.

Initial release behavior:

- Audio is enabled.
- Camera access is disabled.
- Screen sharing is permission-controlled.
- Rooms inherit EdNotebook class access.
- Recording is off.

Still pending:

- Signed LiveKit webhook for authoritative room-end and usage updates
- Recording controls, indicators, consent flow, and egress verification
- Usage dashboards and automated cost limits inside EdNotebook

References:

- Client: [`src/live/LiveLearningRooms.jsx`](../src/live/LiveLearningRooms.jsx)
- Token function: [`supabase/functions/live-room-session/index.ts`](../supabase/functions/live-room-session/index.ts)
- Schema: [`supabase/migrations/20260719083000_live_office_hours_and_study_rooms.sql`](../supabase/migrations/20260719083000_live_office_hours_and_study_rooms.sql)
- Architecture: [`docs/live-office-hours-architecture.md`](./live-office-hours-architecture.md)

## 9. Payments: Stripe scaffold exists; Shopify is not connected

All visible plans remain free or "coming soon." Current class-required features must not depend on payment.

### Stripe status

The repository contains a server-side Stripe webhook scaffold with signature checks and idempotent event storage. It can process checkout completion, subscription changes, entitlement updates, and invoice state changes after the missing billing baseline and real Stripe configuration exist.

Not implemented:

- Checkout-session creation endpoint
- Customer portal
- Refund workflow
- Active production prices
- Completed entitlement/billing baseline in this repository
- Live paid buttons in the UI

Leave Stripe secrets unset and keep the paid-services waitlist until those pieces are tested end to end.

Stripe reference: [`supabase/functions/stripe-webhook/index.ts`](../supabase/functions/stripe-webhook/index.ts)

### Shopify status

Shopify is not connected. There is no Shopify package, API client, environment variable, webhook, product mapping, checkout path, or order-sync service in this repository. Do not describe Shopify as available. If Shopify is chosen later for physical or catalog sales, treat it as a separate integration project rather than a substitute switch for the existing Stripe entitlement scaffold.

## 10. Verification and release matrix

Do not call a feature live until its relevant row passes.

| Area | Required checks | Current expected result |
| --- | --- | --- |
| Owner access | Learner/professor denied `#/admin`; owner allowed; server review RPC succeeds | Must verify after migration |
| Account audit | Dry run reports only; inactive/test accounts are hidden; Reactivate restores visibility; no user deletion occurs | Implemented locally; deploy migration and worker |
| Signup | Email verification completes; confirmation leaves signup form; fresh login appears; duplicate email rejected | Verify in production Auth settings |
| Email change | New address verifies; same user UUID, profile, account number, and referrals remain | Implemented locally; deploy migration |
| Referral | Invite link captures inviter; one new account counts once; idle/test account can be hidden manually | Implemented locally; deploy migration |
| Student class link | New account claims link and joins the intended class; unrelated class remains inaccessible | Implemented locally; deploy migration |
| Directory | Live rows replace the clearly labeled demo fallback; K-12 and university results stay separate | Backend adapter exists; load real data |
| Educator verification | Pending request accepts only the requester’s scanning/quarantined file; approval fails until that same file is clean/released; deleted or blocked evidence cannot be approved | Corrected locally; verify pending, clean approval, blocked approval, and ownership cases in staging |
| Syllabus PDF/DOCX | Text appears in editable source; highlighted lines match extraction; edits refresh output; selected dates import once | Works on device; retest all target browsers |
| Paper scan | Rotate/crop/cleanup/OCR works; poor scans show warnings; exports download | Works on device; performance varies by device |
| Structured paper editor | Educator adds/removes/reorders sections; required cover/reference/appendix fields block submission when empty; student outline jumps to a section; structured/free-style save and reload; naming convention; Word-compatible `.doc` and print/PDF exports preserve order and headings | Works in the existing JSON save shape; verify with real assignment IDs and review final pagination in Word/PDF |
| Course and lesson creator | Pasted content creates the selected number of course-map entries on device; quiz/check counts carry into lesson starters; edits, undo/redo, preview, export, and publish controls remain usable; no direct provider request leaves the browser | On-device starter works; model-assisted generation is not connected and must not be advertised as live |
| Course isolation and publishing | Creating course B clears course A lesson state; exported/publication payload contains only current lesson IDs; a device draft cannot infer a class ID or create a cloud broadcast/enrollment link | Corrected locally; test two sequential courses and then explicitly bind a saved class in staging |
| Grades | Educator sees only managed-class rows; student sees only own rows; publish writes persist; share link is scoped and expires | UI/schema foundation; publishing/share service still incomplete |
| Sensitive educator area | Password re-entry required; tab hiding and five-minute timer re-lock | Client behavior implemented; server step-up still pending |
| Secure uploads | Quarantine, scan, callback, release, signed download, and deletion-request paths pass; reject callbacks without a valid SHA-256/size; reject replayed callbacks; keep the database record when Storage deletion returns an error | Hardened locally; requires baseline, worker host, secrets, and staging Edge invocation |
| Safe link previews | Allowed host succeeds; an unlisted host, private address, redirect to an unlisted host, and untrusted related image all fail closed | Hardened exact-host allowlist locally; set `LINK_PREVIEW_ALLOWED_HOSTS`, deploy, and verify in staging |
| Live rooms | Same-class users connect; outsider denied; audio works; camera never requested; share rule enforced; reconnect works | Requires LiveKit owner setup |
| Course broadcast | Guest link opens without account; course content matches preview; HTML export works offline | Local code; deploy publication migration |
| Public forms | Waitlist and feedback rows arrive; spam/rate controls work; admin can remove a row | Cloud insert exists; rate limiting/bot protection pending |
| Admin issue reports | Report from one device appears for the real owner on another device | Fails today: current demo inbox is localStorage only |
| Student social | K-12 and university separation, class membership, visibility, comments, blocks, and moderation persist | Mostly demo/local; production service pending |
| Activity Points and groups | Points never alter grades; duplicate awards fail safely; rewards cannot overdraw a balance; group choice follows the class rule; live quiz/poll/challenge is course-scoped and appears in a second client without refresh | Backend-ready in this PR; deploy to nonproduction and verify RLS, RPC, Realtime, and concurrency |
| Live class updates | A course change, assignment, announcement, message, or authorized group post appears in a second client without refresh; an outsider cannot subscribe to or load protected rows | Dashboard and service ready in this PR; deploy Realtime migration and verify with educator, learner, and outsider accounts |
| Payments | Signed webhook, duplicate event, price map, entitlement, checkout, cancellation, and refund tests | Payments off; do not run live charges |
| Fonts and images | No 404s, blurry guide portraits, unexpected font swaps, unreadable contrast, or clipped text | Recheck every final production build |
| Data-integrity hardening | Directory badge cannot be spoofed; unpublished grades stay hidden; verification evidence belongs to the requester and must be clean/released before approval; inactive/test accounts remain hidden; post author cannot change | Migration ready locally; audit historical rows and run live RLS/advisor tests after baseline repair |

### Device matrix

Minimum manual matrix:

- Windows: current Chrome, Edge, and Firefox
- macOS: current Safari and Chrome
- iPhone: physical Safari
- Android phone: physical Chrome
- iPad or comparable tablet: portrait and landscape
- Keyboard-only desktop navigation
- Browser zoom at 200 percent
- Reduced-motion preference

For LiveKit, test microphone permission, denied permission, screen-share permission, Wi-Fi/cellular change, background/foreground recovery, mute, leave, and rejoin on physical devices.

## 11. Three-click and five-minute acceptance

The product target is access to any core feature in three intentional clicks or fewer and completion of a normal simple task in five minutes or less. Lesson creation is the stated exception.

### How to count

- Count links, buttons, menu selections, or tab selections after the page is loaded.
- Do not count scrolling, typing, upload-file selection, or browser permission prompts as navigation clicks.
- Authentication and email delivery time are recorded separately; do not hide them inside the product-task time.
- Test from the home page, each audience landing page, and each signed-in dashboard.

### Navigation checks

| Starting point | Destination | Maximum path |
| --- | --- | --- |
| Home | University syllabus scanner | Students -> University -> Scanner, or Find a feature -> Scanner |
| Home | K-12 scanner | Students -> K-12 -> Scanner |
| Home | Professor lesson creator | Professors -> Lesson creator |
| Any public portal | About, careers, tour, sign in, scanner, or audience switch | Footer or Find a feature in no more than 3 clicks |
| Student dashboard | Any student feature | Find a feature or mobile feature selector -> feature |
| Professor dashboard | Any educator feature | Find a feature or sidebar/mobile selector -> feature |
| Assignment screen | Paper outline, section writing, free-style page, or export | Open assignment -> Customize/outline control -> selected section or export |
| Mobile page | Compact or desktop-style view | Footer/feature finder -> Page view -> Auto, Compact, or Full |

Relevant navigation implementation:

- Feature finder: [`src/FeatureFinder.jsx`](../src/FeatureFinder.jsx)
- Footer directory: [`src/SiteFooter.jsx`](../src/SiteFooter.jsx)
- View selector: [`src/LayoutViewToggle.jsx`](../src/LayoutViewToggle.jsx)
- Responsive/full-layout rules: [`src/site-navigation.css`](../src/site-navigation.css)

`Auto` follows the device, `Compact` stacks the interface, and `Full` keeps an approximately 1100-pixel desktop layout with horizontal panning on smaller screens. Verify that Full mode remains readable and that controls are not trapped off-screen.

### Timed task checks

Time these with a first-time tester:

- Locate and open a featured scanner: under 30 seconds.
- Extract a normal text-based syllabus and reach editable review: target 60 seconds or less.
- Correct one extracted date and add it to the calendar: under 5 minutes.
- Find a school/class and request access: under 5 minutes.
- Create a basic assignment template with one word-limited response: under 5 minutes.
- Create a structured paper template, reorder one section, and preview it as a student: under 5 minutes.
- Open a structured assignment, jump from the outline to one required section, save, and export: under 5 minutes excluding writing time.
- Start office hours after a class already exists: under 5 minutes.
- Preview and create a course broadcast link after content exists: under 5 minutes.
- Check Activity Points, open the ledger, and join an open student-choice group: under 5 minutes after the service is connected.
- Change email, visibility, or layout mode: under 5 minutes, excluding external email delivery.

Paper OCR, very large documents, network-dependent scanning, and lesson authoring should report their real processing time instead of promising a fixed result.

## 12. Technology stack and declared versions

Versions below come from the current repository files, not a general product description.

### Web application

| Technology | Declared version | Use |
| --- | --- | --- |
| React | `^18.3.1` | Interface and dashboards |
| React DOM | `^18.3.1` | Browser rendering |
| Vite | `8.1.5` | Development and production build |
| `@vitejs/plugin-react` | `6.0.3` | React/Vite integration |
| Node.js in CI | `22` | GitHub Actions build runtime |
| Supabase JS | `^2.57.4` | Auth, database, storage, RPC, Edge Functions |
| LiveKit client | `^2.20.1` | Browser audio and screen sharing |
| LiveKit components | `^2.9.23` | LiveKit UI foundation |
| pdf.js | `6.1.200` | PDF text extraction |
| Mammoth | `1.12.0` | DOCX text extraction |
| Tesseract.js | `7.0.0` | Browser OCR |
| OpenCV.js web | `4.13.0-release.1` | Scan cleanup and image processing |
| jsPDF | `4.2.1` | PDF export |
| tus-js-client | `4.3.1` | Resumable secure uploads |

Source: [`package.json`](../package.json)

### Capacitor app-bundle readiness

The existing React controls remain standard web controls; no Ionic component library or other button framework was added. Every JSX `<button>` has an explicit `type`, the hash router does not depend on server rewrite rules, touch actions use normal browser behavior, safe-area viewport insets are exposed, and Vite already produces the required `dist/index.html` bundle.

- Native bundle configuration: [`capacitor.config.json`](../capacitor.config.json)
- Repeatable web-bundle check: `npm run verify:app-bundle`
- Readiness checker: [`scripts/check-capacitor-ready.mjs`](../scripts/check-capacitor-ready.mjs)

The configuration deliberately has no production `server.url`, cleartext traffic, mixed-content access, or extra navigation allowlist. It uses `dist` as `webDir` and keeps `localhost` so secure-context browser APIs remain available inside the WebView.

Capacitor runtime packages and generated `ios/` and `android/` projects are not committed yet. Before creating them, confirm that `com.transformontologysystems.ednotebook` is the final permanent bundle/application ID. Then install matching Capacitor 8 core, CLI, iOS, and Android versions; run `npm run build`; add each platform; run `npx cap sync`; and test on physical iOS and Android devices. The native pass must cover authentication redirects, email verification links, file selection, syllabus scanning/OCR, downloads/exports, sharing, microphone/screen-share permissions, native back behavior, keyboard avoidance, safe areas, and external links. Browser success alone does not certify those native behaviors.

Official references: [installing Capacitor in an existing web app](https://capacitorjs.com/docs/getting-started), [configuration schema](https://capacitorjs.com/docs/config), and [build/sync/native testing workflow](https://capacitorjs.com/docs/basics/workflow).

### Website link-preview card

After this branch is merged and GitHub Pages deploys it, a shared `https://ednotebook.com` link declares:

- Title: **EdNotebook — Learning made simple**
- Description: **Find your classes. Find your people. Keep learning in one place. Join EdNotebook free.**
- Image: [`public/ednotebook-share-card-v2.png`](../public/ednotebook-share-card-v2.png)
- Canonical URL: `https://ednotebook.com/`

Open Graph image URL, secure URL, PNG type, dimensions, alt text, Twitter/X large-card tags, and the canonical URL are all explicit in [`index.html`](../index.html). The image is also used by the in-site share/download controls so the downloaded invitation matches the link preview.

Before this branch is merged, production still serves the older card and older title. Link-preview services cache metadata, so after deployment validate with fresh platform debugger requests and a new query-string test URL rather than assuming an old message thread will refresh. Because the application uses `#/...` routes on static GitHub Pages, every hash route receives the same root preview: URL fragments are not sent in the HTTP request. Audience- or course-specific cards require future path-based, server-rendered share URLs; do not expose private course data in those cards.

### Edge Functions

| Technology | Declared version | Use |
| --- | --- | --- |
| Deno in CI | `2.x` | Edge Function type-check/runtime target |
| Supabase JS | `2.57.4` | Edge database and auth clients |
| LiveKit server SDK | `2.17.0` | Short-lived room tokens |
| Stripe SDK | `22.1.1` | Webhook signature and event handling |

### Document worker

| Technology | Declared version | Use |
| --- | --- | --- |
| Python image | `3.12-slim-bookworm` | Container runtime |
| FastAPI | `0.116.1` | Worker HTTP API |
| Uvicorn | `0.35.0` | Worker server |
| Pydantic | `2.11.7` | Request/result validation |
| HTTPX | `0.28.1` | Bounded source/callback requests |
| pypdf | `5.8.0` | PDF inspection/extraction |
| python-docx | `1.2.0` | Word processing |
| python-pptx | `1.0.2` | Presentation processing |
| EbookLib | `0.19` | Ebook processing |
| Pillow | `11.3.0` | Image processing |
| Beautiful Soup | `4.13.4` | Safe document/HTML parsing |
| python-magic | `0.4.27` | File-type inspection |
| ClamAV, LibreOffice, Poppler | Debian Bookworm packages at image-build time | Malware scan, conversion, PDF tools |

Sources: [`services/document-security-worker/requirements.txt`](../services/document-security-worker/requirements.txt) and [`services/document-security-worker/Dockerfile`](../services/document-security-worker/Dockerfile)

### Hosting and services

- GitHub Pages: static web hosting and custom domain
- Supabase: Auth, Postgres, RLS, Storage, and Edge Functions
- LiveKit Cloud: selected live audio/screen-share provider
- GitHub Container Registry: document-worker image publishing
- External always-on container host: still owner-selected
- Stripe: inactive webhook scaffold
- Shopify: not connected

## 13. Points, rewards, and class groups - implementation in this PR; deploy the new migration

The implementation is now present in this working tree:

- Migration: [`20260719160000_engagement_points_groups_activities.sql`](../supabase/migrations/20260719160000_engagement_points_groups_activities.sql)
- Shared student/educator screen: [`src/portal/EngagementPoints.jsx`](../src/portal/EngagementPoints.jsx)
- Dashboard entries: [`src/portal/StudentDashboard.jsx`](../src/portal/StudentDashboard.jsx) and [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx)

The migration and service adapter add:

- Assignment point rules, an append-only point ledger, calculated balances, optional reward definitions, unlock records, and class-wide goals.
- Teacher-assigned or student-choice class groups with one active group per learner per course.
- Course-scoped quizzes, polls, group challenges, questions, options, participants, and responses.
- Thirteen RLS-enabled tables with course-scoped read policies and direct client table mutations revoked.
- Authenticated public RPC wrappers that delegate to private functions which check active account state and course access before awarding, claiming, spending, joining, or responding.
- A per-course, per-learner idempotency key to prevent the same logical point award from being inserted twice.
- A balance trigger and a no-update/no-delete trigger for the ledger. Activity Points are deliberately separate from grades.
- Guarded Supabase Realtime publication plus course-filtered subscriptions for points, rewards, groups, and classroom activity changes.
- Browser query/mutation/subscription functions in [`src/portal/portalService.js`](../src/portal/portalService.js), with aligned values such as `quiz`, `poll`, `group_challenge`, `teacher_assign`, and `student_choice`.
- Student and educator dashboards subscribe to the selected class and refresh the points screen after a matching database change; the explicit reload control remains available for connection recovery.

The React screen exposes the intended student balance/history, reward, group, and activity views plus educator controls. It also behaves honestly when the backend is unavailable: it labels itself **Setup preview only** and disables mutations.

The implementation is backend-ready, not deployed or production-accepted. Before enabling it for real classes, finish and review all of the following:

1. Pass the baseline gate in Section 3; this migration depends on `profiles`, `courses`, `course_memberships`, `assignments`, assignment-submission tables, and the course-access helpers that are missing from this repository's migration baseline.
2. Review the new RLS policies and RPC grants in a pull-request SQL review, then run `supabase db push --dry-run`, database lint, and both database advisors on a clean nonproduction project.
3. Apply all pending migrations in timestamp order in nonproduction. The engagement migration depends on `20260719044500_account_referrals_and_activity.sql` for account-audit state.
4. Confirm every engagement table appears in the `supabase_realtime` publication and that two open clients receive changes without manual refresh. Keep the explicit refresh action only as a recovery control.
5. Test with at least three accounts: one educator, one enrolled learner, and one outsider. Confirm the outsider cannot read or mutate the course; a learner cannot self-award; duplicate awards do not double-count; spending cannot create a negative balance; teacher-assigned groups cannot be self-selected; and inactive/test accounts cannot mutate.
6. Test simultaneous reward unlocks, group joins, activity starts/closes, and response submissions so row locking, capacity, one-response, and nonnegative-balance checks hold under concurrency.
7. Verify the UI falls back to **Setup preview only** when Supabase is unavailable and never reports a successful mutation that the server rejected.
8. Add operational monitoring for RPC errors, Realtime disconnects, unusual award volume, and repeated idempotency-key conflicts before a broad launch.

This release uses filtered Postgres Changes because it is the smallest reliable path for early testing. Supabase currently recommends private Broadcast with database triggers for most higher-scale use cases and notes that Postgres Changes can bottleneck as volume grows. Revisit the transport after measuring concurrent connections, event volume, replication lag, and errors in Realtime reports. References: [database-change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Postgres Changes setup and filters](https://supabase.com/docs/guides/realtime/postgres-changes), and [Realtime reports](https://supabase.com/docs/guides/realtime/reports).

Until those items pass, the precise status is: **backend-ready in this PR; deploy to nonproduction and complete RLS, concurrency, Realtime, and three-account acceptance before production**.

### Classroom-interaction patterns researched

The quick-activity design uses familiar classroom patterns without copying another product's branding or interface:

- [Kahoot for schools](https://kahoot.com/schools/how-it-works/) supports teacher-led and student-paced activities, question types such as quizzes, polls, word clouds, and open responses, team play, timers, points, and reports. EdNotebook starts with a smaller course-scoped quiz, poll, and group-challenge set so an educator can launch an activity quickly from the same class workspace.
- [Poll Everywhere's getting-started guide](https://support.polleverywhere.com/hc/en-us/articles/1260801556389-Getting-started) centers a projected activity, student-device responses, and results that update live. EdNotebook follows that live-response loop and keeps the manual refresh action only as a fallback.
- [Mentimeter's educator guide](https://help.mentimeter.com/en/articles/11378575-an-educator-s-guide-to-mentimeter) includes multiple choice, word clouds, open-ended responses, scales, rankings, quiz competitions, and Q&A. Those are the appropriate next activity types after the first quiz/poll/challenge release is secure and measured.

Do not add every game type at once. First verify course isolation, clear action labels, realtime reliability, accessibility, response recovery, and professor controls. Then add word clouds, ranked choices, Q&A, flash cards, and team rounds behind the same activity model.

## 14. Feature inventory

Status meanings:

- **Works on device** - usable without a backend deployment; data may remain in the browser.
- **Backend-ready; deploy/verify** - code/schema exists locally but owner setup or production deployment is still required.
- **Mixed** - some real connections exist while visible portions remain sample, local, or disconnected.
- **Preview/demo** - intentionally illustrative; not a production data service.
- **Planned** - no complete working integration exists.

| Feature | Purpose | Technology | Status | Main references |
| --- | --- | --- | --- | --- |
| Audience portal chooser | Send users to university, K-12, educator, or publishing paths | React hash routing | Works on device | [`src/portal/PortalHome.jsx`](../src/portal/PortalHome.jsx), [`src/main.jsx`](../src/main.jsx) |
| Feature finder | Reach core features within three clicks | React feature registry | Works on device | [`src/FeatureFinder.jsx`](../src/FeatureFinder.jsx) |
| Footer directory | Keep broad navigation out of the main interface | React links | Works on device | [`src/SiteFooter.jsx`](../src/SiteFooter.jsx) |
| Website link preview and share graphic | Show a controlled EdNotebook title, description, and invitation image in messages and social embeds | Open Graph, Twitter card metadata, PNG share card | Ready in this PR; visible after merge/deploy and cache refresh | [`index.html`](../index.html), [`public/ednotebook-share-card-v2.png`](../public/ednotebook-share-card-v2.png), [`src/portal/ShareEdNotebook.jsx`](../src/portal/ShareEdNotebook.jsx) |
| Auto/Compact/Full view | Responsive layout plus desktop-style panning on small screens | React, CSS, localStorage | Works on device | [`src/LayoutViewToggle.jsx`](../src/LayoutViewToggle.jsx), [`src/site-navigation.css`](../src/site-navigation.css) |
| Capacitor web bundle | Preserve the existing web controls in future iOS/Android shells | Vite `dist`, Capacitor JSON config, safe-area CSS, readiness check | Web bundle ready; native projects and physical-device acceptance still required | [`capacitor.config.json`](../capacitor.config.json), [`scripts/check-capacitor-ready.mjs`](../scripts/check-capacitor-ready.mjs) |
| Brooke/Jaylen/Atlas tours | Explain each audience and let guests explore | React demo/persona engine | Works on device; demo data | [`src/demo/DemoExperience.jsx`](../src/demo/DemoExperience.jsx), [`src/demo/personas.js`](../src/demo/personas.js) |
| Guest syllabus scanner | Try the main student feature before signup | React scanner workspace | Works on device | [`src/portal/FeaturedProductExperience.jsx`](../src/portal/FeaturedProductExperience.jsx), [`src/demo/WorkspaceSyllabus.jsx`](../src/demo/WorkspaceSyllabus.jsx) |
| PDF syllabus extraction | Put PDF text into editable review | pdf.js | Works on device | [`src/demo/syllabusFileExtractors.js`](../src/demo/syllabusFileExtractors.js) |
| DOCX syllabus extraction | Put Word text into editable review | Mammoth | Works on device | [`src/demo/syllabusFileExtractors.js`](../src/demo/syllabusFileExtractors.js) |
| Paper syllabus scanning | Crop, clean, OCR, review, and export paper pages | OpenCV.js, Tesseract.js, jsPDF | Works on device; device performance varies | [`src/demo/SyllabusScanner.jsx`](../src/demo/SyllabusScanner.jsx), [`src/demo/syllabusScannerPipeline.js`](../src/demo/syllabusScannerPipeline.js) |
| Editable extraction and calendar | Correct source/output before adding dates; export calendar | React, browser state, ICS generation | Works on device | [`src/demo/WorkspaceSyllabus.jsx`](../src/demo/WorkspaceSyllabus.jsx), [`src/demo/WorkspaceCalendar.jsx`](../src/demo/WorkspaceCalendar.jsx) |
| Source/citation workspace | Save sources and format APA/MLA previews | React citation formatter, localStorage | Works on device; cloud document preview is mixed | [`src/demo/WorkspaceLibrary.jsx`](../src/demo/WorkspaceLibrary.jsx), [`src/demo/citationTools.js`](../src/demo/citationTools.js) |
| Built-in workspace assistant | Answer from current workspace context and clarify class/date questions | Local intent/context engine | Works on device; not a managed model service | [`src/demo/WorkspaceCommunityTools.jsx`](../src/demo/WorkspaceCommunityTools.jsx) |
| External assistant connector | Let a user call their own OpenAI/Claude gateway | HTTPS gateway URL and tab-scoped bearer token | Backend supplied by user; no EdNotebook provider gateway | [`src/AccountSettings.jsx`](../src/AccountSettings.jsx), [`src/demo/WorkspaceCommunityTools.jsx`](../src/demo/WorkspaceCommunityTools.jsx) |
| Auth and email verification | Create and protect student/educator accounts | Supabase Auth PKCE | Connected foundation; production settings must be verified | [`src/AuthGate.jsx`](../src/AuthGate.jsx), [`src/supabaseClient.js`](../src/supabaseClient.js) |
| Account number and referrals | Link invitations and unlock limited extras | Supabase Postgres/RPC | Backend-ready; deploy migration | [`20260719044500_account_referrals_and_activity.sql`](../supabase/migrations/20260719044500_account_referrals_and_activity.sql), [`src/AccountSettings.jsx`](../src/AccountSettings.jsx) |
| Email change | Verify a new email while retaining the account | Supabase Auth plus profile sync trigger | Backend-ready; deploy migration and test redirects | [`src/AccountSettings.jsx`](../src/AccountSettings.jsx), [`20260719044500_account_referrals_and_activity.sql`](../supabase/migrations/20260719044500_account_referrals_and_activity.sql) |
| University finder and class search | Browse Texas institutions and published classes before signup | Static Texas list plus Supabase directory fallback | Mixed; real listings require data | [`src/portal/UniversityFinder.jsx`](../src/portal/UniversityFinder.jsx), [`src/portal/texasUniversities.js`](../src/portal/texasUniversities.js), [`src/portal/ClassDirectory.jsx`](../src/portal/ClassDirectory.jsx) |
| Educator class publishing | Publish searchable class metadata | Supabase Postgres/RLS | Schema foundation; dashboard sync incomplete | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx), [`20260718230234_student_professor_portals.sql`](../supabase/migrations/20260718230234_student_professor_portals.sql) |
| Course studio | Customize, preview, broadcast, and export standalone HTML | React, generated HTML, Supabase publication rows | HTML works on device; cloud links need migration | [`src/CoursePublishingStudio.jsx`](../src/CoursePublishingStudio.jsx), [`src/coursePublishingService.js`](../src/coursePublishingService.js) |
| Automatic class signup link | Enroll a signed-in student from an educator link | Hashed token, Supabase RPC | Backend-ready; deploy migration | [`src/CourseJoinExperience.jsx`](../src/CourseJoinExperience.jsx), [`20260719044500_account_referrals_and_activity.sql`](../supabase/migrations/20260719044500_account_referrals_and_activity.sql) |
| Roster import and approval | Match students to classes and approve enrollment | Supabase schema/RPC; current browser identifier hash | Mixed; server HMAC service still planned | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx), [`src/portal/portalService.js`](../src/portal/portalService.js) |
| Assignment and paper templates | Let educators create fill-in sections, word limits, drag-and-drop paper outlines, required elements, cover details, headers, footers, references, appendices, and naming rules | React editor; existing template JSON; Supabase templates/submissions | Works in the existing data shape; verify persistence and historical-template compatibility after migration | [`src/portal/AssignmentTemplateWorkspace.jsx`](../src/portal/AssignmentTemplateWorkspace.jsx), [`20260719010923_assignment_template_editor.sql`](../supabase/migrations/20260719010923_assignment_template_editor.sql) |
| Full-page and section writing editor | Complete assignments by guided section or free-style page; see an outline and completion state; save one assembled paper; export Word-compatible `.doc` or print/PDF | React content editor, local/cloud draft paths, structure-aware HTML export | Mixed device/cloud paths; verify real assignment persistence and final pagination | [`src/portal/AssignmentTemplateWorkspace.jsx`](../src/portal/AssignmentTemplateWorkspace.jsx), [`src/studio/AssignmentWorkspace.jsx`](../src/studio/AssignmentWorkspace.jsx) |
| Course-map and lesson starter | Turn pasted course material into an editable map and section-based lesson starter without a browser-held provider key | React, deterministic on-device organizer, existing course editor/history | Works on device; provider-assisted generation is not connected | [`src/Builder.jsx`](../src/Builder.jsx) |
| Gradebook and student report | Show pending/missing/final grades, weights, and calculator | React plus grade schema | Preview/mixed; real publishing and sharing are incomplete | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx), [`src/portal/StudentDashboard.jsx`](../src/portal/StudentDashboard.jsx), [`20260718230234_student_professor_portals.sql`](../supabase/migrations/20260718230234_student_professor_portals.sql) |
| Educator sensitive-area lock | Recheck password and auto-lock roster/grade views | Supabase Auth password check, client timer | Client protection works; server step-up planned | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx) |
| Student notes | Keep notes beside classes | localStorage | Works on device; signed-in sync pending | [`src/portal/StudentDashboard.jsx`](../src/portal/StudentDashboard.jsx) |
| Student messages | Short-lived device conversations | sessionStorage | Preview/device-only; sync is planned | [`src/portal/StudentDashboard.jsx`](../src/portal/StudentDashboard.jsx) |
| Student page and visibility | Build a simple profile and control discovery | React plus student profile table foundation | Mixed; some settings persist locally, cloud profile save exists | [`src/portal/StudentDashboard.jsx`](../src/portal/StudentDashboard.jsx), [`20260718230234_student_professor_portals.sql`](../supabase/migrations/20260718230234_student_professor_portals.sql) |
| Student social/story feed | Explore guide stories, posts, reactions, saves, comments, and audiences | React story engine, localStorage, sample content | Preview/demo; production moderation and persistence pending | [`src/demo/storyEngine.js`](../src/demo/storyEngine.js), [`src/demo/WorkspaceCommunityTools.jsx`](../src/demo/WorkspaceCommunityTools.jsx) |
| Live class updates | Keep assignments, announcements, class messages, and authorized group posts current without a page reload | React, Supabase RLS, filtered Postgres Changes subscriptions | Backend-ready in this PR; deploy publication migration and run three-account acceptance | [`src/portal/LiveCourseUpdates.jsx`](../src/portal/LiveCourseUpdates.jsx), [`src/portal/portalRealtimeService.js`](../src/portal/portalRealtimeService.js), [`20260719185200_enable_core_course_realtime.sql`](../supabase/migrations/20260719185200_enable_core_course_realtime.sql) |
| Points/rewards/class groups | Reward participation without changing grades; support optional unlocks, groups, and quick class activities | React shared screen, Supabase RLS/RPC/Realtime, portal service adapter | Backend-ready in this PR; nonproduction deployment and acceptance required | [`src/portal/EngagementPoints.jsx`](../src/portal/EngagementPoints.jsx), [`src/portal/portalService.js`](../src/portal/portalService.js), [`20260719160000_engagement_points_groups_activities.sql`](../supabase/migrations/20260719160000_engagement_points_groups_activities.sql) |
| Live office hours/study rooms | Audio-first class rooms with screen sharing | LiveKit Cloud, Supabase token function and RLS | Backend-ready; owner setup/deploy/physical-device tests required | [`src/live/LiveLearningRooms.jsx`](../src/live/LiveLearningRooms.jsx), [`20260719083000_live_office_hours_and_study_rooms.sql`](../supabase/migrations/20260719083000_live_office_hours_and_study_rooms.sql) |
| Manual educator affiliation | Add a reviewed school badge without blocking educator tools | Secure upload, Supabase RPC, admin queue | Backend-ready; scanner worker and admin role required | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx), [`src/portal/PlatformAdminDashboard.jsx`](../src/portal/PlatformAdminDashboard.jsx) |
| Account audit | Hide inactive/test accounts and reactivate manually | Supabase RPC, retention worker, admin UI | Backend-ready; deploy migration/worker | [`supabase/functions/retention-worker/index.ts`](../supabase/functions/retention-worker/index.ts), [`src/portal/PlatformAdminDashboard.jsx`](../src/portal/PlatformAdminDashboard.jsx) |
| Release data-integrity hardening | Prevent badge spoofing, unpublished-grade exposure, cross-course grade mismatches, verification-file misuse, account-audit tampering, inactive/test discovery, and post-author impersonation | Postgres triggers, RLS, column grants, private helpers, forward migration | Ready locally; requires baseline repair, historical-row audit, nonproduction apply, and live RLS/advisor tests | [`20260719213000_release_security_data_integrity_hardening.sql`](../supabase/migrations/20260719213000_release_security_data_integrity_hardening.sql) |
| Waitlist, feedback, opportunities | Collect product interest from public pages | Supabase table and direct insert | Connected foundation; rate limiting/bot controls pending | [`src/portal/InterestForm.jsx`](../src/portal/InterestForm.jsx), [`20260719031619_portal_waitlist_and_profile_discovery.sql`](../supabase/migrations/20260719031619_portal_waitlist_and_profile_discovery.sql) |
| Syllabus issue inbox | Send extraction problems to the owner | Current localStorage demo inbox | Preview only; cross-device admin delivery not connected | [`src/demo/WorkspaceSyllabus.jsx`](../src/demo/WorkspaceSyllabus.jsx), [`src/portal/PlatformAdminDashboard.jsx`](../src/portal/PlatformAdminDashboard.jsx) |
| Secure cloud files | Quarantine, scan, preview, release, signed download, and controlled deletion | Supabase Storage/TUS, Edge Functions, Python worker | Callback replay/hash/size and Storage-error handling are hardened locally; requires missing baseline, worker deployment, and staging Edge tests | [`src/studio/resumableUpload.js`](../src/studio/resumableUpload.js), [`supabase/functions`](../supabase/functions), [`services/document-security-worker`](../services/document-security-worker) |
| Safe link preview | Inspect approved external page metadata server-side without becoming an open network fetcher | Supabase Edge Function, exact-host allowlist, bounded fetch, redirect/related-URL checks | Hardened fail-closed locally; configure `LINK_PREVIEW_ALLOWED_HOSTS`, deploy, and verify allowed/blocked redirects in staging | [`supabase/functions/link-preview/index.ts`](../supabase/functions/link-preview/index.ts), [`src/studio/MaterialsWorkspace.jsx`](../src/studio/MaterialsWorkspace.jsx) |
| Publishing/EduBook studio | Create course-ready readings, previews, and publication records | React studio, Supabase, document worker | Mixed; commercial partner path is preview | [`src/studio/PublisherStudio.jsx`](../src/studio/PublisherStudio.jsx), [`docs/EDUBOOK_SPEC.md`](./EDUBOOK_SPEC.md) |
| PowerSchool/SIS sync | Import attendance and pass grades | No active connector | Planned; controls remain disabled | [`src/portal/ProfessorDashboard.jsx`](../src/portal/ProfessorDashboard.jsx), [`docs/PORTAL_ROLLOUT.md`](./PORTAL_ROLLOUT.md) |
| Stripe payments | Optional future paid services | Stripe webhook and entitlement scaffold | Inactive scaffold; no checkout | [`supabase/functions/stripe-webhook/index.ts`](../supabase/functions/stripe-webhook/index.ts) |
| Shopify | Future commerce option if selected | No implementation | Not connected | No repository implementation |

## 15. TalentLMS creator benchmark and EdNotebook fit

TalentLMS is a useful benchmark for page order and plain-language product marketing, not a copy source. EdNotebook should keep its own words, visual system, audience, and product claims. The educator landing page in this release follows the same useful decision sequence—outcome, proof of ease, how it works, content types, editing tools, feature status, then signup—using original EdNotebook copy.

Official benchmark pages reviewed: [TalentCraft](https://www.talentlms.com/talentcraft), [TalentLMS course creation](https://www.talentlms.com/create-online-courses), [TalentLMS AI feature guide](https://help.talentlms.com/hc/en-us/articles/18209693273372-What-are-the-TalentLMS-AI-features), [TalentLMS security](https://www.talentlms.com/security), and [TalentLMS accessibility](https://www.talentlms.com/accessibility).

| Benchmark capability | EdNotebook position | Action |
| --- | --- | --- |
| Fast document-to-course start | PDF/DOCX syllabus extraction, editable review, deterministic course map, and lesson starter work locally | Keep the 60-second scanner and under-five-minute starter promises tied to review/start, not a finished comprehensive course |
| Visual course editing and responsive previews | Course builder, structured paper editor, pop-out studio, compact/full layout switch, HTML preview/export, and guest broadcast exist | Verify desktop/tablet/mobile preview and exported HTML in the release matrix |
| Text improvement commands | Browser spelling/formatting and external assistant connector exist; hosted rewrite actions are not connected | Show Improve writing, Continue, Make longer/shorter, tone, translation, and question generation as **Coming soon** until a server-side model gateway, consent controls, and tests exist |
| Visual content generation | Images, video links, slides, charts, scanner output, and media workspaces exist; generative image/thumbnail creation is not an EdNotebook service | Show AI image/thumbnail generation as **Coming soon** |
| Interactive learning blocks | Quizzes, polls, challenges, assignments, points, groups, discussions, live rooms, flashcards/lesson patterns, and public course broadcast foundations exist | Verify persistence and Realtime; list interactive-video questions and labeled graphics as **Coming soon** |
| Standards-based package import | Standalone HTML export exists; SCORM/xAPI/cmi5 import and export do not | Keep SCORM/xAPI/cmi5 clearly marked **Coming soon**; do not imply compatibility yet |
| Skills, learning paths, libraries, and analytics | Classes, assignments, progress, grades, points, and reports have foundations | Treat managed skill paths, a ready-made content library, scheduled reports, and adaptive practice as future complements |
| Accessibility evidence | Keyboard focus, reduced motion, labeled controls, responsive layouts, and a skip-to-content control are in the code | Run automated and manual WCAG 2.2 AA testing, remediate issues, then commission an independent audit/VPAT before making a conformance claim |

TalentLMS states that it holds ISO/IEC 27001:2022 and ISO 9001:2015 certifications. Those certifications belong to TalentLMS/Epignosis; they do not transfer through feature similarity or the use of Supabase, GitHub Pages, LiveKit, or any other vendor. EdNotebook must not display either badge or claim certification until Transform Ontology Systems defines the certification scope, operates the required management systems, completes independent audits, and receives its own current certificates.

## 16. Owner action order

Use this order; later steps depend on earlier ones.

1. Create and verify the dedicated owner account, then assign `profiles.role = 'owner'` by exact UUID.
2. Run the Supabase baseline preflight. Stop and repair the baseline if any required object is absent.
3. Audit historical directory identity/status, grade course and publication state, educator-verification file ownership/status, and social-post authors before validating the corrective foreign key.
4. Verify GitHub CLI authentication and review the final diff so only intended files are committed.
5. Configure GitHub Actions variables/secrets.
6. Configure non-Stripe Supabase Edge secrets, including exact custom-domain origins.
7. Run migration list and dry run; apply migrations only after the baseline and historical-row gates pass.
8. Deploy the changed retention and LiveKit functions; verify JWT behavior from `supabase/config.toml`.
9. Deploy the document worker and complete harmless/blocked-file tests.
10. Complete LiveKit Cloud acceptance with two same-class accounts and one outsider account.
11. Turn on `VITE_LIVE_ROOMS_ENABLED` only after the LiveKit gate passes.
12. Run the full browser/device, three-click, five-minute, font, image, placeholder, structured-paper, and data-mode matrix.
13. Keep paid buttons on the waitlist. Stripe remains inactive and Shopify remains unconnected.
14. Deploy the engagement migration to nonproduction, then run the RLS, Realtime, three-account, and concurrency tests in Section 13.
15. Confirm the permanent Capacitor app ID, generate native projects, and complete the physical-device matrix before any app-store release. This does not block the web release.
16. Run WCAG 2.2 AA automated, keyboard, screen-reader, 200-percent zoom, and 320-pixel reflow checks; obtain an independent audit/VPAT before making an accessibility-conformance claim. Do not display ISO badges unless EdNotebook completes its own scoped certification audits.
17. Push the final branch, wait for GitHub Pages and security jobs, and retest both production domains in a private window.

## 17. Release decision

Do not invite external testers to cloud-backed courses until all of these are true:

- The missing Supabase baseline has been recovered into the repository or conclusively reconciled and proven on a clean nonproduction project.
- Owner access and all platform-manager RPCs work server-side.
- The pending migrations and changed functions are deployed.
- Custom-domain CORS, GitHub build variables, and Auth redirects are correct.
- The document worker is healthy or cloud uploads are clearly disabled.
- LiveKit is either fully accepted or remains behind its disabled feature flag.
- Activity Points remain in labeled setup preview until the migration is deployed and its RLS, RPC, Realtime, and concurrency acceptance tests pass.
- Demo, local-only, disabled, and coming-soon areas remain plainly labeled.
- No automatic account deletion exists.
- Core feature paths meet the three-click goal on desktop and mobile.
- Timed simple tasks meet the five-minute target or display an honest processing-time message.
