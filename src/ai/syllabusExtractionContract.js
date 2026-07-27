import {
  ANGELO_STATE_2026_PROFILE,
  evaluateSyllabusRequirements,
  syllabusFieldDefinitions,
} from "../syllabus/angeloState2026Profile.js";

const BULLET_ARTIFACTS = /[\uF0A7\uF0B7\uF0D8\uFFFD]/gu;
const PAGE_HEADER = /^[A-Z]{2,8}\s+\d{2,5}\s*\|.*\|\s*(?:MOCK|DRAFT)$/i;
const PAGE_FOOTER = /^EdNotebook staging demonstration\s*-\s*not an official university syllabus\s+Page\s+\d+$/i;
const PAGE_ONLY = /^Page\s+\d+$/i;

const EXTRA_HEADINGS = [
  ["course information", "identity"],
  ["course at a glance", "identity"],
  ["instructor contact information", "contact"],
  ["title and name", "contact"],
  ["required readings and media", "materials"],
  ["recommended resources", "materials"],
  ["required hardware software and supplies", "materials"],
  ["course level outcomes and objectives", "outcomes"],
  ["course level outcomes", "outcomes"],
  ["assessment of outcomes", "outcomes"],
  ["course level objectives", "objectives"],
  ["grading scale", "grading"],
  ["grade breakdown", "grading"],
  ["major assignment summary", "grading"],
  ["final examination culminating activity", "grading"],
  ["preparation and participation", "expectations"],
  ["communication and response time", "expectations"],
  ["late work", "expectations"],
  ["academic behavior", "expectations"],
  ["academic behavior and source use", "expectations"],
  ["online conduct", "expectations"],
  ["online conduct and netiquette", "expectations"],
  ["course specific generative ai policy", "expectations"],
  ["generative ai use policy", "expectations"],
  ["accessibility and accommodation process", "expectations"],
  ["additional items resources and procedures", "additionalItems"],
  ["eight week course outline", "courseOutline"],
  ["course scope reference", "scopeReference"],
  ["operational course information", "operationalInformation"],
  ["course record", "courseRecord"],
  ["document control", "documentControl"],
];

const DIRECT_PATTERNS = {
  courseTitle: [
    /^(?:course\s*title|title)\s*[:\-]\s*(.+)$/i,
    /^course\s+[A-Z]{2,8}\s*\d{2,5}(?:-\d{1,4})?\s*[:\-]\s*(.+)$/i,
    /^[A-Z]{2,8}\s*\d{2,5}\s*\|\s*(.+?)\s*\|\s*(?:fall|spring|summer|winter)\b/i,
  ],
  courseCode: [
    /^(?:course\s*(?:number|code)|catalog\s*number)\s*[:\-]\s*(.+)$/i,
    /^course\s+([A-Z]{2,8}\s*\d{2,5})(?:-\d{1,4})?(?:\s*[:\-]|$)/i,
    /^([A-Z]{2,8}\s*\d{2,5})\s*\|/i,
  ],
  sectionNumber: [
    /^(?:section|section\s*number)\s*[:\-]?\s*(.+)$/i,
    /^course\s+[A-Z]{2,8}\s*\d{2,5}-(\d{1,4})(?:\s*[:\-]|$)/i,
  ],
  term: [
    /^(?:term|semester|session)\s*[:\-]?\s*(.+)$/i,
    /^[A-Z]{2,8}\s*\d{2,5}\s*\|\s*.+?\s*\|\s*((?:fall|spring|summer|winter).+?)\s*\|/i,
  ],
  creditHours: [/^(?:credit\s*hours?|credits?)\s*[:\-]?\s*(.+)$/i],
  instructorTitle: [/^(?:instructor\s*title|faculty\s*title)\s*[:\-]?\s*(.+)$/i],
  instructorName: [/^(?:instructor|professor|faculty\s*name)\s*[:\-]\s*(.+)$/i],
  instructorPhone: [/^(?:phone|telephone|office\s*phone)\s*[:\-]?\s*(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})\s*$/i],
  instructorEmail: [/^(?:email|e-mail|asu(?:-style)?\s*email)\s*[:\-]?\s*([^\s]+@[^\s]+)(?:\s.*)?$/i],
  officeLocation: [/^office(?!\s*hours?\b)(?:\s*location)?\s*[:\-]?\s*(.+)$/i],
  officeHours: [/^office\s*hour(?:\s*s)?\s*[:\-]?\s*(.+)$/i],
  otherContact: [/^(?:other\s*contact|other\s*means\s*of\s*contact)\s*[:\-]?\s*(.+)$/i],
  deliveryModality: [/^(?:course\s*delivery|delivery|modality|course\s*format)\s*[:\-]?\s*(.+)$/i],
  meetingTimes: [/^(?:meeting\s*(?:days?\s*and\s*)?times?|meeting\s*pattern|class\s*time)\s*[:\-]?\s*(.+)$/i],
  meetingLocation: [/^(?:meeting\s*location|classroom|room|location)\s*[:\-]?\s*(.+)$/i],
  blackboardCourseId: [/^(?:blackboard\s*(?:course\s*)?(?:id|identifier|key))\s*[:\-]?\s*(.+)$/i],
};

