export const SYLLABUS_CALENDAR_CONTRACT_VERSION = "1.0.0";

const REMINDER_PHASES = Object.freeze([
  {
    key: "twoHours",
    milliseconds: 2 * 60 * 60 * 1000,
    trigger: "-PT2H",
    label: "Due within 2 hours",
  },
  {
    key: "twoDays",
    milliseconds: 2 * 24 * 60 * 60 * 1000,
    trigger: "-P2D",
    label: "Due within 48 hours",
  },
  {
    key: "week",
    milliseconds: 7 * 24 * 60 * 60 * 1000,
    trigger: "-P7D",
    label: "Due within 7 days",
  },
]);

function stableToken(value) {
  let hash = 2_166_136_261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function calendarIdentity(item) {
  return [
    cleanText(item.importSourceId, "calendar"),
    cleanText(item.importItemKey, item.id),
    cleanText(item.course),
    cleanText(item.sourceTitle, item.title),
    cleanText(item.sourceDue, item.due),
  ].join("\u0000");
}

export function approveCalendarCandidate(item, approvedAt = new Date()) {
  const sourceDue = cleanText(item?.sourceDue, item?.due);
  const sourceTitle = cleanText(item?.sourceTitle, item?.title);
  return {
    ...item,
    id: cleanText(
      item?.id,
      `calendar-${stableToken(calendarIdentity(item || {}))}`,
    ),
    sourceDue,
    sourceTitle,
    due: cleanText(item?.personalDueOverride, sourceDue),
    title: cleanText(item?.personalTitleOverride, sourceTitle),
    personalDueOverride: cleanText(item?.personalDueOverride) || null,
    personalTitleOverride: cleanText(item?.personalTitleOverride) || null,
    dateConfirmed: true,
    approvedAt: approvedAt.toISOString(),
    calendarContractVersion: SYLLABUS_CALENDAR_CONTRACT_VERSION,
  };
}

export function synchronizeCalendarSourceItem(
  prior,
  incoming,
  approvedAt = new Date(),
) {
  const approved = approveCalendarCandidate(incoming, approvedAt);
  if (!prior) return approved;
  const personalDueOverride = cleanText(prior.personalDueOverride) || null;
  const personalTitleOverride = cleanText(prior.personalTitleOverride) || null;
  return {
    ...approved,
    id: prior.id || approved.id,
    status: prior.status || approved.status,
    personalDueOverride,
    personalTitleOverride,
    due: personalDueOverride || approved.sourceDue,
    title: personalTitleOverride || approved.sourceTitle,
    calendarContractVersion: SYLLABUS_CALENDAR_CONTRACT_VERSION,
  };
}

export function applyPersonalCalendarEdit(item, patch, editedAt = new Date()) {
  const sourceDue = cleanText(item?.sourceDue, item?.due);
  const sourceTitle = cleanText(item?.sourceTitle, item?.title);
  const nextDue = cleanText(patch?.due, item?.due);
  const nextTitle = cleanText(patch?.title, item?.title);
  if (!validDate(nextDue)) {
    throw new Error("Choose a valid personal calendar date and time.");
  }
  return {
    ...item,
    sourceDue,
    sourceTitle,
    due: nextDue,
    title: nextTitle,
    hours: Number(patch?.hours) > 0
      ? Number(patch.hours)
      : Number(item?.hours) || 1,
    personalDueOverride: nextDue === sourceDue ? null : nextDue,
    personalTitleOverride: nextTitle === sourceTitle ? null : nextTitle,
    calendarEditedAt: editedAt.toISOString(),
    calendarContractVersion: SYLLABUS_CALENDAR_CONTRACT_VERSION,
  };
}

export function resetPersonalCalendarEdit(item) {
  return {
    ...item,
    due: cleanText(item?.sourceDue, item?.due),
    title: cleanText(item?.sourceTitle, item?.title),
    personalDueOverride: null,
    personalTitleOverride: null,
    calendarEditedAt: null,
    calendarContractVersion: SYLLABUS_CALENDAR_CONTRACT_VERSION,
  };
}

function durationLabel(milliseconds) {
  const absoluteMinutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (absoluteMinutes < 60) {
    return `${absoluteMinutes} minute${absoluteMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(absoluteMinutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function deriveCalendarWorkflow(item, now = new Date()) {
  if (item?.status === "complete") {
    return {
      stage: "complete",
      rank: 5,
      label: "Complete",
      nextAction: "No reminder needed.",
      millisecondsRemaining: null,
    };
  }
  const due = validDate(item?.due);
  if (!due) {
    return {
      stage: "verify",
      rank: 0,
      label: "Date needs review",
      nextAction: "Verify the date before planning work.",
      millisecondsRemaining: null,
    };
  }
  const remaining = due.getTime() - now.getTime();
  if (remaining < 0) {
    return {
      stage: "rescue",
      rank: 0,
      label: `${durationLabel(Math.abs(remaining))} overdue`,
      nextAction: "Create a recovery plan or contact the instructor.",
      millisecondsRemaining: remaining,
    };
  }
  if (remaining <= 2 * 60 * 60 * 1000) {
    return {
      stage: "submit",
      rank: 1,
      label: `${durationLabel(remaining)} left`,
      nextAction: "Finish the submission check now.",
      millisecondsRemaining: remaining,
    };
  }
  if (remaining <= 2 * 24 * 60 * 60 * 1000) {
    return {
      stage: "focus",
      rank: 2,
      label: `${durationLabel(remaining)} left`,
      nextAction: "Make this a current-work priority.",
      millisecondsRemaining: remaining,
    };
  }
  if (remaining <= 7 * 24 * 60 * 60 * 1000) {
    return {
      stage: "plan",
      rank: 3,
      label: `${durationLabel(remaining)} left`,
      nextAction: "Reserve work time this week.",
      millisecondsRemaining: remaining,
    };
  }
  return {
    stage: "upcoming",
    rank: 4,
    label: `${durationLabel(remaining)} left`,
    nextAction: "Keep it visible in the upcoming plan.",
    millisecondsRemaining: remaining,
  };
}

export function buildDueNotificationCandidates(
  items,
  reminders,
  now = new Date(),
) {
  const currentTime = now.getTime();
  return (Array.isArray(items) ? items : []).flatMap((item) => {
    if (item?.status === "complete") return [];
    const due = validDate(item?.due);
    if (!due) return [];
    const remaining = due.getTime() - currentTime;
    if (remaining < 0) {
      if (!reminders?.rescue) return [];
      return [{
        id: `${item.id}:rescue:${due.toISOString()}`,
        title: `${cleanText(item.course, "Course")} · ${item.title}`,
        body: `${durationLabel(Math.abs(remaining))} overdue. Open EdNotebook to make a recovery plan.`,
        phase: "rescue",
      }];
    }
    const phase = REMINDER_PHASES.find(
      (candidate) =>
        reminders?.[candidate.key] && remaining <= candidate.milliseconds,
    );
    if (!phase) return [];
    return [{
      id: `${item.id}:${phase.key}:${due.toISOString()}`,
      title: `${cleanText(item.course, "Course")} · ${item.title}`,
      body: `${phase.label}. ${deriveCalendarWorkflow(item, now).nextAction}`,
      phase: phase.key,
    }];
  });
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function unescapeIcs(value) {
  return String(value || "")
    .replaceAll("\\n", "\n")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\");
}

function icsDate(value) {
  return validDate(value)
    ?.toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z") || "";
}

function parseIcsDate(value) {
  const match = String(value || "").match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,
  );
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  ).toISOString();
}

export function buildCalendarIcs(
  items,
  {
    calendarName = "EdNotebook reviewed calendar",
    reminders = {},
    now = new Date(),
  } = {},
) {
  const stamp = icsDate(now);
  const events = (Array.isArray(items) ? items : []).flatMap((item) => {
    if (item?.dateConfirmed === false || !validDate(item?.due)) return [];
    const start = validDate(item.due);
    const end = new Date(
      start.getTime() + Math.max(0.5, Number(item.hours) || 0.5) * 60 * 60 *
        1000,
    );
    const uid = `${stableToken(calendarIdentity(item))}@ednotebook.com`;
    const alarms = REMINDER_PHASES.filter(
      (phase) => reminders?.[phase.key],
    ).flatMap((phase) => [
      "BEGIN:VALARM",
      `TRIGGER:${phase.trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(`${item.title} · ${phase.label}`)}`,
      "END:VALARM",
    ]);
    return [[
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcs(`${cleanText(item.course, "Course")} — ${item.title}`)}`,
      `DESCRIPTION:${escapeIcs(item.description || "Reviewed in EdNotebook")}`,
      `X-EDNOTEBOOK-CONTRACT-VERSION:${SYLLABUS_CALENDAR_CONTRACT_VERSION}`,
      `X-EDNOTEBOOK-SOURCE-DUE:${escapeIcs(item.sourceDue || item.due)}`,
      `X-EDNOTEBOOK-SOURCE-TITLE:${escapeIcs(item.sourceTitle || item.title)}`,
      "X-EDNOTEBOOK-DATE-CONFIRMED:TRUE",
      ...alarms,
      "END:VEVENT",
    ].join("\r\n")];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//EdNotebook//Reviewed Syllabus Calendar//EN",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function parseCalendarIcs(
  value,
  { sourceId = `ics-${Date.now()}` } = {},
) {
  const lines = String(value || "")
    .replace(/\r?\n[ \t]/gu, "")
    .split(/\r?\n/gu);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current || line.startsWith("BEGIN:") || line.startsWith("END:")) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const rawKey = line.slice(0, separator);
    const key = rawKey.split(";")[0];
    current[key] = unescapeIcs(line.slice(separator + 1));
  }

  return events.flatMap((event, index) => {
    const exportedDue = cleanText(event["X-EDNOTEBOOK-SOURCE-DUE"]);
    const due = exportedDue || parseIcsDate(event.DTSTART);
    if (!due || !validDate(due)) return [];
    const summary = cleanText(event.SUMMARY, `Imported calendar item ${index + 1}`);
    const [coursePart, ...titleParts] = summary.split(/\s+—\s+/u);
    const title = cleanText(
      event["X-EDNOTEBOOK-SOURCE-TITLE"],
      titleParts.join(" — ") || summary,
    );
    const course = titleParts.length ? coursePart : "Imported calendar";
    const identity = cleanText(
      event.UID,
      `${sourceId}-${index}-${summary}-${due}`,
    );
    return [{
      id: `calendar-import-${stableToken(`${sourceId}-${identity}`)}`,
      importSourceId: sourceId,
      importItemKey: stableToken(identity),
      course,
      title,
      sourceTitle: title,
      due,
      sourceDue: due,
      hours: 1,
      status: "not-started",
      priority: "medium",
      description: cleanText(
        event.DESCRIPTION,
        "Imported from an external calendar file.",
      ),
      sourceLine: null,
      sourceExcerpt: "",
      origin: "calendar-import",
      dateConfirmed: false,
      personalDueOverride: null,
      personalTitleOverride: null,
      calendarContractVersion:
        cleanText(
          event["X-EDNOTEBOOK-CONTRACT-VERSION"],
          SYLLABUS_CALENDAR_CONTRACT_VERSION,
        ),
    }];
  });
}
