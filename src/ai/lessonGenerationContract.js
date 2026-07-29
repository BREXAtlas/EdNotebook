import { cloneManifest } from "../course-runtime/courseManifest.js";

export const LESSON_AI_DRAFT_LABEL = "AI Draft — Not Published";
export const LESSON_AI_TASK_TYPE = "lesson";
export const LESSON_GENERATION_INPUT_VERSION =
  "EdNotebookSelectedLessonInput/1.0";

export const LESSON_REQUESTED_ELEMENTS = Object.freeze([
  "teaching_sections",
  "examples",
  "readings",
  "activity",
  "knowledge_checks",
]);

const clean = (value, fallback = "") =>
  String(value ?? fallback)
    .replace(/\s+/g, " ")
    .trim();
const clone = (value) => JSON.parse(JSON.stringify(value));
const list = (value) =>
  (Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value]
  )
    .map((item) => clean(item))
    .filter(Boolean);
const unique = (items) => Array.from(new Set(items.filter(Boolean)));
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function fieldValue(syllabusRecord, key) {
  return syllabusRecord?.structuredContent?.[key]?.value;
}

function fieldText(syllabusRecord, key) {
  const value = fieldValue(syllabusRecord, key);
  if (Array.isArray(value))
    return value
      .map((item) => clean(item))
      .filter(Boolean)
      .join("; ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return clean(value);
}

function identifier(value, fallback) {
  const normalized = clean(value)
    .replace(/[^A-Za-z0-9._:-]+/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 120);
  return normalized || fallback;
}

function versionLabel(value, fallback = "1.0.0") {
  const candidates = [
    value,
    value?.current_version,
    value?.version,
    value?.profile?.version,
    value?.course?.contentVersion,
  ];
  for (const candidate of candidates) {
    const normalized = clean(candidate);
    if (VERSION_PATTERN.test(normalized)) return normalized;
    if (/^\d+$/.test(normalized)) return `${normalized}.0.0`;
  }
  return fallback;
}

function numericCreditHours(value) {
  const match = clean(value).match(/\d+(?:\.\d+)?/);
  if (!match) return Number.NaN;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function selectedPath(manifest, pathId) {
  return (
    manifest?.paths?.find((path) => path.id === pathId) ||
    manifest?.paths?.[0] ||
    null
  );
}

function selectedLesson(manifest, pathId, lessonId) {
  const path = selectedPath(manifest, pathId);
  return {
    path,
    lesson:
      path?.nodes?.find((node) => node.id === lessonId) ||
      path?.nodes?.[0] ||
      null,
  };
}

const approvedCourseRights = Object.freeze({
  usageStatus: "approved",
  permittedUses: ["lesson_generation", "display"],
  attributionRequired: false,
  accessibilityStatus: "ready",
  license: "Professor-approved content for this course package.",
});

function sourceRecord({
  sourceId,
  sourceType,
  authorityRank,
  title,
  excerpt,
  citation = null,
  references,
  rights = approvedCourseRights,
}) {
  return {
    sourceId: identifier(sourceId, "source"),
    sourceType,
    authorityRank,
    title: clean(title).slice(0, 500),
    excerpt: clean(excerpt).slice(0, 4000),
    citation: citation ? clean(citation).slice(0, 1000) : null,
    references: references.map((reference) => ({
      kind: reference.kind,
      id: identifier(reference.id, "reference"),
    })),
    rights: clone(rights),
  };
}

function outlineCourse(outlineRecord) {
  return outlineRecord?.course || outlineRecord || {};
}

function outlineObjectives(outlineRecord) {
  return list(outlineCourse(outlineRecord)?.learningObjectives);
}

function lessonPurpose(lesson) {
  const purpose = clean(
    lesson?.purpose || lesson?.openingNarrative || lesson?.subtitle,
  );
  return (
    purpose ||
    `Teach ${clean(lesson?.title) || "the selected lesson"} through explanation, application, and review.`
  ).slice(0, 1_000);
}

function normalizedModality(value) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (normalized.includes("hybrid") || normalized.includes("mixed"))
    return "hybrid";
  if (normalized.includes("in_person") || normalized.includes("face_to_face")) {
    return "in_person";
  }
  if (
    normalized.includes("online") ||
    normalized.includes("asynchronous") ||
    normalized.includes("synchronous")
  ) {
    return "online";
  }
  return "";
}

function nextLessonId(path, lesson) {
  const currentIndex = path.nodes.findIndex((node) => node.id === lesson.id);
  return (
    identifier(
      lesson.recommendedNextNodeId || path.nodes[currentIndex + 1]?.id,
      "",
    ) || null
  );
}

function matchingOutlineLesson(outlineRecord, lesson) {
  return (outlineCourse(outlineRecord)?.acts || [])
    .flatMap((act) => act.episodes || [])
    .find(
      (episode) =>
        episode.id === lesson.id ||
        clean(episode.title) === clean(lesson.title),
    );
}

export function createLessonGenerationInput({
  manifest,
  pathId,
  lessonId,
  course = {},
  syllabusRecord = null,
  outlineRecord = null,
  professorInstruction = "",
}) {
  const { path, lesson } = selectedLesson(manifest, pathId, lessonId);
  if (!path || !lesson)
    throw new Error("Select one existing course lesson before generating.");
  if (!syllabusRecord?.structuredContent) {
    throw new Error(
      "Connect the professor-reviewed structured syllabus before generating.",
    );
  }
  if (!outlineRecord || !matchingOutlineLesson(outlineRecord, lesson)) {
    throw new Error(
      "Connect the professor-accepted outline for this selected lesson.",
    );
  }
  const courseId = clean(
    course.id ||
      manifest.course?.sourceEdNotebookCourseId ||
      manifest.course?.id,
  );
  if (!UUID_PATTERN.test(courseId)) {
    throw new Error(
      "The selected lesson needs an authenticated cloud course ID.",
    );
  }
  const creditHours = numericCreditHours(
    fieldValue(syllabusRecord, "creditHours") ||
      course.creditHours ||
      course.settings?.creditHours,
  );
  if (!Number.isInteger(creditHours) || creditHours < 1 || creditHours > 12) {
    throw new Error(
      "Record 1–12 approved course credit hours before generating.",
    );
  }
  const modality = normalizedModality(
    fieldValue(syllabusRecord, "deliveryModality") ||
      course.settings?.modality ||
      course.modality,
  );
  if (!modality) {
    throw new Error(
      "Record the approved online, hybrid, or in-person modality before generating.",
    );
  }

  const syllabusSectionId = "syllabus-selected-lesson";
  const outcomeTexts = unique([
    ...list(fieldValue(syllabusRecord, "courseOutcomes")),
    ...list(fieldValue(syllabusRecord, "courseObjectives")),
    ...outlineObjectives(outlineRecord),
    ...(lesson.learningObjectives || []).map((item) => clean(item)),
  ]).slice(0, 30);
  if (!outcomeTexts.length)
    throw new Error("Add at least one approved learning outcome.");
  const outcomeIds = outcomeTexts.map((_, index) => `outcome-${index + 1}`);
  const assessmentTexts = unique([
    ...list(fieldValue(syllabusRecord, "outcomeAssessmentMethods")),
    ...list(fieldValue(syllabusRecord, "majorAssignments")),
    ...(lesson.knowledgeChecks || []).map((check) => clean(check?.question)),
  ]).slice(0, 30);
  if (!assessmentTexts.length)
    throw new Error("Add an approved assessment method.");
  const assessmentIds = assessmentTexts.map(
    (_, index) => `assessment-${index + 1}`,
  );
  const requiredReadings = unique([
    ...list(fieldValue(syllabusRecord, "requiredReadings")),
    ...list(fieldValue(syllabusRecord, "recommendedReadings")),
  ]).slice(0, 30);
  if (!requiredReadings.length)
    throw new Error("Add at least one approved course reading.");
  const readingIds = requiredReadings.map((_, index) => `reading-${index + 1}`);
  const integrityText = fieldText(
    syllabusRecord,
    "institutionalAcademicIntegrity",
  );
  const aiPolicyText = fieldText(syllabusRecord, "aiUsePolicy");
  if (!integrityText || !aiPolicyText) {
    throw new Error(
      "Approve both academic-integrity and course AI-use policy sources before generating.",
    );
  }
  const policyIds = ["policy-academic-integrity", "policy-ai-use"];
  const scheduleText = fieldText(syllabusRecord, "courseOutline");
  if (!scheduleText)
    throw new Error("Connect the approved course outline/schedule.");
  const courseDescription = fieldText(syllabusRecord, "courseDescription");
  if (!courseDescription) {
    throw new Error(
      "Add the approved catalog/ACGM-aligned course description; it will not be inferred.",
    );
  }
  const scheduleIds = ["schedule-selected-lesson"];
  const syllabusExcerpt = [
    courseDescription,
    ...outcomeTexts,
    ...assessmentTexts,
    scheduleText,
  ]
    .filter(Boolean)
    .join(" ");
  const outlineLesson = matchingOutlineLesson(outlineRecord, lesson);
  const manifestVersion = versionLabel(manifest.course?.contentVersion);
  const followingLessonId = nextLessonId(path, lesson);

  const acceptedSources = [
    sourceRecord({
      sourceId: "source-institution-integrity",
      sourceType: "institution_policy",
      authorityRank: 1,
      title: "Approved academic-integrity policy",
      excerpt: integrityText,
      references: [{ kind: "academic_integrity_policy", id: policyIds[0] }],
    }),
    sourceRecord({
      sourceId: "source-course-ai-policy",
      sourceType: "syllabus",
      authorityRank: 3,
      title: "Approved course AI-use policy",
      excerpt: aiPolicyText,
      references: [{ kind: "ai_use_policy", id: policyIds[1] }],
    }),
    sourceRecord({
      sourceId: "source-catalog-outcomes",
      sourceType: "catalog",
      authorityRank: 2,
      title: "Professor-approved catalog and course outcomes",
      excerpt: `${courseDescription} ${outcomeTexts.join("; ")}`,
      references: outcomeIds.map((id) => ({ kind: "outcome", id })),
    }),
    sourceRecord({
      sourceId: "source-approved-syllabus",
      sourceType: "syllabus",
      authorityRank: 3,
      title: "Professor-approved structured syllabus",
      excerpt: syllabusExcerpt,
      references: [
        { kind: "syllabus_section", id: syllabusSectionId },
        ...assessmentIds.map((id) => ({ kind: "assessment", id })),
        { kind: "schedule", id: scheduleIds[0] },
      ],
    }),
    sourceRecord({
      sourceId: "source-approved-outline",
      sourceType: "course_outline",
      authorityRank: 4,
      title: "Professor-accepted course outline",
      excerpt: `${outlineLesson.title}. ${lessonPurpose(lesson)}`,
      references: [
        { kind: "outline_lesson", id: identifier(lesson.id, "lesson") },
        ...(followingLessonId
          ? [{ kind: "next_lesson", id: followingLessonId }]
          : []),
      ],
    }),
    sourceRecord({
      sourceId: "source-course-manifest",
      sourceType: "course_manifest",
      authorityRank: 4,
      title: "Existing EdNotebook course-package manifest",
      excerpt: `Manifest ${manifestVersion}; template ${manifest.template?.family}; display preset ${manifest.preset?.id}; selected lesson ${lesson.title}.`,
      references: [{ kind: "manifest", id: manifestVersion }],
    }),
    ...requiredReadings.map((reading, index) =>
      sourceRecord({
        sourceId: `source-reading-${index + 1}`,
        sourceType: "reading",
        authorityRank: 5,
        title: reading,
        excerpt: `Professor-approved course reading: ${reading}`,
        citation: reading,
        references: [{ kind: "reading", id: readingIds[index] }],
        rights: {
          usageStatus: "approved",
          permittedUses: ["lesson_generation", "display", "link"],
          attributionRequired: true,
          accessibilityStatus: "needs_review",
          license:
            "Course reading metadata; content rights require professor review.",
        },
      }),
    ),
  ];
  let boundedInstruction = null;
  const instructionText = clean(professorInstruction).slice(0, 2_000);
  if (instructionText) {
    const sourceId = "source-professor-instruction";
    acceptedSources.push(
      sourceRecord({
        sourceId,
        sourceType: "professor_instruction",
        authorityRank: 6,
        title: "Bounded professor instruction",
        excerpt: instructionText,
        references: [
          { kind: "outline_lesson", id: identifier(lesson.id, "lesson") },
        ],
      }),
    );
    boundedInstruction = { sourceId, text: instructionText };
  }

  const totalWorkloadMinutes = creditHours * 2_700;
  const lessonMinutes = Math.max(
    5,
    Math.round(Number(lesson.estimatedMinutes) || 15),
  );
  if (lessonMinutes > 600) {
    throw new Error(
      "Set the selected lesson workload between 5 and 600 minutes.",
    );
  }
  const usedMinutes = (manifest.paths || [])
    .flatMap((item) => item.nodes || [])
    .filter((node) => node.id !== lesson.id)
    .reduce(
      (sum, node) => sum + Math.max(0, Number(node.estimatedMinutes) || 0),
      0,
    );
  const remainingWorkloadMinutes = Math.max(
    0,
    totalWorkloadMinutes - usedMinutes,
  );
  if (remainingWorkloadMinutes < lessonMinutes) {
    throw new Error(
      "The selected lesson exceeds the remaining approved course workload.",
    );
  }
  const courseTitle = clean(manifest.course?.title || course.title).slice(
    0,
    180,
  );
  if (!courseTitle)
    throw new Error("Add the approved course title before generating.");
  const selectedLessonTitle = clean(lesson.title).slice(0, 180);
  if (!selectedLessonTitle) {
    throw new Error("Add the selected lesson title before generating.");
  }
  const sequencePosition =
    path.nodes.findIndex((node) => node.id === lesson.id) + 1;
  if (sequencePosition < 1 || sequencePosition > 1_000) {
    throw new Error(
      "The selected lesson sequence position is outside the governed range.",
    );
  }

  return {
    qualityProfile: {
      profileKey: "angelo_state_online_course_quality",
      version: "1.0.0",
    },
    course: {
      courseId,
      title: courseTitle,
      academicLevel: clean(
        course.settings?.academicLevel ||
          course.academicLevel ||
          manifest.course?.audience ||
          "higher education",
      ).slice(0, 80),
      modality,
      creditHours,
      totalWorkloadMinutes,
      remainingWorkloadMinutes,
      syllabusVersion: versionLabel(syllabusRecord),
      outlineVersion: versionLabel(outlineRecord),
      manifestVersion,
      templateKey: identifier(manifest.template?.family, "ram-ready"),
      displayPreset: identifier(manifest.preset?.id, "ednotebook-default"),
    },
    selectedLesson: {
      lessonId: identifier(lesson.id, "lesson"),
      unitId: identifier(lesson.groupId || path.id, "unit"),
      title: selectedLessonTitle,
      purpose: lessonPurpose(lesson),
      prerequisites: list(lesson.prerequisites)
        .slice(0, 20)
        .map((item) => item.slice(0, 500)),
      sequencePosition,
      maxMinutes: Math.max(
        lessonMinutes,
        Math.min(240, lessonMinutes + 15, remainingWorkloadMinutes),
      ),
      requestedElements: [...LESSON_REQUESTED_ELEMENTS],
    },
    alignments: {
      syllabusSectionIds: [syllabusSectionId],
      outcomeIds,
      assessmentIds,
      readingIds,
      policyIds,
      scheduleIds,
    },
    connections: {
      assignmentIds: [],
      quizIds: [],
      discussionIds: [],
      calendarEventIds: [],
      nextLessonId: followingLessonId,
    },
    authoritativeSources: acceptedSources,
    professorInstruction: boundedInstruction,
    maximumSections: 8,
    maximumWords: 1_500,
    unresolvedAuthoritativeConflicts: list(
      syllabusRecord?.extraction?.conflictingInformation,
    )
      .slice(0, 20)
      .map((item) => item.slice(0, 500)),
  };
}

function requireObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function requireArray(value, message, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(message);
  }
  return value;
}