const clean = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const listItem = (line) => clean(String(line || "").replace(/^[-•*\d.)\s]+/u, ""));

function withoutMockParenthetical(value) {
  return clean(value).replace(/\s*\((?:mock|staging)[^)]*\)\s*$/i, "");
}

export function normalizeSyllabusSourceText(value) {
  const rawLines = String(value || "")
    .replaceAll("\u0000", "")
    .replaceAll("\u00a0", " ")
    .replace(BULLET_ARTIFACTS, "•")
    .replace(/\r\n?/gu, "\n")
    .replace(/([\p{L}])-\n(?=[\p{Ll}])/gu, "$1")
    .split("\n");

  const normalized = [];
  for (const rawLine of rawLines) {
    const line = rawLine.replace(/[ \t]+/gu, " ").trim();
    if (!line) {
      if (normalized.at(-1) !== "") normalized.push("");
      continue;
    }
    if (PAGE_HEADER.test(line) || PAGE_FOOTER.test(line) || PAGE_ONLY.test(line)) continue;
    if (/^(?:REQUIRED SECTION(?:\s*-.*)?|REQUIRED AND PROGRAM-OPTIONAL SECTIONS|OPTIONAL BY PROGRAM OR DEPARTMENT)$/i.test(line)) continue;
    if (normalized.at(-1)?.toLowerCase() === line.toLowerCase()) continue;
    normalized.push(line);
  }

  return normalized.join("\n").replace(/\n{3,}/gu, "\n\n").trim();
}

function sourceLines(text) {
  return normalizeSyllabusSourceText(text).split("\n").map((line) => line.trim()).filter(Boolean);
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item === "object" ? item : clean(item)))
      .filter((item) => (item && typeof item === "object" ? true : Boolean(item)));
  }
  if (value && typeof value === "object") return value;
  return clean(value);
}

function field(value, confidence, sourceExcerpt, method = "deterministic") {
  return {
    value: normalizeValue(value),
    confidence,
    sourceExcerpt: clean(sourceExcerpt).slice(0, 1500),
    method,
  };
}

function addField(fields, key, value, confidence, excerpt, method = "deterministic") {
  const normalized = normalizeValue(value);
  const present = Array.isArray(normalized)
    ? normalized.length > 0
    : normalized && typeof normalized === "object"
      ? Object.keys(normalized).length > 0
      : clean(normalized).length > 0;
  if (!present) return;
  if (!fields[key] || confidence > Number(fields[key]?.confidence || 0)) {
    fields[key] = field(normalized, confidence, excerpt, method);
  }
}

function allMatches(lines, patterns) {
  const matches = [];
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const value = clean(match[1] || match[0]);
        if (/[\p{L}\p{N}]/u.test(value)) {
          matches.push({ value, sourceExcerpt: line });
        }
        break;
      }
    }
  }
  return matches;
}

function normalizedHeading(line) {
  return clean(line)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/^[\dIVXLC]+\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function headingLookup(profile) {
  const profileEntries = profile.sections.flatMap((section) => section.headingAliases.map((alias) => ({
    alias: normalizedHeading(alias),
    sectionId: section.id,
    title: section.title,
  })));
  const extraEntries = EXTRA_HEADINGS.map(([alias, sectionId]) => ({
    alias: normalizedHeading(alias),
    sectionId,
    title: alias,
  }));
  return [...profileEntries, ...extraEntries]
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.alias === entry.alias && candidate.sectionId === entry.sectionId) === index)
    .sort((a, b) => b.alias.length - a.alias.length);
}

