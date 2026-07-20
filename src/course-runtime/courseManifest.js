export const COURSE_FORMAT = "EdNotebookCourse/1.0";

export const COURSE_PRESETS = {
  "ednotebook-default": { id: "ednotebook-default", label: "EdNotebook", primary: "#1d4ed8", primaryDark: "#153b91", accent: "#f2b33d", surface: "#ffffff", background: "#f5f7fb", text: "#17233b", muted: "#657086", border: "#d9deea", success: "#18865b", error: "#b42318" },
  "angelo-state-inspired": { id: "angelo-state-inspired", label: "Angelo State Inspired", primary: "#245397", primaryDark: "#162f57", accent: "#f0c33b", surface: "#ffffff", background: "#f6f8fb", text: "#1a1d23", muted: "#454b57", border: "#d7dde6", success: "#1e7d43", error: "#b3261e" },
};

const clean = (value, fallback = "") => String(value ?? fallback).trim();
const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export function createStarterLesson(courseTitle = "Course", index = 1) {
  const title = index === 1 ? `Start ${courseTitle}` : `Lesson ${index}`;
  const correct = `Explain ${title} in your own words and connect it to the course material.`;
  return {
    id: makeId("lesson"), groupId: "module-1", title,
    subtitle: "Learn the idea, apply it, and check your understanding", estimatedMinutes: 15,
    learningObjectives: [`Explain the central idea in ${title}.`, "Apply the idea to a course example."],
    openingNarrative: `This lesson introduces ${title} through a practical example and a decision you can examine.`,
    realWorldExample: `A learner studies ${title}, reviews the available evidence, and decides how to apply it.`,
    visual: { title: `${title} in four steps`, type: "flow", items: ["Notice", "Study", "Apply", "Check"], textAlternative: `A four-step sequence for ${title}.`, credit: "Original EdNotebook course figure" },
    concept: {
      what: `${title} is the main idea explored in this lesson.`,
      why: "It gives learners a shared starting point before practice.",
      how: "It may help learners explain the topic and apply it to a new situation.",
      whoMayBenefit: "Learners who need a clear explanation and practice.",
      cost: "Careful learning takes time, attention, and revision.",
      risks: "A short explanation can oversimplify a complex topic.",
      whoMayNotBenefit: "Advanced learners may need a more challenging extension.",
      misunderstandingRisk: "Memorizing a phrase without being able to explain it.",
      verifyNote: "Compare the lesson with professor-approved course material and sources.",
    },
    scenario: { prompt: `What should a learner do after studying ${title}?`, type: "multiple_choice" },
    choices: [
      { id: "a", text: "Explain the idea, verify it, and apply it to an example", whyChosen: "This combines understanding and transfer.", possibleBenefit: "The learner can show understanding.", possibleCost: "It takes additional time.", possibleRisk: "The explanation may need revision.", whatCouldChangeThisOutcome: "Professor feedback may improve it.", sourceIds: [] },
      { id: "b", text: "Review the lesson and write one specific question", whyChosen: "Part of the idea remains unclear.", possibleBenefit: "A focused question supports useful help.", possibleCost: "The learner pauses before finishing.", possibleRisk: "The question may need a response.", whatCouldChangeThisOutcome: "A source or professor response may resolve it.", sourceIds: [] },
      { id: "c", text: "Continue without checking understanding", whyChosen: "The learner may be short on time.", possibleBenefit: "The page is completed quickly.", possibleCost: "A knowledge gap may remain.", possibleRisk: "Later work may be harder.", whatCouldChangeThisOutcome: "Returning to review can repair the gap.", sourceIds: [] },
    ],
    consequences: {
      immediate: { a: "The learner creates an explanation that can be checked.", b: "The learner identifies what needs clarification.", c: "The learner finishes without confirming understanding." },
      later: { a: "The learner is prepared to use the idea.", b: "A focused follow-up can build understanding.", c: "The uncertainty may return later." },
      longTerm: { a: "Explanation and verification become habits.", b: "Specific questions become a recovery strategy.", c: "Skipping review can create gaps." },
    },
    recoveryPath: "Return to the lesson, compare it with the approved source, and ask the professor one specific question.",
    knowledgeChecks: [{ id: makeId("check"), question: `Which response best demonstrates understanding of “${title}”?`, type: "multiple_choice", options: [correct, "Repeat one phrase without explanation.", "Skip the material and guess.", "Move on without checking."], correctAnswer: correct, explanation: "Understanding is demonstrated through explanation, connection, and verification." }],
    endQuiz: [], sourceIds: [], achievementId: null, recommendedNextNodeId: null,
    accessibilitySummary: "All content and interactions are keyboard accessible and do not rely on color alone.", reviewedDate: new Date().toISOString().slice(0, 10), assignmentTemplateIds: [],
  };
}

