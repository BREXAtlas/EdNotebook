# In-Platform Ram Ready Course Runtime

## Governing direction

EdNotebook must use one approved course package to produce two learner experiences:

```text
EdNotebookCourse/1.0 package
├── Standalone course renderer
│   └── A self-contained course website like Ram Ready Digital Literacy
└── In-platform course renderer
    └── The same course mechanics inside the signed-in student workspace
```

The two renderers may arrange the interface differently, but they must not change the approved academic content, correct answers, sources, learning objectives, consequences, recovery guidance, completion rules, or course version.

This is a functional architecture requirement, not only a visual reference.

## The account-as-browser-shell model

The signed-in student account acts like a persistent browser shell around the course.

The student continues to see the EdNotebook account frame:

- EdNotebook identity and navigation
- profile access
- class switcher
- Due Next
- messages
- assignments
- notes
- accessibility and display controls
- account controls

Inside that frame, the selected course behaves like a loaded destination.

```text
Student account shell
├── persistent EdNotebook navigation
├── persistent student tools
└── course viewport
    ├── course home
    ├── path or module map
    ├── lesson player
    ├── sources
    ├── progress
    └── course-linked assignments
```

The learner should not feel that every lesson opens an unrelated application. The course is rendered inside a stable course viewport while the account shell remains available.

## Course destination model

Every published course receives one stable, unique destination.

Recommended route form:

```text
#/student/course/{course-publication-id}
```

A human-readable alias may also exist:

```text
#/student/course/{stable-slug}
```

The publication ID is authoritative. A title or course-code change must not break saved links.

The route resolver must:

1. identify the authenticated user;
2. identify the course publication;
3. verify current course membership or another approved entitlement;
4. verify that the publication is active;
5. load the approved manifest version;
6. load the learner's saved progress;
7. open the requested course, path, module, lesson, or assignment location;
8. deny access without revealing private course content when authorization fails.

## Link lifecycle

### Publish

Publishing creates or updates an active course publication and its stable destination.

### Update

A course update creates a new publication version. Existing student links continue resolving to the same publication identity and load the current approved version unless a professor intentionally pins an assignment to an earlier version.

### Unpublish

Unpublishing disables ordinary learner access but preserves the publication, versions, progress, submissions, audit history, retention rules, and legal holds.

### Delete course

Deleting a course must not immediately destroy learning records. The course enters the existing deletion and retention process. Its active route stops serving course content, while authorized administrators may still access required records.

### Restore

Restoring a course may reactivate the same stable publication route when policy permits.

## Course display modes

EdNotebook should support three presentation modes from the same course package.

### 1. Full course destination

Use for a substantial multi-module course.

The course opens as a dedicated destination inside the account shell. It can include:

- course landing view;
- one or more learning paths;
- maps;
- lesson navigation;
- progress dashboard;
- achievements;
- sources;
- course-specific styling.

### 2. Embedded module

Use for a smaller course, short training, supplement, or individual unit.

The module opens within the existing class page without a separate full course home. It still uses the shared lesson mechanics and progress model.

### 3. Standalone export

Use when a professor exports the course as an independent website package.

The standalone version contains its own navigation, course home, maps, progress, sources, privacy notice, and optional certificates. It does not include private EdNotebook messaging, roster, gradebook, or institutional records.

## Shared lesson mechanics

Both renderers must support the same approved lesson elements:

1. course and path context;
2. lesson title and subtitle;
3. estimated time;
4. learning objectives;
5. learner-facing narrative;
6. real-world or fictional example;
7. accessible learning figure;
8. grouped concept explanations;
9. scenario prompt;
10. decision cards;
11. benefits, costs, and risks;
12. immediate, later, and long-term consequences;
13. recovery path;
14. knowledge checks with explanations;
15. optional end quiz when configured;
16. source drawer;
17. completion result;
18. stars, points, or achievement when configured;
19. next destination.

The standalone renderer may show these as a vertically scrolling webpage. The in-platform renderer may divide them into panels, sections, or a guided player. The content contract remains the same.

## Student lesson layout

Recommended in-platform layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ EdNotebook student header · class switcher · profile tools   │
├───────────────────┬──────────────────────────────────────────┤
│ Course rail       │ Course viewport                          │
│                   │                                          │
│ Course home       │ Lesson title and progress                │
│ Path map          │ Narrative / concept / scenario / checks  │
│ Due Next          │ Sources / assignment connection          │
│ Assignments       │                                          │
│ Messages          │ Previous · Save · Continue               │
│ Notes             │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

On small screens, the course rail becomes a drawer and the lesson viewport occupies the screen. Account navigation remains available through the persistent mobile header.

## Navigation behavior

### Enter a course

From Classes, the student selects **Open course** or **Continue lesson**.

### Enter a lesson

The route records the selected course, path, and lesson. The lesson opens in the course viewport, not an unrelated browser tab.

