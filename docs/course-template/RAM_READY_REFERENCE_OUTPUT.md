# Ram Ready Reference Standalone Course Output

## 1. Purpose

This document locks the reusable course shell represented by `BREXAtlas/Digital-Literacy-Course` and separates that shell from the subject-specific Digital Literacy curriculum.

The reference course proves that one stable course engine can support different subjects. The Digital Literacy Course itself was built from the Financial Literacy shell while replacing the curriculum, tools, sources, achievements, language, and branding details. EdNotebook should formalize that same separation so professors can create new courses without rebuilding the interface.

## 2. Product rule

> The standalone course is produced from a stable shell plus reviewed course data plus a selected preset.

```text
Locked Ram Ready shell
+ professor-approved course content
+ professor-selected course settings
+ institution or brand preset
= standalone interactive course
```

The shell is not a screenshot and is not a loose style guide. It includes the page architecture, navigation, lesson player, learning interactions, progress behavior, accessibility requirements, and export package.

## 3. Reference repository architecture

The Digital Literacy reference product uses:

```text
index.html                Course landing page
foundations.html          Foundations map and lesson player
ai-quest.html             Quest map and quest player
journey.html              Progress dashboard and certificates
achievements.html         Achievement collection
profile.html              Guest/account and progress controls
onboarding.html           Bounded personalization setup
sources.html              Central source registry
instructor-guide.html     Instructor guidance
privacy.html              Privacy explanation
disclaimer.html           Course and institutional disclaimer
feedback.html             Pilot feedback workflow
presentation.html         Optional course/pilot presentation
assets/                    Shared shell, rendering, progress, visuals, print, access
data/                      Course-specific content and configuration
llm/                       Optional bounded/local personalization providers
supabase/                  Optional account synchronization
scripts/validate-site.mjs  Export validation
```

### Core standalone package

Every EdNotebook Ram Ready standalone export should contain the equivalent of:

- course landing page
- one or more learning-path maps
- lesson player
- journey/progress dashboard
- achievements
- certificates
- source registry
- instructor guide
- privacy page
- disclaimer page
- shared responsive navigation
- accessible print styles
- structured curriculum data
- structured theme preset
- export validator

### Optional package additions

The following may be included when enabled by the professor or institution:

- learner onboarding and bounded personalization
- optional second advanced/quest path
- pilot feedback page
- course presentation
- optional account synchronization
- next-course handoff
- subject-specific interactive tools

## 4. Locked shell versus customizable content

### 4.1 Locked shell

The following should remain structurally consistent across Ram Ready standalone exports.

#### Site structure

- Shared header and footer
- Mobile menu behavior
- Skip link
- Consistent navigation order
- Course home
- Learning-path map
- Accessible list alternative
- Lesson player
- Journey dashboard
- Achievements
- Sources
- Privacy and disclaimer
- Instructor guidance
- Print behavior

#### Lesson rhythm

Every standard Ram Ready lesson follows this order:

1. Back-to-map control
2. Progress label
3. Optional guide or course voice
4. Lesson title
5. Lesson subtitle
6. “What’s happening” narrative
7. Real-world or fictional example
8. Original learning figure with text alternative
9. Four grouped concept cards
10. Optional subject-specific activity or widget
11. Scenario prompt
12. Decision cards
13. Decision result and consequences
14. Optional scoring dimensions or reflection
15. Knowledge checks with explanations
16. Sources
17. Continue action
18. Completion feedback, stars, achievement, and next destination

#### Four concept groups

The concept framework is a shell invariant.

**Understand it**

- What
- Why it exists

**Possible value**

- How it may help
- Who may benefit

**Tradeoffs**

- What it may cost
- Risks or limitations
- Who may not benefit

**Use carefully**

- When misunderstood
- What must be verified

A professor may change the words used in the headings only through a reviewed template version. Ordinary course creation changes the content beneath the headings, not the conceptual function of the groups.

#### Decision-card anatomy

Every decision option includes:

- choice text
- why someone might choose it
- possible benefit
- possible cost
- possible risk
- immediate learning/simulation effect when used
- what could change the outcome
- source references when the claim needs support

Every selected decision may reveal:

- what changes right away
- what may happen later
- longer-term consequence
- what could change the outcome
- recovery path

#### Recovery principle

The shell does not create irreversible educational dead ends. Every lesson with simulated consequences includes a recovery path.

#### Knowledge-check anatomy

Every knowledge check includes:

- stable ID
- question
- answer type
- response options when applicable
- correct answer
- explanation
- accessible status feedback

A learner sees an explanation whether the selected answer is correct or incorrect.

#### Source handling

- Course claims point to stable source IDs.
- Source metadata is maintained in one registry.
- Lessons reference source IDs rather than duplicating full references.
- The course renders a source drawer or source section.
- Links use HTTPS where available.
- Sources are reviewed separately from lesson prose.

#### Progress behavior

- Each path has a current node.
- Completed node IDs are tracked.
- Stars or completion quality are tracked separately from completion.
- Choices may be retained for reflection.
- Achievements use stable IDs.
- Streak is optional but standardized when enabled.
- Progress can be exported and imported in guest mode.
- Reset behavior is explicit and confirmed.

