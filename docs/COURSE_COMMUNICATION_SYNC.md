# Governed Course Communication

Status: implemented in code and migrations; not deployed by this change.

## One shared record model

EdNotebook continues to use the existing records:

- `public.learning_messages` for course questions, replies, and short course notes.
- `public.professor_announcements` for professor-authored course announcements.
- `public.learning_resources` for authorized attachment references. Message rows never contain file bytes, signed URLs, or external credentials.

The student dashboard, professor dashboard, and Learning Studio course room now use
`src/communication/courseCommunicationService.js`. Device-only notes remain a separate,
explicit browser-session notebook. They are never labeled sent, delivered, synced, or
official course communication.

## Authorization and isolation

- Students see a course only through a current `learner` membership.
- Professors publish only through a current `owner`, `admin`, or `professor` membership.
- The existing hardened `private.can_access_course` and `private.can_manage_course`
  functions require current institution affiliation when a course belongs to an
  institution.
- Every shared question and reply has `recipient_id = null`, which means the audience is
  the exact course—not the whole institution or platform.
- Course announcement institution and education-division values are derived from the
  selected course. University and K–12 records therefore cannot be relabeled by the
  browser.
- Sender and professor IDs plus sender labels are derived from `auth.uid()` and the
  server-side profile.
- Anonymous roles receive no write or RPC privilege.

## Payload minimization

The client and database reject message or announcement text containing:

- email addresses;
- private UUID/account identifiers;
- explicitly labeled student IDs, grades, scores, rewards, or points;
- explicitly labeled passwords, API keys, access tokens, or secrets.

The UI does not query grades, rewards, email addresses, raw student identifiers, or
attachment bytes. A selectable attachment is only an RLS-authorized course resource
reference.

## Read state, preferences, and refresh

`course_communication_reads` stores per-user read receipts for visible course messages
and announcements. `course_communication_preferences` stores two optional in-app badge
preferences: announcements and questions/replies. Turning a badge off does not hide the
underlying education record.

Both student-owned tables are explicit domains in the version 2.3, 47-domain student-data
safety snapshot. Shared course messages and announcements remain separate course-scoped
records rather than being duplicated into a student's private state.

The small-course pilot uses the repository's existing Postgres Changes subscription for
`learning_messages` and adds `professor_announcements` to the publication. The UI also
offers manual refresh and performs a deterministic 30-second refresh, so a disconnected
WebSocket does not falsely imply synchronization. The list is deliberately bounded to
100 recent thread items and 30 announcements; there is no infinite feed.

## Synthetic first course

`DIGITAL_LITERACY_COMMUNICATION_FIXTURE` models:

- one `DLIT 101` Digital Literacy course;
- one professor announcement about source-check practice;
- one learner question about tracing claims;
- one professor reply.

The fixture contains no real learner, professor, institution, or research data and is
used only by contract tests.

## Verification

```powershell
npm run test:course-communication
npm run test:student-data-safety
npm run build
npm run audit:bundle
npm run build:staging
npm run audit:bundle
```

The database-safety GitHub job applies every migration to a disposable Supabase database
and runs `supabase/tests/institution_student_data_safety.sql`. Its communication gate
checks shared professor/student visibility, server-derived identity, read receipts,
payload minimization, current-course authorization, and cross-institution denial.