function identifyHeading(line, lookup) {
  if (!line || line.length > 170) return null;
  const firstLetter = line.match(/\p{L}/u)?.[0] || "";
  if (firstLetter && firstLetter === firstLetter.toLowerCase() && firstLetter !== firstLetter.toUpperCase()) return null;
  const candidate = normalizedHeading(line);
  if (!candidate) return null;
  const exact = lookup.find((entry) => candidate === entry.alias);
  if (exact) return exact;
  if (/[.!?]$/.test(line.trim())) return null;
  if (/\d/.test(candidate) || candidate.length > 80) return null;
  return lookup.find((entry) => {
    const aliasWords = entry.alias.split(" ");
    const candidateWords = candidate.split(" ");
    if (candidate.startsWith(`${entry.alias} `)) {
      return candidateWords.length - aliasWords.length <= 4;
    }
    if (candidate.endsWith(` ${entry.alias}`)) {
      return candidateWords.length - aliasWords.length <= 4;
    }
    return false;
  }) || null;
}

function sectionBlocks(text, profile) {
  const lookup = headingLookup(profile);
  const blocks = [];
  let current = { sectionId: "preamble", title: "Preamble", heading: "Preamble", headingNormalized: "preamble", body: [] };
  for (const line of sourceLines(text)) {
    const heading = identifyHeading(line, lookup);
    if (heading) {
      if (current.body.length) blocks.push(current);
      current = {
        sectionId: heading.sectionId,
        title: heading.title,
        heading: line,
        headingNormalized: normalizedHeading(line),
        body: [],
      };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length) blocks.push(current);
  return blocks;
}

function blocksFor(blocks, sectionId, headingPattern = null) {
  return blocks.filter((block) => block.sectionId === sectionId && (!headingPattern || headingPattern.test(block.headingNormalized)));
}

function mergeWrappedLines(lines) {
  const merged = [];
  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    const startsNewItem = /^(?:[•*-]|\d+[.)]\s|[A-F]\s+\d|(?:Week|Wk)\s+\d+|\d+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|[A-Z].*\b\d{1,3}(?:\.\d+)?%)/i.test(line);
    if (!merged.length || startsNewItem) {
      merged.push(line);
      continue;
    }
    const previous = merged.at(-1);
    const previousEndsSentence = /[.!?:;)]$/.test(previous);
    const currentLooksNewSentence = /^[A-Z][A-Za-z]/.test(line);
    if (previousEndsSentence && currentLooksNewSentence) {
      merged.push(line);
    } else {
      merged[merged.length - 1] = `${previous}${previous.endsWith("-") ? "" : " "}${line}`;
    }
  }
  return merged;
}

function blockLines(blocks, sectionId, headingPattern = null, max = 250) {
  return blocksFor(blocks, sectionId, headingPattern)
    .flatMap((block) => mergeWrappedLines(block.body))
    .map(listItem)
    .filter(Boolean)
    .slice(0, max);
}

function blockLinesRaw(blocks, sectionId, headingPattern = null, max = 250) {
  return blocksFor(blocks, sectionId, headingPattern)
    .flatMap((block) => mergeWrappedLines(block.body))
    .map(clean)
    .filter(Boolean)
    .slice(0, max);
}

function blockText(blocks, sectionId, headingPattern = null) {
  return blockLines(blocks, sectionId, headingPattern).join("\n").trim();
}

function linesMatching(lines, pattern, max = 50) {
  return lines.filter((line) => pattern.test(line)).map(listItem).filter(Boolean).slice(0, max);
}

function labeledValueWithContinuation(lines, labelPattern, stopPattern) {
  const index = lines.findIndex((line) => labelPattern.test(line));
  if (index < 0) return null;
  const first = lines[index];
  const initial = clean(first.replace(labelPattern, ""));
  let value = /^s$/i.test(initial) ? "" : initial;
  let excerpt = first;
  for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
    const next = lines[cursor];
    if (stopPattern.test(next)) break;
    if (!value && /^s$/i.test(next)) {
      excerpt += ` | ${next}`;
      continue;
    }
    const shouldContinue = !value
      || /(?:and|or|by|through|excluding|,|;)$/i.test(value)
      || /^[a-z(]/.test(next)
      || next.length < 24;
    if (!shouldContinue) break;
    value = `${value} ${next}`.trim();
    excerpt += ` | ${next}`;
  }
  return { value, excerpt };
}

