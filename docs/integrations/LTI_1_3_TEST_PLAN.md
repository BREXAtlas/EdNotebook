# LTI 1.3 pilot test plan

Use synthetic or institution-approved test records in a non-production Blackboard course. Record tester, timestamp, Blackboard release, deployment, expected/actual result, redacted evidence, issue, and disposition. Do not paste JWTs, access tokens, student records, or private keys into tickets.

## Automated checks

- `npm run test:lti`
- `npm run test:blackboard`
- `npm run build`
- `npm run audit:bundle`
- `deno check --config supabase/functions/deno.json supabase/functions/_shared/*.ts supabase/functions/*/index.ts`
- `deno test --config supabase/functions/deno.json supabase/functions/_shared/lti/*.test.ts`

These check standard scopes/states, canonical model compatibility, RLS/grants, hashed secrets, activation gates, claim validation, target/service allowlists, cryptography, and public-bundle separation.

## Registration and key tests

- Configuration JSON contains the expected production URLs.
- JWKS exposes current public RSA key and no private members (`d`, `p`, `q`, `dp`, `dq`, `qi`).
- Blackboard selects the expected `kid`.
- Current key signs launch/service responses; previous key works only during planned rotation.
- Setup/testing/suspended records do not behave as active.

## Negative launch/security tests

Each case must fail without a browser session or durable mapping change:

- unknown issuer, client ID, or deployment ID;
- wrong `aud` or missing/wrong `azp` for multiple audiences;
- unknown `kid`, non-RS256 algorithm, altered signature;
- missing/wrong/replayed/expired state or nonce;
- expired/future/old JWT time;
- wrong LTI version or unsupported message type;
- changed/unregistered target-link URL;
- service, JWKS, token, return, or pagination URL on an unregistered host;
- learner role invoking instructor, Deep Linking, NRPS, or AGS action;
- expired/revoked opaque launch handle;
- raw JWT or token absent from database, browser storage, console, and logs.

## Instructor launch and course mapping

- Instructor launch reaches `#/lti/instructor` through the server validator.
- First launch creates a pending context only; it does not create/overwrite an EdNotebook course.
- Owner sees familiar Blackboard context label/title/ID.
- Owner can map only a course in the same institution.
- Wrong-institution and unauthorized mappings fail.
- Existing educator account links explicitly and gains no cross-course authority.

## Learner launch

- Learner launch records learner-role evidence and reaches `#/lti/student`.
- Name/email do not silently map an account.
- Explicit current-account linking uses the signed LTI subject.
- Published resource opens only after active resource/context mapping.
- A pending/disabled/other-course resource is blocked.
- Refresh/new-tab continuation works while launch handle is valid; expired handle produces a clear safe error.

## Deep Linking

- Instructor sees only content belonging to the mapped EdNotebook course.
- Whole course, published package, and assignment links return to Blackboard.
- Optional line-item metadata uses correct label, maximum, resource ID, tag, and due date.
- Blackboard creates the link; later launch supplies a resource-link ID and returns to the same content.
- Unpublished/other-course/invalid selection fails.
- Response preserves Blackboard `data` claim and has valid tool signature, audience, deployment, message type/version, issue/expiry.

## NRPS

- Sync uses only signed context-membership URL and approved scope.
- Multiple pages are followed only on allowlisted HTTPS hosts.
- Received, mapped, pending, conflict, and page counts reconcile with test roster.
- Roles normalize to administrator/instructor/teaching assistant/learner/observer/content developer/unknown.
- Existing `sub` mappings persist; display-name/email collisions do not merge users.
- Removed/inactive members follow the institution's agreed reconciliation rule before production.
- Roster-profile-retention-off mode does not retain name/email.

## AGS line items and grades

- Published EdNotebook grade item creates/reconciles one Blackboard line item.
- Draft/other-course grade item fails.
- Returned line-item URL must remain on an allowlisted host.
- Grade release requires professor confirmation, mapped LTI subject, enabled mapping, and finalized grade.
- Pending/missing/null/stale/other-course/held grades fail.
- Score, maximum, `activityProgress`, `gradingProgress`, timestamp, and optional comment appear correctly in Blackboard.
- Repeating the same release is idempotent.
- A changed finalized grade creates a new idempotency version, not an overwrite of audit evidence.
- Simulated LMS failure records bounded failure and retry schedule; retry succeeds without duplicating the grade.
- Read-results works only when result-read scope is approved.

## Activation and recovery

- Activation fails before instructor launch, learner launch, mapped context, successful grade passback, and scope-dependent NRPS/line-item evidence.
- Eligible deployment activates and writes an audit event.
- Suspending registration/deployment immediately blocks new sessions/service calls.
- Key rotation passes; removed old key fails after the planned window.
- Database restore preserves mappings/audits but not expired plaintext secrets (none are stored).
- Manual Blackboard CSV export remains available as the documented fallback.

## Acceptance

Product acceptance requires all applicable cases passing, no unresolved high-risk findings, privacy/security/accessibility approval, support and incident owners, retention/restore evidence, and Blackboard administrator sign-off. This is not equivalent to 1EdTech certification.