function requireBoundedText(value, maximum, message) {
  const normalized = clean(value);
  if (!normalized || normalized.length > maximum) {
    throw new Error(message);
  }
  return normalized;
}

function sameSet(left = [], right = []) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

function exactSetCheck(returned, approved, label) {
  if (!sameSet(returned || [], approved || [])) {
    throw new Error(
      `The lesson draft changed its approved ${label} alignment.`,
    );
  }
}

function sourceReferences(artifact) {
  const sectionSources = (artifact.sections || []).flatMap(
    (section) => section?.sourceIds || section?.sourceReferences || [],
  );
  const exampleSources = (artifact.examples || []).flatMap(
    (example) => example?.sourceIds || example?.sourceReferences || [],
  );
  const checkSources = (artifact.knowledgeChecks || []).flatMap(
    (check) => check?.sourceIds || check?.sourceReferences || [],
  );
  const discussionSources = (artifact.discussionPrompts || []).flatMap(
    (discussion) => discussion?.sourceIds || [],
  );
  const objectiveSources = (artifact.objectives || []).flatMap(
    (objective) => objective?.sourceIds || [],
  );
  const vocabularySources = (artifact.vocabulary || []).flatMap(
    (item) => item?.sourceIds || [],
  );
  return unique([
    ...(artifact.alignment?.sourceIds || []),
    ...sectionSources,
    ...exampleSources,
    ...checkSources,
    ...discussionSources,
    ...objectiveSources,
    ...vocabularySources,
    ...(artifact.readings || []).map((reading) => reading?.sourceId),
    ...(artifact.activity?.sourceIds || []),
    ...(artifact.accessibility?.images || []).map((item) => item.sourceId),
    ...(artifact.accessibility?.media || []).map((item) => item.sourceId),
  ]);
}

