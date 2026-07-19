# EdNotebook educational material storage

## Decision

EdNotebook uses **Supabase Storage for the launch architecture** and keeps GitHub Pages limited to static application assets.

The operational database and educational files remain separate concerns:

- Postgres stores users, courses, memberships, assignments, resource metadata, rubrics, drafts, messages, publication records, and annotations.
- Supabase Storage stores uploaded file bytes in private buckets.
- IndexedDB stores files only when a user deliberately selects **This device only**.
- GitHub stores versioned application source and public build assets, never student submissions or private educational documents.

This architecture is intentionally adapter-based. Cloudflare R2 can become an overflow or publication-asset provider later without changing the `learning_resources` metadata contract or course UI.

## Private buckets

| Bucket | Purpose | Object path convention |
|---|---|---|
| `ed-private-vault` | Private personal materials | `<user_id>/<object_id>/<safe_name>` |
| `ed-course-materials` | Materials shared inside a course | `<course_id>/<uploader_id>/<object_id>/<safe_name>` |
| `ed-submissions` | Learner assignment uploads | `<course_id>/<assignment_id>/<student_id>/<object_id>/<safe_name>` |
| `ed-publications` | Book, reading, and publisher source packages | `<owner_id>/<publication_id>/<object_id>/<safe_name>` |

All four buckets are private. Access is enforced by Storage RLS policies, not by obscurity or guess-resistant URLs.

## Access model

- Personal-vault objects are readable, writable, and removable only by the authenticated owner represented in the first path segment.
- Course materials are readable by authorized course members. Uploaders can manage their objects; professors and course managers can manage course objects.
- Submission files are readable by the submitting learner and assignment managers. A student cannot read another student’s submission.
- Publication source files are private to their owner during the launch phase. Future approved-marketplace delivery should issue time-limited access from a server-side entitlement service.

The browser never receives a Supabase secret/service-role key. It uses the public publishable key plus the authenticated user session and RLS.

## Digital-literacy file handling

The upload interface teaches and applies this convention:

```text
YYYY-MM-DD_course-code_material-type_subject_vNN.extension
```

Example:

```text
2026-07-18_dlit-101_reading_platform-power_v01.pdf
```

For cloud files EdNotebook records:

- original filename
- generated safe filename
- MIME type
- size in bytes
- SHA-256 checksum
- placement in the course
- source/creator
- license or permission statement
- image alternative text when applicable
- version number and naming convention

The launch UI limits files to 25 MB even though the private buckets allow up to 50 MB. This preserves free-tier headroom and leaves room for resumable-upload and malware-scanning infrastructure before larger files are accepted.

## Device-only mode

Device-only files are stored as browser blobs in IndexedDB under `ednotebook-device-vault`.

Properties:

- The file is not uploaded to Supabase.
- The file is not represented in the cloud resource table.
- It is available only in the browser profile that stored it.
- Clearing browser/site data removes it.
- The user can explicitly download a copy to the device.

Device-only mode is appropriate for scratch work or local references. It is not appropriate for required submissions, institutional records, or materials that must follow a user between devices.

## Metadata records

`public.learning_resources` is the storage-neutral index. It supports:

- `cloud`: private object plus metadata
- `external`: link or embedded service
- `metadata`: quotation, table, map, or generated tool with no file bytes
- `device`: reserved for local-only metadata patterns; the current file vault keeps local metadata entirely in IndexedDB

Because the object provider is not the course model, a later provider migration changes `bucket_id` / `storage_path` handling, not lesson placement or assignment relationships.

## Upload lifecycle

1. Authenticate the user.
2. Confirm the course or assignment tenancy.
3. Validate file size and allowed type in the browser.
4. Generate a safe versioned filename.
5. Calculate SHA-256.
6. Upload into the authorized private path.
7. Insert the `learning_resources` record.
8. Display the material in its selected page panel.
9. On deletion, remove the object and then its resource record.

A production hardening worker should add:

- malware scanning and quarantine before learner release
- archive/ZIP inspection
- content-disposition enforcement
- image metadata stripping where appropriate
- document preview conversion
- audit events for upload, download, share, rename, and delete
- institutional retention schedules and administrator deletion locks
- resumable uploads for larger files

## What should not go into GitHub

Do not commit or upload these to the repository:

- student submissions
- course readings under restricted licenses
- unpublished manuscripts
- identity documents
- class messages
- grade exports
- database backups
- API secrets

GitHub Pages remains the deployment target for the public Vite bundle only.

## Growth path

### Phase 1: Supabase only

Use the current private buckets while the product validates usage. This keeps Auth, RLS, Postgres metadata, and object storage in one security boundary.

### Phase 2: R2 publication/overflow adapter

Add a server-side S3-compatible adapter for larger publisher catalogs or high-egress public assets. Keep private course submissions in Supabase unless the new adapter implements equivalent tenancy and audit controls.

### Phase 3: institutional storage connectors

Offer optional SharePoint/OneDrive, Google Drive, or institution-managed object storage. Connectors must map external permissions into EdNotebook course/resource metadata and must never silently widen access.

## Required administrator setting

Enable Supabase Auth leaked-password protection in the project’s Authentication security settings. The database security advisor is otherwise clear for the new schema; this remaining warning is account-authentication configuration rather than a table-policy defect.
