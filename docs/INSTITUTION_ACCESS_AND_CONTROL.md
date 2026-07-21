# Institution access and platform control

## Purpose

This document explains how EdNotebook separates institutions, how the restricted administration areas should work, what an institution can control, and what evidence a technology, privacy, accessibility, or records team can review.

It is written for platform owners and institutional reviewers. It is not a certification, legal opinion, security guarantee, or claim that Angelo State University—or any other institution—has approved or connected EdNotebook. Repository features still require deployment, configuration, institutional testing, and written approval before production student data is used.

The term **Owner Control Center** means the restricted platform-owner administration area sometimes called the “secret admin” page. The page is not protected because its URL is difficult to find. It must be protected by authentication, database authorization, row-level security, short sessions, and audit logging.

The term **Institution Control Center** means the same organized control experience limited to one institution. An institution administrator may manage the school’s EdNotebook environment but cannot view another school, override platform safety rules, read server secrets, or change EdNotebook for every customer.

## Status words used in the control center

Every feature and connection should use the same plain-language status words:

| Status | Meaning |
| --- | --- |
| Not configured | No approved setup exists yet. |
| Setup required | The feature exists, but required fields, permissions, or deployment steps are missing. |
| Testing | Configuration exists and is restricted to approved test users or courses. |
| Ready to activate | Required tests passed; an authorized person must still approve activation. |
| Active | The feature is available within its approved scope. |
| Scheduled | The feature will turn on or off at a defined time. |
| Paused | Access is temporarily stopped without deleting data or mappings. |
| Attention needed | A test, sync, credential, or dependency failed. |
| Retired | The connection is no longer used; history is retained according to policy. |

“Present in the repository” does not mean “active in production.” The control center must show code readiness, deployment readiness, connection readiness, testing evidence, and activation as separate facts.

## Who controls what

| Control | Platform owner | Institution administrator | Institution security/records role | Professor | Student | Publisher |
| --- | --- | --- | --- | --- | --- | --- |
| See all institutions | Yes | No | No | No | No | No |
| Approve a new institution | Yes | No | No | No | No | No |
| Assign an institution to its EdNotebook environment | Yes | No | No | No | No | No |
| Create platform-wide feature rules and locks | Yes | No | No | No | No | No |
| Manage one institution’s approved features | Yes | Yes, when granted | Only assigned capabilities | No | No | No |
| Invite and remove institution team members | Yes | Yes, when granted | Only assigned capabilities | No | No | No |
| Configure or test an institution connection | Yes | Yes, when granted | Security role may review; records role may review exports | Course-level actions only | No | Content actions only |
| Search institution accounts and courses | Yes | Own institution only | Own institution and assigned purpose only | Own courses and eligible learners only | Self and permitted course directory only | Own content/course scope only |
| Download audit or records reports | Yes | Own institution only, when granted | Assigned report categories only | Own course reports only | Own records only | Own publication records only |
| View or edit server secrets | No browser user | No browser user | No browser user | No | No | No |

The existing institution roles—owner, admin, security, records, professor, learner, and publisher—should be combined with named capabilities such as **Manage team**, **Manage integrations**, **Review security**, **Review records**, **Manage courses**, and **Download reports**. A records or security reviewer must not automatically receive the power to assign new owners or expand their own permissions.

Platform-wide controls reserved for the platform owner include institution approval, master feature locks, global theme locks, platform connection shutdown, institution assignment, and authorization to create other platform administrators. These controls require a preview, an impact summary, an explicit confirmation, and a logged reason.

## Institution directory, signup, and approval

### Directory structure

The institution selector should use a maintained directory, not typed names as an authorization boundary. The directory needs:

- a canonical institution name;
- searchable aliases and former names;
- institution type, such as university, college, system, district, or school;
- parent-system and campus relationships;
- public location and domain information;
- public identifiers when their use and source are approved;
- whether the institution is selectable, pending review, active in EdNotebook, or retired; and
- a link to the active EdNotebook institution record when one exists.

Angelo State University should appear alphabetically under **A**. A system and its individual schools should remain distinct. For example, a university system can be the parent while each university has its own selectable record and tenant boundary.