export function validateLessonArtifact(artifact, requestInput) {
  requireObject(artifact, "The AI router returned no selected lesson draft.");
  if (artifact.artifactType !== "lesson") {
    throw new Error("The AI router returned the wrong academic artifact type.");
  }
  if (artifact.draftStatus !== "ai_draft_not_published") {
    throw new Error(
      "The selected lesson draft returned the wrong draft state.",
    );
  }
  if (artifact.statusLabel !== LESSON_AI_DRAFT_LABEL) {
    throw new Error(
      "The lesson draft is missing its unpublished status label.",
    );
  }
  if (artifact.humanReviewRequired !== true) {
    throw new Error(
      "The lesson draft did not preserve mandatory human review.",
    );
  }
  if (clean(artifact.courseId) !== clean(requestInput?.course?.courseId)) {
    throw new Error("The lesson draft returned for a different course.");
  }
  if (
    clean(artifact.lessonId) !== clean(requestInput?.selectedLesson?.lessonId)
  ) {
    throw new Error(
      "The lesson draft returned for a different selected lesson.",
    );
  }
  requireBoundedText(
    artifact.title,
    180,
    "The selected lesson title must contain 1–180 characters.",
  );
  requireBoundedText(
    artifact.subtitle,
    300,
    "The selected lesson subtitle must contain 1–300 characters.",
  );
  requireBoundedText(
    artifact.purpose,
    1_000,
    "The selected lesson purpose must contain 1–1,000 characters.",
  );
  const minutes = Number(artifact.estimatedMinutes);
  if (
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > Number(requestInput?.selectedLesson?.maxMinutes || 240)
  ) {
    throw new Error(
      "The selected lesson draft exceeds its approved time boundary.",
    );
  }
  requireArray(
    artifact.objectives,
    "The selected lesson draft needs measurable objectives.",
  );
  requireArray(
    artifact.sections,
    "The selected lesson draft needs readable teaching sections.",
  );
  requireArray(
    artifact.readings,
    "The selected lesson draft needs approved readings.",
  );
  requireArray(
    artifact.knowledgeChecks,
    "The selected lesson draft needs at least one formative knowledge check.",
  );
  if (artifact.objectives.length > 12) {
    throw new Error(
      "The selected lesson draft exceeds 12 measurable objectives.",
    );
  }
  if (artifact.sections.length > 12) {
    throw new Error("The selected lesson draft exceeds 12 teaching sections.");
  }
  if (artifact.readings.length > 30) {
    throw new Error("The selected lesson draft exceeds 30 approved readings.");
  }
  if (artifact.knowledgeChecks.length > 20) {
    throw new Error("The selected lesson draft exceeds 20 formative checks.");
  }
  requireObject(
    artifact.alignment,
    "The selected lesson draft is missing alignment evidence.",
  );
  requireObject(
    artifact.connections,
    "The selected lesson draft is missing course connections.",
  );
  requireObject(
    artifact.workload,
    "The selected lesson draft is missing workload evidence.",
  );
  requireObject(
    artifact.accessibility,
    "The selected lesson draft is missing accessibility metadata.",
  );
  requireObject(
    artifact.academicIntegrity,
    "The selected lesson draft is missing academic-integrity alignment.",
  );
  requireObject(
    artifact.courseVersionProvenance,
    "The selected lesson draft is missing course-version provenance.",
  );
  ["sourceGaps", "uncertainties", "conflicts", "reviewBlocks"].forEach((key) =>
    requireArray(
      artifact[key],
      `The selected lesson draft is missing ${key}.`,
      { allowEmpty: true },
    ),
  );

  artifact.objectives.forEach((objective) => {
    requireObject(objective, "A lesson objective is malformed.");
    requireBoundedText(
      objective.text,
      500,
      "A lesson objective must contain 1–500 characters.",
    );
    requireArray(
      objective.outcomeIds,
      "A lesson objective is missing outcome alignment.",
    );
    requireArray(
      objective.sourceIds,
      "A lesson objective is missing source alignment.",
    );
  });
  artifact.sections.forEach((section) => {
    if (!clean(section.sectionId))
      throw new Error("A teaching section is missing its ID.");
    requireBoundedText(
      section.heading,
      500,
      "A teaching-section heading must contain 1–500 characters.",
    );
    requireBoundedText(
      section.body,
      8_000,
      "Teaching-section text must contain 1–8,000 characters.",
    );
    if (![2, 3].includes(section.headingLevel)) {
      throw new Error(
        "A teaching section returned an invalid semantic heading level.",
      );
    }
    requireArray(
      section.sourceIds,
      "A teaching section is missing source alignment.",
    );
  });
  artifact.knowledgeChecks.forEach((check) => {
    if (!clean(check.checkId))
      throw new Error("A formative knowledge check is missing its ID.");
    requireBoundedText(
      check.question,
      1_000,
      "A formative-check question must contain 1–1,000 characters.",
    );
    requireBoundedText(
      check.answer,
      2_000,
      "A formative-check answer must contain 1–2,000 characters.",
    );
    requireBoundedText(
      check.explanation,
      2_000,
      "Formative-check feedback must contain 1–2,000 characters.",
    );
    if (
      check.type === "multiple_choice" &&
      (!Array.isArray(check.options) ||
        check.options.length < 2 ||
        !check.options.includes(check.answer))
    ) {
      throw new Error("A multiple-choice check returned an invalid answer.");
    }
  });

  const alignment = artifact.alignment;
  exactSetCheck(
    alignment.syllabusSectionIds,
    requestInput.alignments.syllabusSectionIds,
    "syllabus references",
  );
  exactSetCheck(
    alignment.outcomeIds,
    requestInput.alignments.outcomeIds,
    "outcome references",
  );
  exactSetCheck(
    alignment.assessmentIds,
    requestInput.alignments.assessmentIds,
    "assessment references",
  );
  exactSetCheck(
    alignment.policyIds,
    requestInput.alignments.policyIds,
    "policy references",
  );
  exactSetCheck(
    alignment.scheduleIds,
    requestInput.alignments.scheduleIds,
    "schedule references",
  );
  exactSetCheck(
    alignment.sourceIds,
    requestInput.authoritativeSources.map((source) => source.sourceId),
    "source references",
  );
  if (
    clean(alignment.outlineLessonId) !==
    clean(requestInput.selectedLesson.lessonId)
  ) {
    throw new Error(
      "The lesson draft returned alignment to a different outline lesson.",
    );
  }
  const approvedSourceIds = requestInput.authoritativeSources.map(
    (source) => source.sourceId,
  );
  if (
    sourceReferences(artifact).some(
      (sourceId) => !approvedSourceIds.includes(sourceId),
    )
  ) {
    throw new Error(
      "The lesson draft invented an unapproved source reference.",
    );
  }
  exactSetCheck(
    artifact.readings.map((reading) => reading.readingId),
    requestInput.alignments.readingIds,
    "reading",
  );
  ["assignmentIds", "quizIds", "discussionIds", "calendarEventIds"].forEach(
    (key) =>
      exactSetCheck(
        artifact.connections[key],
        requestInput.connections[key],
        `${key} connection`,
      ),
  );
  if (
    clean(artifact.connections.nextLessonId) !==
    clean(requestInput.connections.nextLessonId)
  ) {
    throw new Error(
      "The lesson draft changed the approved next-lesson connection.",
    );
  }
  const expectedProvenance = {
    syllabusVersion: requestInput.course.syllabusVersion,
    outlineVersion: requestInput.course.outlineVersion,
    manifestVersion: requestInput.course.manifestVersion,
    qualityProfileKey: requestInput.qualityProfile.profileKey,
    qualityProfileVersion: requestInput.qualityProfile.version,
    templateKey: requestInput.course.templateKey,
    displayPreset: requestInput.course.displayPreset,
  };
  Object.entries(expectedProvenance).forEach(([key, value]) => {
    if (artifact.courseVersionProvenance[key] !== value) {
      throw new Error(
        "The lesson draft returned incorrect course-version provenance.",
      );
    }
  });
  return artifact;
}