function parseCourseIdentity(lines, fields, matchesByKey) {
  const courseLine = lines.find((line) => /^course\s+[A-Z]{2,8}\s*\d{2,5}(?:-\d{1,4})?\s*[:\-]/i.test(line));
  if (courseLine) {
    const match = courseLine.match(/^course\s+([A-Z]{2,8}\s*\d{2,5})(?:-(\d{1,4}))?\s*[:\-]\s*(.+)$/i);
    if (match) {
      addField(fields, "courseCode", match[1], 0.99, courseLine);
      if (match[2]) addField(fields, "sectionNumber", match[2], 0.99, courseLine);
      addField(fields, "courseTitle", match[3], 0.98, courseLine);
    }
  }

  const titleAndName = lines.find((line) => /^title\s+and\s+name\s+/i.test(line));
  const professorLine = lines.find((line) => (
    /^(?:professor|dr\.?)\s+[\p{L}]/iu.test(line)
    || /^instructor\s+(?!title\b)[\p{L}]/iu.test(line)
  ));
  const identityLine = titleAndName || professorLine;
  if (identityLine) {
    const stripped = identityLine.replace(/^title\s+and\s+name\s+/i, "");
    const match = stripped.match(/^(Professor|Dr\.?|Instructor|Lecturer|Adjunct Professor|Assistant Professor|Associate Professor)\s+(.+)$/i);
    if (match) {
      addField(fields, "instructorTitle", match[1], 0.98, identityLine);
      addField(fields, "instructorName", withoutMockParenthetical(match[2]), 0.98, identityLine);
    }
  }

  for (const [key, patterns] of Object.entries(DIRECT_PATTERNS)) {
    const matches = allMatches(lines, patterns);
    matchesByKey[key] = matches;
    if (!matches[0]) continue;
    const value = ["courseTitle", "instructorName"].includes(key)
      ? withoutMockParenthetical(matches[0].value)
      : matches[0].value;
    addField(fields, key, value, key === "instructorEmail" ? 0.99 : 0.94, matches[0].sourceExcerpt);
  }

  const officeHours = labeledValueWithContinuation(
    lines,
    /^office\s*hour(?:\s*s)?\s*[:\-]?\s*/i,
    /^(?:other\s*contact|response\s*time|course\s*delivery|texts?\s*and\s*materials|description|requisites?)\b/i,
  );
  if (officeHours) addField(fields, "officeHours", officeHours.value, 0.98, officeHours.excerpt, "labeled_continuation");
}

function parseMaterials(blocks, fields) {
  const all = blockLines(blocks, "materials", null, 180);
  const requiredReadingLines = blockLines(blocks, "materials", /required readings?(?: and media)?/, 60);
  const recommendedLines = blockLines(blocks, "materials", /recommended (?:readings?|resources?)/, 40);
  const hardwareBlock = blockLines(blocks, "materials", /required hardware software and supplies/, 80);

  const requiredReadings = requiredReadingLines.length
    ? requiredReadingLines.filter((line) => !/^(required hardware|recommended resources)/i.test(line))
    : linesMatching(all, /required reading|required text|required book|textbook|course media reader/i, 40);
  const recommendedReadings = recommendedLines.length
    ? recommendedLines
    : linesMatching(all, /recommended reading|recommended text|recommended book|recommended resources?/i, 40);
  if (requiredReadings.length) addField(fields, "requiredReadings", requiredReadings, 0.92, requiredReadings.join(" | "));
  if (recommendedReadings.length) addField(fields, "recommendedReadings", recommendedReadings, 0.92, recommendedReadings.join(" | "));

  const hardware = linesMatching(hardwareBlock.concat(all), /laptop|tablet|desktop|computer|headphones|earbuds|device|webcam|microphone/i, 30);
  const software = linesMatching(hardwareBlock.concat(all), /browser|blackboard|ednotebook|presentation software|image[- ]editing|word processor|application|software/i, 30);
  const subscriptions = linesMatching(hardwareBlock.concat(all), /subscription|access code|paid streaming|online service/i, 20);
  const supplemental = linesMatching(all, /worksheet|sketchbook|guide|survey index|suppl(?:y|ies)|headphones|earbuds|annotation/i, 40);
  const access = linesMatching(requiredReadingLines.concat(all), /provided through|blackboard|bookstore|library access|licensed clips|alternate viewing|no additional charge|where .* obtain|available through/i, 30);

  if (hardware.length) addField(fields, "requiredHardware", hardware, 0.88, hardware.join(" | "));
  if (software.length) addField(fields, "requiredSoftware", software, 0.88, software.join(" | "));
  if (subscriptions.length) addField(fields, "requiredSubscriptions", subscriptions, 0.86, subscriptions.join(" | "));
  else if (all.some((line) => /no paid .*subscription.*required/i.test(line))) {
    const explicitNone = all.find((line) => /no paid .*subscription.*required/i.test(line));
    addField(fields, "requiredSubscriptions", [explicitNone], 0.94, explicitNone);
  }
  if (supplemental.length) addField(fields, "supplementalMaterials", supplemental, 0.84, supplemental.join(" | "));
  if (access.length) addField(fields, "materialAccess", access, 0.86, access.join(" | "));
}

