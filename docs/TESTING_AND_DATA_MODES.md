# Testing and data modes

EdNotebook testing must remain available without turning optional institutional or research workflows into product-wide gates. The product should ask for additional information only when a user enables the feature that needs it.

## Default: prototype and product-feedback mode

This is the default for demonstrations, usability tests, bug reports, feature voting, and ordinary user-experience surveys.

- Use synthetic course, learner, grade, and submission records in shared demonstrations.
- Collect only the response and optional contact details needed to follow up.
- Show a short, plain-language note explaining what is collected, why, and how to request deletion.
- Do not request a protocol number, research approval, institutional agreement, student identifier, official roster, or official grade.
- Do not describe the activity as anonymous when an account ID, email address, device identifier, or other linkable value is stored.
- Product-feedback surveys can launch without a research review.

## Survey purpose is the trigger

Every survey has a required `purpose` value:

- `product_feedback` — software quality, usability, onboarding, or feature feedback
- `course_feedback` — feedback used by an instructor to improve a course
- `research` — a systematic study configured to produce generalizable findings

Only `research` enables research-specific fields. Those fields stay absent from the other survey forms and exports.

When `purpose = research`, the workspace owner configures whether that project requires a protocol, participant notice, consent record, institution contact, or launch review. A missing required field blocks only that research survey, never the rest of EdNotebook or its product testing.

Changing an existing survey to `research` must create a new version; it must not silently apply new terms to responses already collected for product or course feedback.

## Institution-record mode

This mode is off by default. Enable it for a specific institution workspace when EdNotebook receives an official roster, institution-issued identifier, grade, submission, attendance record, SIS/LTI data, or another institution-controlled learner record.

Activation requires the institution to identify its data owner and required controls. EdNotebook can then enable the appropriate workspace isolation, access, export, and deletion settings for that institution. Any additional setup requested by Blackboard or another connected institution tool belongs only to that connection; it does not become a requirement for product testing, ordinary surveys, or unrelated users.

## Other optional feature triggers

| Feature | Default | Requirements activated with the feature |
| --- | --- | --- |
| Institution records, SIS, LTI, or SSO | Off | Institution owner, connection settings, scoped access, data-use configuration, and institution-required review |
| Research survey or research export | Off | Project-specific protocol, notice, consent, review, and export rules selected by the workspace owner |
| Commercial publishing or marketplace sales | Off | Creator verification, catalog pricing, payout setup, and partner checks needed to list or sell |
| Payments | Off | Price and refund behavior, payment processor configuration, and transaction records |
| Public learner portfolio or talent uploads | Off | Explicit learner choice, audience controls, removal controls, and any destination-specific requirements |

These triggers do not weaken authentication, role checks, private storage, malware scanning, audit events, deletion controls, or data minimization. Those are product safeguards and remain active wherever the underlying feature uses them.

## Implementation rules

1. Feature flags must be workspace-scoped; one institution or research project cannot impose its requirements on unrelated testers.
2. The UI must explain a triggered requirement in product language and identify the feature that caused it.
3. Disabling a feature must stop new collection for that purpose and expose the applicable export/deletion path.
4. Never infer research participation from enrollment, product use, or acceptance of general account settings.
5. Never reuse product-feedback responses as a research dataset unless participants receive the newly required choices and the project owner completes the research-mode setup.
6. A Blackboard, SIS, LTI, or SSO connection can request extra setup for that connection. Do not show or enforce it anywhere else.