export function assessLessonAlignment(artifact, requestInput) {
  const checks = [];
  const returnedAlignment = artifact?.alignment || {};
  const hasSyllabusContext =
    requestInput.alignments.syllabusSectionIds.length > 0;
  const syllabusAligned =
    hasSyllabusContext &&
    requestInput.alignments.syllabusSectionIds.every((id) =>
      (returnedAlignment.syllabusSectionIds || []).includes(id),
    );
  checks.push({
    key: "syllabus",
    label: "Approved syllabus",
    status: syllabusAligned ? "aligned" : "review",
    detail: hasSyllabusContext
      ? syllabusAligned
        ? "Every supplied lesson-applicable syllabus section is referenced."
        : `Missing supplied syllabus IDs: ${requestInput.alignments.syllabusSectionIds
            .filter(
              (id) =>
                !(returnedAlignment.syllabusSectionIds || []).includes(id),
            )
            .join(", ")}.`
      : "No approved structured syllabus was connected to this course draft.",
  });
  const outlineAligned =
    clean(returnedAlignment.outlineLessonId) ===
    clean(requestInput.selectedLesson.lessonId);
  checks.push({
    key: "outline",
    label: "Professor outline",
    status: outlineAligned ? "aligned" : "review",
    detail: outlineAligned
      ? "The returned lesson points to the selected outline lesson."
      : "Confirm this draft belongs to the selected outline lesson.",
  });
  const requiredOutcomes = requestInput.alignments.outcomeIds;
  const outcomesAligned =
    requiredOutcomes.length > 0 &&
    requiredOutcomes.every((id) =>
      (returnedAlignment.outcomeIds || []).includes(id),
    );
  checks.push({
    key: "outcomes",
    label: "Learning outcomes",
    status: outcomesAligned ? "aligned" : "review",
    detail: outcomesAligned
      ? "All supplied outcome identifiers are represented."
      : `Missing supplied outcome IDs: ${requiredOutcomes
          .filter((id) => !(returnedAlignment.outcomeIds || []).includes(id))
          .join(", ")}.`,
  });
  const approvedSourceIds = new Set(
    requestInput.authoritativeSources.map((source) => source.sourceId),
  );
  const usedSources = sourceReferences(artifact);
  const sourcesAligned =
    usedSources.length > 0 &&
    usedSources.every((id) => approvedSourceIds.has(id)) &&
    (artifact.sourceGaps || []).length === 0;
  checks.push({
    key: "sources",
    label: "Approved sources",
    status: sourcesAligned ? "aligned" : "review",
    detail: sourcesAligned
      ? "All cited source IDs are approved and no source gap was returned."
      : `${(artifact.sourceGaps || []).length} source gap(s) returned; verify every reference against the approved set.`,
  });
  const qualityEvidence = [
    [(artifact.objectives || []).length > 0, "measurable objectives"],
    [
      (returnedAlignment.assessmentIds || []).length > 0,
      "assessment alignment",
    ],
    [(artifact.sections || []).length > 0, "teaching sections"],
    [Boolean(artifact.activity), "learner activity"],
    [(artifact.knowledgeChecks || []).length > 0, "formative checks"],
    [Boolean(artifact.workload), "workload"],
    [Boolean(artifact.accessibility), "accessibility"],
    [Boolean(artifact.academicIntegrity), "academic integrity"],
  ];
  const missingQualityEvidence = qualityEvidence
    .filter(([present]) => !present)
    .map(([, label]) => label);
  const qualityFloorPresent = missingQualityEvidence.length === 0;
  checks.push({
    key: "quality",
    label: "ASU/OLC pilot lesson-quality mapping",
    status: qualityFloorPresent ? "aligned" : "review",
    detail: qualityFloorPresent
      ? "The selected lesson includes outcomes-to-assessment evidence, regular learner interaction, workload, accessibility, and integrity fields. This versioned pilot mapping remains pending institutional confirmation."
      : `Missing selected-lesson evidence: ${missingQualityEvidence.join(", ")}. No course-level requirement was inferred.`,
  });
  return checks;
}