function parseGradingBreakdown(lines) {
  return lines
    .map((line) => {
      const match = line.match(/^(.{2,120}?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)\b/);
      if (match) return { category: clean(match[1]), weight: `${match[2]}%`, points: match[3] };
      const simple = line.match(/^(.{2,120}?)\s+(\d{1,3}(?:\.\d+)?)%\s*$/);
      return simple ? { category: clean(simple[1]), weight: `${simple[2]}%` } : null;
    })
    .filter(Boolean);
}

function parseFinalAssessment(lines, blocks, fields) {
  const summaryLine = lines.find((line) => /^final\/culminating activity\s+/i.test(line));
  const finalBlockLines = blockLines(blocks, "grading", /final examination culminating activity/, 30);
  const combined = [summaryLine, ...finalBlockLines].filter(Boolean);
  const directFinalAssessment = lines.find((line) => /^final\s*assessment\s*[:\-]\s*/i.test(line));
  const narrative = combined.find((line) => /culminating|final exam|final examination/i.test(line)) || directFinalAssessment;
  if (narrative) {
    addField(
      fields,
      "finalAssessmentType",
      directFinalAssessment ? directFinalAssessment.replace(/^final\s*assessment\s*[:\-]\s*/i, "") : narrative,
      0.94,
      narrative,
    );
  }

  const joined = combined.join(" ");
  const date = joined.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i)
    || joined.match(/\b([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i);
  const time = joined.match(/\b(\d{1,2}:\d{2}(?:\s*(?:a\.?m\.?|p\.?m\.?))?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?))/i);
  const location = joined.match(/\b(?:in|at)\s+((?:Media|Academic|Library|Science|Business|Education|Building|Room)[^.;]{2,100})/i);
  if (date) addField(fields, "finalExamDate", date[1], 0.9, joined);
  if (time) addField(fields, "finalExamTime", time[1], 0.9, joined);
  if (location) addField(fields, "finalExamLocation", location[1], 0.86, joined);
}

function parseExpectations(blocks, fields) {
  const rules = [
    ["attendanceExpectations", /attendance/i],
    ["participationExpectations", /preparation and participation|participation/i],
    ["communicationExpectations", /communication and response time|communication/i],
    ["academicBehaviorExpectations", /academic behavior and source use|academic behavior/i],
    ["onlineConductExpectations", /online conduct and netiquette|netiquette|online conduct/i],
    ["aiUsePolicy", /course specific generative ai policy|generative ai use policy|ai use policy|ai use limited and disclosed|generative ai/i],
    ["accessibilityProcess", /accessibility and accommodation process|accessibility|accommodation/i],
  ];
  const allExpectationLines = blockLines(blocks, "expectations", null, 180);
  for (const [key, pattern] of rules) {
    const value = blockText(blocks, "expectations", pattern);
    if (value) {
      addField(fields, key, value, 0.9, value, "section_capture");
      continue;
    }
    const fallback = linesMatching(allExpectationLines, pattern, 30);
    if (fallback.length) addField(fields, key, fallback, 0.8, fallback.join(" | "), "keyword_detection");
  }
}

