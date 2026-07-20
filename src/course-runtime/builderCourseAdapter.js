import { createStarterLesson } from "./courseManifest.js";
import { listManageableCourses, loadPublicationForCourse, saveCoursePackageDraft } from "./courseService.js";

export const BUILDER_DRAFT_KEY = "ednotebook-generated-course-package";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value, fallback = "") => String(value ?? fallback).trim();
const clone = (value) => JSON.parse(JSON.stringify(value));

function slug(value, fallback) {
  const normalized = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function sectionMap(sections = []) {
  return Object.fromEntries(sections.map((section) => [clean(section.heading).toLowerCase(), clean(section.body)]));
}

function sectionBy(map, terms, fallback = "") {
  const entry = Object.entries(map).find(([heading]) => terms.some((term) => heading.includes(term)));
  return entry?.[1] || fallback;
}

function mapCheck(check, fallbackId) {
  const options = Array.isArray(check?.options) ? check.options.map((option) => clean(option)).filter(Boolean) : [];
  const answerIndex = Number(check?.answer);
  return {
    id: clean(check?.id, fallbackId),
    question: clean(check?.q, "Check your understanding."),
    type: "multiple_choice",
    options,
    correctAnswer: options[answerIndex] || options[0] || "",
    explanation: clean(check?.why, "Review the lesson explanation and compare your reasoning."),
  };
}

function genericChoices(title) {
  return [
    {
      id: "apply",
      text: `Explain ${title}, verify it against the lesson, and apply it to an example`,
      whyChosen: "This combines explanation, verification, and transfer.",
      possibleBenefit: "The learner can show understanding and identify remaining gaps.",
      possibleCost: "It takes more time than simply continuing.",
      possibleRisk: "The first explanation may still need revision.",
      whatCouldChangeThisOutcome: "Professor feedback or a stronger source may improve the explanation.",
      sourceIds: [],
    },
    {
      id: "question",
      text: "Review the lesson and ask one specific question",
      whyChosen: "The learner recognizes that one part is still unclear.",
      possibleBenefit: "A focused question makes support more useful.",
      possibleCost: "The learner pauses before finishing.",
      possibleRisk: "The question may remain unresolved until someone responds.",
      whatCouldChangeThisOutcome: "A course source, discussion, or professor response may resolve it.",
      sourceIds: [],
    },
    {
      id: "skip",
      text: "Continue without checking understanding",
      whyChosen: "The learner may be short on time.",
      possibleBenefit: "The page is completed quickly.",
      possibleCost: "A misunderstanding can carry into later work.",
      possibleRisk: "The learner may struggle on the next assessment or assignment.",
      whatCouldChangeThisOutcome: "Returning to the lesson and asking for help can repair the gap.",
      sourceIds: [],
    },
  ];
}

function mapBuilderLesson(episode, builderLesson, groupId, index) {
  const starter = createStarterLesson(clean(episode?.title, `Lesson ${index + 1}`), index + 1);
  starter.id = clean(episode?.id, `lesson-${index + 1}`);
  starter.groupId = groupId;
  starter.title = clean(episode?.title, starter.title);
  starter.subtitle = `${clean(episode?.type, "Lesson")} · generated in Course Forge`;
  starter.estimatedMinutes = Math.max(1, Number(episode?.minutes) || 15);

  if (!builderLesson) {
    starter.openingNarrative = `This lesson has a generated pathway and title. Open it in Course Forge and generate the full lesson before final publication.`;
    starter.realWorldExample = `The connected course package is holding this position so the pathway, order, due dates, and enrollment links remain stable.`;
    starter.builderStatus = "title_only";
    return starter;
  }

  const sections = Array.isArray(builderLesson.sections) ? builderLesson.sections : [];
  const mapped = sectionMap(sections);
  const bodies = sections.map((section) => clean(section.body)).filter(Boolean);
  const what = sectionBy(mapped, ["what it is", "the concept", "the rule", "the source", "setup"], bodies[0] || starter.concept.what);
  const why = sectionBy(mapped, ["why it exists", "the problem", "context", "why it happened"], bodies[1] || starter.concept.why);
  const how = sectionBy(mapped, ["how it may help", "the turn", "worked example", "procedure"], bodies[2] || starter.concept.how);
  const cost = sectionBy(mapped, ["what it may cost", "common errors", "competing readings"], bodies[3] || starter.concept.cost);
  const people = sectionBy(mapped, ["who may and may not benefit", "your move", "take a position", "push further"], bodies[4] || starter.concept.whoMayBenefit);
  const verify = sectionBy(mapped, ["verify this now", "discussion prompt", "independent set", "what you should see"], bodies[5] || starter.concept.verifyNote);

  starter.learningObjectives = [
    `Explain the central idea in ${starter.title}.`,
    `Use the lesson evidence to apply ${starter.title} to a new example.`,
    `Check the limits, tradeoffs, or verification needs connected to ${starter.title}.`,
  ];
  starter.openingNarrative = bodies[0] || starter.openingNarrative;
  starter.realWorldExample = bodies[1] || bodies[2] || starter.realWorldExample;
  starter.visual = {
    title: `${starter.title} lesson sequence`,
    type: "flow",
    items: sections.map((section) => clean(section.heading)).filter(Boolean).slice(0, 6),
    textAlternative: `A sequence of the lesson sections for ${starter.title}: ${sections.map((section) => clean(section.heading)).filter(Boolean).join(", ")}.`,
    credit: "Original EdNotebook course figure generated from the professor-approved lesson structure",
  };
  starter.concept = {
    what,
    why,
    how,
    whoMayBenefit: people || starter.concept.whoMayBenefit,
    cost,
    risks: cost || starter.concept.risks,
    whoMayNotBenefit: people || starter.concept.whoMayNotBenefit,
    misunderstandingRisk: `This idea may be misunderstood when a learner memorizes the wording without connecting it to the lesson evidence: ${what}`,
    verifyNote: verify || starter.concept.verifyNote,
  };
  starter.scenario = {
    prompt: `After studying ${starter.title}, what is the strongest next learning move?`,
    type: "multiple_choice",
  };
  starter.choices = genericChoices(starter.title);
  starter.consequences = {
    immediate: {
      apply: "The learner produces an explanation that can be checked and improved.",
      question: "The learner identifies the exact point that needs clarification.",
      skip: "The learner moves forward without confirming understanding.",
    },
    later: {
      apply: "The learner is better prepared to use the idea in an assignment.",
      question: "A focused follow-up can turn uncertainty into understanding.",
      skip: "The same uncertainty may reappear in later course work.",
    },
    longTerm: {
      apply: "Explanation and verification become repeatable learning habits.",
      question: "Specific questions become a reliable recovery strategy.",
      skip: "Repeatedly skipping review can create avoidable knowledge gaps.",
    },
  };
  starter.recoveryPath = "Return to the professor-approved lesson sections, compare the explanation with the verification section, and ask one specific question. A missed idea remains recoverable.";
  starter.knowledgeChecks = (builderLesson.knowledgeChecks || []).map((check, checkIndex) => mapCheck(check, `${starter.id}-check-${checkIndex + 1}`));
  starter.endQuiz = (builderLesson.quiz || []).map((check, checkIndex) => mapCheck(check, `${starter.id}-quiz-${checkIndex + 1}`));
  starter.builderSections = clone(sections);
  starter.builderStatus = "written";
  return starter;
}

function pathwayLabel(templateKey) {
  return {
    ramready: "Foundations",
    story: "Story Path",
    lab: "Lab Path",
    drill: "Mastery Path",
    seminar: "Seminar Path",
  }[templateKey] || "Course Path";
}

export function adaptBuilderCourseToManifest({ builderCourse, builderLessons = {}, platformCourse = {}, existingManifest = null, updatedAt = new Date().toISOString() }) {
  if (!builderCourse?.acts?.length) return existingManifest;

  const existing = existingManifest ? clone(existingManifest) : null;
  const templateKey = clean(builderCourse.templateKey, "ramready");
  const groups = [];
  const nodes = [];

  builderCourse.acts.forEach((act, actIndex) => {
    const groupId = slug(act.title, `group-${actIndex + 1}`);
    const nodeIds = [];
    (act.episodes || []).forEach((episode) => {
      const node = mapBuilderLesson(episode, builderLessons[episode.id], groupId, nodes.length);
      nodes.push(node);
      nodeIds.push(node.id);
    });
    groups.push({ id: groupId, number: actIndex + 1, title: clean(act.title, `Module ${actIndex + 1}`), nodeIds });
  });

  nodes.forEach((node, index) => {
    node.recommendedNextNodeId = nodes[index + 1]?.id || null;
  });

  const title = clean(builderCourse.courseTitle, platformCourse.title || existing?.course?.title || "Untitled course");
  const courseId = clean(platformCourse.id, existing?.course?.sourceEdNotebookCourseId || existing?.course?.id || crypto.randomUUID());
  const grading = existing?.grading || { mode: "auto", maxPoints: 100, title: `Course completion · ${title}`, dueAt: "" };

  return {
    ...(existing || {}),
    format: "EdNotebookCourse/1.0",
    course: {
      ...(existing?.course || {}),
      id: courseId,
      sourceEdNotebookCourseId: clean(platformCourse.id) || existing?.course?.sourceEdNotebookCourseId || null,
      courseCode: clean(platformCourse.course_code || platformCourse.code, existing?.course?.courseCode || "COURSE"),
      title,
      subtitle: clean(builderCourse.subtitle, existing?.course?.subtitle || "A guided EdNotebook course"),
      description: clean(existing?.course?.description || platformCourse.audience, "Generated in Course Forge and synchronized to the connected course package."),
      subject: clean(platformCourse.subject, existing?.course?.subject || "Interdisciplinary"),
      audience: clean(platformCourse.audience, existing?.course?.audience || "Learners"),
      teachingWindow: clean(platformCourse.teaching_window, existing?.course?.teachingWindow || "Self-paced"),
      language: existing?.course?.language || "en",
      contentVersion: existing?.course?.contentVersion || "1.0.0",
    },
    template: {
      ...(existing?.template || {}),
      family: templateKey === "ramready" ? "ram-ready" : templateKey,
      version: "1.0",
      allNodesOpen: existing?.template?.allNodesOpen ?? true,
      endQuizEnabled: nodes.some((node) => node.endQuiz?.length),
    },
    preset: existing?.preset || { id: templateKey === "ramready" ? "angelo-state-inspired" : "ednotebook-default", version: "1.0" },
    experience: existing?.experience || { starsEnabled: true, achievementsEnabled: true, certificatesEnabled: true },
    grading,
    paths: [{
      id: templateKey === "ramready" ? "foundations" : slug(templateKey, "course-path"),
      label: pathwayLabel(templateKey),
      description: clean(builderCourse.subtitle, "The professor-approved learning pathway generated in Course Forge."),
      unitLabel: templateKey === "ramready" ? "Episode" : "Lesson",
      groupLabel: templateKey === "ramready" ? "Act" : "Module",
      required: true,
      groups,
      nodes,
    }],
    sources: existing?.sources || [],
    achievements: existing?.achievements || [],
    certificates: existing?.certificates || [],
    builderSource: {
      format: "EdNotebookBuilderDraft/1.0",
      templateKey,
      updatedAt,
      generatedLessonCount: nodes.filter((node) => node.builderStatus === "written").length,
      totalLessonCount: nodes.length,
    },
  };
}

export function readBuilderCourseDraft() {
  try {
    return JSON.parse(window.localStorage.getItem(BUILDER_DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export async function syncBuilderCoursePackage({ course, lessons, session }) {
  const updatedAt = new Date().toISOString();
  const localPayload = { format: "EdNotebookBuilderDraft/1.0", course, lessons, updatedAt };
  window.localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(localPayload));
  window.dispatchEvent(new CustomEvent("ednotebook:builder-course-updated", { detail: localPayload }));

  const courseId = window.localStorage.getItem("ednotebook-course-id") || "";
  if (!session?.user?.id || !UUID_PATTERN.test(courseId)) {
    return { source: "device", manifest: null, error: null };
  }

  const coursesResult = await listManageableCourses();
  const platformCourse = (coursesResult.data || []).find((item) => item.id === courseId);
  if (!platformCourse) return { source: "device", manifest: null, error: coursesResult.error || new Error("The connected course record was not found.") };

  const publicationResult = await loadPublicationForCourse(courseId);
  const existingManifest = publicationResult.data?.draft_manifest?.format ? publicationResult.data.draft_manifest : null;
  const manifest = adaptBuilderCourseToManifest({ builderCourse: course, builderLessons: lessons, platformCourse, existingManifest, updatedAt });
  const saveResult = await saveCoursePackageDraft(courseId, manifest, {
    displayMode: publicationResult.data?.display_mode || "full_course",
    themePreset: manifest.preset?.id || "ednotebook-default",
    gradingMode: manifest.grading?.mode || "auto",
  });

  return { ...saveResult, manifest };
}
