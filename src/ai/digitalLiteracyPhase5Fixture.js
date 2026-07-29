export const DIGITAL_LITERACY_REFERENCE_COMMIT =
  "da411a0764a8f30de75717056851a7145513309d";
export const DIGITAL_LITERACY_INSTITUTION_ID =
  "22222222-2222-4222-8222-222222222222";
export const DIGITAL_LITERACY_COURSE_ID =
  "11111111-1111-4111-8111-111111111111";

const approvedRights = Object.freeze({
  usageStatus: "approved",
  permittedUses: ["lesson_generation", "display", "quotation", "link"],
  attributionRequired: false,
  accessibilityStatus: "ready",
  license: "Synthetic pilot fixture; no external publication rights implied.",
});

export const DIGITAL_LITERACY_LESSON_INPUT = Object.freeze({
  qualityProfile: {
    profileKey: "angelo_state_online_course_quality",
    version: "1.0.0",
  },
  course: {
    courseId: DIGITAL_LITERACY_COURSE_ID,
    title: "Digital Literacy",
    academicLevel: "Undergraduate first year",
    modality: "online",
    creditHours: 3,
    totalWorkloadMinutes: 8_100,
    remainingWorkloadMinutes: 7_200,
    syllabusVersion: "1.0.0",
    outlineVersion: "1.0.0",
    manifestVersion: "1.0.0",
    templateKey: "ram-ready-digital-literacy",
    displayPreset: "guided-reader",
  },
  selectedLesson: {
    lessonId: "lesson-evaluating-online-information",
    unitId: "unit-information-literacy",
    title: "Evaluating Online Information",
    purpose:
      "Practice evaluating an online claim by checking authority, evidence, context, and corroboration.",
    prerequisites: ["Open and compare two browser-readable sources."],
    sequencePosition: 2,
    maxMinutes: 90,
    requestedElements: [
      "teaching_sections",
      "examples",
      "readings",
      "activity",
      "knowledge_checks",
    ],
  },
  alignments: {
    syllabusSectionIds: ["syllabus-information-evaluation"],
    outcomeIds: ["outcome-evaluate-information"],
    assessmentIds: ["assessment-source-check"],
    readingIds: ["reading-source-evaluation-guide"],
    policyIds: ["policy-integrity", "policy-ai-use"],
    scheduleIds: ["week-2-evaluating-sources"],
  },
  connections: {
    assignmentIds: ["assignment-source-check"],
    quizIds: ["quiz-evaluating-sources"],
    discussionIds: ["discussion-credible-information"],
    calendarEventIds: ["calendar-week-2-source-check"],
    nextLessonId: "lesson-citing-and-organizing-sources",
  },
  authoritativeSources: [
    {
      sourceId: "source-institution-policy",
      sourceType: "institution_policy",
      authorityRank: 1,
      title: "Synthetic institution integrity and course AI-use profile",
      excerpt:
        "Students identify assistance used, follow the course AI-use rule, and submit their own source evaluation.",
      citation: null,
      references: [
        { kind: "academic_integrity_policy", id: "policy-integrity" },
        { kind: "ai_use_policy", id: "policy-ai-use" },
      ],
      rights: approvedRights,
    },
    {
      sourceId: "source-catalog-outcome",
      sourceType: "catalog",
      authorityRank: 2,
      title: "Synthetic Digital Literacy catalog outcome",
      excerpt:
        "Learners evaluate the credibility and relevance of information from digital sources.",
      citation: null,
      references: [
        { kind: "outcome", id: "outcome-evaluate-information" },
      ],
      rights: approvedRights,
    },
    {
      sourceId: "source-approved-syllabus",
      sourceType: "syllabus",
      authorityRank: 3,
      title: "Approved synthetic Digital Literacy syllabus",
      excerpt:
        "Week 2 evaluates online sources. Learners complete the source-check assignment and a formative quiz before the next lesson.",
      citation: null,
      references: [
        { kind: "syllabus_section", id: "syllabus-information-evaluation" },
        { kind: "assessment", id: "assessment-source-check" },
        { kind: "schedule", id: "week-2-evaluating-sources" },
        { kind: "assignment", id: "assignment-source-check" },
        { kind: "quiz", id: "quiz-evaluating-sources" },
        { kind: "calendar_event", id: "calendar-week-2-source-check" },
      ],
      rights: approvedRights,
    },
    {
      sourceId: "source-approved-outline",
      sourceType: "course_outline",
      authorityRank: 4,
      title: "Approved Digital Literacy course outline",
      excerpt:
        "The selected lesson teaches source evaluation before the lesson on citation and source organization.",
      citation: null,
      references: [
        { kind: "outline_lesson", id: "lesson-evaluating-online-information" },
        { kind: "next_lesson", id: "lesson-citing-and-organizing-sources" },
        { kind: "discussion", id: "discussion-credible-information" },
      ],
      rights: approvedRights,
    },
    {
      sourceId: "source-course-manifest",
      sourceType: "course_manifest",
      authorityRank: 4,
      title: "Approved Digital Literacy course manifest",
      excerpt:
        "Manifest version 1.0.0 uses the guided reader preset and keeps course lessons in the signed-in platform viewport.",
      citation: null,
      references: [{ kind: "manifest", id: "1.0.0" }],
      rights: approvedRights,
    },
    {
      sourceId: "source-evaluation-reading",
      sourceType: "reading",
      authorityRank: 5,
      title: "Synthetic source-evaluation guide",
      excerpt:
        "Check who created the information, what evidence is offered, when and why it was published, and whether independent sources corroborate it.",
      citation:
        "EdNotebook Learning Design Team. (2026). Synthetic source-evaluation guide.",
      references: [
        { kind: "reading", id: "reading-source-evaluation-guide" },
      ],
      rights: {
        ...approvedRights,
        attributionRequired: true,
      },
    },
    {
      sourceId: "source-professor-instruction",
      sourceType: "professor_instruction",
      authorityRank: 6,
      title: "Bounded professor instruction",
      excerpt:
        "Use a friendly example and require learners to explain which evidence changed their judgment.",
      citation: null,
      references: [
        { kind: "outline_lesson", id: "lesson-evaluating-online-information" },
      ],
      rights: approvedRights,
    },
  ],
  professorInstruction: {
    sourceId: "source-professor-instruction",
    text:
      "Use a friendly example and require learners to explain which evidence changed their judgment.",
  },
  maximumSections: 4,
  maximumWords: 1_500,
  unresolvedAuthoritativeConflicts: [],
});