The list will need an approved source, update schedule, duplicate review, and source-license review. A populated directory is not proof that a school is an EdNotebook customer or has approved the product.

### Student and professor signup

Institution choice is part of signup for student and professor pathways. The required field can include an explicit **Independent / no institution** choice so a person can use free public content. The warning must say, in plain language:

> Without an active institution, you can use public and free EdNotebook content, but a professor cannot find you for an institution course, enroll you, assign institution work, or connect your grades to that institution.

Selecting a school creates a pending affiliation. It does not by itself grant access to the school’s users, courses, grades, files, reports, or connections. The selected directory ID—not the typed school label—is used for matching.

If the school is not listed, **Other institution** collects the proposed name and public information for review. It does not create a new tenant automatically.

A requested student, professor, or publisher pathway is also a request, not an administrator credential. User-editable signup metadata must never grant professor, publisher, institution-admin, or platform-admin authority.

### Institution signup form

An institution representative can submit an access application containing:

- canonical institution and campus/system selection;
- official domain and public website;
- applicant name, title, and institution email;
- technology, security/privacy, accessibility, and records contacts;
- intended pilot population and course count;
- identity provider, LMS, SIS, and file-storage preferences;
- requested Blackboard capabilities: manual CSV, LTI launch, Deep Linking, NRPS, AGS, and optional REST review;
- retention, legal-hold, backup, and data-residency requirements;
- requested plugins or external services;
- supporting documents stored in approved private storage; and
- attestation that submission does not itself authorize production use.

The platform owner reviews the request, resolves the directory record, creates or assigns the institution environment, assigns the first institution owner, and records conditions or denied capabilities. Approval must not be possible through a browser-only flag or unreviewed email-domain match.

### Institution login experience

EdNotebook should use the existing authentication service. It should not create a second password database for institution administrators.

After authentication, a person with access to more than one institution selects the institution they intend to manage, similar to choosing an institution or tenant in another education platform. That choice controls the visible workspace but does not grant authority. Every database request still checks active membership and the row’s institution.

Students and professors normally have one active primary institution per pathway. A pending selection may be corrected. After affiliation is active, changing institutions requires a transfer request.

### Institution team management

Institution owners can invite approved team members by institution email, assign a limited role and capabilities, set an expiration date when appropriate, resend or revoke an invitation, suspend access, and review last activity. Invitation tokens are one-time and stored only as hashes.

Removing an administrator removes future administrative access but does not erase their audit history. The institution should retain at least two authorized owners or a documented recovery process.

### Affiliation and transfer

An affiliation records the person, pathway, selected institution, relationship, status, source, verification method, identifier hash/last four, and effective dates. Sources can include reviewed signup, institution invitation, verified LTI launch, SIS/OneRoster, or an authorized administrator.

The platform should store only identifiers needed for matching and reconciliation. Full student or employee identifiers should not be displayed in ordinary search results. Hashes are not anonymous data when they can still be linked to a person and must be protected accordingly.

An approved transfer:

- ends the prior active affiliation at an effective time;
- creates the new affiliation after review;
- does not move old grades, submissions, messages, courses, or institutional audit records to the new school;
- preserves the student’s allowed personal learning memory separately from institution-owned records; and
- logs who approved the change and what access changed.

## Institution-aware privacy and tenant separation

EdNotebook uses one platform with institution-scoped records. It should appear to each school as its own environment because database policies enforce the boundary, not because the frontend merely hides other schools.

Required rules are:

- Every institutional course belongs to one institution.
- A professor can create or manage an institutional course only with an active approved relationship to that institution.
- A student can join an institutional course only when the course and active affiliation match, unless an authorized cross-registration process exists.
- A professor’s learner search is limited to eligible people in the same institution and pathway; it is not a platform-wide people search.
- Institution administrators search only their institution’s people, courses, feature rules, connections, sync records, and audits.
- Public/free courses are explicitly marked public. A missing institution value must not accidentally make a private course public.
- Course membership, grade, submission, message, and file checks are enforced on the server and in database row-level security.
- Blackboard/LTI contexts, subjects, line items, and grades are mapped inside one institution and deployment.
- Selecting a different institution in the interface never changes database authorization.
- Historical records keep the institution that owned them at the time.

