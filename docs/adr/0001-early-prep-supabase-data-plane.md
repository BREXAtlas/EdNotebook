# ADR 0001: Early Prep Supabase data plane

Status: Proposed for staging review
Date: 2026-08-03

## Context

EdNotebook already stores University and high-school records in one schema with `education_division`, role-aware RLS, course membership authorization, separate social audiences and the shared TOS/EdNotebook control plane. Early Prep adds stronger high-school constraints, but this foundation unit is not authorized to create or switch a production project.

## Options

### A. Shared project with conditional policy enforcement

This reuses Auth, canonical profiles, course memberships, Digital Literacy enrollment/progress, audit events and the control plane. It avoids cross-project identity synchronization, but every high-risk query and write must remain division-aware and a policy regression can affect both divisions.

### B. Separate Early Prep project

This offers stronger operational blast-radius isolation, but duplicates Auth and migrations or requires cross-project identity. It complicates canonical progress, governance, audit reporting and continuity, and adds backup, monitoring and incident-response surfaces.

## Decision

Use Option A for the Early Prep staging foundation, with `education_division='k12'` enforced in database policies, RPCs and commerce triggers. Keep Option B open as a future legal/operational decision; do not create a project during this unit.

Before production, reviewers must approve RLS/trigger tests, restore evidence, district data-processing requirements and the final production-promotion decision. If those requirements demand physical isolation, supersede this ADR with a migration plan rather than silently introducing a second data plane.
