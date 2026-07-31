# Governed EduBook publishing acceptance

Status: **implemented locally; requires merge, staging migration, and browser acceptance**

This controlled unit extends the existing Alex B. Morrison Library/Bookstore
and Stripe Connect marketplace. It does not create a second catalog, checkout,
publication source, course, or reader.

## Connected workflow

1. A professor imports original or licensed text into one `publications` record.
2. The professor chooses read-only or interactive EduBook mode and chooses
   private, course-assigned, open, purchase, or rental placement.
3. Interactive books receive a separate, professor-authored teaching layer for
   chapter checks, private discussion drafts, and a final quiz.
4. Every saved teaching-layer change creates a versioned manifest snapshot.
5. Correct answers and explanations stay in the private schema. The student
   manifest contains prompts and choices only.
6. A student with current open, course, purchase, or rental access can save a
   reading place, answers, private reflection drafts, and completion.
7. The server validates the chapter against the published source, confirms
   current access, requires all questions before completion, and calculates the
   final knowledge score.
8. Existing Stripe webhook fulfillment and refund/dispute revocation continue
   to decide whether a commercial student can open the book.

Standalone bookstore sellers cannot see an identified buyer's reading record.
A professor can retrieve a summary only when the same publication is linked to
a course the professor manages and the learner has a current student
membership. The summary omits answers and private reflection drafts.

## Security boundaries

- Browser clients cannot insert or update `publication_reading_progress`.
- Students alone can select their full reading record. Professors and platform
  owners use `get_publication_reading_progress_summary`, which returns progress
  and score but never interaction content.
- `save_publication_reading_progress` requires `auth.uid()` and current
  publication access on every write.
- `save_publication_learning_layer` is limited to the publication owner.
- Public manifests exclude `correctAnswer` and answer explanations.
- Private answer-key versions are not granted to anonymous or authenticated
  Data API roles.
- Reading-annotation inserts and updates now require current publication access.
- The source chapter blocks are not accepted as teaching-layer input and remain
  unchanged when the professor saves a learning version.

## Automated evidence

- `npm run test:edubook-publishing`
- `npm run test:commercial-publishing`
- `npm run test:student-experience`
- `supabase/tests/edubook_learning_gate.sql`
- `supabase/tests/commercial_publishing_gate.sql`
- production and staging builds

The rollback-safe SQL gate proves version history, hidden answer keys, governed
progress writes, server scoring, access-scoped annotations, and the privacy
boundary that prevents a standalone seller from reading buyer learning data.

## Staging acceptance after merge

Use the existing professor, student, and owner staging accounts.

1. Professor: create **Digital Literacy · Source Verification Field Guide** as
   an interactive text EduBook, then add one chapter check, one reflection, and
   one final quiz question.
2. Professor: publish it open/free first and confirm it opens inside the Alex B.
   Morrison Library without another browser tab.
3. Student: answer the check, save progress, leave and reopen the book, complete
   the final quiz, and confirm progress and private notes return.
4. Professor/owner: confirm a standalone Library reader's identified progress
   is not exposed in seller commerce records.
5. Commerce extension: submit book purchase/rental rights and a sandbox listing,
   approve it in the TOS Control Center, then run the same verified Stripe
   checkout/entitlement trace already proven for courses.

Live commerce remains disabled until the production tax, legal, finance,
security, webhook, and payout blockers in
`docs/STRIPE_CONNECT_STAGING_EVIDENCE.md` are approved.
