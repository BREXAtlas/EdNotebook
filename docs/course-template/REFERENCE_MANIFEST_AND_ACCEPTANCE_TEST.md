# Reference Manifest and Acceptance Test

## 1. Purpose

This document defines the minimum course manifest and the test EdNotebook must pass before claiming it can reproduce Ram Ready Digital Literacy as a standalone export.

The manifest is a documentation contract. It does not replace the existing EdNotebook database or EduBook format.

## 2. Recommended manifest identity

```json
{
  "format": "EdNotebookCourse/1.0",
  "template": {
    "family": "ram-ready-standalone",
    "version": "1.0"
  },
  "preset": {
    "id": "angelo-state-inspired",
    "version": "1.0"
  }
}
```

## 3. Course-level manifest shape

```json
{
  "format": "EdNotebookCourse/1.0",
  "course": {
    "id": "stable-course-id",
    "sourceEdNotebookCourseId": "uuid-or-null",
    "title": "Course title",
    "subtitle": "Course subtitle",
    "description": "Course description",
    "subject": "Subject",
    "audience": "Learner audience",
    "language": "en",
    "estimatedMinutes": 480,
    "contentVersion": "1.0.0",
    "reviewedAt": "ISO date",
    "rights": {
      "confirmed": true,
      "statement": "Rights statement"
    },
    "institutionalStatus": {
      "type": "independent",
      "notice": "Independent-use notice"
    }
  },
  "template": {
    "family": "ram-ready-standalone",
    "version": "1.0",
    "allNodesOpen": true,
    "endQuizEnabled": false
  },
  "preset": {
    "id": "angelo-state-inspired",
    "version": "1.0"
  },
  "experience": {
    "onboardingEnabled": true,
    "boundedPersonalizationEnabled": true,
    "guestProgressEnabled": true,
    "optionalAccountSyncEnabled": false,
    "starsEnabled": true,
    "achievementsEnabled": true,
    "streakEnabled": true,
    "certificatesEnabled": true,
    "feedbackEnabled": true,
    "presentationEnabled": true
  },
  "paths": [],
  "sources": [],
  "achievements": [],
  "certificates": [],
  "onboarding": {},
  "navigation": {},
  "privacy": {},
  "disclaimer": {},
  "instructorGuide": {},
  "handoff": {},
  "export": {
    "exportedAt": "ISO date",
    "exportedBy": "user id",
    "shellChecksum": "checksum",
    "contentChecksum": "checksum"
  }
}
```

## 4. Path manifest shape

```json
{
  "id": "foundations",
  "label": "University Digital Literacy Foundations",
  "description": "Path description",
  "unitLabel": "Episode",
  "groupLabel": "Act",
  "required": true,
  "advanced": false,
  "groups": [
    {
      "id": "act-1",
      "number": 1,
      "title": "Start College Digitally Ready",
      "nodeIds": ["ep01", "ep02", "ep03", "ep04", "ep05"]
    }
  ],
  "nodes": []
}
```

## 5. Node manifest shape

```json
{
  "id": "ep01",
  "groupId": "act-1",
  "title": "Build Your College File System",
  "subtitle": "A folder structure that survives a busy semester",
  "estimatedMinutes": 11,
  "learningObjectives": [],
  "openingNarrative": "Reviewed narrative",
  "personalizationSlots": [],
  "approvedStoryFragmentIds": [],
  "realWorldExample": "Reviewed example",
  "fictionalExamples": [],
  "visual": {
    "title": "A folder system that scales",
    "type": "flow",
    "items": [],
    "textAlternative": "Text alternative",
    "credit": "Original course figure"
  },
  "concept": {
    "what": "",
    "why": "",
    "how": "",
    "whoMayBenefit": "",
    "cost": "",
    "risks": "",
    "whoMayNotBenefit": "",
    "misunderstandingRisk": "",
    "verifyNote": ""
  },
  "activity": {
    "type": "optional-widget-id-or-null",
    "configuration": {}
  },
  "scenario": {
    "prompt": "",
    "type": "multiple_choice"
  },
  "choices": [],
  "consequences": {
    "immediate": {},
    "later": {},
    "longTerm": {}
  },
  "recoveryPath": "",
  "scoringDimensions": [],
  "closingReflection": "",
  "knowledgeChecks": [],
  "endQuiz": [],
  "sourceIds": [],
  "achievementId": "",
  "recommendedNextNodeId": "",
  "accessibilitySummary": "",
  "reviewedDate": "YYYY-MM-DD"
}
```