Search results should return only the minimum fields needed for the task. Account IDs, emails, institutional identifiers, disability/accessibility information, grades, and activity logs must not be bundled into a general directory response.

Cross-tenant tests must prove that Institution A cannot find, enroll, grade, export, report on, configure, or synchronize Institution B.

## Student, professor, and publisher pathways

The control center organizes features into three searchable pathways:

- **Student:** account, public/free learning, enrollment, assignments, progress, grades, reading, storage, messages, and permitted community features.
- **Professor:** course creation, roster, assignments, grading, publishing, Blackboard export, LTI course actions, reports, storage, and communication.
- **Publisher:** publication preparation, rights review, catalog visibility, course placement, file conversion, distribution controls, and publication reporting.

Each pathway has a plain-language template. A template is a starting set of feature values, not a replacement for individual decisions. Applying a template first shows:

- what will turn on, turn off, or change value;
- the institutions, courses, accounts, and pathways affected;
- dependent connections or entitlements;
- warnings for loss of access or delayed work;
- whether a platform lock prevents the change; and
- when a schedule will start or end.

The owner can create platform templates. An institution can create templates for its own environment only. Existing users should not notice a route or layout change merely because controls are added; the effective policy is applied behind the existing pathway pages.

## Feature controls, schedules, and locks

Controls may appear as switches, checkboxes, sliders, or select lists, but every control needs a stable feature name and an explanation box opened through a labeled question-mark button. The explanation should state what the control does, who it affects, what is stored, what depends on it, and what happens when it is disabled.

Controls can be scoped to:

1. the entire EdNotebook platform;
2. one pathway across the platform;
3. one institution;
4. one institution pathway;
5. one course; or
6. one account.

The most specific active rule normally wins. A higher-level rule marked **Lock lower-level changes** wins over every more specific rule. This lets the platform owner enforce a holiday theme, security pause, accessibility requirement, or pilot limitation while preventing downstream overrides. Institution locks apply only inside that institution.

Time controls use the institution’s recorded timezone and can include a start date/time, end date/time, allowed weekdays, daily access window, and exception dates. The preview must show the interpreted local time and affected pathways before saving.

Controls must support optimistic version checks so an administrator cannot unknowingly overwrite a newer change. High-impact changes require a second confirmation. Disabling a feature must not silently delete its records.

Some items are displayed for accountability but are not toggleable application features:

- row-level security;
- authentication and password protection;
- audit collection;
- encryption and secret protection;
- malware controls required for an enabled upload pathway;
- legal holds;
- required accessibility safeguards; and
- database backup and recovery controls.

These appear as **Required protection** or **Status only**, with evidence and escalation contacts. “Master control” does not mean that a browser switch can bypass security policy or database authorization.

## Connections, plugins, and integrations

The connection area should show provider, purpose, institution, pathway, current status, approved capabilities, responsible owner, last successful test, last synchronization, next action, and a redacted error summary.

| Connection | Repository status | What it connects | Activation boundary |
| --- | --- | --- | --- |
| Supabase Auth/Postgres/Storage/Functions | Present; deployment configuration required | Accounts, institution data, RLS, files, and server functions | Institution-owned environment, secrets, backups, and access tests |
| GitHub/Actions/Pages | Present | Source, build, checks, and static hosting | Protected institution-owned repository/environment |
| Railway document worker | Container foundation; deployment required | Malware inspection and document conversion | Institution-owned service, worker secret, network and retention tests |
| Blackboard manual CSV | Pilot foundation | Professor-controlled grade-file reconciliation | Non-production import/export test and handling procedure |
| Blackboard LTI 1.3 | Pilot foundation | Launch, content selection, roster, line items, and grade passback | Real Blackboard registration, test course, scopes, and evidence gate |
| Blackboard REST | Optional future connection | Blackboard-specific objects not covered by LTI | Separate app registration, OAuth entitlements, rate limits, and review |
| SIS/OneRoster | Data model reserved; not a live connection | Institutional rosters, sections, users, and results | Source-of-truth and reconciliation decision |
| Stripe | Server-side foundation; production billing incomplete | Subscription and entitlement events | Finance/legal approval and live webhook tests |
| AI providers | Demonstration only | Course-generation assistance | Approved server gateway, contract, data rules, and human review |
| Calendar, email, Teams/Slack, analytics | Not production-connected | Optional communication/operations | Separate OAuth, scopes, privacy review, and audit plan |

