# EdNotebook Standalone Course Template Package

This folder defines the reference standalone-course output that EdNotebook's Course Creator should produce.

The source product is:

- Repository: `BREXAtlas/Digital-Literacy-Course`
- Public example: `https://brexatlas.github.io/Digital-Literacy-Course/`
- Maintained reference branch: `main`

The Digital Literacy Course is treated as the **reference product output**, not merely as visual inspiration. EdNotebook works backward from that finished course so a professor can provide course inputs, select the Ram Ready template, preview the result, and export a standalone course with the same structure, behavior, accessibility, progress model, assessment rhythm, and theme rules.

## Governing statement

> EdNotebook's Ram Ready Course Creator must be able to reproduce the Digital Literacy Course from structured course inputs without rewriting the standalone shell for each subject.

## What this package does

This package separates:

1. **The locked shell** — the parts that make every exported course behave consistently.
2. **The course content** — the subject matter supplied or approved by the professor.
3. **The preset** — colors, naming, branding notices, guides, and presentation choices.
4. **The export contract** — the files, data, validation, and acceptance criteria required for a standalone course.
5. **The EdNotebook input map** — how Course Creator fields become the finished course.

## Documents

- [`RAM_READY_REFERENCE_OUTPUT.md`](RAM_READY_REFERENCE_OUTPUT.md) — complete audit of the Digital Literacy shell, fixed behavior, optional behavior, and customizable course fields.
- [`EDNOTEBOOK_INPUT_OUTPUT_MAP.md`](EDNOTEBOOK_INPUT_OUTPUT_MAP.md) — backward map from the finished standalone course to EdNotebook Course Creator inputs and review steps.
- [`ANGELO_STATE_INSPIRED_PRESET.md`](ANGELO_STATE_INSPIRED_PRESET.md) — exact preset rules used to reproduce Ram Ready Digital Literacy without claiming official university affiliation.
- [`REFERENCE_MANIFEST_AND_ACCEPTANCE_TEST.md`](REFERENCE_MANIFEST_AND_ACCEPTANCE_TEST.md) — reference configuration, required export contents, validation rules, and the test for exact reproduction.

## Scope boundary

This documentation does not add a new product category and does not replace current course-building code.

It establishes a stable output contract for the course builder already present in EdNotebook. Future implementation should connect existing authoring inputs to this contract and reveal the standalone export only after it passes the acceptance test.

## Core distinction

The current EdNotebook Ram Ready authoring preview and the Digital Literacy standalone course are related, but they are not yet identical.

The current EdNotebook preview already includes:

- course title and audience inputs
- learning-design selection
- groups and lessons
- lesson sections
- embedded knowledge checks
- an optional end quiz
- learner preview
- theme selection

The Digital Literacy reference output adds a richer required course contract:

- landing page and two-path overview
- path maps and accessible list views
- continuous narrative
- original lesson visualization with text alternative
- four grouped concept cards
- scenario choices with benefits, costs, and risks
- immediate, one-year, and long-term consequences
- recovery path
- source drawer
- progress, stars, achievements, streak, and certificates
- onboarding and bounded personalization
- guest persistence and optional account sync
- privacy, disclaimer, instructor, and source pages
- mobile navigation, reduced motion, dark mode, print, and accessibility rules

The standalone exporter should therefore compile approved EdNotebook course data into the Digital Literacy reference contract rather than export the current preview component directly.