export function createStarterManifest(course = {}) {
  const title = clean(course.title || course.name, "Untitled course");
  const lesson = createStarterLesson(title, 1);
  return {
    format: COURSE_FORMAT,
    course: { id: clean(course.id, makeId("course")), sourceEdNotebookCourseId: clean(course.id) || null, courseCode: clean(course.course_code || course.code, "COURSE"), title, subtitle: clean(course.subtitle, "A guided EdNotebook course"), description: clean(course.description || course.audience, "Learn through explanation, decisions, checks, and reflection."), subject: clean(course.subject, "Interdisciplinary"), audience: clean(course.audience, "Learners"), teachingWindow: clean(course.teaching_window || course.length, "Self-paced"), language: "en", contentVersion: "1.0.0" },
    template: { family: "ram-ready", version: "1.0", allNodesOpen: true, endQuizEnabled: false },
    preset: { id: "ednotebook-default", version: "1.0" },
    experience: { starsEnabled: true, achievementsEnabled: true, certificatesEnabled: true },
    grading: { mode: "auto", maxPoints: 100, title: `Course completion · ${title}`, dueAt: "" },
    paths: [{ id: "foundations", label: "Foundations", description: "The core learning path", unitLabel: "Lesson", groupLabel: "Module", required: true, groups: [{ id: "module-1", number: 1, title: "Module 1", nodeIds: [lesson.id] }], nodes: [lesson] }],
    sources: [], achievements: [], certificates: [],
  };
}

export const cloneManifest = (manifest) => JSON.parse(JSON.stringify(manifest));
export const flattenLessons = (manifest) => (manifest?.paths || []).flatMap((path) => (path.nodes || []).map((lesson) => ({ ...lesson, pathId: path.id, pathLabel: path.label })));

export function validateCourseManifest(manifest) {
  const errors = [];
  if (manifest?.format !== COURSE_FORMAT) errors.push(`Format must be ${COURSE_FORMAT}.`);
  if (!clean(manifest?.course?.title)) errors.push("Add a course title.");
  if (!Array.isArray(manifest?.paths) || !manifest.paths.length) errors.push("Add at least one learning path.");
  const ids = new Set();
  for (const path of manifest?.paths || []) {
    if (!Array.isArray(path.nodes) || !path.nodes.length) errors.push(`${path.label || "A path"} needs at least one lesson.`);
    for (const node of path.nodes || []) {
      if (!clean(node.id) || ids.has(node.id)) errors.push("Lesson IDs must be unique.");
      ids.add(node.id);
      if (!clean(node.title) || !clean(node.openingNarrative)) errors.push("Every lesson needs a title and opening context.");
      if (node.builderStatus === "title_only") errors.push(`${node.title || "A Course Forge lesson"} is still title-only. Generate its full lesson before publishing.`);
      for (const check of node.knowledgeChecks || []) if (!check.options?.includes(check.correctAnswer)) errors.push(`${node.title} has an invalid knowledge check.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function addLessonToManifest(manifest, pathId, groupId) {
  const next = cloneManifest(manifest); const path = next.paths.find((item) => item.id === pathId) || next.paths[0]; const group = path.groups.find((item) => item.id === groupId) || path.groups[0];
  const lesson = createStarterLesson(next.course.title, path.nodes.length + 1); lesson.groupId = group.id; path.nodes.push(lesson); group.nodeIds.push(lesson.id); return next;
}

export function removeLessonFromManifest(manifest, pathId, lessonId) {
  const next = cloneManifest(manifest); const path = next.paths.find((item) => item.id === pathId); if (!path || path.nodes.length <= 1) return next;
  path.nodes = path.nodes.filter((item) => item.id !== lessonId); path.groups = path.groups.map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => id !== lessonId) })); return next;
}