export const DIGITAL_LITERACY_RELEASE_ID = "2026.08.01.1";
export const DIGITAL_LITERACY_COURSE_KEY = "brexatlas.digital-literacy-course";
export const DIGITAL_LITERACY_PROGRESS_MESSAGE = "ednotebook.digital-literacy.progress.v1";
export const DIGITAL_LITERACY_SOURCE_ORIGIN = "https://brexatlas.github.io";

export function groupCanonicalUnits(units = []) {
  const groups = new Map();
  for (const unit of units) {
    const key = `${unit.path}:${unit.group_number}`;
    if (!groups.has(key)) groups.set(key, {
      key,
      path: unit.path,
      groupNumber: unit.group_number,
      title: unit.group_title,
      units: [],
    });
    groups.get(key).units.push(unit);
  }
  return [...groups.values()].sort((left, right) => {
    const pathOrder = left.path === "foundations" ? 0 : 1;
    const otherPathOrder = right.path === "foundations" ? 0 : 1;
    return pathOrder - otherPathOrder || left.groupNumber - right.groupNumber;
  });
}

export function assignmentProgressSummary(assignment) {
  const units = Array.isArray(assignment?.units) ? assignment.units : [];
  const completed = units.filter((unit) => unit.completed).length;
  return { completed, total: units.length, percent: units.length ? Math.round((completed / units.length) * 100) : 0 };
}

export function firstOpenUnit(assignment) {
  const units = Array.isArray(assignment?.units) ? assignment.units : [];
  return units.find((unit) => !unit.completed) || units.at(-1) || null;
}

export function buildCanonicalUnitUrl({ assignment, unit, parentOrigin }) {
  if (!assignment?.source_home || !unit?.relative_url) return "";
  const destination = new URL(unit.relative_url, assignment.source_home);
  destination.searchParams.set("embedded", "1");
  destination.searchParams.set("ednotebook_origin", parentOrigin);
  destination.searchParams.set("ednotebook_assignment", assignment.assignment_id);
  return destination.toString();
}

export function isCanonicalProgressMessage(event, frameWindow) {
  return event?.origin === DIGITAL_LITERACY_SOURCE_ORIGIN
    && event?.source === frameWindow
    && event?.data?.type === DIGITAL_LITERACY_PROGRESS_MESSAGE
    && event?.data?.releaseId === DIGITAL_LITERACY_RELEASE_ID
    && event?.data?.courseKey === DIGITAL_LITERACY_COURSE_KEY;
}

export function normalizeEmbeddedProgress(data) {
  const foundations = data?.progress?.foundations || {};
  const aiQuest = data?.progress?.aiQuest || {};
  return [
    {
      path: "foundations",
      completedNodeIds: Array.isArray(foundations.completedNodeIds) ? foundations.completedNodeIds : [],
      stars: foundations.stars && typeof foundations.stars === "object" ? foundations.stars : {},
    },
    {
      path: "ai-quest",
      completedNodeIds: Array.isArray(aiQuest.completedNodeIds) ? aiQuest.completedNodeIds : [],
      stars: aiQuest.stars && typeof aiQuest.stars === "object" ? aiQuest.stars : {},
    },
  ];
}

export function instrumentQuestions(instrument) {
  const definition = instrument?.definition || {};
  if (Array.isArray(definition.questions) && definition.questions.length) {
    return definition.questions.filter((question) => question?.key && question?.label).map((question) => ({
      key: question.key,
      label: question.label,
      help: question.help || "",
      type: ["select", "radio", "textarea", "number", "text"].includes(question.type) ? question.type : "text",
      options: Array.isArray(question.options) ? question.options : [],
      required: question.required !== false,
    }));
  }
  return (definition.allowed_response_fields || []).map((key) => ({
    key,
    label: String(key).replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    help: "",
    type: "text",
    options: [],
    required: true,
  }));
}

export function researchStatusLabel(status) {
  return {
    not_enrolled: "No choice recorded",
    consented: "Participating",
    declined: "Not participating",
    withdrawn: "Withdrawn",
  }[status] || "No choice recorded";
}
