# Digital Literacy pilot launch signoff

Status: technically rehearsed in disposable data; **human-subjects research remains off**

## What this signoff proves

The final controlled unit verifies that the complete canonical Digital Literacy course can continue as ordinary course work while optional research remains independently fail closed.

- The professor launch panel reads the database's current blockers; it does not infer approval in the browser.
- The active canonical release must contain all 40 repository units.
- A research project needs one exact immutable version with current dates, an authorized data owner, minimized instruments, retention/deletion/export rules, and the approved Digital Literacy unit scope.
- A current written ASU IRB/HRPP determination must match that version's notice and consent—or documented written waiver—configuration.
- The course-scoped human-subjects feature control and the exact project version require separate explicit activation.
- Enrollment, assignments, completion, grades, rewards, feedback, and ordinary course surveys remain available when research is absent, declined, withdrawn, expired, or blocked.

## Synthetic export rehearsal

`supabase/tests/digital_literacy_research_gate.sql` creates a disposable institution, course, approval marked clearly as synthetic, three voluntary synthetic participants, and minimized responses inside one transaction. It then verifies that the governed export:

1. enforces the approved minimum cohort;
2. returns a version-specific keyed participant code rather than a user ID;
3. excludes emails, names, the secret linkage key, and other direct identifiers;
4. labels the output pseudonymized rather than anonymous;
5. requires manual disclosure review for approved qualitative text; and
6. writes an audit receipt containing counts and policy mode, never response content.

The transaction rolls back. No fixture represents a real person, determination, consent record, or ASU study.

## External launch blockers

Passing repository, database, and staging checks means the system is technically ready for an authorized research configuration. It does **not** authorize research collection. Before a real Digital Literacy pilot can collect pre/post, open-ended, interview, or learning-effectiveness research data, an authorized institution owner must provide and record:

- the real written ASU IRB/HRPP determination for the exact project version;
- approved participant notice and consent or waiver language;
- the approved instruments, course-unit scope, recruitment process, data owner, dates, retention, deletion, incident-response, and export plan;
- confirmation that participation is prospective, voluntary, and disconnected from grades or access; and
- separate staging acceptance and production activation authorization.

Until those items exist, the correct launch state is `research_not_configured` or `blocked_pending_governance`, and the student research surface returns no active project.
