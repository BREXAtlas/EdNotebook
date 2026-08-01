# Media-to-learning workflow acceptance

This controlled unit connects professor-published media to the student learning workflow without treating playback as evidence of attention, understanding, grading, or course completion.

## Professor acceptance

- A professor can leave media optional or make accessible video, audio, image, or YouTube media required.
- Required media must be placed in one exact published lesson or assignment.
- Lesson media can be completed by the same lesson or one exact knowledge check in that lesson.
- Assignment media is completed only by submission of that exact assignment.
- The professor can set an estimated duration and an optional due date that feeds the existing syllabus, calendar, reminder, and notification route.
- Editing a learning requirement returns the source resource to draft until the professor publishes the next immutable course version.
- Replacing media preserves the prior publication evidence and carries the linked activity state into the replacement version.

## Student acceptance

- Required media appears in due work, the traditional calendar, syllabus dates, reminders, and the notification bell.
- Selecting any of those surfaces opens the exact media in its lesson or assignment; it does not send the student to an external page.
- Native and YouTube media resume from the learner's last governed playback position.
- Finishing playback never completes the learning requirement. The exact lesson completion, submitted knowledge check, or submitted assignment controls the status.
- Completed linked learning work leaves the active due-work and notification flow.

## Governance evidence

- `media_learning_progress` is RLS-enabled, has no direct browser access, and is changed only through server-governed lesson/check/assignment events.
- Student resource envelopes expose only the signed resource, the learner's own playback state, the learner's own linked-learning state, and explicit reader policy.
- Professor evidence is aggregate and separates playback, accessibility readiness, and linked-learning completion.
- Publication rejects missing or mismatched lesson, knowledge-check, and assignment targets.
- The rollback-safe SQL gate proves exact completion, replacement history, outsider denial, and playback/completion separation.

## Evidence commands

```powershell
npm run test:media-learning
npm run test:student-experience
npm run test:media-accessibility
npm run test:media-resources
Get-Content -Raw supabase/tests/media_learning_workflow_gate.sql | docker exec -i supabase_db_ednotebook-local psql -U postgres -d postgres -v ON_ERROR_STOP=1
npm run build
npm run audit:bundle
npm run build:staging
npm run audit:bundle
```
