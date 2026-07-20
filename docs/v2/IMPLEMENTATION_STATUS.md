# EdNotebook V2 implementation status

Updated July 19, 2026.

## Completed locally

- Audience-first landing routes with student, K–12, and educator product entry points.
- Guest syllabus scanner and lesson creator entry experiences.
- PDF and DOCX extraction into the existing editable syllabus review flow.
- Post-tour actions for dashboard, featured product, sample page, and workspace return.
- Course publishing studio with limited appearance controls, interactive preview, standalone HTML export, guest broadcast link, and class signup link.
- Account referral code capture, unique account number foundation, referral progress, verified email-change flow, and inactive-account worker rules.
- Audio-only office-hours and study-room client, shared scratchpad, class-scoped schema, token function, and provider architecture.
- Research prioritization for spaced retrieval and open resources.

## Requires backend deployment or owner setup

- Apply the two pending July 19 migrations to the linked Supabase project.
- Deploy `live-room-session` and the updated retention worker.
- Add LiveKit function secrets and a provider spending alert.
- Validate email templates and redirect URLs in Supabase Auth.
- Run RLS/advisor checks in the live project.
- Verify the production custom domain after the new build is deployed.

## Not represented as complete

The full eight-PR V2 communications, moderation, native-app, and publisher-intelligence program is broader than the foundations above. No production claim should say that all messaging moderation, native push, widgets, offline sync, recording, or external SIS/LMS sync is live until its own schema, UI, abuse tests, store configuration, and deployment gates pass.
