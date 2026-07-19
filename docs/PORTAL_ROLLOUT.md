# University, K–12, and educator portal rollout

## What is implemented

- A neutral first page routes students, educators, and publishing partners to separate onboarding pages.
- Students choose University or K–12, then browse the matching school, class, and educator directory without an account. Protected class work begins only after sign-in and enrollment.
- Student onboarding collects the university or school ID needed for roster matching, stores only a match value and last four characters, and records the current education division.
- Educators can sign up with any email and receive teaching tools immediately. Manual review is optional and controls only whether a school-affiliation badge is displayed.
- Verified and unverified educator classes can both appear in live search; each listing shows its affiliation status.
- The shared student dashboard includes classes, points, grades, published weights, report-card sharing, notes, groups, messages, a student page, opportunities, and a tour. Language and examples adapt to University or K–12 without duplicating the app.
- K–12 and University profiles, groups, posts, notes, and session messages use separate audiences or storage keys. A K–12 learning path can transfer learning memory into University while leaving K–12 social content behind.
- The shared educator dashboard includes University and K–12 class publishing, CSV roster preview, account-link approvals, grade status, published weights, attendance, announcements, educator page options, school verification, and a tour.
- PowerSchool attendance and grade-passback connection controls are present but disabled until a district connection and section mapping are implemented.
- The master admin dashboard separates University and K–12 affiliation queues and lets an `owner` or `admin` review the private teacher document and approve or reject the public badge.
- Roster and grade screens require password re-entry, lock after five minutes, and lock when the browser tab is hidden.
- Device-only messages use session storage and can be cleared manually. University and K–12 use different keys. Paid sync is optional and is never silently enabled.
- The live Supabase schema separates public listings from class content and restricts grades to the student, a manager of that class, or an educator explicitly authorized by the student for named classes.

## Free and paid boundaries

Core learning and teaching work stays free:

- class discovery and public class previews
- enrollment and account linking
- course work, notes, basic messaging, grades, weights, and report cards
- basic student page after enrollment
- class groups, school or campus groups, announcements, progress, and reward sharing by student choice
- class publishing, roster management, attendance, grading, and basic educator presence

Optional paid items are separate from required class participation:

| Offer | Proposed price | Adds |
| --- | ---: | --- |
| Pocket add-on | $0.99 each | One safe page theme, link block, media block, or profile accent |
| Student Plus | $2.99/month | Cross-device note/message sync, expanded page layouts, and longer private history |
| Educator Plus | $8/month | Expanded educator page, media blocks, additional public presentation options, and advanced exports |
| Founding student or educator | Free forever | The founding feature set remains available after launch |

Do not charge for viewing grades, joining a required class, reading class material, submitting work, or receiving educator feedback.

## Data boundaries

| Data | Student | Class educator | Another educator | Public |
| --- | --- | --- | --- | --- |
| Public class listing | View | Publish/manage own class | View | View |
| Protected class content | Enrolled classes | Managed classes | No | No |
| Student grades | All of their own classes | Only managed classes | Only classes named in a student-authorized share | No |
| Roster match | Own match status | Managed classes; last four shown | No | No |
| Class group | Enrolled members in the current division | Managed class | No, unless enrolled/authorized in that division | No |
| Student social page | Student-selected fields in the current division | Same division and audience only | Same division and audience only | University only when the student selects public |
| K–12 learning transfer | Student-controlled learning memory | No | No | No |

Signup metadata is copied into database-owned profile and education-path records. Database roles, class ownership, enrollment, and row-level rules control access after signup.

## Survey and testing behavior

Product feedback, usability checks, bug reports, feature voting, and ordinary user-experience surveys stay in the default product-feedback mode. They do not request grades, student IDs, or institutional records.

Additional setup appears only when a workspace deliberately creates a research survey or connects an outside school system. A Blackboard, SIS, LTI, or SSO connection can add requirements to that connection only; it cannot block ordinary product testing or unrelated surveys.

## Owner actions before a production pilot

1. **Enable compromised-password detection.** In the Supabase dashboard, open Authentication settings, find password protection or attack protection, and enable leaked-password checks. This is the only remaining Supabase security-advisor warning.
2. **Add the roster match service.** Create a server-only `ROSTER_ID_HMAC_SECRET`, deploy an authenticated function that normalizes and HMACs university and school IDs, and change student signup and educator CSV import to call it. Never log or store the raw ID. The current browser hash is suitable for prototype matching but not for a school pilot.
3. **Assign affiliation reviewers.** Give a small number of trusted accounts the `owner` or `admin` role. They can open `#/admin`, inspect a private teacher document after security scanning finishes, and approve or reject only the affiliation badge.
4. **Load real directory data.** Create University and K–12 institution and class records, then publish rows to `published_course_directory` with the correct `education_division`. Until rows are published, each directory clearly labels synthetic demonstration listings.
5. **Connect notifications.** Add an email provider and send class-scoped notices when a student requests linking, when an educator approves or rejects the request, and when a finalized grade is published. Do not include grades or student IDs in email.
6. **Add server-enforced step-up for grades.** The interface already rechecks the password and auto-locks. Before official grades are used, issue a short-lived server-side gradebook capability after reauthentication or MFA and require it on grade writes and report exports.
7. **Connect public forms.** Route feature suggestions, waitlist entries, and opportunity interest through a rate-limited endpoint with bot protection and a deletion path. The current preview stores entries only for the browser session and says it is not a live submission.
8. **Configure billing.** Create Stripe prices for optional add-ons, Student Plus, and Educator Plus; map them to existing entitlements; and create a founding-user entitlement that does not expire. Keep every class-required feature outside the paywall.
9. **Decide the customization ceiling.** The current page builder uses safe themes and fields. If student-authored code is added later, render it on an isolated origin with a strict sandbox and no access to EdNotebook cookies, storage, grades, or messages.
10. **Plan the PowerSchool connection.** Obtain district approval and credentials, map SIS sections and grade categories, and implement server-side sync with audit logs and retry handling. Keep the two PowerSchool buttons disabled until an end-to-end district test passes.

## Current rollout state

The routes, screens, live public-directory adapter, immediate educator access, optional affiliation workflow, master admin queue, and Supabase division boundaries are implemented. Dashboard examples remain synthetic until real institutions, classes, enrollments, and grades are loaded. Payment, email, server-side roster HMAC, grade step-up capability, public form delivery, and PowerSchool sync require the owner actions above.