Plugins such as Box, SharePoint, OneDrive, Google Drive, Teams, Slack, or institution services are optional connectors. Installing or displaying a plugin is not authorization to exchange institutional data. Each plugin requires an owner, approved scopes, data inventory, secret location, retention rule, revocation process, test evidence, and institution-specific activation.

Server credentials, OAuth tokens, signing private keys, Supabase service-role keys, and worker secrets never appear in the control center. The page may show that a named secret reference is present, its last rotation date, and whether a connection test passed. Actual secret values remain in an approved server secret store.

## Connection testing, activation, synchronization, and shutdown

The expected workflow is:

1. **Register:** record the institution, provider, approved purpose, owner, and redacted endpoints.
2. **Configure:** add server-side secrets and the minimum approved permissions outside the browser.
3. **Test:** use non-production users, courses, and records. Record each required test separately.
4. **Review:** show passed, failed, skipped, and expired evidence with plain-language explanations.
5. **Approve:** an authorized institution person and, where required, the platform owner approve activation.
6. **Activate:** enable only the approved institution, pathways, courses, and capabilities.
7. **Monitor:** show last successful sync, last attempted sync, records received/changed/rejected, bounded error details, and next retry.
8. **Pause or revoke:** stop new exchanges without deleting mappings needed for reconciliation or audit.

A connection cannot become active simply because a record exists or a dropdown says “Active.” Blackboard LTI activation, for example, requires real instructor and learner launches, an institution-matched course context, successful grade passback, and the enabled NRPS/line-item evidence described in the LTI test plan.

## Blackboard, LTI, REST, SIS, and grade relationships

EdNotebook keeps one course, person, enrollment, grade-item, and grade-result model. Blackboard CSV, LTI, REST, and SIS/OneRoster identifiers are crosswalks to those records, not separate gradebooks.

- **Manual Blackboard CSV** is the controlled fallback. The professor reviews mappings, exports finalized grades, downloads the file, and imports it into Blackboard.
- **LTI Core 1.3** provides secure LMS launch and role/context claims.
- **Deep Linking** lets an instructor place approved EdNotebook content in Blackboard.
- **NRPS** provides the roster for the launched context when the institution approves that scope.
- **AGS** creates/reconciles line items and sends professor-confirmed finalized scores.
- **Blackboard REST** is separate and optional for Blackboard-specific administrative or content objects.
- **OneRoster/SIS** can be the institution’s authoritative roster/section source when approved.

The institution must decide which system owns each field and what happens when values disagree. At minimum, the shared record set includes institution, academic session, course/section, person, enrollment/role/status, grade item, maximum points, result, result status, timestamps, source, and external identifiers.

EdNotebook does not request a Blackboard password. LTI and REST tokens remain server-side. Email or display-name matching alone must never silently merge accounts.

See [Learning-system data model](./integrations/LEARNING_SYSTEM_DATA_MODEL.md), [LTI owner setup](./integrations/LTI_1_3_OWNER_SETUP.md), [Blackboard administrator setup](./integrations/BLACKBOARD_LTI_ADMIN_SETUP.md), and [LTI security](./integrations/LTI_1_3_SECURITY.md).

## Audit, version history, and accountability

Every control change should record:

- actor and actor role;
- institution, pathway, course, account, feature, or connection affected;
- date/time and request/correlation ID;
- previous and new values;
- reason and confirmation method;
- impact counts shown before the change;
- schedule and lock changes;
- test or activation evidence;
- success, rejection, or failure; and
- related change or rollback version.

