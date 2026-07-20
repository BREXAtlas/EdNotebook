# Angelo State-Inspired Ram Ready Preset

## 1. Purpose

This preset reproduces the visual direction and course-language rules used by Ram Ready Digital Literacy.

It is an independent EdNotebook course preset. It must not be represented as an official Angelo State University theme, website, course, policy, credential, or endorsement unless the university separately authorizes that use.

Recommended preset identity:

```text
Preset name: Angelo State Inspired
Preset ID: angelo-state-inspired
Preset version: 1.0
Template family: Ram Ready Standalone Course
Reference product: Ram Ready Digital Literacy
```

## 2. Exact reference tokens

```text
primary dark / blue 900: #162F57
primary / blue 700: #245397
primary mid / blue 500: #3A6BB8
primary light / blue 100: #E8EEF8
accent / gold 500: #F0C33B
accent dark / gold 700: #C99A1C
text / ink: #1A1D23
secondary text / ink soft: #454B57
surface: #FFFFFF
alternate surface: #F6F8FB
border: #D7DDE6
success: #1E7D43
danger: #B3261E
focus ring: #0B57D0
corner radius: 10px
maximum reading width: 1100px
body font: Segoe UI, system-ui, -apple-system, Roboto, sans-serif
```

Token names may be normalized inside EdNotebook, but exported values must match the preset.

## 3. Dark-mode reference tokens

When the learner’s system requests dark mode:

```text
text: #EEF1F6
secondary text: #C3CAD6
surface: #141824
alternate surface: #1B2130
border: #2C3444
primary light: #1C2740
```

Link colors must maintain sufficient contrast.

## 4. Component rules

### Header

- white or dark surface according to mode
- four-pixel gold bottom border
- blue course brand text
- circular original mark using blue/gold segments
- accessible mobile menu
- minimum 44-pixel controls

### Hero

- gradient from primary blue to dark blue
- white heading and text
- gold primary action
- rounded lower corners

### Primary action

- gold background
- dark-blue text
- strong visible focus

### Secondary action

- transparent or surface background
- blue border and text

### Path cards

- white/dark surface
- subtle border
- 16-pixel card radius in the reference landing-page treatment
- primary path receives a blue top rule
- quest/advanced path receives a gold top rule

### Map nodes

- available: gold left rule
- completed: green left rule
- status also written in text
- no color-only meaning

### Concept cards

- card 1: blue top rule
- card 2: success green top rule
- card 3: dark gold top rule
- card 4: danger/red top rule
- headings and labels remain readable in dark mode

### Selected decision

- thicker blue border
- visible selected state
- consequence panel on primary-light surface
- focus moved to the revealed result

### Knowledge checks

- dashed blue outline in the reference course
- response explanation uses a live region
- correct/incorrect meaning is written in text

### Learning figures

- blue/gold icon treatment
- semantic HTML/CSS rather than inaccessible decorative-only graphics
- visible title
- text alternative
- source/original credit

### Celebration

- gold background
- dark-blue text
- brief motion
- motion removed when reduced motion is requested

### Certificate

Reference certificate colors:

```text
border: #245397
heading: #245397
gold rule: #F0C33B
background: #FFFFFF
text: #1A1A1A
```

Certificate content is course-specific and must not claim official university credit unless separately authorized.

## 5. Branding language

The preset may use:

- “Ram Ready” as the independent course family name when approved by the owner
- blue and gold color direction
- belonging, community, integrity, growth, and inclusion themes
- original guide characters
- original dialogue

The preset may not automatically use:

- Angelo State seal
- official university logo
- copyrighted mascot artwork
- official photography
- language implying university endorsement
- claims of official credit
- official policy language that has not been supplied and approved

## 6. Required independent-use notice

When this preset is used without formal institutional authorization, the exported course includes a notice equivalent to:

> This course is an independent educational product using an Angelo State-inspired blue and gold direction. It is not an official Angelo State University course, policy, credential, website, or endorsement.

The exact course may add more specific wording about AI use, academic integrity, credit, or pilot status.

## 7. Guide-character rules

Ram Ready Digital Literacy uses original text-based interface guides.

A new course may configure:

- guide names
- guide role
- original avatar treatment
- short opening phrases
- which guide appears by path or group

Guide content must:

- remain original
- not impersonate university officials
- not claim official policy authority
- not alter correct answers or source claims
- support rather than obstruct the lesson

## 8. Customizable values in the preset

The professor or institution may customize:

- course title
- subtitle
- hero text
- course mark when rights are confirmed
- guide names
- course family label
- footer attribution
- independent-use notice
- certificate title
- path accent labels

The following stay locked for preset version 1.0 unless a new preset version is created:

- color values
- semantic token roles
- focus-ring behavior
- minimum touch size
- contrast requirements
- dark-mode treatment
- reduced-motion behavior
- main reading width
- core component relationships

## 9. Relationship to EdNotebook’s existing Ram Ready theme

EdNotebook currently has a Ram Ready authoring theme with a similar university blue/gold direction. It is not an exact token match for the Digital Literacy standalone course.

The rule moving forward is:

- `Ram Ready` identifies the learning-design family.
- `Angelo State Inspired` identifies the exact standalone visual preset.
- Other institutions or independent authors can create different presets without changing the Ram Ready lesson shell.

```text
Ram Ready template
├── Angelo State Inspired preset
├── EdNotebook default preset
├── Institution-approved preset
└── Independent publisher preset
```

## 10. Reproduction rule

A successful Digital Literacy reproduction must use:

- the exact token values in this document
- the independent-use notice
- no official university seal or mascot art
- the Digital Literacy path names and content
- the Digital Literacy shell structure
- the reference certificate colors

Visual similarity without these rules is not considered a faithful preset reproduction.