#### Accessibility behavior

- Full keyboard access
- Visible focus states
- Skip link
- Minimum touch target
- No color-only status
- Text alternatives for every learning figure
- Reduced-motion support
- Accessible list alternative for visual maps
- Live regions for answer and choice feedback
- Mobile-first layout
- Dark-mode compatibility when the preset supports it
- Print-friendly summaries

#### Safety and truthfulness

- Raw personalization markers never appear.
- HTML from professor or model output is escaped or sanitized.
- Correct answers and sources require professor review.
- Course-specific policies are not invented.
- Institutional endorsement is not implied.
- Simulated scores are not represented as intelligence, morality, employability, diagnosis, or official academic standing.

### 4.2 Customizable course content

The professor or approved course-generation process may change:

- course title
- course subtitle
- course description
- subject
- learner audience
- estimated duration
- path names
- path descriptions
- group names
- number of groups within allowed limits
- lesson/quest titles
- lesson subtitles
- estimated minutes
- learning objectives
- narrative
- real-world example
- fictional examples
- learning figure title, items, type, and text alternative
- concept-card content
- subject activity/widget selection
- scenario prompt
- decision options
- consequences
- recovery path
- knowledge checks
- end quiz when enabled
- source registry entries
- achievements
- certificate skills
- instructor-guide content
- next-course handoff

### 4.3 Customizable preset content

A preset may change:

- color tokens
- fonts
- spacing scale within accessibility limits
- corner radius
- hero treatment
- course logo or approved mark
- course voice
- guide names and original guide visuals
- path terminology such as Act, Unit, Module, Tier, Chapter, or Quest
- button labels where the underlying action remains clear
- institution-specific disclaimer language
- certificate colors and title
- footer attribution

### 4.4 Conditionally customizable behavior

These features may be configured, but the selected setting must be explicit in the course manifest.

- one path or two paths
- all nodes open or sequenced access
- optional onboarding
- optional bounded personalization
- required versus optional quest path
- stars enabled or disabled
- achievements enabled or disabled
- streak enabled or disabled
- certificate thresholds
- number of knowledge checks
- end quiz enabled or disabled
- attempt limits
- pass thresholds
- guest-only or optional-account mode
- feedback form enabled or disabled
- next-course handoff enabled or disabled

## 5. Reference path model

### 5.1 Foundations path

The Digital Literacy reference has:

- path label: University Digital Literacy Foundations
- 20 episodes
- four acts
- five episodes per act
- continuous storyline
- all episodes directly available
- completion, stars, and achievements tracked

### 5.2 Quest path

The Digital Literacy reference has:

- path label: AI Digital Literacy Quest
- 20 quests
- four tiers
- five quests per tier
- advanced and optional framing
- all quests directly available
- completion, stars, and achievements tracked separately
- optional scoring dimensions and closing reflection

### 5.3 Generic Ram Ready limits

The reusable shell may support:

- one or two primary paths
- three to six groups per path
- three to thirty nodes per path
- one to six knowledge checks per node
- zero to eight end-quiz questions per node

The Digital Literacy reproduction preset must override those ranges with its exact reference counts.

## 6. Reference lesson data contract

A standard lesson or quest needs the following course-data fields.

```text
id
group number or group id
title
subtitle
estimated minutes
learning objectives
opening narrative
personalization slots, when enabled
scenario prompt and scenario type
choices
immediate consequences
later consequences
long-term consequences
recovery path
concept explanation
real-world example
fictional examples, when used
knowledge checks
source ids
achievement id
recommended next node
accessibility summary
reviewed date
learning visual configuration
optional scoring dimensions
optional closing reflection
```

### Choice object

```text
id
text
why chosen
possible benefit
possible cost
possible risk
immediate effect
future effect
what could change this outcome
source ids
```

### Knowledge-check object

```text
id
question
type
options
correct answer
explanation
```

### Learning-visual object

```text
lesson id
title
type: flow | grid | compare | segments | layers | meter
items
text alternative
credit label
```

## 7. Quiz and knowledge-check rules

### Digital Literacy reference behavior

The existing standalone Digital Literacy lessons use:

- a decision scenario
- one or more knowledge checks
- explanations after answer submission
- no separate cumulative end-of-lesson quiz in the current reference player

### EdNotebook authoring behavior

The current EdNotebook preview supports:

- content sections
- knowledge checks inserted after selected sections
- a separate end quiz
- completion and XP

### Required mapping rule

To reproduce Digital Literacy perfectly:

- embedded knowledge checks are enabled
- decision scenario is enabled
- consequence and recovery panels are enabled
- sources are enabled
- achievement completion is enabled
- separate end quiz is disabled unless explicitly included in the reference course manifest

The generic Ram Ready shell may support an optional end quiz, but the Digital Literacy reference preset must not silently add one.

## 8. Progress and reward rules

### Reference star model

The current reference course awards up to three stars:

- discover/complete the scenario
- decide/complete the choice interaction
- explain/pass all knowledge checks

### Reference achievement rule

