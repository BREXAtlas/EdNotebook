const PRIVATE_SOURCE_PATTERNS = [
  /\bstudent\s+(?:id|number|identifier)\b/i,
  /\b(?:sid|uin)\s*[:#-]\s*[a-z0-9-]{4,}\b/i,
  /\bmy\s+(?:(?:current|final)\s+)?grade\b/i,
  /\b(?:private|direct)\s+messages?\b/i,
  /\b(?:text|email|message)\s+from\s+(?:my\s+)?(?:advisor|professor|teacher)\b/i,
];

function nonEmptyLines(value) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function privateSourceLine(lines) {
  return lines.find((line) =>
    PRIVATE_SOURCE_PATTERNS.some((pattern) => pattern.test(line))
  );
}

function boundedStrings(values, limit, maxLength) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((value) => value.slice(0, maxLength));
}

function stableToken(value) {
  let hash = 2_166_136_261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function buildStudentSemesterInput({
  text,
  analysis,
  extraction,
  timeZone,
}) {
  const lines = nonEmptyLines(text);
  const blockedLine = privateSourceLine(lines);
  if (blockedLine) {
    throw new Error(
      "Remove student IDs, personal grades, or private-message content before governed AI review. No AI request was sent.",
    );
  }

  const uncertainSections = (Array.isArray(analysis) ? analysis : [])
    .filter((line) => line?.line && !line.type)
    .map((line) => String(line.line).trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => line.slice(0, 4000));

  return {
    uncertainSections,
    deterministicFields: {
      courseName: String(extraction?.title || "").trim().slice(0, 500),
      requiredBooks: boundedStrings(extraction?.books, 30, 500),
      learningObjectives: boundedStrings(extraction?.objectives, 30, 500),
      assignments: (Array.isArray(extraction?.assignments)
        ? extraction.assignments
        : []
      )
        .slice(0, 100)
        .map((item) => {
          const sourceLine = Number.isInteger(item?.sourceLine)
            ? item.sourceLine
            : null;
          return {
            title: String(item?.title || "").trim().slice(0, 500),
            course: String(item?.course || "").trim().slice(0, 120),
            due: String(item?.due || "").trim().slice(0, 80),
            sourceLine,
            sourceExcerpt: sourceLine
              ? String(analysis?.[sourceLine - 1]?.line || "").slice(0, 1000)
              : "",
          };
        })
        .filter((item) => item.title),
      timeZone: String(timeZone || "America/Chicago").slice(0, 80),
      humanReviewRequired: true,
      calendarItemsStartUnapproved: true,
    },
  };
}

export function studentArtifactCalendarItems(
  artifact,
  { course, sourceId, parseDate, defaultHours = 1 },
) {
  const groups = [
    ["assignment", artifact?.assignments],
    ["exam", artifact?.exams],
  ];

  return groups.flatMap(([kind, values]) =>
    (Array.isArray(values) ? values : []).flatMap((item, index) => {
      if (item?.date?.confirmed !== false || !item.date.value) return [];
      const rawDate = String(item.date.value).trim();
      const due = parseDate(rawDate);
      if (!due) return [];
      const title = String(item.title || "").trim();
      if (!title) return [];
      const identity = `${kind}\u0000${title.toLowerCase()}\u0000${rawDate}`;
      const importItemKey = `ai-${stableToken(identity)}`;
      return [{
        id: `student-ai-${stableToken(sourceId)}-${importItemKey}-${index}`,
        importSourceId: sourceId,
        importItemKey,
        course,
        title,
        due,
        hours: Number(defaultHours) || 1,
        status: "not-started",
        priority: kind === "exam" ? "high" : "medium",
        description: String(
          item.details ||
            `Unconfirmed ${kind} date from governed syllabus review.`,
        ).slice(0, 2000),
        sourceLine: null,
        sourceExcerpt: String(item.date.sourceExcerpt || "").slice(0, 1000),
        confidence: Number(item.date.confidence) || 0,
        origin: "governed-ai",
        dateConfirmed: false,
      }];
    })
  );
}
