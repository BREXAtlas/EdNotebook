# EdNotebook Input-to-Output Map

## 1. Objective

This document maps EdNotebook Course Creator inputs backward from the finished Digital Literacy product.

The goal is not to add a separate course system. The goal is to make the existing EdNotebook course-building workflow produce a defined standalone output.

```text
EdNotebook authoring inputs
→ structured Ram Ready course data
→ professor review
→ standalone course compiler
→ Digital Literacy-style course package
```

## 2. Current EdNotebook authoring inputs

EdNotebook already asks for or supports:

- course name
- course code
- subject
- learner audience
- teaching window
- source content
- learning-design template
- number of lessons
- number of knowledge checks
- number of quiz questions
- groups and lesson titles
- lesson section content
- learner preview
- theme selection

The existing `Ram Ready` choice identifies the correct template family, but the current preview data shape is smaller than the Digital Literacy reference output.

## 3. Current gap

### Current EdNotebook preview shape

```text
course title
subtitle
template key
acts/groups
episodes/lessons
lesson type
estimated minutes
sections
knowledge checks
optional end quiz
```

### Digital Literacy reference shape

```text
course identity
branding and disclaimer
one or two learning paths
path groups
lesson titles and metadata
learning objectives
narrative
real-world example
learning visualization
four concept groups
subject activity/widget
scenario
choices with benefits/costs/risks
immediate/later/long-term consequences
recovery path
knowledge checks
sources
achievements
recommended next lesson
accessibility summary
review date
progress and certificate settings
onboarding and personalization settings
```

The Digital Literacy course therefore becomes the output contract that EdNotebook must populate.

## 4. Professor workflow

### Step 1 — Create the course

Professor inputs:

- course title
- course code
- subject
- learner audience
- teaching window
- institution or independent-course setting

Standalone output:

- page title
- course title
- subtitle and summary
- audience language
- estimated completion information
- course metadata
- default privacy/disclaimer language

### Step 2 — Add source material

Professor inputs:

- syllabus
- course outline
- lecture notes
- readings
- learning outcomes
- required sources
- policy statements
- assignment instructions

EdNotebook extracts and proposes:

- topic inventory
- concept dependencies
- course claims needing sources
- schedule constraints
- required terminology
- course-specific rules
- source registry candidates

Standalone output:

- curriculum data
- source registry
- instructor guide
- course-specific disclaimer
- lesson sequence

### Step 3 — Select Ram Ready standalone template

Professor selects:

- `Ram Ready Standalone Course`
- theme preset
- one-path or two-path course
- group terminology
- lesson terminology
- all-open or sequenced access
- guest or optional account mode
- personalization on or off
- stars/achievements/certificate on or off
- end quiz on or off

For exact Digital Literacy reproduction:

```text
template: Ram Ready Standalone Course 1.0
preset: Angelo State Inspired 1.0
path count: 2
primary path: Foundations
secondary path: Quest
primary groups: 4 Acts
secondary groups: 4 Tiers
nodes per path: 20
all nodes open: true
bounded personalization: true
guest progress: true
stars: true
achievements: true
streak: true
certificates: true
end quiz: false
```

### Step 4 — Define course structure

Professor inputs or approves:

- path names
- path descriptions
- path requirement status
- group names
- lesson count
- lesson titles
- lesson subtitles
- estimated minutes
- recommended next lesson

Standalone output:

- landing-page path cards
- visual maps
- accessible list maps
- progress labels
- direct lesson links
- journey dashboard sections

### Step 5 — Build each lesson

For each lesson, EdNotebook must collect, generate, or allow editing of the following blocks.

#### A. Lesson identity

Professor-facing fields:

- lesson title
- subtitle
- estimated time
- learning objectives
- group/path placement

Output:

- lesson heading
- progress badge
- map label
- certificate/outcome references

#### B. Opening context

Professor-facing fields:

- opening narrative
- real-world example
- optional fictional examples
- approved personalization slot

Output:

- “What’s happening” section
- contextual story
- safe learner-specific variation

#### C. Learning figure

Professor-facing fields:

- figure title
- figure type
- figure steps/items
- text alternative
- original/source credit

Output:

- responsive semantic figure
- text alternative
- print representation

Available basic figure types:

- sequence/flow
- comparison
- grid
- segments
- layers
- meter/dashboard

#### D. Concept framework

Professor-facing fields:

- What is it?
- Why does it exist?
- How may it help?
- Who may benefit?
- What may it cost?
- What are the risks or limitations?
- Who may not benefit?
- What happens when it is misunderstood?
- What should the learner verify?

Output:

- four grouped concept cards

#### E. Scenario

Professor-facing fields:

- scenario prompt
- scenario type
- learner role/context

Output:

- decision section

#### F. Decision choices

For each choice:

- choice label
- why someone might choose it
- possible benefit
- possible cost
- possible risk
- immediate effect
- future effect
- what could change the result
- source IDs

Output:

- decision card
- selected state
- accessible result announcement

#### G. Consequences and recovery

For each choice:

- immediate consequence
- later consequence
- long-term consequence

For the lesson:

- recovery path

Output:

- “What this choice changes” panel
- recovery guidance

#### H. Knowledge checks

Professor-facing fields:

- question
- type
- answer options
- correct answer
- explanation
- optional placement

Output:

- answer control
- correct/not-quite response
- explanation
- completion rule

#### I. Optional end quiz

Professor-facing setting:

- enabled or disabled
- questions
- answer options
- correct answers
- explanations
- pass rule

Reference Digital Literacy setting:

- disabled

Generic Ram Ready courses may enable it.

#### J. Sources

Professor-facing fields:

- source ID
- author or organization
- date
- title
- publisher
- URL or DOI
- source note
- reviewed date

Output:

