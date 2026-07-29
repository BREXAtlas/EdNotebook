# Digital Literacy student learning workspace

## Outcome

The signed-in student dashboard now has one `Learning workspace` surface for notes, sources, citations, feedback, device files, and portable export. It reuses the existing student dashboard, local device vault, Digital Literacy file-name convention, and optional Supabase account service. It does not create a second site or replace the course runtime.

Digital Literacy is the first synthetic practice context. The UI labels it as practice and does not invent an Angelo State University course, syllabus, enrollment, professor, source, or library record.

## Student workflow

1. **Read and capture:** Save a note with its course, lesson, and optional related source.
2. **Revise without overwriting:** `Create next version` appends a new version and retains the prior file name, timestamp, and lineage.
3. **Credit the source:** Choose APA 7 or MLA 9, select a common source type, add multiple personal or organizational authors and other contributors, then format, copy, and save the reference and in-text citation.
4. **Learn from a pasted reference:** The format checker returns specific teaching prompts. It is explicitly a pattern check, not authoritative proof that the bibliographic facts or the source itself are correct.
5. **Keep feedback and files:** A student may retain feedback they are allowed to keep and save a file in the existing IndexedDB device vault. Files follow `date_course_category_subject_version.ext`.
6. **Leave with the work:** The student selects records and file metadata, then downloads:
   - a readable standalone HTML learning packet; and
   - an `EdNotebookLearningPacket/1.0` JSON restore manifest.

The JSON manifest can be restored later. Restore appends records and creates a new version on a root/version collision; it never overwrites an existing version. Binary device files are not silently embedded or uploaded. Students download those separately and decide where to store them.

## Storage and no-lock-in behavior

- **This browser (default):** all learning records are saved to the environment-namespaced browser workspace. Device files use the existing IndexedDB vault. This mode does not query or merge private cloud learning records.
- **Private cloud + browser (optional):** selecting this mode is the explicit action that loads the signed-in student's private cloud records and merges them into the browser without overwriting local versions. New saves can then append the same record to `student_learning_records`. A cloud error never removes the browser copy.
- **Portable device export:** HTML and JSON remain readable outside EdNotebook.

Live course choices use the course record's unique ID, not its display code. This keeps two sections with the same course code distinct. If the dashboard first renders the synthetic Digital Literacy practice option and an enrolled Digital Literacy course arrives asynchronously, the workspace reconciles to the real course ID before saving. A live course row without a stable ID cannot become a save target; the clearly labeled synthetic practice fixture remains available instead.

The cloud table is append-only for authenticated clients:

- explicit `SELECT` and `INSERT` grants only;
- RLS `SELECT` and `INSERT` policies require `auth.uid() = student_id`;
- a real `course_id` must pass the existing `private.can_access_course` membership check;
- no authenticated `UPDATE` or `DELETE` grant or policy;
- unique student/root/version and student/record identifiers;
- a one-megabyte JSON payload limit.

Existing student-dashboard notes are migrated into version 1 records the first time the new workspace opens. The original local note store is retained, and deterministic legacy identifiers prevent duplicate imports. Device-vault file listings are scoped to the signed-in workspace so a second account using the same browser does not receive another student's file list in the UI.

The migration is prepared but not deployed by this change:

`supabase/migrations/20260729043032_student_learning_workspace.sql`

## Citation scope

Style metadata is pinned to the current official manuals used for this implementation:

- [APA Publication Manual, 7th edition](https://www.apa.org/pubs/books/publication-manual-7th-edition-paperback)
- [APA reference examples](https://apastyle.apa.org/style-grammar-guidelines/references/examples)
- [MLA Handbook, 9th edition](https://style.mla.org/mla-handbook-ninth-edition/)
- [MLA citations by format](https://style.mla.org/works-cited/citations-by-format/)

The bounded formatter supports common student source types: journal article, book, book chapter, website, video, report, government resource, and an extensible other type. It supports multiple authors, organizations, editors and other contributors, DOI normalization, plain-text copy, rich-text copy with italics where the destination supports it, and common parenthetical/narrative in-text forms.

This is not a certified citation validator. Source-specific exceptions, capitalization, legal materials, archival collections, datasets, unusual media, and the accuracy of entered metadata still require comparison with the official manual or a librarian/instructor.

## Verification

Run the focused CI gate:

```powershell
npm run test:student-learning
```

Run the build gates:

```powershell
npm run build
npm run build:staging
```

The focused gate checks:

- APA 7 / MLA 9 edition metadata and representative formatting;
- multiple-author and in-text output;
- HTML escaping of student-entered citation data;
- teaching-only checker language;
- append-only lineage and collision handling;
- search/retrieval and predictable file names;
- readable packet and restore manifest generation;
- restore without overwrite;
- one-time, non-destructive migration of existing student notes;
- device mode performing no private-cloud load or merge;
- unique-ID course selection, including duplicate display codes and synthetic-to-live reconciliation;
- actual signed-in student dashboard integration;
- own-student RLS, absence of authenticated update/delete access, and inclusion in the version 2.3 / 47-domain student-data inventory.

Before enabling cloud sync in staging, apply the migration to the existing staging project only and test with two synthetic student accounts:

1. Student A can insert and select Student A records.
2. Student B cannot select Student A records.
3. Student B cannot insert a row with Student A's `student_id`.
4. Neither authenticated student can update or delete a record.
5. A record with a real `course_id` is rejected unless the current user has active course access.
6. Device-only save, export, and restore continue to work with Supabase unavailable.
