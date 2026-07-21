# LTI 1.3 owner setup

## Purpose and current status

EdNotebook includes a deployable LTI 1.3/LTI Advantage foundation for Blackboard Learn. It uses the existing EdNotebook institution, course, membership, publication, grade-item, and finalized-grade records. LTI tables are crosswalks and sync evidence; they are not a second course or gradebook engine.

The code is a **pilot foundation**, not a claim of 1EdTech certification or a live Angelo State connection. Every registration and deployment begins in `setup`, moves to `testing` only by an owner decision, and can become `active` only after the database verifies live launch and service evidence.

## Components

- Owner UI: `#/admin/integrations/lti`
- Public configuration: `lti-configuration`
- Public JWKS: `lti-jwks`
- OIDC initiation: `lti-oidc-login`
- Signed launch validation: `lti-launch`
- Short-lived browser bridge: `lti-session`
- Deep Linking response: `lti-deep-link-response`
- Names and Roles sync: `lti-nrps-sync`
- Assignment and Grade Services: `lti-ags`
- Schema: `supabase/migrations/20260721190000_lti_1_3_foundation.sql`

The implementation follows the [1EdTech LTI Core 1.3 specification](https://www.imsglobal.org/spec/lti/v1p3), [Deep Linking](https://www.imsglobal.org/spec/lti-dl/v2p0), [Names and Role Provisioning Services](https://www.imsglobal.org/spec/lti-nrps/v2p0), and [Assignment and Grade Services](https://www.imsglobal.org/spec/lti-ags/v2p0).

## Prerequisites

- Institution record and platform-owner EdNotebook account.
- Institution-controlled Supabase project with migrations applied.
- Institution-controlled DNS/TLS for the EdNotebook site.
- Blackboard administrator and a non-production Blackboard test course.
- RSA signing key of at least 2048 bits.
- Documented issuer, client ID, deployment ID, authorization URL, platform JWKS URL, OAuth token URL/audience, and service hosts.
- Approved scopes and education-record handling policy.

## Deploy

1. Apply all Supabase migrations, including `20260721190000_lti_1_3_foundation.sql`.
2. Create an RSA PKCS#8 private key outside the repository. For example: `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out lti-private.pem`.
3. Put secrets in the Supabase project secret store, never in GitHub, browser variables, Postgres rows, or a `.env` file committed to source:

   - `LTI_SIGNING_PRIVATE_KEY_PEM`
   - `LTI_SIGNING_KID`
   - `LTI_SITE_URL` (for example `https://ednotebook.com`)
   - existing server-only Supabase secret/service key
   - `ALLOWED_ORIGINS` including the production EdNotebook origin

4. Deploy all eight LTI Edge Functions. `supabase/config.toml` declares `verify_jwt = false` because Blackboard does not send a Supabase session JWT; every public function performs the applicable LTI signature, state, launch-session, role, and scope checks itself.
5. Verify that `lti-configuration` and `lti-jwks` return public configuration only. The JWKS must contain `kty`, `n`, `e`, `alg`, `use`, and `kid`, never RSA private fields.
6. Open `#/admin/integrations/lti`, enter the platform registration, and leave its status at `setup` until both sides are configured.
7. Add the deployment ID and exact launch URL, then move registration and deployment to `testing`.

## Owner-entered fields

- Institution: existing EdNotebook institution; this controls data boundary and course choices.
- Display name and LMS product: recognizable operator labels.
- Issuer and client ID: exact values used to validate `iss`, `aud`, and `azp`.
- Authorization, JWKS, OAuth token URL/audience: HTTPS platform endpoints.
- Allowed service hosts: hostnames for JWKS, OAuth, Deep Linking return, NRPS, and AGS. Redirects are disabled and every server call is checked against this list.
- Enabled scopes: the institution-approved subset of NRPS/AGS scopes.
- Roster profile retention: whether protected name/email fields are stored for reconciliation.
- Deployment ID: exact signed LTI deployment claim.
- Allowed target-link URLs: exact EdNotebook launch URLs accepted at login and launch.
- Auto-provision users: off by default. Existing accounts are linked explicitly; names/emails never silently merge identities.

## Course and identity binding

- The first valid launch creates a pending LTI context mapping, not a new course.
- An owner maps the Blackboard context to an existing EdNotebook course in the same institution.
- LTI users are keyed by deployment plus signed `sub`.
- A user links an existing EdNotebook account explicitly. A mapped role becomes an existing course membership; existing owner/admin memberships are not downgraded.
- NRPS updates the LTI identity record but does not merge people by display name or email.

## Production activation gate

The **Verify evidence and activate** action fails closed unless the deployment and registration are in `testing` and all required evidence exists:

- successful real instructor launch;
- successful real learner launch;
- Blackboard context mapped to an existing EdNotebook course;
- successful AGS grade passback;
- successful NRPS sync when NRPS scope is enabled; and
- reconciled AGS line item when line-item creation scope is enabled.

Activation writes a redacted audit event. Official 1EdTech conformance/certification is separate from these product tests.

## Signing-key rotation

1. Generate a new PKCS#8 RSA key and new unique `kid`.
2. Move the old values to `LTI_SIGNING_PREVIOUS_PRIVATE_KEY_PEM` and `LTI_SIGNING_PREVIOUS_KID`.
3. Install the new current key and deploy/restart functions.
4. Confirm JWKS publishes current and previous public keys.
5. Update/verify the tool key in Blackboard and test launch plus OAuth client assertion.
6. After the Blackboard cache/rotation window, remove the previous private key and verify JWKS again.