export function createEditableLessonDraft(
  routerResult,
  requestInput,
  previousDraft = null,
  generatedAt = new Date().toISOString(),
) {
  const artifact = clone(
    validateLessonArtifact(routerResult?.artifact, requestInput),
  );
  const revisionHistory = [
    ...(previousDraft?.revisionHistory || []),
    {
      action: previousDraft
        ? "whole_lesson_regenerated"
        : "whole_lesson_generated",
      at: generatedAt,
      provider: clean(routerResult?.provenance?.provider),
      model: clean(routerResult?.provenance?.model),
      promptVersion: clean(routerResult?.provenance?.promptVersion),
      policyVersion: clean(routerResult?.provenance?.policyVersion),
    },
  ];
  return {
    ...artifact,
    reviewState: "ai_draft_not_published",
    generatedAt,
    requestInputVersion: LESSON_GENERATION_INPUT_VERSION,
    requestInput: clone(requestInput),
    provenance: {
      provider: clean(routerResult?.provenance?.provider),
      model: clean(routerResult?.provenance?.model),
      tier: Number(routerResult?.provenance?.tier) || null,
      promptVersion: clean(routerResult?.provenance?.promptVersion),
      policyVersion: clean(routerResult?.provenance?.policyVersion),
      fallbackCount: Number(routerResult?.provenance?.fallbackCount) || 0,
    },
    revisionHistory,
    professorEdited: false,
  };
}

