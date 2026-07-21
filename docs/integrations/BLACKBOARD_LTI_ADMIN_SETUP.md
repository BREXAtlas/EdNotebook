# Blackboard administrator setup for EdNotebook LTI 1.3

Blackboard menu labels and registration workflows vary by Anthology release and institution policy. Complete these steps with the institution Blackboard administrator and use Anthology's current administrator documentation. Anthology distinguishes portable LTI launch/NRPS/AGS capabilities from Blackboard-specific REST APIs in [LTI or REST](https://docs.anthology.com/docs/blackboard/rest-apis/getting-started/lti-or-rest).

## Exchange these values

EdNotebook provides:

- OIDC login initiation URL
- launch/redirect URL
- Deep Linking launch URL (same validated server launch endpoint)
- public JWKS URL
- tool website/configuration JSON URL

Blackboard/institution provides:

- issuer
- client ID
- deployment ID
- OIDC authorization URL
- platform JWKS URL
- OAuth token URL and audience, if different
- exact LMS service hostnames
- approved LTI Advantage scopes

Do not send private keys, Supabase service keys, or OAuth access tokens between administrators.

## Blackboard registration and placement

1. Use a non-production or institution-approved test environment/course.
2. Register EdNotebook as an LTI 1.3 tool using the URLs shown at `#/admin/integrations/lti`.
3. Enable only the message types in pilot scope:

   - LTI Resource Link launch
   - LTI Deep Linking request

4. Approve only the required services:

   - NRPS context-membership read for roster sync
   - AGS line-item write/read as approved
   - AGS score write for professor-confirmed passback
   - AGS result read only when reconciliation requires it

5. Create an institution/deployment placement that permits an instructor and a learner test launch.
6. Record the exact deployment ID in EdNotebook. Do not treat a client ID as a deployment ID.
7. Put the registration and deployment in EdNotebook `testing` status.

## Data sent or received

- Launch: signed issuer, audience, deployment, subject, roles, course context, resource link, target link, message type/version, nonce/time, and approved service endpoints/scopes.
- Optional protected identity claims: name/email when institution policy allows roster reconciliation.
- NRPS: members for the launched course context only.
- Deep Linking: selected existing EdNotebook publication/assignment and optional grade-line-item metadata.
- AGS: LTI subject, line-item URL, finalized score, maximum, activity/grading progress, timestamp, and optional professor feedback.

EdNotebook never requests a Blackboard username/password. Access tokens are obtained server-to-server, held in function memory, and are not written to browser storage or application tables.

## Required test sequence

1. Instructor launches the EdNotebook placement.
2. Owner maps the discovered Blackboard context to the existing EdNotebook course.
3. Instructor explicitly links the correct EdNotebook educator account.
4. Learner launches and explicitly links the correct learner account.
5. Instructor completes Deep Linking and confirms the created Blackboard link launches the intended item.
6. Instructor runs NRPS and reviews received/mapped/pending counts.
7. Instructor creates or reconciles an AGS line item.
8. Instructor confirms one finalized test grade for release.
9. Blackboard administrator/instructor verifies the grade in Blackboard.
10. Repeat the same grade release to verify idempotency, then test a controlled failure and retry.
11. Owner selects **Verify evidence and activate**. The database must refuse activation if evidence is incomplete.

Use the detailed [LTI test plan](./LTI_1_3_TEST_PLAN.md) and retain only redacted test evidence.

## Blackboard REST is separate

LTI covers launch, content selection, context roster, line items, grades, and results. A future Blackboard REST connector is optional for Blackboard-specific course/content/administrative objects. It requires a separately registered application, OAuth/entitlements, rate-limit plan, and security approval; it must use the same canonical identifiers rather than creating new course or grade fields.