## 6. Choice manifest shape

```json
{
  "id": "a",
  "text": "Choice text",
  "whyChosen": "Why a learner may choose it",
  "possibleBenefit": "Possible benefit",
  "possibleCost": "Possible cost",
  "possibleRisk": "Possible risk",
  "immediateEffect": {},
  "futureEffect": "Future effect",
  "whatCouldChangeThisOutcome": "Condition",
  "sourceIds": []
}
```

## 7. Knowledge-check manifest shape

```json
{
  "id": "kc1",
  "question": "Question",
  "type": "multiple_choice",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "explanation": "Reasoning explanation"
}
```

## 8. Digital Literacy reference configuration

The exact reproduction configuration is:

```text
Course title: Ram Ready Digital Literacy
Template: ram-ready-standalone@1.0
Preset: angelo-state-inspired@1.0
Paths: 2
Foundations nodes: 20
Foundations groups: 4
Quest nodes: 20
Quest groups: 4
All nodes open: yes
Embedded knowledge checks: yes
Separate end quiz: no
Bounded personalization: yes
Guest persistence: yes
Optional account pattern: supported
Stars: yes
Achievements: yes
Streak: yes
Certificates: Foundations, Quest, Full
Sources: central registry
Learning figures: one per node
Independent-use notice: required
Next-course handoff: Ram Ready Financial Futures
```

## 9. Export folder contract

A compiled static export should contain an equivalent, versioned structure.

```text
course-export/
  index.html
  paths/
    foundations.html
    quest.html
  journey.html
  achievements.html
  profile.html
  onboarding.html
  sources.html
  instructor-guide.html
  privacy.html
  disclaimer.html
  assets/
    course.css
    print.css
    site.js
    lesson-player.js
    progress.js
    accessibility.js
    certificate.js
    visuals.js
  data/
    course-manifest.json
    paths.json
    nodes.json
    sources.json
    achievements.json
    onboarding.json
    story-fragments.json
  export-manifest.json
  README.txt
```

The actual implementation may bundle or rename files. The learner-visible behavior and portable data must remain equivalent.

## 10. Required validation rules

### Course identity

- format version is present
- course ID is stable
- title, subtitle, description, subject, and audience are present
- institutional status and notice are present
- rights statement is present
- content and preset versions are present

### Path structure

- every path ID is unique
- every group ID is unique within the course
- every node ID is unique
- every group references existing nodes
- every node belongs to one valid group
- every recommended-next ID exists or is null
- configured node counts match generated node counts

### Lesson content

- every node has title, subtitle, estimated time, and objectives
- every node has narrative or approved equivalent opening context
- every node has all required concept fields
- every choice has benefit, cost, risk, and outcome-change text
- every choice has corresponding consequence records
- every scenario lesson has a recovery path
- every knowledge check has a correct answer and explanation
- no unresolved template marker is visible

### Sources

- every referenced source ID exists
- source IDs are unique
- required metadata is present
- external URLs use approved protocols
- professor review date is retained

### Visuals

- every enabled visual has a title
- every enabled visual has a supported type
- every enabled visual has content items
- every enabled visual has a text alternative
- decorative elements are hidden from assistive technology

### Accessibility

- skip link exists
- all controls work with keyboard
- focus is visible
- touch targets meet the minimum size
- maps have list alternatives
- status is not color-only
- dynamic feedback uses an appropriate status region
- reduced motion is honored
- print output is readable
- heading order is valid
- page language and title are present