export const DIGITAL_LITERACY_LESSON_ARTIFACT = Object.freeze({
  artifactType: "lesson",
  draftStatus: "ai_draft_not_published",
  statusLabel: "AI Draft — Not Published",
  humanReviewRequired: true,
  courseId: DIGITAL_LITERACY_COURSE_ID,
  lessonId: "lesson-evaluating-online-information",
  title: "Evaluating Online Information",
  subtitle: "A practical source-check routine",
  purpose:
    "Practice evaluating an online claim by checking authority, evidence, context, and corroboration.",
  estimatedMinutes: 75,
  alignment: {
    syllabusSectionIds: ["syllabus-information-evaluation"],
    outlineLessonId: "lesson-evaluating-online-information",
    outcomeIds: ["outcome-evaluate-information"],
    assessmentIds: ["assessment-source-check"],
    sourceIds: DIGITAL_LITERACY_LESSON_INPUT.authoritativeSources.map(
      (source) => source.sourceId,
    ),
    policyIds: ["policy-integrity", "policy-ai-use"],
    scheduleIds: ["week-2-evaluating-sources"],
  },
  objectives: [
    {
      text: "Evaluate an online claim using four source-check questions.",
      outcomeIds: ["outcome-evaluate-information"],
      sourceIds: ["source-catalog-outcome", "source-evaluation-reading"],
    },
  ],
  prerequisites: ["Open and compare two browser-readable sources."],
  vocabulary: [
    {
      term: "corroboration",
      definition:
        "Confirmation of a claim through evidence from an independent source.",
      sourceIds: ["source-evaluation-reading"],
    },
  ],
  sections: [
    {
      sectionId: "section-source-check",
      heading: "Use the source-check routine",
      headingLevel: 2,
      body:
        "Identify who created the information, inspect the evidence, consider when and why it was published, and compare the claim with an independent source.",
      sourceIds: ["source-catalog-outcome", "source-evaluation-reading"],
    },
    {
      sectionId: "section-explain-judgment",
      heading: "Explain your judgment",
      headingLevel: 2,
      body:
        "State whether the claim is useful for the current purpose and name the evidence that most influenced the decision.",
      sourceIds: ["source-professor-instruction", "source-evaluation-reading"],
    },
  ],
  examples: [
    {
      exampleId: "example-campus-claim",
      title: "A campus-services claim",
      body:
        "Compare a reposted claim with the dated page from the organization responsible for the service.",
      sourceIds: ["source-professor-instruction", "source-evaluation-reading"],
    },
  ],
  readings: [
    {
      readingId: "reading-source-evaluation-guide",
      title: "Synthetic source-evaluation guide",
      citation:
        "EdNotebook Learning Design Team. (2026). Synthetic source-evaluation guide.",
      sourceId: "source-evaluation-reading",
      required: true,
    },
  ],
  activity: {
    title: "Compare two versions of a claim",
    instructions:
      "Apply the four source-check questions to both versions, then explain which evidence changed or confirmed your judgment.",
    estimatedMinutes: 20,
    successCriteria: [
      "Addresses authority, evidence, context, and corroboration.",
      "Explains which evidence affected the judgment.",
    ],
    outcomeIds: ["outcome-evaluate-information"],
    sourceIds: ["source-professor-instruction", "source-evaluation-reading"],
  },
  knowledgeChecks: [
    {
      checkId: "check-corroboration",
      question: "What does corroboration add to a source evaluation?",
      type: "multiple_choice",
      options: [
        "Independent evidence for comparison",
        "A more colorful page",
        "A longer headline",
      ],
      answer: "Independent evidence for comparison",
      explanation:
        "Corroboration checks a claim against evidence from an independent source.",
      outcomeIds: ["outcome-evaluate-information"],
      sourceIds: ["source-evaluation-reading"],
    },
  ],
  recovery: {
    feedbackGuidance:
      "Name the missing source-check question and return to the matching source passage.",
    retryGuidance:
      "Revise one judgment after comparing it with a second independent source.",
    hints: [
      "Start with who is responsible for the claim.",
      "Separate evidence from page appearance.",
    ],
    nextAction: "Complete the connected source-check assignment.",
  },
  connections: {
    assignmentIds: ["assignment-source-check"],
    quizIds: ["quiz-evaluating-sources"],
    discussionIds: ["discussion-credible-information"],
    calendarEventIds: ["calendar-week-2-source-check"],
    nextLessonId: "lesson-citing-and-organizing-sources",
  },
  workload: {
    lessonMinutes: 75,
    courseBudgetMinutes: 8_100,
    contributionPercent: 0.9259259259,
  },
  accessibility: {
    headingOrderLogical: true,
    images: [],
    media: [],
    tables: [],
    instructionsDoNotDependOnColor: true,
    keyboardOperable: true,
    screenReaderReady: true,
    timedAssessmentAccommodationRequired: false,
    accommodationNotes: [],
    unresolvedItems: [],
  },
  academicIntegrity: {
    policyIds: ["policy-integrity", "policy-ai-use"],
    aiUsePolicyIds: ["policy-ai-use"],
    learnerGuidance:
      "Identify any permitted assistance and submit your own source evaluation.",
  },
  sourceGaps: [],
  uncertainties: [],
  conflicts: [],
  reviewBlocks: [],
  courseVersionProvenance: {
    syllabusVersion: "1.0.0",
    outlineVersion: "1.0.0",
    manifestVersion: "1.0.0",
    qualityProfileKey: "angelo_state_online_course_quality",
    qualityProfileVersion: "1.0.0",
    templateKey: "ram-ready-digital-literacy",
    displayPreset: "guided-reader",
  },
});

export const DIGITAL_LITERACY_PHASE5_FIXTURE = Object.freeze({
  fixtureKey: "ram-ready-digital-literacy-selected-lesson",
  fixtureVersion: "2026-07-28.1",
  reference: {
    repository: "BREXAtlas/Digital-Literacy-Course",
    commit: DIGITAL_LITERACY_REFERENCE_COMMIT,
    license: "Course code MIT; reviewed curriculum CC BY 4.0",
    role: "First Phase 5 subject and functional course reference",
  },
  input: DIGITAL_LITERACY_LESSON_INPUT,
  artifact: DIGITAL_LITERACY_LESSON_ARTIFACT,
  researchBoundary: {
    status: "not_activated",
    collectsHumanSubjectData: false,
  },
});

