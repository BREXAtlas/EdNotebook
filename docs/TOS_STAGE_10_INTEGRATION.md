# TOS Stage 10 EdNotebook integration

## Status

Pilot foundation and synthetic demonstration only. Production is not
activated. No institution approval, real-user pilot, trusted TOS adapter, or
official record transfer is claimed. The owner-approved synthetic bounded
pilot now rehearses the entire institution-to-closeout journey before later
approved-pilot or production activation is considered.

## Purpose

This coordinated EdNotebook PR adds the Layer 1 side of the TOS Stage 10
contract while preserving the existing EdNotebook login, Supabase data plane,
institution controls, Blackboard CSV/LTI foundations, and repository release
process.

## Current pipeline

```text
EdNotebook UI
  -> Supabase Auth
  -> Supabase Postgres/RLS + Storage + Edge Functions
  -> educator-confirmed Blackboard CSV/LTI workflow
  -> Blackboard/SIS authoritative roster and grades
```

The Stage 10 preview adds a future control-plane seam:

```text
EdNotebook protected backend (not implemented here)
  -> minimized, signed, idempotent metadata envelope
  -> trusted TOS backend adapter (not implemented here)
  -> readiness, approval, reconciliation, release, and audit evidence
```

No browser-to-TOS API call exists. The preview creates only a local synthetic
fixture containing aggregate counts, exact existing-infrastructure mappings,
and boundary flags. It carries no names,
student IDs, raw grades, submissions, attendance, accommodations, credentials,
or authentication tokens. After closeout it exports a SHA-256 evidence packet
that the owner imports and confirms in TOS.

## Complete synthetic journey

The authenticated `#/admin/synthetic-pilot` cockpit runs 15 ordered,
role-bounded actions: institution application and approval; professor signup
and independent approval; course creation; student signup and enrollment;
assignment publication; student and professor discussion; submission; points;
grade publication; student grade view; and semester closeout.

Each action displays the existing EdNotebook route and authoritative record
families it would use. The rehearsal does not write those records. This keeps
the simulator faithful to the deployed Auth, membership, course, roster,
discussion, assignment, progress, grade, Blackboard, and audit architecture
without creating fake production activity.

Approved-pilot and production modes remain fail-closed until Stages 1-12 and
all institution, assurance, privacy, support, backend rate-limit, budget,
rollback, and critical-finding gates carry independent human evidence.

## Login and Supabase

The current login screen and Supabase Auth remain unchanged. This PR adds no
table, RLS policy, migration, storage bucket, function, or secret.

Supabase can be replaced later behind provider-neutral identity/data
contracts, but only through a separate migration that proves identity mapping,
authorization equivalence, storage, functions, retention, backup/restore,
export, dual-run reconciliation, institutional acceptance, cutover, and
rollback. Deleting Supabase data before those gates would be unsafe.

The official Supabase changelog was reviewed on July 24, 2026. Future database
work must account for explicit Data API exposure, RLS, and the Node 22+
requirement.

## Authentication and authorization

The preview route is inside the existing authenticated institution Control
Center. That client gate is product UX, not a trusted cross-system
authorization boundary. A production adapter must verify the EdNotebook
principal and institution membership server-side, bind exact tenant,
institution, product, course, environment, and purpose, and deny expired,
suspended, revoked, cross-tenant, or over-scoped access.

## Course closeout and records

In a future approved pilot:

1. The educator finalizes EdNotebook course work.
2. EdNotebook validates roster, drops, grade items, and finalized grades.
3. The educator confirms the Blackboard/LTI/CSV transfer.
4. Blackboard or the SIS accepts the official record.
5. EdNotebook reconciles every accepted/rejected item.
6. TOS receives minimized evidence and audit references—not a shadow
   gradebook.
7. Retention/deletion follows the institution-approved record policy.

The current PR rehearses only aggregate synthetic counts.

## Bounded agents

No agent is connected to an EdNotebook account or record. No code or skill is
injected at runtime. Future agents must use approved exact release bundles,
typed tools, institution-approved routes, containment, Sentinel policy, human
confirmation, and TOS audit. They cannot enroll, grade, publish, sell, or
authorize themselves.

## Testing and rollback

Run:

```bash
npm ci
npm run test:tos-integration
npm run test:admin-control
npm run test:student-data-safety
npm run test:blackboard
npm run test:lti
npm run build
```

Rollback is a PR revert and Pages redeploy. No database rollback is required.
