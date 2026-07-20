# EdNotebook Ram Ready Course Template Package

## Purpose

This folder works backward from the maintained Ram Ready Digital Literacy course and defines the reusable course product that EdNotebook Course Creator must eventually produce.

The reference course is:

```text
https://github.com/BREXAtlas/Digital-Literacy-Course
```

The package separates:

- the fixed course shell;
- replaceable curriculum content;
- visual presets;
- institution-specific branding rules;
- optional course behavior;
- EdNotebook platform services;
- standalone export behavior;
- in-platform student rendering;
- progress, routing, assignments, and publication lifecycle.

## Important status distinction

These documents define the contract. They do not, by themselves, change the running Course Creator or student portal.

A functional implementation requires the sequence in:

```text
docs/course-template/FUNCTIONAL_IMPLEMENTATION_SEQUENCE.md
```

The required in-platform course behavior is defined in:

```text
docs/course-template/IN_PLATFORM_COURSE_RUNTIME.md
```

Do not describe the template as functionally complete until this journey works:

```text
Professor creates course
→ Course Creator produces one valid shared package
→ professor previews through the shared renderer
→ professor publishes
→ stable course destination is created
→ enrolled student opens it inside the account shell
→ progress autosaves and resumes
→ assignments attach to the lesson frame
→ the same package exports as a standalone course
```

## Core rule

> One approved course package must power professor preview, signed-in student learning, and standalone export.

The renderers may arrange the course differently, but they may not change the approved academic content, correct answers, sources, learning objectives, or course version.

## Reference output

The maintained Digital Literacy course is the reference standalone output for the `Ram Ready Standalone Course 1.0` template.

To reproduce it exactly:

```text
Digital Literacy reference manifest
+ Ram Ready Standalone Course 1.0
+ Angelo State Inspired 1.0
= maintained Ram Ready Digital Literacy product
```

## Files

### `RAM_READY_REFERENCE_OUTPUT.md`

Defines the reusable shell, fixed lesson rhythm, course-wide pages, interaction behavior, progress, sources, achievements, accessibility, and the boundary between fixed and customizable behavior.

### `EDNOTEBOOK_INPUT_OUTPUT_MAP.md`

Maps current EdNotebook Course Creator inputs to the reference standalone output and identifies fields still needed for exact reproduction.

### `ANGELO_STATE_INSPIRED_PRESET.md`

Defines the exact preset values and the independent-use branding rules required to reproduce the reference course.

### `REFERENCE_MANIFEST_AND_ACCEPTANCE_TEST.md`

Defines the proposed portable course manifest and the tests EdNotebook must pass before standalone export can be considered complete.

### `IN_PLATFORM_COURSE_RUNTIME.md`

Defines the student-account-as-browser-shell model, full-course and embedded-module display modes, stable course destinations, access control, autosave, assignment connections, updates, unpublishing, deletion, restoration, and in-platform lesson layout.

### `FUNCTIONAL_IMPLEMENTATION_SEQUENCE.md`

Defines the additive implementation order required to turn the contract into working creator, student, progress, routing, assignment, and standalone-export behavior.

## Governing principle

EdNotebook is the authoring and platform layer. The course package is the shared academic source. The standalone renderer and in-platform renderer are two presentations of the same approved course.

```text
Professor inputs
→ structured course package
→ professor review
→ shared renderer preview
→ publish one approved version
   ├── in-platform student course frame
   └── standalone course export
```

No course should require a new hand-built website. No renderer should invent or silently alter approved instructional content.