- lesson source drawer
- central source page

#### K. Completion

Professor-facing fields:

- achievement name
- achievement description
- star threshold
- recommended next lesson
- completion message

Output:

- star award
- achievement unlock
- next lesson or dashboard button

### Step 6 — Course-level settings

Professor inputs or approves:

- course landing-page copy
- path descriptions
- disclaimer
- privacy explanation
- instructor guide
- certificate wording
- next-course handoff
- feedback method
- course contact information
- rights/license statement

Standalone output:

- home
- privacy
- disclaimer
- instructor guide
- certificate
- footer
- optional feedback and handoff pages

### Step 7 — Preview as learner

The EdNotebook preview must eventually offer the same review modes as the export:

- landing page
- visual path map
- accessible list map
- lesson player
- generic learner story
- personalized learner story when enabled
- mobile view
- keyboard-only view
- reduced-motion view
- dark-mode view when supported
- print view
- journey dashboard
- achievements
- certificate preview
- source page

The professor approves the course version only after these views are reviewed.

### Step 8 — Export standalone course

The export process should:

1. Freeze an approved course-content version.
2. Record the selected template version.
3. Record the selected preset version.
4. Validate all required fields.
5. Reject unresolved placeholders.
6. Reject missing correct answers.
7. Reject unknown source IDs.
8. Reject missing text alternatives.
9. Build the static course package.
10. Run route, accessibility, and data validation.
11. Produce a ZIP or repository-ready folder.
12. Produce a manifest describing the export.
13. Allow professor download or approved deployment.

## 5. Input ownership

### Professor owns or approves

- course purpose
- course content
- learning objectives
- lesson sequence
- examples
- policies
- correct answers
- source selection
- assessment rules
- certificate wording
- institutional branding permission

### EdNotebook proposes

- structure
- draft lesson breakdown
- draft learning figures
- draft scenarios
- draft choices
- draft knowledge checks
- draft source links
- draft achievement language
- accessibility warnings
- missing-field warnings

### EdNotebook must not silently decide

- official policy
- academic-integrity rules
- whether AI is allowed on an assignment
- formal grade value
- institutional endorsement
- legal rights to source material
- correct answer changes after approval
- source substitutions

## 6. Mapping from current EdNotebook Ram Ready sections

The current EdNotebook Ram Ready template lists:

```text
What it is
Why it exists
How it may help
What it may cost
Who may and may not benefit
Verify this now
```

These map into the reference concept framework as follows:

| Current EdNotebook field | Reference output location |
|---|---|
| What it is | Understand it → What |
| Why it exists | Understand it → Why it exists |
| How it may help | Possible value → How it may help |
| What it may cost | Tradeoffs → What it may cost |
| Who may and may not benefit | Possible value → Who may benefit; Tradeoffs → Who may not benefit |
| Verify this now | Use carefully → Verify |

The reference output also requires two fields not represented separately in the current six-section preview:

- Risks or limitations
- When misunderstood

These must be collected or proposed before export.

## 7. Course model layers

EdNotebook should treat the finished course as four separate layers.

### Course identity layer

```text
title
subtitle
description
audience
subject
teaching window
license
institutional status
```

### Learning-design layer

```text
paths
groups
lessons
objectives
concept framework
scenarios
choices
consequences
recovery
knowledge checks
quiz settings
sources
achievements
```

### Experience layer

```text
theme preset
navigation labels
guide characters
onboarding
personalization
progress
stars
streak
certificates
access rules
```

### Platform-connection layer

```text
source EdNotebook course ID
assignment links
message links
roster connection
evidence return link
analytics consent
account sync setting
```

The standalone course can function without the platform-connection layer. When connected, that layer must not expose private EdNotebook data inside the public package.

## 8. Exact Digital Literacy reproduction map

To recreate the current Digital Literacy product from EdNotebook, the input package must include:

### Course identity

```text
Ram Ready Digital Literacy
Build the file, communication, research, privacy, security, and AI habits college and work expect—then continue into Ram Ready Financial Futures.
Independent open-source pilot
First-year university learners and the public
```

### Path 1

```text
University Digital Literacy Foundations
20 episodes
4 acts
5 episodes per act
```

### Path 2

```text
AI Digital Literacy Quest
20 quests
4 tiers
5 quests per tier
Advanced and optional
```

### Experience

```text
all nodes open
guest progress
8-screen onboarding
bounded personalization
stars
achievements
streak
three certificate types
source registry
original semantic figures
Angelo State-inspired theme preset
independent-pilot disclaimer
Financial Literacy handoff
```

### Content source

```text
Digital Literacy structured episode and quest data
Digital Literacy source registry
Digital Literacy achievements
Digital Literacy onboarding options
Digital Literacy approved story fragments
Digital Literacy visualization registry
Digital Literacy certificate skill statements
```

## 9. Standalone output and live EdNotebook features

The standalone course must look and behave like the reference course without requiring the full EdNotebook application.

When a course is connected to EdNotebook, the standalone course may provide approved links for:

- ask the professor
- open the assignment
- submit work
- join course discussion
- open office hours
- save evidence to EdNotebook
- return to the course dashboard

Those links must use authenticated EdNotebook routes. They are connections around the standalone course, not replacements for its lesson shell.

## 10. Product acceptance statement

A professor should be able to:

1. enter or upload course content in EdNotebook;
2. select the Ram Ready standalone template;
3. choose the Angelo State-inspired preset or another approved preset;
4. review the generated paths and lessons;
5. preview the complete learner product;
6. export a standalone package;
7. reproduce Ram Ready Digital Literacy when the Digital Literacy reference data is used;
8. replace only the customizable data to create another course with the same shell.

That is the required relationship between EdNotebook Course Creator and the Digital Literacy product.