### Theme

- every required semantic token exists
- focus color has acceptable contrast
- text/background combinations pass contrast requirements
- preset branding notice is included when required
- unsupported institution marks are not bundled

### Progress

- guest storage key is course-specific
- default state is valid
- import/export is versioned
- reset requires confirmation
- completion is distinct from formal grade
- certificate threshold is explicit

### Security

- generated learner text is escaped or sanitized
- no secret or service credential is bundled
- no private EdNotebook course record is included
- no real student record is included
- no direct private-storage link is included
- external links use safe attributes

## 11. Exact-reproduction acceptance test

EdNotebook may claim that it reproduces Ram Ready Digital Literacy only when the following test passes.

### A. Structural parity

- two path cards appear on the home page
- Foundations has four acts and 20 episodes
- Quest has four tiers and 20 quests
- all 40 nodes are directly accessible
- map status and stars display
- accessible list view is available
- journey dashboard reports both paths
- achievements and three certificate choices exist

### B. Lesson parity

Select at least:

- one Foundations episode from each act
- one Quest from each tier
- both capstone nodes

Verify each selected node includes:

- title and subtitle
- estimated time
- opening narrative
- real-world example
- original visual with text alternative
- four concept groups
- scenario
- decision cards
- consequence panel
- recovery path
- knowledge check with explanation
- sources
- completion and achievement behavior

### C. Content parity

For the full reference-data test:

- all lesson titles match the reference data
- all group titles match
- all learning objectives match
- all correct answers match
- all source IDs match
- all achievement IDs match
- all visual titles and text alternatives match
- all course and certificate notices match the approved reference version

### D. Preset parity

- exact blue/gold token values are present
- header has the gold rule
- hero uses the blue gradient
- primary actions use gold
- path accent behavior matches
- concept-card accent order matches
- certificate color treatment matches
- independent-use notice is visible
- no official seal, logo, or copyrighted mascot artwork appears

### E. Experience parity

- guest mode works without an account
- progress survives reload
- progress export/import works
- reset works
- onboarding can be skipped
- generic story contains no raw markers
- personalization does not alter correct answers or sources
- mobile menu works
- keyboard navigation works
- reduced motion works
- dark mode remains readable
- print output is readable

### F. Build parity

- course opens from a static server
- course works at domain root or repository subpath
- internal links resolve
- no console error blocks the lesson
- no required external model call is needed for core lessons
- validator reports zero blocking failures

## 12. New-subject acceptance test

A new course proves the shell is reusable when:

1. the Digital Literacy subject content is removed;
2. new course data is supplied;
3. no lesson-player or site-shell file must be rewritten;
4. the new course retains the same interaction and accessibility contract;
5. the selected preset can be changed independently;
6. the new course passes the same structural validator;
7. no Digital Literacy-specific language remains except intentionally selected template attribution.

## 13. Relationship to EduBook

`EduBook/1.0` remains the portable interactive-reading and publication manifest.

`EdNotebookCourse/1.0` represents the complete standalone course experience.

A course may contain one or more EduBooks:

```text
EdNotebookCourse/1.0
├── course paths and lessons
├── knowledge checks and scenarios
├── progress and achievements
├── course sources
└── EduBook/1.0 publications assigned within lessons
```

The two formats should reference each other through stable IDs rather than combine unrelated responsibilities.

## 14. Release rule

The standalone export control should remain hidden or labeled as not ready until:

- the manifest can be produced from EdNotebook course data;
- the reference-data reproduction test passes;
- the professor can preview the same output before export;
- accessibility validation passes;
- the export contains no private course or student data;
- the package is versioned and reproducible.

## 15. Definition of done

The work is complete when the same Digital Literacy structured inputs produce a course that is functionally equivalent to the maintained Digital Literacy site, and replacing only the approved course-data and preset fields produces a different subject in the same locked shell.