The control center shows a latest-change summary and a searchable history. It does not allow administrators to edit or delete history through the browser. Removing an account does not remove that person’s historical actions.

Existing EdNotebook audit events include an event hash for each recorded event. That is useful for detecting alteration of an individual event, but it is not the same as an external write-once log or a cryptographically chained ledger. Institutions that require stronger evidence can export logs to approved immutable storage or a SIEM.

## Downloadable reports

Reports can be requested for:

- feature inventory and effective settings;
- account, pathway, course, and institution overrides;
- scheduled and locked changes;
- connection configuration and approved capabilities;
- connection tests, synchronization, failures, and retries;
- institution team and permission history;
- affiliation and transfer decisions;
- Blackboard/LTI mappings and reconciliation;
- access-control and cross-tenant test evidence;
- accessibility review evidence; and
- audit/change history.

The request screen must show included fields, time period, institution scope, likely record count, and privacy warning. Reports are generated server-side, stored privately, expire after the approved period, and create audit events when requested and downloaded. CSV exports must neutralize spreadsheet formulas; JSON is appropriate for technical review. Education records and general system evidence should be separate report types.

## Accessibility and security evidence

The institution review area should make evidence easy to understand without suggesting certification that has not occurred.

Accessibility evidence can include:

- automated scan date, tool, route coverage, and unresolved findings;
- keyboard-only navigation and visible-focus review;
- screen-reader names for controls, dialogs, warnings, and question-mark help;
- color contrast, text resize/reflow, reduced motion, error identification, and touch-target review;
- captions, transcripts, text alternatives, and document accessibility status;
- pathway-specific manual testing; and
- remediation owner, due date, retest date, and outcome.

WCAG 2.2 AA can be a target, but EdNotebook must not claim conformance from an automated scan alone.

Security evidence can include:

- row-level security and cross-institution test results;
- dependency, static-analysis, secret, and container scan results;
- connection scope and endpoint allowlist review;
- key/secret rotation dates without secret values;
- backup and restore-test evidence;
- retention/deletion and legal-hold tests;
- session, MFA/SSO, deprovisioning, and break-glass procedures;
- incident, shutdown, and notification exercises; and
- known exceptions with owner and expiration date.

The [Technology stack audit](./TECH_STACK_AUDIT.md) and [Production security runbook](./PRODUCTION_SECURITY_1_10.md) provide additional implementation context.

## Data storage, retention, and deletion

| Data | Location | Important control |
| --- | --- | --- |
| Source and public build | GitHub/GitHub Pages | No education records or production secrets |
| Accounts and sessions | Supabase Auth and the signed-in device | Session duration, sign-out, MFA/SSO, deprovisioning |
| Institutions, memberships, courses, grades, controls, mappings, audit | Supabase Postgres | RLS, institution scope, backups, approved retention |
| Private files and generated reports | Private Supabase Storage with database metadata | Signed/scoped access, malware controls, expiration, legal holds |
| Document-processing copies | Railway or replacement worker temporary storage | Job-only access and verified cleanup |
| Blackboard CSV source | Browser memory during the workflow | Not retained by EdNotebook unless separately approved |
| Downloaded export/report | Authorized administrator device | Institution device and records-handling policy |
| LTI/REST signing keys and tokens | Server secret store or function memory | Rotation, least privilege, no browser/database exposure |

Institution, course, account, feature, connection, and report records need documented retention classes. A feature being disabled does not authorize data deletion. Legal holds override ordinary deletion. Deletion jobs should record eligibility, completion, and failure without logging document contents.

Backups must have an owner, encryption policy, region, retention period, restore procedure, and tested recovery objective. Deleting a production row does not necessarily remove it immediately from backups; that timing must be disclosed in the institution’s approved retention policy.

## Deployment and institutional review checklist

