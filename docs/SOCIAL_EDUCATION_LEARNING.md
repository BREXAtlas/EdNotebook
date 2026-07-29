# Social Education Learning

Social Education Learning is EdNotebook's private-by-default recognition path. A professor can recognize one enrolled student inside one managed course with:

- a named award and friendly visual;
- a learning category;
- a specific lesson, assignment, quest, or learning-moment reference;
- 1–100 proportionate points; and
- a required plain-language reason the student can understand.

The first synthetic example is the **Digital Literacy Course**. It recognizes lateral reading, source evaluation, accessible publishing, digital citizenship, reflection, collaboration, purposeful effort, and growth.

## Student experience

Students receive a warm celebration card, a visible progress path, a trophy shelf, optional convenience unlocks, and the full reason history. Milestones are deterministic:

| Points | Badge | Optional convenience |
| ---: | --- | --- |
| 100 | Source Scout | Low-distraction focus palette |
| 250 | Digital Citizen | Source organizer layout |
| 500 | Evidence Builder | Reflection prompt pack |
| 1,000 | Learning Guide | Private badge-display choice |

Unlocks never gate lessons, assignments, feedback, accessibility support, grades, or any other academic entitlement. Points cannot be purchased, traded, randomized, or converted into grades. There is no public leaderboard or infinite reward feed.

An earned convenience still requires the student to turn it on. Those low-stakes display preferences are stored on the current device in this slice; no convenience is silently enabled and no badge is published automatically.

## Data and correction rules

`social_learning_reward_events` is an append-only ledger. Authenticated browser clients receive read access only:

- students can read only their own records;
- course managers can read only records in courses they manage;
- awards must go through `issue_social_learning_reward`;
- adjustments and reversals must go through `correct_social_learning_reward`; and
- the original award is never edited or deleted during a correction.

The issue RPC verifies active enrollment and course authority. A client idempotency key makes retries safe. A server-computed semantic key prevents the same named award from being issued twice to the same student for the same learning activity. A correction is the required path when the points or message need repair.

Privacy-law deletion may still cascade when an authorized account or course erasure removes its parent record.

## Rollout

1. Apply `20260729041110_social_education_learning_rewards.sql` to the existing staging project only.
2. Run `npm run test:social-learning` and the normal build.
3. Sign in as a professor who manages a course with an active learner membership.
4. Unlock the protected portal area and issue a Digital Literacy test reward.
5. Confirm the student sees the same visual, reason, net points, milestone path, and ledger.
6. Record an adjustment, then a reversal, and confirm the original remains visible.
7. Keep production disabled until staging RLS and browser checks pass.

This slice intentionally does not add a social feed, chat, public competition, store, virtual currency, random prize, or grade integration.
