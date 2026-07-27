import {
  ANGELO_STATE_2026_PROFILE,
  evaluateSyllabusRequirements,
  syllabusFieldDefinitions,
} from "../syllabus/angeloState2026Profile.js";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const sourceLines = (text) => String(text || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
const listItem = (line) => clean(String(line || "").replace(/^[-•*\u2022\d.)\s]+/, ""));

const DIRECT_PATTERNS = {
  courseTitle: [/^(?:course\s*title|title)\s*[:\-]\s*(.+)$/i],
  courseCode: [/^(?:course\s*(?:number|code)|catalog\s*number)\s*[:\-]\s*(.+)$/i, /^([A-Z]{2,8}\s*\d{2,5}[A-Z]?)\s*[-–:]\s*(.+)$/],
  sectionNumber: [/^(?:section|section\s*number)\s*[:\-]\s*(.+)$/i],
  term: [/^(?:term|semester|session)\s*[:\-]\s*(.+)$/i],
  creditHours: [/^(?:credit\s*hours?|credits?)\s*[:\-]\s*(.+)$/i],
  instructorTitle: [/^(?:instructor\s*title|faculty\s*title|title)\s*[:\-]\s*(.+)$/i],
  instructorName: [/^(?:instructor|professor|faculty|name)\s*[:\-]\s*(.+)$/i],
  instructorPhone: [/^(?:phone|telephone|office\s*phone)\s*[:\-]\s*(.+)$/i, /(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/],
  instructorEmail: [/^(?:email|e-mail|asu\s*email)\s*[:\-]\s*(.+)$/i, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i],
  officeLocation: [/^(?:office|office\s*location)\s*[:\-]\s*(.+)$/i],
  officeHours: [/^office\s*hours?\s*[:\-]\s*(.+)$/i],
  deliveryModality: [/^(?:course\s*delivery|delivery|modality|course\s*format)\s*[:\-]\s*(.+)$/i],
  meetingTimes: [/^(?:meeting\s*(?:days?\s*and\s*)?times?|class\s*time)\s*[:\-]\s*(.+)$/i],
  meetingLocation: [/^(?:meeting\s*location|classroom|location)\s*[:\-]\s*(.+)$/i],
  blackboardCourseId: [/^(?:blackboard\s*(?:course\s*)?(?:id|identifier|key))\s*[:\-]\s*(.+)$/i],
  finalExamDate: [/^(?:final\s*exam\s*date|final\s*date)\s*[:\-]\s*(.+)$/i],
  finalExamTime: [/^(?:final\s*exam\s*time|final\s*time)\s*[:\-]\s*(.+)$/i],
  finalExamLocation: [/^(?:final\s*exam\s*location|final\s*location)\s*[:\-]\s*(.+)$/i],
};

const KEYWORD_FIELD_RULES = [
  ["prerequisites", /prerequisite|prior course|required preparation/i],
  ["technicalCompetencies", /technical skill|technical competenc|computer skill|digital skill/i],
  ["lmsUse", /blackboard|learning management system|\blms\b/i],
  ["onlineInteractionPlan", /regular and substantive interaction|instructor interaction|student interaction/i],
  ["requiredHardware", /required hardware|computer requirement|device requirement/i],
  ["requiredSoftware", /required software|software requirement/i],
  ["requiredSubscriptions", /subscription|access code|online service/i],
  ["materialAccess", /bookstore|where to (?:buy|find|obtain)|available at/i],
  ["gradingPolicies", /extra credit|curve|drop(?:ping)? the lowest|late grade|participation.*grade/i],
  ["finalAssessmentType", /final exam|final examination|culminating (?:activity|experience|project)/i],
  ["attendanceExpectations", /attendance/i],
  ["participationExpectations", /participation/i],
  ["communicationExpectations", /communication|response time|contact the instructor/i],
  ["academicBehaviorExpectations", /academic behavior|academic conduct|plagiarism|honor code/i],
  ["onlineConductExpectations", /netiquette|online conduct|discussion board conduct/i],
  ["aiUsePolicy", /generative ai|artificial intelligence|chatgpt|turnitin ai|ai tools/i],
  ["accessibilityProcess", /accessibility|accommodation|disabilit/i],
  ["institutionalAcademicIntegrity", /academic integrity|academic honesty|honor code/i],
  ["institutionalDisability", /student(?:s)? with disabilities|reasonable accommodation/i],
  ["institutionalTitleIX", /title ix|sexual misconduct|sexual harassment/i],
  ["institutionalReligiousHolyDay", /religious holy day|religious observance/i],
  ["studentHandbookLink", /student handbook/i],
];

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter(Boolean);
  if (value && typeof value === "object") return value;
  return clean(value);
}

