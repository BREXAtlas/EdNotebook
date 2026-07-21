# LTI 1.3 security and privacy controls

## Trust boundary

Blackboard is an external identity and learning-service provider. A launch is trusted only after the server validates its signature and every required binding. Browser routes do not validate raw LTI JWTs and never receive the tool private key or LMS OAuth token.

## Login and launch controls

- OIDC initiation accepts only registered HTTPS issuer/client/deployment combinations.
- Target-link URL is an exact deployment allowlist match.
- State, nonce, login hint, and browser launch handles are generated with Web Crypto.
- Postgres stores SHA-256 state/nonce/handle hashes, never their plaintext values.
- OIDC state expires after five minutes and is consumed atomically with the matching nonce hash.
- Launch accepts only form-encoded bounded requests.
- Platform JWKS fetch uses HTTPS, no redirects, timeout, bounded key count, `kid`, RSA key type, and a registered hostname.
- JWT verification requires `RS256`, valid signature, exact `iss`, client in `aud`, matching `azp` for multiple audiences, exact deployment/nonce/target, current `exp`/`iat`, LTI version `1.3.0`, supported message type, roles, context, and appropriate resource/deep-link claims.
- Replayed state fails closed.
- Full JWTs and raw launch payloads are not stored or logged.

## Browser continuation

After validation, the server creates a four-hour opaque launch handle and stores only its hash. The handle appears after `#` in the EdNotebook URL, so it is not sent in normal HTTP requests or referrer headers. LTI browser APIs require that handle in a dedicated request header. It authorizes only the validated deployment, context, role, resource, and services; it is not a general Supabase session.

Linking an EdNotebook account additionally requires a valid Supabase session and a compatible educator/learner role. The platform `sub`, not email or name, is the durable LTI identity key.

## Service-call controls

- OAuth uses signed `private_key_jwt` client assertions with five-minute expiry and unique `jti`.
- Token, NRPS, AGS, Deep Linking return, JWKS, line-item, scores, results, and pagination URLs must use HTTPS and registered service hostnames.
- Redirect following is disabled.
- Requested scopes must be both registered and present in the signed launch service claim.
- NRPS is limited to 20 pages/10,000 received members per request and stores no raw response.
- Deep Linking validates that each selected publication, assignment, and optional grade item belongs to the mapped course.
- AGS creates mappings only for published EdNotebook grade items.
- Grade passback permits finalized, non-null grades only; requires a confirmed LTI user mapping and explicit professor confirmation.
- Grade events use SHA-256 idempotency keys over mapping, grade, version, score, and maximum. Successful duplicates return existing evidence.
- Failed grade calls store bounded error summaries and exponential retry time, not access tokens or complete student payloads.

## Database controls

- LTI tables have RLS enabled.
- Browser roles receive read access only to operational records authorized by platform/institution/course boundaries.
- Launch state, launch sessions, and service endpoints have no browser table grants or policies.
- Owner configuration writes use security-definer RPCs that recheck protected platform roles.
- Course-context mapping requires the same institution and course-management authority.
- Service functions use the server-only Supabase key and re-authorize every action from validated launch records.
- Redacted audit events record type, target, course/institution, actor when mapped, correlation/count/status, and timestamps.

## Data minimization and retention

- Required: issuer/client/deployment, `sub`, roles, context/resource/line-item identifiers, service scopes/URLs, sync state, and audit/reconciliation times.
- Optional: name/email/LIS person sourced ID for protected roster reconciliation. The registration can disable roster-profile retention.
- Never stored: private signing key in Postgres, OAuth access token, raw JWT, plaintext state/nonce/launch handle, Blackboard password, or raw NRPS/AGS responses.
- Institution policy must set retention for mappings, sync evidence, audits, and optional profile claims. Legal hold overrides normal deletion.
- Revoke a compromised deployment by setting registration/deployment to `suspended`, rotating keys, and invalidating active launch sessions.

## Residual risks requiring institution controls

- Blackboard iframe/cookie/browser policies vary; new-tab continuation may be required.
- A compromised educator account can release grades within its course authority; institutional SSO/MFA and audit monitoring remain necessary.
- LTI user provisioning is off by default. If enabled later, account lifecycle and deprovisioning must be agreed with the authoritative SIS/IdP.
- 1EdTech certification, penetration testing, accessibility review, DPA/FERPA review, incident response, restore tests, and production monitoring are outside code-only validation.