function parseInstitutionBlocks(blocks, fields) {
  const all = blockLines(blocks, "institutionalPolicies", null, 180);
  const rules = [
    ["institutionalAcademicIntegrity", /academic integrity|honor code/i],
    ["institutionalDisability", /students? with disabilities|reasonable accommodation/i],
    ["institutionalTitleIX", /title ix|sexual misconduct|sexual harassment/i],
    ["institutionalReligiousHolyDay", /religious holy day|religious observance/i],
    ["studentHandbookLink", /student handbook|https?:\/\/.*handbook/i],
  ];
  for (const [key, pattern] of rules) {
    const matching = linesMatching(all, pattern, 20);
    if (matching.length) addField(fields, key, matching, 0.8, matching.join(" | "), "institution_source_detected");
  }
}

function conflictsFromMatches(matchesByKey) {
  const conflictSensitiveKeys = new Set([
    "courseCode",
    "sectionNumber",
    "instructorPhone",
    "instructorEmail",
    "blackboardCourseId",
  ]);
  const conflicts = [];
  for (const [key, matches] of Object.entries(matchesByKey)) {
    if (!conflictSensitiveKeys.has(key)) continue;
    const unique = Array.from(new Set(matches.map((match) => clean(match.value).toLowerCase()).filter(Boolean)));
    if (unique.length > 1) {
      conflicts.push(`${key.replace(/([A-Z])/g, " $1").toLowerCase()} appears with multiple values: ${unique.join(" | ")}`);
    }
  }
  return conflicts;
}

