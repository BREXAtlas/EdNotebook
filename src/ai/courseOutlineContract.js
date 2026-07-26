const BUILDER_TYPES = new Map([
  ["story", "Story"],
  ["lab", "Lab"],
  ["drill", "Drill"],
  ["seminar", "Seminar"],
]);
const TEMPLATE_KEYS = new Set(["ramready", "story", "lab", "drill", "seminar"]);

const clean = (value, fallback = "") => String(value ?? fallback).trim();

function slug(value, fallback) {
  const normalized = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function normalizedLessonType(value) {
  const normalized = clean(value, "seminar").toLowerCase();
  return BUILDER_TYPES.has(normalized) ? normalized : "seminar";
}

function builderLessonType(value) {
  return BUILDER_TYPES.get(normalizedLessonType(value)) || "Seminar";
}

function normalizedTemplateKey(value, fallback = "ramready") {
  const normalized = clean(value, fallback).toLowerCase();
  return TEMPLATE_KEYS.has(normalized) ? normalized : fallback;
}

function uniqueEpisodeId(title, unitIndex, lessonIndex, used) {
  const base = slug(title, `lesson-${unitIndex + 1}-${lessonIndex + 1}`);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function validateCourseOutlineArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("The AI router returned no course outline.");
  if (!clean(artifact.courseTitle)) throw new Error("The course outline is missing a title.");
  if (!Array.isArray(artifact.learningObjectives) || artifact.learningObjectives.length === 0) {
    throw new Error("The course outline must contain at least one learning objective.");
  }
  if (!Array.isArray(artifact.units) || artifact.units.length === 0) {
    throw new Error("The course outline must contain at least one unit.");
  }
  artifact.units.forEach((unit, unitIndex) => {
    if (!clean(unit?.title)) throw new Error(`Unit ${unitIndex + 1} is missing a title.`);
    if (!Array.isArray(unit?.lessons) || unit.lessons.length === 0) {
      throw new Error(`Unit ${unitIndex + 1} must contain at least one lesson.`);
    }
    unit.lessons.forEach((lesson, lessonIndex) => {
      if (!clean(lesson?.title)) throw new Error(`Lesson ${lessonIndex + 1} in unit ${unitIndex + 1} is missing a title.`);
      const minutes = Number(lesson?.estimatedMinutes);
      if (!Number.isFinite(minutes) || minutes < 5) {
        throw new Error(`Lesson ${lessonIndex + 1} in unit ${unitIndex + 1} needs an estimated duration of at least 5 minutes.`);
      }
    });
  });
  return artifact;
}

export function createEditableOutline(routerResult, requestInput) {
  const artifact = validateCourseOutlineArtifact(routerResult?.artifact);
  const requestedTemplate = normalizedTemplateKey(requestInput.templateKey, "ramready");
  return {
    courseTitle: clean(artifact.courseTitle),
    subtitle: clean(artifact.subtitle, `${clean(requestInput.subject, "Course")} learning pathway`),
    templateKey: normalizedTemplateKey(artifact.templateKey, requestedTemplate),
    learningObjectives: artifact.learningObjectives.map((item) => clean(item)).filter(Boolean),
    assessmentPlan: Array.isArray(artifact.assessmentPlan) ? artifact.assessmentPlan.map((item) => clean(item)).filter(Boolean) : [],
    sourceGaps: Array.isArray(artifact.sourceGaps) ? artifact.sourceGaps.map((item) => clean(item)).filter(Boolean) : [],
    units: artifact.units.map((unit) => ({
      title: clean(unit.title),
      lessons: unit.lessons.map((lesson) => ({
        title: clean(lesson.title),
        lessonType: normalizedLessonType(lesson.lessonType),
        estimatedMinutes: Math.max(5, Math.round(Number(lesson.estimatedMinutes) || 15)),
      })),
    })),
    requestInput: { ...requestInput },
    provenance: {
      provider: clean(routerResult?.provenance?.provider),
      model: clean(routerResult?.provenance?.model),
      tier: Number(routerResult?.provenance?.tier) || null,
      promptVersion: clean(routerResult?.provenance?.promptVersion),
      policyVersion: clean(routerResult?.provenance?.policyVersion),
    },
    reviewState: "ai_draft_not_published",
    generatedAt: new Date().toISOString(),
  };
}

export function outlineToBuilderCourse(outline, acceptedAt = new Date().toISOString()) {
  validateCourseOutlineArtifact(outline);
  const usedIds = new Set();
  return {
    courseTitle: clean(outline.courseTitle),
    subtitle: clean(outline.subtitle),
    templateKey: normalizedTemplateKey(outline.templateKey, "ramready"),
    learningObjectives: outline.learningObjectives.map((item) => clean(item)).filter(Boolean),
    assessmentPlan: (outline.assessmentPlan || []).map((item) => clean(item)).filter(Boolean),
    sourceGaps: (outline.sourceGaps || []).map((item) => clean(item)).filter(Boolean),
    acts: outline.units.map((unit, unitIndex) => ({
      title: clean(unit.title, `Unit ${unitIndex + 1}`),
      episodes: unit.lessons.map((lesson, lessonIndex) => ({
        id: uniqueEpisodeId(lesson.title, unitIndex, lessonIndex, usedIds),
        title: clean(lesson.title, `Lesson ${lessonIndex + 1}`),
        type: builderLessonType(lesson.lessonType),
        minutes: Math.max(5, Math.round(Number(lesson.estimatedMinutes) || 15)),
      })),
    })),
    aiDraft: {
      status: "professor_accepted_outline",
      humanReviewRequired: true,
      generatedAt: outline.generatedAt || null,
      acceptedAt,
      provider: outline.provenance?.provider || null,
      model: outline.provenance?.model || null,
      tier: outline.provenance?.tier ?? null,
      promptVersion: outline.provenance?.promptVersion || null,
      policyVersion: outline.provenance?.policyVersion || null,
    },
  };
}

export function splitProfessorList(value, maxItems = 20, maxLength = 1000) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}
