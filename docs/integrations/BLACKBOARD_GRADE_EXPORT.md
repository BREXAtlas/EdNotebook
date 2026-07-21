# Blackboard Grade Export

## Purpose

EdNotebook creates a Blackboard-compatible grade file using the Blackboard gradebook template uploaded by the professor. The professor then uploads the completed file into Blackboard.

This first integration is a controlled file exchange. It avoids collecting a Blackboard password or API token and works across Blackboard gradebook formats by treating the professor's downloaded CSV as the structural source of truth.

The exporter uses EdNotebook's shared [learning-system data model](./LEARNING_SYSTEM_DATA_MODEL.md). Blackboard CSV, LTI, a future Blackboard REST connector, and institution/SIS adapters therefore use the same course, roster, line-item, result, identifier, and provenance vocabulary instead of adding parallel grade systems.

## What this feature does

- Opens from the protected professor **Grades** area under **Export & integrations**.
- Shows only courses the signed-in professor is authorized to manage.
- Accepts a UTF-8, comma-delimited `.csv` file up to 10 MB.
- Detects likely Blackboard identity, grade, calculated, blank, and unknown columns.
- Recognizes institution-facing username, student ID, SIS user ID, email, name, points-possible, and provider line-item identifiers when present.
- Matches Blackboard rows to learners using saved mappings, exact email, and reviewed names.
- Matches Blackboard grade columns to existing EdNotebook grade items, course completion, or final course grade.
- Requires an explicit scaling choice when EdNotebook and Blackboard maximum points differ.
- Blocks export for duplicate mappings, unresolved review decisions, stale grades, invalid grade values, malformed rows, or unsafe file structure.
- Shows the exact previous and replacement values before confirmation.
- Preserves original headers, column order, row order, unknown columns, and unrelated values.
- Updates only professor-approved cells backed by finalized EdNotebook grades.
- Downloads a UTF-8 CSV and records a permanent export-history entry.

## What this feature does not do

- It does not sign in to Blackboard.
- It does not call the Blackboard REST API.
- It does not automatically synchronize or pass grades back.
- It does not implement LTI, LTI Advantage, OAuth, SCORM, or Blackboard Ultra Extensions.
- It does not change EdNotebook grades, assignments, course progress, or the existing gradebook.
- It does not store the generated Blackboard CSV in GitHub or at a public URL.
- It does not assume every institution uses the same Blackboard headers.

## Professor workflow

1. In Blackboard, open the course gradebook and download the current gradebook as a CSV.
2. In EdNotebook, open **Professor dashboard → Grades → Export & integrations → Export to Blackboard**.
3. Choose the EdNotebook course.
4. Upload the Blackboard CSV.
5. Review the detected identity, grade, calculated, and unknown columns.
6. Match Blackboard students to EdNotebook learners. Low-confidence matches are never accepted automatically.
7. Match Blackboard grade columns to EdNotebook grade items or course-level scores.
8. Resolve blocking issues and review warnings.
9. Preview every changed row and column.
10. Confirm the statement that Blackboard changes only after the professor uploads the downloaded file.
11. Download the generated `blackboard-grades-{course-code}-{timestamp}.csv`.
12. Import that file into Blackboard and use Blackboard's own preview/confirmation controls before completing the upload.
13. Return to EdNotebook's export history for reconciliation metadata.