### Leave a lesson

**Back to course** returns to the course map or current module.

**Back to classes** returns to the student class list.

### Resume

The dashboard's **Continue lesson** button opens the learner's last saved location.

### Deep link

An authorized course link may open a specific lesson, section, source, or assignment. Authorization is checked again when the route opens.

## Progress and autosave

Progress must save automatically after meaningful events:

- lesson opened;
- section viewed;
- scenario choice submitted;
- knowledge check answered;
- quiz answer submitted;
- note created;
- lesson completed;
- assignment opened;
- assignment submitted.

Recommended progress state:

```json
{
  "coursePublicationId": "uuid",
  "courseVersion": 3,
  "pathId": "foundations",
  "lessonId": "ep07",
  "sectionId": "scenario",
  "sectionIndex": 5,
  "status": "in_progress",
  "answers": {},
  "choiceId": "b",
  "stars": 2,
  "points": 50,
  "openedAt": "ISO timestamp",
  "lastSavedAt": "ISO timestamp",
  "completedAt": null
}
```

The client may keep a temporary local recovery copy, but the authenticated cloud record is authoritative for enrolled students.

The interface must visibly show:

- Saving…
- Saved
- Offline changes waiting to sync
- Save failed · retry

## Submission behavior

Knowledge checks and scenarios are lesson interactions. They may record completion and evidence but are not automatically gradebook submissions.

A professor may attach an assignment to:

- the entire course;
- one path;
- one module;
- one lesson;
- one lesson section;
- one source;
- the end of a lesson.

An attached assignment appears inside the course viewport after the relevant content or in the course rail. Submitting it uses EdNotebook's assignment system and returns the learner to the course destination afterward.

The course package stores the assignment reference, not the student's private submission.

## Course-specific appearance inside EdNotebook

The account shell keeps EdNotebook's platform identity and accessibility controls.

The course viewport may apply the course's approved preset to:

- hero or course header;
- accents;
- course map;
- lesson cards;
- badges;
- progress indicators;
- figures;
- certificates.

It must not restyle or obscure global account controls, warnings, privacy controls, or accessibility tools.

For the Digital Literacy parity course:

```text
Platform shell: EdNotebook
Course viewport: Angelo State Inspired preset
```

This lets the learner recognize the course's identity without feeling that they left EdNotebook.

## Access rules

### Enrolled/private course

Only current authorized course members and course managers can open the destination.

### Open course

A professor may publish an open-access standalone or public course destination when the rights, privacy, and publication settings permit it.

### Preview

A professor preview uses the same renderer but displays a visible preview banner and does not create learner-grade or learner-progress records.

### Shared link

A copied link never grants permission by itself. It identifies a destination. The route resolver still checks membership or entitlement.

## Required platform records

The functional implementation requires additive records equivalent to:

### Course publication

- publication ID;
- course ID;
- stable route key;
- current version;
- status;
- display mode;
- course manifest;
- theme preset;
- published timestamp;
- updated timestamp.

### Course publication versions

- publication ID;
- version number;
- immutable manifest snapshot;
- change summary;
- published by;
- published timestamp.

### Lesson progress

- user ID;
- publication ID;
- course ID;
- version;
- path ID;
- lesson ID;
- current section;
- status;
- interaction state;
- score indicators;
- save timestamps.

### Course route aliases

- stable publication ID;
- alias;
- active state;
- replacement alias where applicable;
- creation and retirement timestamps.

## Non-destructive implementation rules

The in-platform runtime must be additive.

It must not:

- delete the current student dashboard;
- replace the current course records;
- replace the assignment system;
- move student submissions into a public course package;
- expose private courses through a route alone;
- duplicate the curriculum into separate incompatible formats;
- force every small module into a full standalone page;
- force every substantial course into a cramped dashboard card;
- open a separate browser window unless the learner chooses an external or standalone destination;
- destroy progress when a course is updated;
- destroy publication history when a course is unpublished.

## Acceptance journey

A functional first release must pass this journey:

1. Professor creates a course.
2. Professor selects Ram Ready.
3. Professor generates or enters lesson content.
4. Professor previews the course through the shared in-platform renderer.
5. Professor publishes the course.
6. EdNotebook creates a stable course destination.
7. An enrolled student opens Classes.
8. The student selects the published course.
9. The course opens inside the student's account shell.
10. The learner sees the same approved lesson elements as the professor preview.
11. The learner answers a scenario and knowledge check.
12. Progress visibly autosaves.
13. The learner leaves the course.
14. **Continue lesson** returns to the saved location.
15. A course-linked assignment opens inside or beside the lesson flow.
16. The learner submits the assignment.
17. The professor updates and republishes the course.
18. The existing course destination continues to work.
19. The learner's progress remains intact or is migrated according to the version policy.
20. The professor exports the same approved course package as a standalone course.

Until this journey passes, the template is defined but not fully functional.