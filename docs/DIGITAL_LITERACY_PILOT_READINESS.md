# Digital Literacy pilot readiness

Status: controlled staging unit — research collection **NOT ACTIVATED**

## Canonical full-course boundary

The pilot uses the complete [`BREXAtlas/Digital-Literacy-Course`](https://github.com/BREXAtlas/Digital-Literacy-Course) repository. The synthetic EdNotebook example is not the course and must not become a second content source.

- Release `2026.08.01.1` publishes a versioned manifest of 20 Foundations episodes and 20 AI Quest units.
- The manifest records stable unit IDs, order, titles, paths, and repository URLs; the lesson HTML and learning interactions remain in the course repository.
- A professor may assign one unit, a sequence of units, either 20-unit path, or the entire 40-unit course to all current learners or selected learners.
- EdNotebook reuses its existing class membership, assignments, due dates, calendar/notification route, and professor/student dashboards.
- Students open the canonical course inside EdNotebook. Only messages from the expected GitHub Pages origin, iframe window, course key, and release are accepted as progress evidence.
- Completion and stars are recorded only for units the authenticated student was actually assigned. Professor and student views are generated from the same recipient/progress records.

Updating lesson content requires a new canonical repository release and manifest hash. EdNotebook must never silently rewrite, scrape, or fork the course into a second curriculum.

## Coursework and research are separate

Assigning or completing Digital Literacy course work is not consent to research. Grades, access, rewards, completion, instructor feedback, and ordinary course feedback continue whether the learner participates, declines, or withdraws.

The optional research surface stays closed until the exact immutable research version has:

1. a current written ASU IRB/HRPP determination;
2. an authorized institution data owner;
3. current effective and expiration dates;
4. an approved participant notice and consent or documented waiver configuration;
5. immutable pre/post and qualitative instrument versions with minimized response fields;
6. retention, deletion, and export rules;
7. course-scoped feature approval and explicit institution activation; and
8. the learner's prospective, voluntary choice.

The approved instrument scope controls timing. A pre-assessment cannot be submitted after assigned-unit completion starts. A post-assessment remains unavailable until the learner completes the approved unit scope. Open-ended surveys and qualitative interviews follow the same version and participation gate.

Angelo State says covered human-subjects projects require IRB review and approval before data collection, and its classroom-project guidance treats students as a captive participant population whose research participation must be disconnected from grades. See [ASU Protection of Human Subjects](https://www.angelo.edu/research/compliance/protection/human-subjects.php) and [ASU Guidelines for Classroom Projects](https://www.angelo.edu/live/files/17315-guidelines-for-classroom-projects). The application does not decide whether the pilot is exempt.

## Governed export boundary

The research export RPC requires institution research-governance access, a blocker-free active version, an approved export mode, and the configured minimum cohort size (never fewer than three; default five).

Direct identifiers and the secret linkage key are excluded. Participant codes are version-specific keyed hashes. That output is **pseudonymized, not anonymous**: coded data may remain identifiable when linkage or contextual information exists. OHRP's [Guidance on Research Involving Coded Private Information or Biological Specimens](https://www.hhs.gov/ohrp/regulations-and-policy/guidance/research-involving-coded-private-information/index.html) is the governing caution.

Qualitative/open-text responses are excluded unless the approved version explicitly permits pseudonymized export with manual redaction. Every included qualitative row is marked for manual disclosure review. Export generation is audited without placing response content in the audit event.

## Evidence gate

Before merge:

1. Run `npm run test:digital-literacy-pilot`.
2. Run `npm run test:research-gate` and the existing student-experience/storage suites.
3. Rebuild staging and run the bundle audit.
4. Validate the full course repository with `npm run validate`.
5. Apply the migration to a disposable local database and run `supabase/tests/digital_literacy_pilot_readiness.sql`.
6. Review RLS and security advisors before any staging deployment.

After the canonical repository PR is merged, merge the EdNotebook staging PR, deploy its migration through the governed staging workflow, and perform professor/student acceptance with the existing staging accounts. Do not activate a research version or collect a response as part of this unit.