Blackboard menu names can differ by release and institution. Anthology maintains the current instructor documentation in [Blackboard Help](https://help.blackboard.com/Learn/Instructor/Ultra/Grade/Grading_Tasks/Download_Grades).

## Identity matching rules

### High confidence

- A professor-confirmed mapping saved for the same EdNotebook course.
- Exact normalized email with one enrolled EdNotebook learner.

### Medium confidence

- Exact full name when only one enrolled learner has that name.

### Low confidence

- Similar name, nickname, partial identity, or an ambiguous name.

Medium- and low-confidence proposals require professor review. One EdNotebook learner cannot be mapped to multiple Blackboard rows. Mappings are never automatically reused across institutions.

## Grade-column matching rules

### High confidence

- A saved mapping for the same course and normalized Blackboard column key.
- Exact normalized title and equal maximum points.

### Medium or low confidence

- Exact title with different maximum points.
- Similar title with a single likely grade item.

The professor must accept uncertain mappings. Calculated or protected-looking columns are left unchanged by default and produce a warning if deliberately mapped.

## Grade scaling

- **Preserve raw score:** export the EdNotebook numeric score unchanged.
- **Scale proportionally:** calculate `EdNotebook score ÷ EdNotebook maximum × Blackboard maximum`.
- **Export percentage:** calculate `EdNotebook score ÷ EdNotebook maximum × 100`.
- **Do not update:** keep the original Blackboard cell.

Exported values round to two decimal places. The preview shows the result before confirmation. Scaling never changes the original EdNotebook grade.

Example: an EdNotebook score of 88 out of 100 mapped to a Blackboard column worth 44 points exports as 38.72 when proportional scaling is selected.

## Validation behavior

### Blocking

- Malformed quoting or inconsistent row width.
- Blank or duplicate headers.
- No likely identity or grade columns.
- A student or column proposal still awaiting review.
- One EdNotebook learner mapped to multiple Blackboard rows.
- One EdNotebook grade item mapped to multiple Blackboard columns.
- A grade item from another course.
- Different maximum points without a selected scaling rule.
- Negative or above-maximum EdNotebook grades.
- Lost course-management permission.
- Grade data changed after the preview.

### Warning

- Blackboard student not matched to EdNotebook.
- EdNotebook learner absent from the Blackboard file.
- Missing, pending, or unfinalized grade.
- Formula-like text cell that will be neutralized.
- Deliberately mapped calculated or protected-looking column.

### Information

- Grade columns intentionally left unchanged.

Unmatched learners and pending grades never receive exported values.

## CSV handling and spreadsheet safety

The parser supports quoted commas, escaped quotes, UTF-8 names, CRLF or LF rows, and blank trailing lines. It does not evaluate formulas. Text values beginning with `=`, `+`, `-`, or `@` are prefixed safely when needed to reduce CSV injection risk. Negative numeric grades remain numeric.

The generator preserves all original columns and their order. It does not add EdNotebook IDs or arbitrary reconciliation columns to the Blackboard upload file. A separate report can be added later without changing the upload format.

## Privacy, storage, and retention

This feature handles educational records and must be operated under the institution's approved privacy and records practices.

- The Blackboard CSV is parsed in volatile browser memory for the current workflow.
- Gradebook contents are not written to `localStorage`, route parameters, analytics, console logs, GitHub, or public Storage.
- The browser sends mappings and a limited grade snapshot to a secure Supabase function only at confirmation.
- The function rechecks the signed-in professor, course authority, learner enrollment, grade source, finalized status, score, and `updated_at` value.
- If any source grade changed after preview, confirmation fails closed.
- Supabase stores course-scoped mappings, export metadata, source and grade-snapshot hashes, counts, and the limited reconciliation snapshot.
- Mapping records reserve canonical provider, mode, external identifier, external line-item, academic-session, reconciliation, and contract-version fields. Values remain null when a CSV does not provide them.
- RLS restricts records to authorized course managers and applicable institution managers. Students cannot browse them.
- The generated CSV is downloaded directly to the professor's device; it is not retained by EdNotebook in this implementation.
- Audit details contain counts, hashes, filenames, and event types rather than full CSV contents or student grades.

Institutions should set an approved retention period for mapping and export-history records. Legal-hold and records requirements should be resolved before deletion. If a future policy permits retaining generated files, they must use private storage, short-lived signed access, audited downloads, and explicit retention rules.

## Supabase deployment

Apply the additive migration:

`supabase/migrations/20260721143000_blackboard_grade_export.sql`

The migration creates:

- `blackboard_identity_mappings`
- `blackboard_grade_column_mappings`
- `blackboard_grade_exports`
- Course-manager and institution-manager RLS read policies.
- Secure functions for course summaries, export context, mapping persistence, preview audit, confirmation, staleness validation, and download audit.

The public client receives no service-role key. New writes occur through authenticated, explicitly granted `SECURITY DEFINER` functions that check `auth.uid()` and `private.can_manage_course` before accessing records.

After applying the migration:

1. Confirm the functions appear in the Supabase API schema.
2. Test with an authorized professor, an unrelated professor, and a learner.
3. Confirm the unrelated professor and learner receive no mapping or history rows.
4. Run database security and performance advisors.
5. Verify audit events for template upload, mapping confirmation, preview, confirmation, generation, and download.

### Rollback guidance

Supabase migrations are forward-only in normal deployment. If the feature must be disabled, first remove or feature-gate the professor entry point and revoke `EXECUTE` on the Blackboard export functions. Preserve export history according to institutional retention rules. Only after records and legal holds are reviewed should a separately approved migration drop the functions, policies, and tables. Do not delete educational-record metadata during an incident response merely to reverse application code.

## Troubleshooting

- **No courses appear:** confirm the user owns the course or has `owner`, `admin`, or `professor` membership.
- **Database migration not deployed:** apply the migration and refresh the Supabase API schema.
- **No identity columns detected:** download the full Blackboard gradebook rather than a report that omits learner identifiers.
- **Duplicate headers:** export a fresh Blackboard template or correct the duplicate only in Blackboard before downloading again.
- **Student cannot be matched:** confirm enrollment in EdNotebook, then choose the learner manually or exclude the Blackboard row.
- **Scaling required:** select raw, proportional, percentage, or leave the Blackboard column unchanged.
- **Preview is stale:** return to Preview export and regenerate it after the latest EdNotebook grades load.
- **Blackboard rejects the CSV:** download a fresh gradebook from that Blackboard course and repeat the mapping so institution-specific columns and identifiers remain current.
- **Download interrupted:** the history record remains available; generate a fresh export rather than relying on an incomplete local file.

## Future integration directions

### Blackboard REST API

A future server-side connector may use Blackboard's supported REST APIs for grade columns and grades. It would require institution-approved OAuth registration, least-privilege scopes, token storage outside the browser, rate-limit handling, reconciliation, retries, and full audit. It must remain optional and must not replace the manual export path.

### LTI 1.3 and LTI Advantage

LTI 1.3 could provide institution-managed launches. LTI Advantage Assignment and Grade Services could support line items and grade passback after an institution completes registration, privacy review, deployment testing, and explicit service approval. Secure LTI work requires public server endpoints and signing keys; it cannot be implemented only in the static Vite frontend.

### SCORM

SCORM packaging is a separate course-content interoperability path. It does not replace gradebook CSV exchange, LTI launches, or the Blackboard REST API. Any future SCORM export should reuse the approved EdNotebook course publication rather than create a second course engine.

## Acceptance test

Use a non-production Blackboard test course with at least:

- Three learners, including one unmatched name.
- Two grade columns, including one with a different point maximum.
- One unknown Blackboard column.
- One calculated column left unchanged.
- A quoted learner name or assignment title containing a comma.
- A finalized grade, pending grade, zero, full score, and decimal score.

Confirm the generated CSV has the same header count, header order, row count, row order, unknown values, and unrelated grades as the uploaded template. Confirm only approved cells differ. Then import the file into Blackboard's preview and verify the expected learners and columns before completing the test upload.
