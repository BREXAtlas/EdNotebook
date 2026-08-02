# Privacy/records and lifecycle decisions — TOS staging decision packet

Status: **61 OF 61 DOMAINS DECIDED — PRIVACY/RECORDS HOLD**

Decision scope: TOS-owned synthetic staging baseline for institution `22222222-2222-4222-8222-222222222222`

Staging project: `gfalgonektwdylsxsgzc` (`us-east-1`)

Protected baseline commit: `3076110661a30f970f0e3eec7e53413aa69e548b`

Production project unchanged: `didwxihufueqbpfnfdmm`

## Final governed outcome

Every active lifecycle domain has one explicit decision in the signed manifest:

| Decision | Count | Effect |
| --- | ---: | --- |
| Approved for the synthetic-staging baseline | 33 | A human-reviewed disposition, conservative retention guardrail, trigger, owner, and exceptions are recorded. No lifecycle worker is enabled. |
| Blocked pending an identified decision | 28 | The domain is recorded with `block`, no retention clock, and no automatic terminal action. |
| **Total decided** | **61** | No domain is silently omitted. |

The privacy/records evidence gate is `HOLD`, not `PASS`. Completion of the matrix means every domain has a defensible current decision; it does not mean all domains are approved, that Angelo State University adopted the policies, or that EdNotebook is ready to accept production student data.

The machine-readable decision manifest is [`public/governance/tos-staging-lifecycle-final-decisions.json`](../public/governance/tos-staging-lifecycle-final-decisions.json), SHA-256 `977c34441252157af51dcff410dd6eeeb26d7b7a13194fe3ecec97c76ba19da5`. The human review projection is [`tos-staging-lifecycle-final-decisions.csv`](tos-staging-lifecycle-final-decisions.csv). Both contain policy metadata only and no student data.

## Required safeguards

- Production student intake remains disabled and the production Supabase project is not changed.
- Automatic deletion, anonymization, retention execution, publishing, or promotion remains disabled.
- Outstanding FERPA access or correction requests, disputes, audits, public-information requests, legal holds, and longer applicable series suspend or supersede any clock.
- Provider-controlled residual copies require separately verified export, deletion, and confirmation procedures.
- Digital Literacy consent, identifiable research data, de-identified exports, and IRB records remain governed by an approved research protocol rather than ordinary learning retention.
- Fixed-day values for calendar years use conservative no-earlier-than guardrails: 366, 731, 1096, 1461, 1827, and 3653 days.
- Angelo State official-copy designations and records-schedule adoption remain parked for an authorized institutional reviewer. Source citations inform this staging baseline but are not an ASU approval.

## Recording controls

The governed batch RPC accepts only the exact 61-row manifest and verifies its SHA-256 inside PostgreSQL. It rejects missing, duplicate, unknown, or semantically invalid domains. Approved decisions cannot use `block`; blocked decisions must use `block` with no retention period. Repeating the exact signed batch is idempotent.

The privacy/records gate accepts a time-bounded `HOLD` or `FAIL` after all 61 current decisions exist. A `PASS` is rejected while any lifecycle domain is blocked, expired, or unrecorded and requires a later institutionally authorized review.

This packet is an engineering governance record, not legal advice or an institutional records-schedule approval.