A lesson achievement is unlocked when the learner earns the configured threshold, currently three stars for the reference course.

### Progress is not a grade

Stars, streaks, and achievements are engagement and completion indicators. They are not automatically a formal grade.

A professor may map completion evidence to a grade inside EdNotebook, but the standalone shell must label the distinction clearly.

## 9. Onboarding and bounded personalization

### Reference onboarding

The Digital Literacy course includes eight screens:

1. Character and optional display name
2. Values
3. Interests
4. Academic or work direction
5. Digital priorities
6. Digital goal
7. Starting fictional confidence ranges
8. Preview and privacy confirmation

Every item can be skipped.

### What personalization may change

- optional display name
- pronouns and character presentation
- avatar styling
- approved narrative detail
- approved analogy
- light transition wording when a reviewed local provider is enabled

### What personalization may not change

- learning objectives
- course rules
- academic policy
- correct answers
- consequence logic
- source IDs
- cybersecurity facts
- rights statements
- privacy notices
- accessibility requirements

### Generic export setting

A professor may export a course with onboarding disabled. In that case, the lesson player uses natural second-person language and must not expose template markers.

## 10. Navigation contract

The reference Digital Literacy navigation is:

```text
Home
Foundations
Quest
My Journey
Achievements
Sources
Instructor Guide
Presentation
Pilot Feedback
Profile/Guest indicator
```

A standalone export may omit optional pages, but the remaining items retain a stable order:

```text
Home
Primary learning path
Secondary learning path, when enabled
My Journey
Achievements, when enabled
Sources
Instructor Guide
Optional course pages
Profile/Guest indicator, when account mode exists
```

## 11. Theme contract

Every theme provides semantic tokens rather than ad hoc colors:

```text
primary dark
primary
primary light
accent
accent dark
text
secondary text
surface
alternate surface
border
success
danger
focus ring
radius
maximum reading width
body font
```

The shell uses semantic tokens for:

- header
- hero
- buttons
- path cards
- map nodes
- concept groups
- selected decisions
- feedback panels
- knowledge checks
- celebrations
- badges
- forms
- tables
- certificates

Theme changes must not alter the lesson structure or data contract.

## 12. Standalone export modes

### 12.1 Exact reference reproduction

Produces Ram Ready Digital Literacy with:

- two paths
- 20 Foundations episodes
- 20 AI quests
- four groups per path
- Angelo State-inspired preset
- original course guides
- guest progress
- bounded personalization
- achievements, stars, streak, certificates
- source registry
- next-course handoff
- independent-pilot notices

### 12.2 New subject using the same shell

Changes:

- course identity
- curriculum data
- path/group/node names
- sources
- visuals
- activities
- achievements
- certificate content
- approved preset

Preserves:

- page architecture
- lesson rhythm
- concept framework
- decision anatomy
- consequence/recovery behavior
- knowledge-check behavior
- source registry pattern
- progress engine
- accessibility
- validation

### 12.3 Minimal standalone export

May include:

- landing page
- one path
- map
- lessons
- knowledge checks
- sources
- journey dashboard
- privacy/disclaimer

May disable:

- second path
- onboarding
- personalization
- stars
- streak
- achievements
- certificate
- account sync
- feedback
- presentation

## 13. What is not part of the basic output

The basic standalone course should not automatically include:

- live EdNotebook class messaging
- professor gradebook
- private student submissions
- institutional analytics
- shared assignment spaces
- publisher marketplace transactions
- private course files requiring EdNotebook authorization
- administrator moderation records

Those remain EdNotebook platform services. The standalone course may link back to an authorized EdNotebook course space when the professor enables that connection.

## 14. Connection between standalone course and EdNotebook

The standalone course is the learner-facing instructional product.

EdNotebook remains the authoring, review, course-management, communication, evidence, and institutional layer.

```text
Professor builds in EdNotebook
→ EdNotebook validates the course data
→ professor previews the Ram Ready output
→ professor approves the version
→ EdNotebook exports a standalone package
→ learners use the course
→ optional EdNotebook connection handles roster, messages, assignments, evidence, and reporting
```

## 15. Versioning rule

The template must have an explicit version.

Recommended identity:

```text
Template family: Ram Ready Standalone Course
Template version: 1.0
Reference product: Ram Ready Digital Literacy
Reference repository: BREXAtlas/Digital-Literacy-Course
Reference branch: main
```

Course content and shell version are tracked separately.

```text
shellVersion
courseContentVersion
themePresetVersion
exportedAt
sourceCourseId
```

An update to curriculum does not automatically change the shell version. An accessibility, layout, interaction, or data-contract change does.

## 16. Governing conclusion

Digital Literacy is the reference end product for the Ram Ready template.

EdNotebook should not merely generate six generic lesson paragraphs and call that the same product. It must compile professor-approved inputs into the complete reference contract: course home, path maps, narrative lesson player, concept framework, decisions, consequences, recovery, knowledge checks, sources, progress, achievements, certificates, accessibility, and theme rules.

That contract makes the course reproducible, portable, and suitable for new subjects without rebuilding the course interface each time.
