# Functional Implementation Sequence

## Status

The template documents define the required course output, but documents alone do not change the running Course Creator or student portal.

PR #16 must not be described as a completed functional course renderer until the implementation below is complete and tested.

## Required outcome

One approved course package must drive:

1. professor editing;
2. professor preview;
3. signed-in in-platform learning;
4. progress and submission tracking;
5. standalone export.

The course content must not be copied into separate incompatible models for each output.

## Phase 1 — Shared course package

Create a versioned `EdNotebookCourse/1.0` package in application code.

The package must support:

- course metadata;
- visual preset;
- learning paths;
- groups;
- lessons;
- narratives;
- figures and text alternatives;
- concept groups;
- scenarios and choices;
- consequences and recovery guidance;
- knowledge checks;
- optional quiz;
- sources;
- achievements;
- assignment references;
- accessibility summaries;
- completion settings.

Add runtime validation. Invalid packages must not publish.

## Phase 2 — Course Creator adapter

Update Course Creator so it does not stop at a title map and six text sections.

For Ram Ready courses, the final approved lesson data must include all required reference fields.

The creator must:

- start from the existing course record;
- preserve the current builder and undo history;
- convert existing builder course and lesson objects into `EdNotebookCourse/1.0`;
- show missing required fields;
- allow professor review and editing;
- use the shared renderer for preview;
- prevent publication when required fields are invalid;
- save a draft course package;
- create a version when publishing.

The existing smaller lesson model can be adapted rather than deleted. Existing section data should map forward into the richer package.

## Phase 3 — Publication records and routes

Add additive database records for:

- active course publication;
- immutable publication versions;
- stable route identity;
- optional human-readable aliases;
- publication status;
- display mode;
- theme preset;
- audit history.

Use the existing `courses` and `course_memberships` records for ownership and access.

Recommended course route:

```text
#/student/course/{publication-id}
```

Recommended lesson route:

```text
#/student/course/{publication-id}/path/{path-id}/lesson/{lesson-id}
```

A shared URL identifies the destination but never grants access.

## Phase 4 — Student course frame

Replace the current placeholder **Continue current lesson** action with a real route.

Add an in-platform course frame that preserves:

- student account navigation;
- profile access;
- class switching;
- assignments;
- messages;
- notes;
- Due Next;
- accessibility controls.

Render the selected course inside the frame using the same manifest as professor preview and standalone export.

Substantial courses use a full course destination inside the shell. Small courses may use embedded-module mode.

## Phase 5 — Progress autosave

Add additive learner-progress records with user, course, publication version, path, lesson, current section, interactions, completion, and timestamps.

Autosave after meaningful activity.

The interface must display save state and support a temporary offline recovery copy.

Progress must survive:

- closing the lesson;
- signing out and returning;
- opening on another device after sync;
- ordinary course updates;
- route changes;
- title changes.

## Phase 6 — Assignment interface

Allow assignments to reference a course, path, group, lesson, section, or source.

The course player displays attached assignments in context.

Private submissions remain in the assignment system. They are not embedded in the public or portable course manifest.

After submission, the learner returns to the course location and the course records the assignment status reference.

## Phase 7 — Standalone exporter

Create a renderer/exporter that consumes the same approved package.

The export must reproduce the Digital Literacy reference mechanics when the exact reference manifest and Angelo State Inspired preset are selected.

The standalone package must not include:

- private messages;
- grades;
- student submissions;
- roster records;
- administrator records;
- institution-private analytics.

## Phase 8 — Version, delete, and route lifecycle

Implement:

- stable publication identity;
- immutable versions;
- active version pointer;
- update without broken links;
- unpublish without destructive deletion;
- archived route state;
- retention and legal hold;
- progress migration rules;
- restore behavior;
- alias retirement and replacement.

## Required tests

### Creator to preview

- Build a Ram Ready lesson.
- Validate the manifest.
- Preview through the shared renderer.
- Confirm every approved content field appears.

### Creator to student

- Publish a course.
- Enroll a student.
- Open the stable course route.
- Confirm the student sees the same approved content in the platform layout.

### Autosave and resume

- Answer a scenario and knowledge check.
- Close the lesson.
- Return through **Continue lesson**.
- Confirm exact saved position and answers.

### Assignment connection

- Attach an assignment to a lesson.
- Open it from the course frame.
- Submit it.
- Return to the lesson.

### Update

- Publish version 1.
- Begin learner progress.
- Publish version 2.
- Confirm the route still works and progress follows the declared migration policy.

### Delete and restore

- Unpublish a course.
- Confirm learner access stops.
- Confirm records remain under retention.
- Restore the publication.
- Confirm the stable route works again.

### Standalone parity

- Export the Digital Literacy reference manifest.
- Compare paths, lessons, interactions, sources, achievements, certificates, accessibility, and preset values to the maintained reference course.

### New-subject reuse

- Replace the curriculum with a different subject.
- Keep the same shell.
- Confirm no Digital Literacy instructional text remains.

## Merge and activation rule

The documentation contract may merge as architecture, but the user-facing labels **Publish course**, **Continue current lesson**, and **Export standalone course** must not imply this full behavior until their respective acceptance tests pass.

Recommended implementation order:

```text
Shared manifest
→ shared renderer
→ creator adapter
→ publication records and route
→ student frame
→ progress
→ assignment connection
→ standalone exporter
→ parity and lifecycle tests
```

This is additive work. Existing records, routes, dashboards, assignments, and builder behavior remain available during migration.