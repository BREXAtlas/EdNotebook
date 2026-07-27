const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const lines = (text) => String(text || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);

const FIELD_PATTERNS = {
  courseTitle: [/^(?:course\s*title|title)\s*[:\-]\s*(.+)$/i],
  courseCode: [/^(?:course\s*(?:number|code)|catalog\s*number)\s*[:\-]\s*(.+)$/i, /^([A-Z]{2,6}\s*\d{2,4}[A-Z]?)\s*[-–:]\s*(.+)$/],
  instructor: [/^(?:instructor|professor|faculty)\s*[:\-]\s*(.+)$/i],
  email: [/^(?:email|e-mail)\s*[:\-]\s*(.+)$/i, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i],
  officeHours: [/^office\s*hours?\s*[:\-]\s*(.+)$/i],
  term: [/^(?:term|semester|session)\s*[:\-]\s*(.+)$/i],
};

function field(value, confidence, sourceExcerpt, method = "deterministic") {
  return { value: clean(value), confidence, sourceExcerpt: clean(sourceExcerpt).slice(0, 1000), method };
}

function firstMatch(sourceLines, patterns) {
  for (const sourceLine of sourceLines) {
    for (const pattern of patterns) {
      const match = sourceLine.match(pattern);
      if (match) return { value: match[1] || match[0], sourceExcerpt: sourceLine };
    }
  }
  return null;
}

function sectionBlocks(text) {
  const sourceLines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const headings = /^(course\s*(?:description|objectives?|outcomes?)|learning\s*(?:objectives?|outcomes?)|assignments?|assessment|grading|evaluation|schedule|calendar|weekly\s*schedule|required\s*(?:materials?|texts?|books?)|policies?|attendance|late\s*work|academic\s*integrity|accommodations?)\s*:?$/i;
  const blocks = [];
  let current = null;
  for (const rawLine of sourceLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (headings.test(line)) {
      if (current?.body.length) blocks.push(current);
      current = { heading: line.replace(/:$/, ""), body: [] };
    } else if (current) current.body.push(line);
  }
  if (current?.body.length) blocks.push(current);
  return blocks;
}

function extractList(blocks, headingPattern, max = 50) {
  return blocks
    .filter((block) => headingPattern.test(block.heading))
    .flatMap((block) => block.body)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function extractDeterministicSyllabus(text) {
  const normalizedText = String(text || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
  if (!normalizedText) throw new Error("Paste or upload syllabus text before extraction.");
  const sourceLines = lines(normalizedText);
  const blocks = sectionBlocks(normalizedText);
  const fields = {};

  for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
    const match = firstMatch(sourceLines, patterns);
    if (match) fields[key] = field(match.value, key === "email" ? 0.99 : 0.93, match.sourceExcerpt);
  }

  if (!fields.courseTitle) {
    const likelyTitle = sourceLines.find((line) => line.length >= 5 && line.length <= 160 && !/@/.test(line));
    if (likelyTitle) fields.courseTitle = field(likelyTitle, 0.55, likelyTitle, "heuristic");
  }

  const learningObjectives = extractList(blocks, /objective|outcome/i, 30);
  const assignments = extractList(blocks, /assignment|assessment/i, 60);
  const grading = extractList(blocks, /grading|evaluation/i, 40);
  const schedule = extractList(blocks, /schedule|calendar/i, 100);
  const requiredMaterials = extractList(blocks, /material|text|book/i, 30);
  const policies = extractList(blocks, /polic|attendance|late|integrity|accommodation/i, 50);

  if (learningObjectives.length) fields.learningObjectives = field(learningObjectives, 0.82, learningObjectives.join(" | "));
  if (assignments.length) fields.assignments = field(assignments, 0.78, assignments.join(" | "));
  if (grading.length) fields.gradingStructure = field(grading, 0.76, grading.join(" | "));
  if (schedule.length) fields.schedule = field(schedule, 0.74, schedule.join(" | "));
  if (requiredMaterials.length) fields.requiredMaterials = field(requiredMaterials, 0.82, requiredMaterials.join(" | "));
  if (policies.length) fields.policies = field(policies, 0.78, policies.join(" | "));

  const uncertainSections = blocks
    .filter((block) => block.body.join(" ").length > 40)
    .filter((block) => !/objective|outcome|assignment|assessment|grading|evaluation|schedule|calendar|material|text|book|polic|attendance|late|integrity|accommodation/i.test(block.heading))
    .map((block) => `${block.heading}\n${block.body.join("\n")}`.slice(0, 4000))
    .slice(0, 30);

  const missingInformation = ["courseTitle", "courseCode", "instructor", "email", "officeHours", "term"]
    .filter((key) => !fields[key])
    .map((key) => key.replace(/([A-Z])/g, " $1").toLowerCase());

  return {
    sourceText: normalizedText,
    fields,
    missingInformation,
    conflictingInformation: [],
    uncertainSections,
    proposedCourseOutline: null,
  };
}

export function mergeSyllabusExtraction(deterministic, aiArtifact) {
  const aiFields = aiArtifact?.fields || {};
  const fields = { ...deterministic.fields };
  for (const [key, value] of Object.entries(aiFields)) {
    if (!fields[key] || Number(value?.confidence || 0) > Number(fields[key]?.confidence || 0)) {
      fields[key] = { ...value, method: "ai_uncertainty_resolution" };
    }
  }
  return {
    ...deterministic,
    fields,
    missingInformation: Array.from(new Set([...(deterministic.missingInformation || []), ...(aiArtifact?.missingInformation || [])])),
    conflictingInformation: Array.from(new Set([...(deterministic.conflictingInformation || []), ...(aiArtifact?.conflictingInformation || [])])),
    proposedCourseOutline: aiArtifact?.proposedCourseOutline || null,
  };
}