1. Assign platform owner, institution owner, technology, security/privacy, records, accessibility, and support contacts.
2. Place source, hosting, Supabase, Railway or replacement worker, DNS, and monitoring under approved organizational ownership.
3. Apply reviewed migrations and verify that every exposed table has RLS and explicit grants.
4. Establish the platform-owner account through a controlled process; do not use signup metadata to create it.
5. Load and review the institution directory, including Angelo State University, aliases, parent systems, and the Other-institution process.
6. Submit and approve a test institution application; invite at least two institution owners and exercise invitation revocation.
7. Test student, professor, publisher, independent, pending, rejected, transferred, suspended, and removed-account cases.
8. Prove cross-tenant isolation for account search, course enrollment, grades, files, reports, controls, connections, and sync logs.
9. Review all feature definitions, help text, warnings, templates, schedules, locks, and non-toggleable safeguards.
10. Test preview/apply concurrency, rollback, audit history, report creation, report expiry, and CSV formula protection.
11. Configure server secrets outside the browser and verify redacted connection displays.
12. Deploy and test required Edge Functions and the document-security worker.
13. Use a non-production Blackboard course for CSV and LTI testing; record each launch, mapping, roster, line-item, and grade result.
14. Decide whether REST, SIS/OneRoster, AI, payments, calendar, email, plugins, analytics, or community features are explicitly out of scope.
15. Complete accessibility manual review and document remediation rather than relying only on automated tools.
16. Run backup restore, retention/deletion, legal-hold, deprovisioning, incident shutdown, and secret-rotation exercises.
17. Obtain institution approvals and activate only the approved features, pathways, courses, users, and connection scopes.
18. Schedule recurring access, vendor, dependency, accessibility, privacy, and connection reviews.

## Service alternatives and handoff choices

EdNotebook’s data and integration contracts are intended to allow institution-approved substitutions:

| Current role | Current foundation | Alternatives |
| --- | --- | --- |
| Source/CI | GitHub and Actions | GitHub Enterprise, GitLab, Azure DevOps, Bitbucket, Jenkins |
| Static hosting | GitHub Pages | Institutional hosting, Azure Static Web Apps, Cloudflare Pages, Netlify, Vercel, S3/CloudFront |
| Identity | Supabase Auth | Microsoft Entra ID, Okta, Auth0, Keycloak, CAS, Shibboleth/SAML/OIDC |
| Database | Supabase Postgres | Institution Postgres, Azure Database for PostgreSQL, AWS RDS/Aurora, Cloud SQL, Neon |
| File storage | Supabase Storage | Azure Blob, AWS S3, Google Cloud Storage, MinIO, Box, SharePoint |
| Server functions | Supabase Edge Functions | Azure Functions, AWS Lambda, Cloud Run, Cloudflare Workers, institution APIs |
| Document worker | Railway | Kubernetes/OpenShift, Azure Container Apps, ECS/Fargate, Cloud Run, secured campus VM |
| LMS exchange | Blackboard CSV/LTI | Standards-compliant LMS LTI, OneRoster, approved Blackboard REST, SIS exchange |
| Monitoring/audit export | Application audit and provider logs | Splunk, Microsoft Sentinel, Azure Monitor, Datadog, Sentry, institution SIEM |

A vendor change should preserve canonical institution, course, person, enrollment, grade-item, result, feature, connection, and audit identifiers. It should not require a second gradebook or a second institution-membership model.

## Known limitations and statements that must remain accurate

- This document describes the required control model and repository foundations; it does not prove that every control is deployed in a production environment.
- No Angelo State University connection, approval, security finding, accessibility determination, contract, or pilot authorization is claimed.
- The institution directory requires an approved maintained data source and ongoing correction process.
- Blackboard LTI remains a pilot foundation until real institution-issued values and live test evidence pass. EdNotebook does not currently claim 1EdTech certification.
- Blackboard REST is optional and not a live connector.
- SIS/OneRoster, institutional SSO, AI, payment, calendar, email, collaboration plugins, analytics, and monitoring require separate review unless explicitly deployed and documented.
- A frontend switch cannot replace database authorization, remove legal duties, expose a secret, or bypass a platform safety lock.
- Application audit hashes are not a substitute for an institution’s required immutable logging/SIEM controls.
- Privacy, FERPA/records determinations, accessibility acceptance, data residency, vendor risk, retention, incident notification, and production authorization remain institution decisions supported—but not completed—by this documentation.