export function extractDeterministicSyllabus(text, profile = ANGELO_STATE_2026_PROFILE) {
  const normalizedText = normalizeSyllabusSourceText(text);
  if (!normalizedText) throw new Error("Paste or upload syllabus text before extraction.");
  const lines = sourceLines(normalizedText);
  const blocks = sectionBlocks(normalizedText, profile);
  const fields = {};
  const matchesByKey = {};

  parseCourseIdentity(lines, fields, matchesByKey);

  const description = blockText(blocks, "description", /^(?:course )?description$/);
  if (description) addField(fields, "courseDescription", description, 0.92, description, "section_capture");
  const prerequisiteText = [
    blockText(blocks, "description", /requisites?|prerequisites?/),
    blockText(blocks, "description", /^(?:course )?description$/),
  ].filter(Boolean).join("\n");
  const prerequisiteLines = linesMatching(sourceLines(prerequisiteText), /no formal course prerequisite|prerequisite|prepared for|required preparation|college[- ]level/i, 30);
  if (prerequisiteLines.length) addField(fields, "prerequisites", prerequisiteLines, 0.9, prerequisiteLines.join(" | "));
  const technicalLines = linesMatching(sourceLines(prerequisiteText), /technical|browser|blackboard|ednotebook|pdf|upload files?|software|skills?|competenc/i, 30);
  if (technicalLines.length) addField(fields, "technicalCompetencies", technicalLines, 0.88, technicalLines.join(" | "));

  const delivery = blockLines(blocks, "delivery", null, 100);
  if (!fields.deliveryModality) {
    const deliveryNarrative = delivery.find((line) => /in person|online|hybrid|asynchronous|synchronous/i.test(line));
    if (deliveryNarrative) addField(fields, "deliveryModality", deliveryNarrative, 0.86, deliveryNarrative);
  }
  const lmsLines = linesMatching(delivery, /blackboard|learning management system|ednotebook/i, 30);
  if (lmsLines.length) addField(fields, "lmsUse", lmsLines, 0.88, lmsLines.join(" | "));
  const interactionLines = linesMatching(delivery, /regular and substantive interaction|instructor-led meetings|individualized feedback|guided discussions/i, 30);
  if (interactionLines.length) addField(fields, "onlineInteractionPlan", interactionLines, 0.88, interactionLines.join(" | "));

  parseMaterials(blocks, fields);

  const specificOutcomeLines = blockLines(blocks, "outcomes", /^course level outcomes$/, 80);
  const outcomeSource = specificOutcomeLines.length
    ? specificOutcomeLines
    : blockLines(blocks, "outcomes", null, 100);
  const outcomeLines = outcomeSource
    .filter((line) => !/assessment of outcomes|assessment methods?/i.test(line))
    .filter((line) => /^\d+[.)]?\s+/.test(line) || /^(identify|analy[sz]e|compare|evaluate|create|communicate|demonstrate|explain|describe)\b/i.test(line));
  if (outcomeLines.length) addField(fields, "courseOutcomes", outcomeLines, 0.92, outcomeLines.join(" | "));
  const assessmentSpecific = blockLines(blocks, "outcomes", /assessment of outcomes/, 50);
  const assessmentLines = assessmentSpecific.length
    ? assessmentSpecific
    : linesMatching(outcomeSource, /assessment methods?|assess(?:ed|ment).*outcome|weekly checks|scene analyses|final project/i, 40);
  if (assessmentLines.length) addField(fields, "outcomeAssessmentMethods", assessmentLines, 0.92, assessmentLines.join(" | "));
  const objectiveSource = blockLines(blocks, "objectives", /course level objectives|objectives/, 80);
  const objectiveLines = objectiveSource
    .filter((line) => /^\d+[.)]?\s+/.test(line) || /^(identify|describe|compare|construct|defend|design|demonstrate|explain)\b/i.test(line));
  if (objectiveLines.length) addField(fields, "courseObjectives", objectiveLines, 0.9, objectiveLines.join(" | "));

  const allGradingLines = blockLines(blocks, "grading", null, 200);
  const gradingScaleSpecific = blockLines(blocks, "grading", /grading scale/, 20);
  const gradingScale = gradingScaleSpecific.length
    ? gradingScaleSpecific
    : linesMatching(allGradingLines, /^(?:A|B|C|D|F)\s*(?:=|\b).*\d|90\s*[-–]\s*100|below 60/i, 20);
  if (gradingScale.length) addField(fields, "gradingScale", gradingScale, 0.92, gradingScale.join(" | "));
  const breakdownSpecific = blockLinesRaw(blocks, "grading", /grade breakdown/, 80);
  const breakdownLines = breakdownSpecific.length ? breakdownSpecific : allGradingLines;
  const breakdown = parseGradingBreakdown(breakdownLines);
  if (breakdown.length) addField(fields, "gradingBreakdown", breakdown, 0.94, breakdownLines.join(" | "));
  const assignmentSpecific = blockLines(blocks, "grading", /major assignment summary/, 80);
  const assignmentLines = assignmentSpecific.length
    ? assignmentSpecific
    : linesMatching(allGradingLines, /assignment|paper|project|presentation|discussion board|portfolio|memo|connection map/i, 80);
  if (assignmentLines.length) addField(fields, "majorAssignments", assignmentLines, 0.92, assignmentLines.join(" | "));
  const examLines = linesMatching(blockLines(blocks, "grading", null, 180), /midterm|quiz|exam|examination|culminating presentation/i, 30);
  if (examLines.length) addField(fields, "majorExaminations", examLines, 0.84, examLines.join(" | "));
  else if (blockText(blocks, "grading", /final examination culminating activity/)) {
    addField(fields, "majorExaminations", ["No traditional examination; the course uses the documented culminating activity."], 0.9, blockText(blocks, "grading", /final examination culminating activity/));
  }
  const gradingPolicyLines = linesMatching(
    allGradingLines.concat(blockLines(blocks, "expectations", /late work|attendance|participation/, 80)),
    /extra credit|curve|late work|make[- ]up|drop(?:ping)? the lowest|participation credit|grade loss|deduction|submitted up to|absences may reduce/i,
    40,
  );
  if (gradingPolicyLines.length) addField(fields, "gradingPolicies", gradingPolicyLines, 0.86, gradingPolicyLines.join(" | "));
  parseFinalAssessment(lines, blocks, fields);

  parseExpectations(blocks, fields);
  parseInstitutionBlocks(blocks, fields);

  const programText = blockText(blocks, "program");
  if (programText) addField(fields, "programInformation", programText, 0.82, programText);
  const additionalLines = blockLines(blocks, "additionalItems", null, 160);
  if (additionalLines.length) addField(fields, "additionalItems", additionalLines, 0.86, additionalLines.join(" | "));
  const outlineLines = blockLinesRaw(blocks, "courseOutline", null, 240)
    .filter((line) => !/^wk\s+date\s+lecture/i.test(line));
  if (outlineLines.length) addField(fields, "courseOutline", outlineLines, 0.94, outlineLines.join(" | "));

  const responseLine = lines.find((line) => /^response time\s+/i.test(line));
  if (responseLine && !fields.communicationExpectations) addField(fields, "communicationExpectations", responseLine, 0.82, responseLine);

  const requirementReview = evaluateSyllabusRequirements(fields, profile);
  const knownSections = new Set(profile.sections.map((section) => section.id));
  const uncertainSections = blocks
    .filter((block) => block.body.join(" ").length > 80)
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
    proposedCourseOutline: fields.courseOutline?.value || null,
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
