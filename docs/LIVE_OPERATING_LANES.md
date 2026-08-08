# EdNotebook deployment surfaces and live operating lanes

This is the authoritative release model.

| Deployment surface | URL | Source | Data project | Page label | Purpose |
| --- | --- | --- | --- | --- | --- |
| Staging sandbox | `https://ednotebook.com/staging/` | `staging` | `gfalgonektwdylsxsgzc` | `STAGING SANDBOX` | Permanent upgrade, migration, and regression sandbox using synthetic/test data |
| Live service | `https://ednotebook.com/` | `main` | `didwxihufueqbpfnfdmm` | `BETA`, then `PILOT`, then none for Production | Real presentation surface for bounded Beta, authorized Pilot, and eventually approved Production |

Beta and Pilot are not deployment surfaces. They do not create a second URL,
site, database, account set, course set, or workflow. They are governed and
audited operating lanes of the same live service.

## Transition contract

1. Every change is first merged to protected `staging` and accepted at the
   existing `/staging/` sandbox.
2. The exact approved staging candidate is promoted through a protected pull
   request into `main`; it is not force-pushed or manually copied.
3. The normal live root runs in Beta until the accountable owner records a
   Pilot transition.
4. A Beta-to-Pilot record captures the prior lane, exact release commit,
   accountable owner, evidence reference, carried account/course IDs and
   counts, and a checksum. The records themselves are not copied or moved.
5. Production requires its separately protected promotion workflow. When it
   is actually approved and activated, the normal live root has no Beta/Pilot
   banner.

The Pages deployment artifact records both source commits, the live operating
lane, and the two deployment surfaces in `environment.json` and the deployment
status ledger. The database stamps live audit events as Beta or Pilot and
staging audit events as Sandbox. Unknown execution context stays
`unclassified`; it is never guessed to be Production.

## Current promotion size

At the audit point for this correction, `origin/staging` is 108 commits ahead
of `origin/main`. That count is evidence, not a merge method. The promotion
must merge the exact protected `staging` candidate into `main`, pass the full
workflow, deploy the combined Pages artifact, and then complete live Beta
acceptance.