function field(value, confidence, sourceExcerpt, method = "deterministic") {
  return {
    value: normalizeValue(value),
    confidence,
    sourceExcerpt: clean(sourceExcerpt).slice(0, 1000),
    method,
  };
}

function allMatches(lines, patterns) {
  const matches = [];
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) matches.push({ value: match[1] || match[0], sourceExcerpt: line });
    }
  }
  return matches;
}

function normalizedHeading(line) {
  return clean(line)
    .replace(/^[\dIVXLC]+[.)\-:\s]+/i, "")
    .replace(/[.:\-–—]+$/, "")
    .toLowerCase();
}

function headingLookup(profile) {
  const entries = profile.sections.flatMap((section) => section.headingAliases.map((alias) => ({
    alias: normalizedHeading(alias),
    sectionId: section.id,
    title: section.title,
  })));
  return entries.sort((a, b) => b.alias.length - a.alias.length);
}

function identifyHeading(line, lookup) {
  if (!line || line.length > 140) return null;
  const candidate = normalizedHeading(line);
  return lookup.find((entry) => candidate === entry.alias || candidate.startsWith(`${entry.alias}:`) || candidate.startsWith(`${entry.alias} -`)) || null;
}

function sectionBlocks(text, profile) {
  const rawLines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const lookup = headingLookup(profile);
  const blocks = [];
  let current = { sectionId: "preamble", title: "Preamble", heading: "Preamble", body: [] };
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = identifyHeading(line, lookup);
    if (heading) {
      if (current.body.length) blocks.push(current);
      current = { sectionId: heading.sectionId, title: heading.title, heading: line, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length) blocks.push(current);
  return blocks;
}

function blockText(blocks, sectionId) {
  return blocks.filter((block) => block.sectionId === sectionId).flatMap((block) => block.body).join("\n").trim();
}

function blockLists(blocks, sectionId, max = 100) {
  return blocks
    .filter((block) => block.sectionId === sectionId)
    .flatMap((block) => block.body)
    .map(listItem)
    .filter(Boolean)
    .slice(0, max);
}

function addField(fields, key, value, confidence, excerpt, method = "deterministic") {
  const normalized = normalizeValue(value);
  const present = Array.isArray(normalized) ? normalized.length > 0 : clean(normalized).length > 0;
  if (!present) return;
  if (!fields[key] || confidence > Number(fields[key]?.confidence || 0)) fields[key] = field(normalized, confidence, excerpt, method);
}

function linesMatching(lines, pattern, max = 50) {
  return lines.filter((line) => pattern.test(line)).map(listItem).filter(Boolean).slice(0, max);
}

function parseGradingBreakdown(lines) {
  const weighted = lines
    .map((line) => line.match(/^(.{2,120}?)\s*[:\-–]?\s*(\d{1,3}(?:\.\d+)?)\s*%\s*$/))
    .filter(Boolean)
    .map((match) => ({ category: clean(match[1]), weight: `${match[2]}%` }));
  return weighted;
}

function extractInstitutionBlocks(lines, fields) {
  for (const [key, pattern] of KEYWORD_FIELD_RULES) {
    const matching = linesMatching(lines, pattern, 20);
    if (matching.length) addField(fields, key, matching, 0.72, matching.join(" | "), "keyword_detection");
  }
}

function conflictsFromMatches(matchesByKey) {
  const conflicts = [];
  for (const [key, matches] of Object.entries(matchesByKey)) {
    const unique = Array.from(new Set(matches.map((match) => clean(match.value).toLowerCase()).filter(Boolean)));
    if (unique.length > 1) conflicts.push(`${key.replace(/([A-Z])/g, " $1").toLowerCase()} appears with multiple values: ${unique.join(" | ")}`);
  }
  return conflicts;
}

export function extractDeterministicSyllabus(text, profile = ANGELO_STATE_2026_PROFILE) {
  const normalizedText = String(text || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
  if (!normalizedText) throw new Error("Paste or upload syllabus text before extraction.");
  const lines = sourceLines(normalizedText);
  const blocks = sectionBlocks(normalizedText, profile);
  const fields = {};
  const matchesByKey = {};

  for (const [key, patterns] of Object.entries(DIRECT_PATTERNS)) {
    const matches = allMatches(lines, patterns);
    matchesByKey[key] = matches;
    if (matches[0]) addField(fields, key, matches[0].value, key === "instructorEmail" ? 0.99 : 0.93, matches[0].sourceExcerpt);
  }

  if (!fields.courseTitle) {
    const likelyTitle = lines.find((line) => line.length >= 5 && line.length <= 160 && !/@/.test(line) && !identifyHeading(line, headingLookup(profile)));
    if (likelyTitle) addField(fields, "courseTitle", likelyTitle, 0.55, likelyTitle, "heuristic");
  }

  const description = blockText(blocks, "description");
  if (description) addField(fields, "courseDescription", description, 0.84, description);
  const descriptionLines = blockLists(blocks, "description");
  addField(fields, "prerequisites", linesMatching(descriptionLines, /prerequisite|prior course|required preparation/i), 0.82, description);
  addField(fields, "technicalCompetencies", linesMatching(descriptionLines, /technical|computer|digital|competenc|skill/i), 0.8, description);

  const contact = blockText(blocks, "contact");
  if (contact && !fields.officeHours) {
    const officeLine = sourceLines(contact).find((line) => /office hours?/i.test(line));
    if (officeLine) addField(fields, "officeHours", officeLine.replace(/^.*?office hours?\s*[:\-]?/i, ""), 0.88, officeLine);
  }

  const delivery = blockText(blocks, "delivery");
  if (delivery) {
    if (!fields.deliveryModality) addField(fields, "deliveryModality", delivery, 0.72, delivery, "section_capture");
    const lmsLines = linesMatching(sourceLines(delivery), /blackboard|learning management system|\blms\b/i);
    if (lmsLines.length) addField(fields, "lmsUse", lmsLines, 0.86, lmsLines.join(" | "));
    const interactionLines = linesMatching(sourceLines(delivery), /regular and substantive interaction|instructor interaction|student interaction/i);
    if (interactionLines.length) addField(fields, "onlineInteractionPlan", interactionLines, 0.82, interactionLines.join(" | "));
  }

  const materialLines = blockLists(blocks, "materials", 100);
  addField(fields, "requiredReadings", linesMatching(materialLines, /required reading|required text|required book|textbook/i), 0.84, materialLines.join(" | "));
  addField(fields, "recommendedReadings", linesMatching(materialLines, /recommended reading|recommended text|recommended book/i), 0.84, materialLines.join(" | "));
  addField(fields, "requiredHardware", linesMatching(materialLines, /hardware|computer|laptop|device|webcam|microphone/i), 0.8, materialLines.join(" | "));
  addField(fields, "requiredSoftware", linesMatching(materialLines, /software|application|browser|word processor/i), 0.8, materialLines.join(" | "));
  addField(fields, "requiredSubscriptions", linesMatching(materialLines, /subscription|access code|online service/i), 0.78, materialLines.join(" | "));
  addField(fields, "materialAccess", linesMatching(materialLines, /bookstore|obtain|purchase|available|find/i), 0.78, materialLines.join(" | "));
  if (materialLines.length && !fields.requiredReadings && !fields.recommendedReadings) addField(fields, "supplementalMaterials", materialLines, 0.68, materialLines.join(" | "), "section_capture");

  const outcomes = blockLists(blocks, "outcomes", 50);
  if (outcomes.length) addField(fields, "courseOutcomes", outcomes, 0.88, outcomes.join(" | "));
  const assessmentMethods = linesMatching(lines, /assess(?:ed|ment).*outcome|method.*assess/i, 30);
  if (assessmentMethods.length) addField(fields, "outcomeAssessmentMethods", assessmentMethods, 0.76, assessmentMethods.join(" | "));

  const objectives = blockLists(blocks, "objectives", 50);
  if (objectives.length) addField(fields, "courseObjectives", objectives, 0.86, objectives.join(" | "));

  const gradingLines = blockLists(blocks, "grading", 150);
  const gradeScale = linesMatching(gradingLines, /\bA\b.*\bB\b|\bA\s*[=:].*\d|90\s*[-–]\s*100|system of grading/i, 30);
  if (gradeScale.length) addField(fields, "gradingScale", gradeScale, 0.82, gradeScale.join(" | "));
  const breakdown = parseGradingBreakdown(gradingLines);
  if (breakdown.length) addField(fields, "gradingBreakdown", breakdown, 0.9, gradingLines.join(" | "));
  const assignments = linesMatching(gradingLines.concat(lines), /assignment|paper|project|presentation|discussion board|blog/i, 60);
  if (assignments.length) addField(fields, "majorAssignments", assignments, 0.76, assignments.join(" | "));
  const exams = linesMatching(gradingLines.concat(lines), /exam|examination|midterm|quiz/i, 40);
  if (exams.length) addField(fields, "majorExaminations", exams, 0.76, exams.join(" | "));
  const gradingPolicies = linesMatching(gradingLines, /extra credit|curve|drop(?:ping)? the lowest|participation|late work|make[- ]up/i, 40);
  if (gradingPolicies.length) addField(fields, "gradingPolicies", gradingPolicies, 0.78, gradingPolicies.join(" | "));
  if (!fields.finalAssessmentType) {
    const finalLine = gradingLines.find((line) => /final exam|final examination|culminating (?:activity|experience|project)/i.test(line));
    if (finalLine) addField(fields, "finalAssessmentType", finalLine, 0.86, finalLine);
  }

  const expectationLines = blockLists(blocks, "expectations", 150);
  for (const [key, pattern] of KEYWORD_FIELD_RULES.slice(9, 16)) {
    const matching = linesMatching(expectationLines, pattern, 30);
    if (matching.length) addField(fields, key, matching, 0.8, matching.join(" | "));
  }

  const program = blockText(blocks, "program");
  if (program) addField(fields, "programInformation", program, 0.84, program);

  const institutionLines = blockLists(blocks, "institutionalPolicies", 150);
  extractInstitutionBlocks(institutionLines, fields);

  const additional = blockLists(blocks, "additionalItems", 100);
  if (additional.length) addField(fields, "additionalItems", additional, 0.82, additional.join(" | "));

  const outline = blockLists(blocks, "courseOutline", 200);
  if (outline.length) addField(fields, "courseOutline", outline, 0.86, outline.join(" | "));

  extractInstitutionBlocks(lines, fields);

  const requirementReview = evaluateSyllabusRequirements(fields, profile);
  const knownSections = new Set(profile.sections.map((section) => section.id));
  const uncertainSections = blocks
    .filter((block) => block.body.join(" ").length > 40)
    .filter((block) => block.sectionId === "preamble" || !knownSections.has(block.sectionId))
    .map((block) => `${block.heading}\n${block.body.join("\n")}`.slice(0, 4000))
    .slice(0, 30);

  return {
    sourceText: normalizedText,
    profile: {
      profileKey: profile.profileKey,
      version: profile.version,
      title: profile.title,
    },
    fields,
    requirementReview,
    missingInformation: requirementReview.missingRequired.map((item) => item.label),
    conflictingInformation: conflictsFromMatches(matchesByKey),
    uncertainSections,
    proposedCourseOutline: null,
  };
}

export function mergeSyllabusExtraction(deterministic, aiArtifact, profile = ANGELO_STATE_2026_PROFILE) {
  const aiFields = aiArtifact?.fields || {};
  const knownKeys = new Set(syllabusFieldDefinitions(profile).map((definition) => definition.key));
  const fields = { ...deterministic.fields };
  for (const [key, value] of Object.entries(aiFields)) {
    if (!knownKeys.has(key)) continue;
    if (!fields[key] || Number(value?.confidence || 0) > Number(fields[key]?.confidence || 0)) {
      fields[key] = { ...value, method: "ai_uncertainty_resolution" };
    }
  }
  const requirementReview = evaluateSyllabusRequirements(fields, profile);
  return {
    ...deterministic,
    fields,
    requirementReview,
    missingInformation: Array.from(new Set([
      ...requirementReview.missingRequired.map((item) => item.label),
      ...(aiArtifact?.missingInformation || []),
    ])),
    conflictingInformation: Array.from(new Set([
      ...(deterministic.conflictingInformation || []),
      ...(aiArtifact?.conflictingInformation || []),
    ])),
    proposedCourseOutline: aiArtifact?.proposedCourseOutline || deterministic.proposedCourseOutline || null,
  };
}