export function updateEditableLessonDraft(draft, patch) {
  return {
    ...draft,
    ...patch,
    professorEdited: true,
  };
}

function sectionHeading(section) {
  return clean(section?.heading || section?.title || section?.sectionId);
}

function sectionBody(section) {
  return clean(section?.body || section?.content || section?.text);
}

function matchingSection(sections, terms) {
  return (sections || []).find((section) => {
    const heading = sectionHeading(section).toLowerCase();
    return terms.some((term) => heading.includes(term));
  });
}

function mappedCheck(check, index, lessonId) {
  const options = list(check?.options);
  const answer = clean(check?.answer);
  return {
    id: clean(check?.checkId, `${lessonId}-check-${index + 1}`),
    question: clean(check?.question),
    type: clean(
      check?.type,
      options.length ? "multiple_choice" : "short_answer",
    ),
    options,
    correctAnswer: answer,
    explanation: clean(check?.explanation),
    sourceIds: list(check?.sourceIds || check?.sourceReferences),
  };
}

export function lessonDraftToManifestLesson(
  draft,
  currentLesson,
  acceptedAt = new Date().toISOString(),
) {
  validateLessonArtifact(draft, draft.requestInput);
  if ((draft.reviewBlocks || []).length) {
    throw new Error(
      "Resolve every lesson review block before accepting the draft.",
    );
  }
  const sections = draft.sections || [];
  const opening = matchingSection(sections, ["opening", "overview", "orient"]);
  const what = matchingSection(sections, ["what", "concept", "understand"]);
  const why = matchingSection(sections, ["why"]);
  const how = matchingSection(sections, ["how", "apply", "practice"]);
  const limits = matchingSection(sections, [
    "limit",
    "risk",
    "cost",
    "tradeoff",
  ]);
  const verify = matchingSection(sections, ["verify", "source", "check"]);
  const example = draft.examples?.[0];
  const sourceIds = sourceReferences(draft);
  const acceptedRevision = {
    action: "professor_accepted",
    at: acceptedAt,
    professorEdited: Boolean(draft.professorEdited),
  };

  return {
    ...currentLesson,
    title: clean(draft.title, currentLesson.title),
    subtitle: clean(draft.subtitle, currentLesson.subtitle),
    purpose: clean(draft.purpose),
    estimatedMinutes: Number(draft.estimatedMinutes),
    learningObjectives: draft.objectives.map((objective) =>
      clean(objective.text),
    ),
    prerequisites: list(draft.prerequisites),
    vocabulary: clone(draft.vocabulary || []),
    openingNarrative: sectionBody(opening) || clean(draft.purpose),
    realWorldExample:
      sectionBody(example) ||
      clean(example?.description) ||
      clean(currentLesson.realWorldExample),
    concept: {
      ...currentLesson.concept,
      what: sectionBody(what) || currentLesson.concept?.what,
      why: sectionBody(why) || currentLesson.concept?.why,
      how: sectionBody(how) || currentLesson.concept?.how,
      cost: sectionBody(limits) || currentLesson.concept?.cost,
      risks: sectionBody(limits) || currentLesson.concept?.risks,
      verifyNote: sectionBody(verify) || currentLesson.concept?.verifyNote,
    },
    builderSections: sections.map((section) => ({
      id: clean(section?.sectionId || section?.id),
      heading: sectionHeading(section),
      body: sectionBody(section),
      sourceIds: list(section?.sourceIds || section?.sourceReferences),
    })),
    readings: clone(draft.readings || []),
    activity: clone(draft.activity || null),
    discussionPrompts: clone(
      draft.discussionPrompts || currentLesson.discussionPrompts || [],
    ),
    quizDrafts: clone(draft.quizDrafts || currentLesson.quizDrafts || []),
    rubricDrafts: clone(draft.rubricDrafts || currentLesson.rubricDrafts || []),
    knowledgeChecks: (draft.knowledgeChecks || [])
      .map((check, index) => mappedCheck(check, index, currentLesson.id))
      .filter((check) => check.question && check.correctAnswer),
    recoveryPath:
      clean(
        draft.recovery?.nextAction ||
          draft.recovery?.retryGuidance ||
          draft.recovery?.feedbackGuidance,
      ) || currentLesson.recoveryPath,
    connections: clone(draft.connections || {}),
    workload: clone(draft.workload),
    accessibilitySummary: draft.accessibility.unresolvedItems.length
      ? `Accessibility review required: ${draft.accessibility.unresolvedItems.join("; ")}`
      : "Logical headings, keyboard operation, screen-reader support, and non-color-dependent instructions were returned for professor review.",
    academicIntegrity: clone(draft.academicIntegrity),
    sourceIds,
    builderStatus: "written",
    aiDraft: {
      status: "professor_accepted_lesson",
      statusLabel: LESSON_AI_DRAFT_LABEL,
      humanReviewRequired: true,
      generatedAt: draft.generatedAt,
      acceptedAt,
      provider: draft.provenance?.provider || null,
      model: draft.provenance?.model || null,
      tier: draft.provenance?.tier ?? null,
      promptVersion: draft.provenance?.promptVersion || null,
      policyVersion: draft.provenance?.policyVersion || null,
      sourceGaps: clone(draft.sourceGaps || []),
      uncertainties: clone(draft.uncertainties || []),
      conflicts: clone(draft.conflicts || []),
      courseVersionProvenance: clone(draft.courseVersionProvenance),
      revisionHistory: [...(draft.revisionHistory || []), acceptedRevision],
      publicationState: "not_published",
    },
  };
}

export function acceptLessonDraftIntoManifest(
  manifest,
  pathId,
  lessonId,
  draft,
  acceptedAt = new Date().toISOString(),
) {
  const next = cloneManifest(manifest);
  const path = next.paths.find((item) => item.id === pathId);
  const lessonIndex =
    path?.nodes?.findIndex((item) => item.id === lessonId) ?? -1;
  if (!path || lessonIndex < 0) {
    throw new Error("The selected course lesson no longer exists.");
  }
  path.nodes[lessonIndex] = lessonDraftToManifestLesson(
    draft,
    path.nodes[lessonIndex],
    acceptedAt,
  );
  next.course = {
    ...next.course,
    contentVersion: clean(next.course?.contentVersion, "1.0.0"),
  };
  next.phase5 = {
    ...(next.phase5 || {}),
    lastAcceptedLessonId: lessonId,
    lastAcceptedAt: acceptedAt,
    humanReviewRequired: true,
    publicationState: "draft",
  };
  return next;
}
