import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import FullscreenSurface from "../FullscreenSurface.jsx";
import { dateKey, formatDateTime, NotebookLabel } from "./demoShared.jsx";
import { extractSyllabusFile, MAX_EXTRACTED_CHARACTERS } from "./syllabusFileExtractors.js";
import "./demo.css";
import "./syllabus-review.css";

const SyllabusScanner = lazy(() => import("./SyllabusScanner.jsx"));

const MONTH_TOKENS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const LINE_LABELS = {
  title: "Course title",
  heading: "Section",
  objective: "Objective",
  material: "Book or material",
  assignment: "Calendar item",
};

const REVIEW_PAGES = [
  { id: "source", label: "Source & highlights" },
  { id: "review", label: "Calendar review" },
];

function defaultParameters(persona) {
  return {
    course: persona.classes[0]?.code || "COURSE",
    defaultYear: new Date().getFullYear(),
    defaultTime: "23:59",
    defaultHours: 2,
    timeZone: "America/Chicago",
    requireDeadlineWords: true,
  };
}

function defaultSyllabusText(persona) {
  if (persona.id === "k12") return `ACCOUNTING I\nRequired text: Introduction to Accounting course packet\nLearning objectives:\n- Explain the accounting cycle\n- Prepare journals, ledgers, and a trial balance\n- Discuss ethics and accounting careers\nAssignments:\nJournal entries case due September 22, 2026 at 3:30 PM\nCareer interview due October 6, 2026 at 8:00 AM`;
  if (persona.id === "professor") return `TRANSFORMATIVE TEACHING — EDUC 5302\nRequired reading: Teaching for Transformation\nLearning objectives:\n- Design learner-centered experiences\n- Evaluate inclusive teaching strategies\n- Use workspace assistants thoughtfully in course preparation\nAssignments:\nTeaching philosophy statement due August 21, 2026 at 5:00 PM\nLearning design prototype due September 11, 2026 at 11:59 PM`;
  return `PRINCIPLES OF MARKETING — MKTG 2301\nRequired book: Principles of Marketing, 19th edition\nLearning objectives:\n- Analyze customer value and market segments\n- Explain positioning and ethical promotion\n- Build a basic marketing plan\nAssignments:\nMarketing reflection draft due August 21, 2026 at 11:59 PM\nAudience analysis due September 4, 2026 at 5:00 PM`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function stableToken(value) {
  let hash = 2_166_136_261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function syllabusSourceId(personaId, name, course, instanceToken = "") {
  const sourceScope = `${String(course || "course").trim().toLowerCase()}\u0000${String(name || "sample").trim().toLowerCase()}`;
  const normalizedInstance = String(instanceToken || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 96);
  const instanceSuffix = normalizedInstance ? `-${normalizedInstance}` : "";
  return `syllabus-${personaId}-${stableToken(sourceScope)}${instanceSuffix}`;
}

function sourceInstanceToken(sequence) {
  const uniquePart = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${uniquePart}-${Number(sequence || 0).toString(36)}`;
}

function clockFromText(value, { beforeDate = false } = {}) {
  const suffix = beforeDate ? String(value || "").slice(-48) : String(value || "");
  const ending = beforeDate ? "(?:\\s+(?:on|for))?[\\s,;@-]*$" : "\\b";
  const clock = suffix.match(new RegExp(`(?:\\bat\\b|@|\\bby\\b)?\\s*(\\d{1,2}):(\\d{2})\\s*(AM|PM)?${ending}`, "i"));
  if (clock) return { hour: Number(clock[1]), minute: Number(clock[2]), meridiem: clock[3]?.toUpperCase() || "" };
  const hourOnly = suffix.match(new RegExp(`(?:\\bat\\b|@|\\bby\\b)?\\s*(\\d{1,2})\\s*(AM|PM)${ending}`, "i"));
  if (hourOnly) return { hour: Number(hourOnly[1]), minute: 0, meridiem: hourOnly[2].toUpperCase() };
  return null;
}

function offsetMinutesAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
  const displayedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((displayedAsUtc - instant.getTime()) / 60_000);
}

function timeZoneOffset({ year, month, day, hour, minute }, timeZone) {
  if (timeZone === "UTC") return "Z";
  const localAsUtc = Date.UTC(year, month, day, hour, minute, 0);
  let offsetMinutes = offsetMinutesAt(new Date(localAsUtc), timeZone);
  offsetMinutes = offsetMinutesAt(new Date(localAsUtc - offsetMinutes * 60_000), timeZone);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function parseDateFromLine(line, parameters) {
  const value = String(line || "");
  let match = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/u);
  let year;
  let month;
  let day;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
    day = Number(match[3]);
  } else {
    match = value.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/u);
    if (match) {
      month = Number(match[1]) - 1;
      day = Number(match[2]);
      year = Number(match[3]);
      if (year < 100) year += 2000;
    } else {
      const monthNames = Object.keys(MONTH_TOKENS).sort((first, second) => second.length - first.length).join("|");
      match = value.match(new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{2,4}))?\\b`, "i"));
      if (!match) return null;
      month = MONTH_TOKENS[match[1].toLowerCase()];
      day = Number(match[2]);
      year = Number(match[3] || parameters.defaultYear);
      if (year < 100) year += 2000;
    }
  }

  const fallbackTime = String(parameters.defaultTime || "23:59").split(":");
  const trailingText = value.slice((match.index || 0) + match[0].length);
  const leadingText = value.slice(0, match.index || 0);
  const parsedClock = clockFromText(trailingText) || clockFromText(leadingText, { beforeDate: true });
  let hour = parsedClock ? parsedClock.hour : Number(fallbackTime[0]);
  const minute = parsedClock ? parsedClock.minute : Number(fallbackTime[1]);
  const meridiem = parsedClock?.meridiem;
  if (meridiem && (hour < 1 || hour > 12)) return null;
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const calendarCheck = new Date(Date.UTC(year, month, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month || calendarCheck.getUTCDate() !== day) return null;
  const offset = timeZoneOffset({ year, month, day, hour, minute }, parameters.timeZone);
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`;
}

function analyzeSyllabusLines(text, parameters) {
  let activeSection = "";
  let foundTitle = false;
  return text.split(/\r?\n/).map((raw, index) => {
    const line = raw.trim();
    let type = "";
    if (line && !foundTitle) {
      type = "title";
      foundTitle = true;
    } else if (/^(learning\s+)?objectives?\s*:?$/i.test(line)) {
      activeSection = "objective";
      type = "heading";
    } else if (/^(assignments?|deadlines?|course\s+schedule)\s*:?$/i.test(line)) {
      activeSection = "assignment";
      type = "heading";
    } else if (/required\s+(book|text|reading)|textbook|course\s+materials?/i.test(line)) {
      type = "material";
    } else {
      const parsedDate = parseDateFromLine(line, parameters);
      const hasDeadlineWord = /\bdue\b|\bdeadline\b|\bsubmit(?:ted)?\s+by\b/i.test(line);
      if (parsedDate && (hasDeadlineWord || !parameters.requireDeadlineWords || activeSection === "assignment")) type = "assignment";
      else if (/^[-•*]/.test(line) && activeSection === "objective") type = "objective";
    }
    return { index, raw, line, type, label: LINE_LABELS[type] || "Not converted" };
  });
}

function extractSyllabus(text, persona, parameters, sourceId) {
  const analysis = analyzeSyllabusLines(text, parameters);
  const detected = analysis.filter((line) => line.line);
  const title = detected.find((line) => line.type === "title")?.line || `${persona.classes[0].title} syllabus`;
  const bookLines = detected.filter((line) => line.type === "material");
  const objectiveLines = detected.filter((line) => line.type === "objective");
  const assignmentLines = detected.filter((line) => line.type === "assignment");
  const itemOccurrences = new Map();
  const extractedAssignments = assignmentLines.map((line, index) => {
    const due = parseDateFromLine(line.line, parameters) || persona.assignments[index]?.due || `${parameters.defaultYear}-09-15T${parameters.defaultTime}:00-05:00`;
    const titlePart = line.line.split(/\s+(?:is\s+)?due\s+|\s+deadline\s*:?\s*|\s+submit(?:ted)?\s+by\s+/i)[0] || `Extracted assignment ${index + 1}`;
    const identityText = titlePart.trim().toLowerCase().replace(/\s+/g, " ") || `item-${index + 1}`;
    const occurrence = (itemOccurrences.get(identityText) || 0) + 1;
    itemOccurrences.set(identityText, occurrence);
    const importItemKey = `${stableToken(identityText)}-${occurrence}`;
    return {
      id: `extract-${stableToken(sourceId)}-${importItemKey}`,
      importSourceId: sourceId,
      importItemKey,
      course: parameters.course,
      title: titlePart.trim(),
      due,
      hours: Number(parameters.defaultHours) || 1,
      status: "not-started",
      priority: index === 0 ? "high" : "medium",
      description: `Reviewed from source line ${line.index + 1}.`,
      sourceLine: line.index + 1,
    };
  });
  return {
    title,
    themes: persona.id === "professor" ? ["Transformative leadership", "Inclusive teaching", "Thoughtful technology use"] : persona.id === "k12" ? ["Accounting cycle", "Financial statements", "Career readiness"] : ["Customer value", "Market segments", "Ethical promotion"],
    objectives: objectiveLines.length ? objectiveLines.map((line) => line.line.replace(/^[-•*]\s*/, "")) : ["Add or correct learning objectives in the source review."],
    books: bookLines.length ? bookLines.map((line) => line.line.replace(/^Required (book|text|reading):\s*/i, "")) : ["No required material confidently detected"],
    assignments: extractedAssignments,
    detectedLines: analysis.filter((line) => line.type && line.type !== "heading").map((line) => line.index + 1),
  };
}

function toDateTimeInput(value) {
  return String(value || "").slice(0, 16);
}

function withTimeZoneOffset(value, timeZone) {
  if (!value) return value;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match.map(Number);
  return `${value}:00${timeZoneOffset({ year, month: month - 1, day, hour, minute }, timeZone)}`;
}

function ParameterControls({ parameters, setParameters }) {
  function update(key, value) {
    setParameters((current) => ({ ...current, [key]: value }));
  }
  return (
    <div className="syllabus-parameter-grid">
      <label>Course code<input value={parameters.course} onChange={(event) => update("course", event.target.value)} /></label>
      <label>Year when omitted<input type="number" min="2000" max="2100" value={parameters.defaultYear} onChange={(event) => update("defaultYear", Number(event.target.value))} /></label>
      <label>Time when omitted<input type="time" value={parameters.defaultTime} onChange={(event) => update("defaultTime", event.target.value)} /></label>
      <label>Default effort<input type="number" min="0.25" max="40" step="0.25" value={parameters.defaultHours} onChange={(event) => update("defaultHours", Number(event.target.value))} /></label>
      <label>Source time zone<select value={parameters.timeZone} onChange={(event) => update("timeZone", event.target.value)}><option value="America/Chicago">Central</option><option value="America/New_York">Eastern</option><option value="America/Denver">Mountain</option><option value="America/Los_Angeles">Pacific</option><option value="UTC">UTC</option></select></label>
      <label className="syllabus-parameter-toggle"><input type="checkbox" checked={parameters.requireDeadlineWords} onChange={(event) => update("requireDeadlineWords", event.target.checked)} /><span><strong>Strict date detection</strong>Only convert dated lines that look like assignments.</span></label>
    </div>
  );
}

function DetectedLinePreview({ analysis }) {
  const detected = analysis.filter((line) => line.type);
  return (
    <div className="syllabus-detection-preview">
      <div><strong>Highlighted source map</strong><span>{detected.length} detected lines</span></div>
      {detected.length ? <ol>{detected.slice(0, 12).map((line) => <li className={`is-${line.type}`} key={`${line.index}-${line.raw}`}><span>{line.index + 1}</span><p>{line.raw || "Blank line"}</p><small>{line.label}</small></li>)}</ol> : <p>No conversion lines are highlighted yet. Add a course title, objectives, materials, or dated assignments.</p>}
    </div>
  );
}

function EditableLineEditor({ text, onChange, analysis }) {
  const lines = text.split(/\r?\n/);
  function updateLine(index, value) {
    const next = [...lines];
    next[index] = value;
    onChange(next.join("\n"));
  }
  return (
    <div className="syllabus-line-editor" aria-label="Editable highlighted syllabus source">
      <header><span>Line</span><span>Editable source text</span><span>Conversion</span></header>
      {lines.map((line, index) => {
        const detected = analysis[index];
        return <label className={detected?.type ? `is-${detected.type}` : ""} key={index}><span>{index + 1}</span><textarea spellCheck rows={Math.max(1, Math.ceil(line.length / 100))} value={line} onChange={(event) => updateLine(index, event.target.value)} aria-label={`Source line ${index + 1}`} /><small>{detected?.type ? detected.label : "—"}</small></label>;
      })}
      <button type="button" onClick={() => onChange(`${text}${text.endsWith("\n") ? "" : "\n"}`)}>+ Add source line</button>
    </div>
  );
}

function EditableList({ title, values, onChange }) {
  function update(index, value) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? value : item));
  }
  return (
    <article className="syllabus-editable-list">
      <strong>{title}</strong>
      {values.map((item, index) => <div key={index}><input value={item} onChange={(event) => update(index, event.target.value)} /><button type="button" aria-label={`Remove ${title} item ${index + 1}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}
      <button type="button" onClick={() => onChange([...values, ""])}>+ Add item</button>
    </article>
  );
}

function ExtractionReview({ extraction, setExtraction, approved, setApproved, parameters, onAddAssignment }) {
  if (!extraction) return <div className="syllabus-empty-review"><strong>No review draft yet.</strong><p>Check the highlighted source, then run the extraction to create editable calendar rows.</p></div>;
  function updateAssignment(id, patch) {
    setExtraction((current) => ({ ...current, assignments: current.assignments.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }
  function removeAssignment(id) {
    setExtraction((current) => ({ ...current, assignments: current.assignments.filter((item) => item.id !== id) }));
    setApproved((current) => current.filter((item) => item !== id));
  }
  return (
    <div className="syllabus-extraction-editor">
      <label className="syllabus-review-title">Course title<input value={extraction.title} onChange={(event) => setExtraction((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="extraction-summary-grid">
        <EditableList title="Themes" values={extraction.themes} onChange={(themes) => setExtraction((current) => ({ ...current, themes }))} />
        <EditableList title="Learning objectives" values={extraction.objectives} onChange={(objectives) => setExtraction((current) => ({ ...current, objectives }))} />
        <EditableList title="Required books & materials" values={extraction.books} onChange={(books) => setExtraction((current) => ({ ...current, books }))} />
      </div>
      <div className="extracted-assignment-list is-editable">
        <div className="extracted-head"><span>Include</span><span>Assignment and course</span><span>Due</span><span>Effort</span><span>Source</span><span /></div>
        {extraction.assignments.map((item) => <div className="extracted-assignment-row" key={item.id}>
          <input aria-label={`Include ${item.title}`} type="checkbox" checked={approved.includes(item.id)} onChange={() => setApproved((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
          <span><input aria-label="Assignment title" value={item.title} onChange={(event) => updateAssignment(item.id, { title: event.target.value })} /><input aria-label="Course code" value={item.course} onChange={(event) => updateAssignment(item.id, { course: event.target.value })} /></span>
          <input aria-label="Due date and time" type="datetime-local" value={toDateTimeInput(item.due)} onChange={(event) => updateAssignment(item.id, { due: withTimeZoneOffset(event.target.value, parameters.timeZone) })} />
          <input aria-label="Estimated effort in hours" type="number" min="0.25" max="100" step="0.25" value={item.hours} onChange={(event) => updateAssignment(item.id, { hours: Number(event.target.value) })} />
          <small>Line {item.sourceLine || "manual"}</small>
          <button type="button" aria-label={`Remove ${item.title}`} onClick={() => removeAssignment(item.id)}>×</button>
        </div>)}
        <button className="syllabus-add-row" type="button" onClick={onAddAssignment}>+ Add missing calendar item</button>
      </div>
    </div>
  );
}

function IssueReportDialog({ persona, fileName, onClose, onSaved }) {
  const [stage, setStage] = useState("Source detection");
  const [issue, setIssue] = useState("");
  function submit(event) {
    event.preventDefault();
    const report = {
      id: globalThis.crypto?.randomUUID?.() || `report-${Date.now()}`,
      createdAt: new Date().toISOString(),
      reporter: {
        id: persona?.id || "guest",
        name: persona?.name || "Guest",
        accountType: persona?.accountType || "Guest",
      },
      sourceFile: fileName || "Pasted or sample course text",
      stage,
      issue: issue.trim(),
      status: "new",
    };
    try {
      const key = "ednotebook-demo-admin-inbox";
      const current = JSON.parse(window.localStorage.getItem(key) || "[]");
      window.localStorage.setItem(key, JSON.stringify([report, ...(Array.isArray(current) ? current : [])].slice(0, 200)));
      onSaved("Issue saved to this device’s admin message inbox with the current demo account and source name.");
      onClose();
    } catch {
      onSaved("This browser blocked device storage. Copy the issue before closing and send it from a connected account later.");
    }
  }
  return (
    <div className="syllabus-report-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="syllabus-report-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="syllabus-report-title">
        <header><div><NotebookLabel>DEMO ISSUE REPORT</NotebookLabel><h2 id="syllabus-report-title">Save this issue to the demo admin inbox.</h2></div><button type="button" onClick={onClose} aria-label="Close issue report">×</button></header>
        <p>This sample workspace saves the report only on this device. Reporter: <strong>{persona?.name || "Guest"}</strong> · Source: <strong>{fileName || "Pasted or sample text"}</strong></p>
        <label>Where did it happen?<select value={stage} onChange={(event) => setStage(event.target.value)}><option>Upload or file reading</option><option>Source detection</option><option>Assignment conversion</option><option>Calendar output</option><option>Something else</option></select></label>
        <label>What was missed or converted incorrectly?<textarea autoFocus required minLength={8} rows={6} value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="Example: Line 14 was highlighted as an assignment, but it is an office-hours date." /></label>
        <footer><button type="button" onClick={onClose}>Cancel issue report</button><button className="primary-paper-button" type="submit">Save demo report</button></footer>
      </form>
    </div>
  );
}

function SyllabusPanel({ persona, assignments, setAssignments }) {
  const [text, setTextState] = useState(() => defaultSyllabusText(persona));
  const [parameters, setParameters] = useState(() => defaultParameters(persona));
  const [fileName, setFileName] = useState("");
  const [extraction, setExtraction] = useState(null);
  const [approved, setApproved] = useState([]);
  const [reviewStale, setReviewStale] = useState(false);
  const [notice, setNotice] = useState("");
  const [surfacePage, setSurfacePage] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readProgress, setReadProgress] = useState("");
  const [readError, setReadError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanArtifact, setScanArtifact] = useState(null);
  const [sourceId, setSourceId] = useState(() => syllabusSourceId(persona.id, "sample syllabus", defaultParameters(persona).course));
  const inputRef = useRef(null);
  const readControllerRef = useRef(null);
  const readSequenceRef = useRef(0);
  const sourceInstanceRef = useRef(0);
  const analysis = useMemo(() => analyzeSyllabusLines(text, parameters), [text, parameters]);

  useEffect(() => {
    readControllerRef.current?.abort();
    readSequenceRef.current += 1;
    setTextState(defaultSyllabusText(persona));
    setParameters(defaultParameters(persona));
    setExtraction(null);
    setApproved([]);
    setReviewStale(false);
    setNotice("");
    setSurfacePage(null);
    setReportOpen(false);
    setFileName("");
    setIsReading(false);
    setReadProgress("");
    setReadError("");
    setScannerOpen(false);
    setScanArtifact(null);
    sourceInstanceRef.current = 0;
    setSourceId(syllabusSourceId(persona.id, "sample syllabus", defaultParameters(persona).course));
    return () => {
      readControllerRef.current?.abort();
      readSequenceRef.current += 1;
    };
  }, [persona.id]);

  function setText(value) {
    const next = value.length > MAX_EXTRACTED_CHARACTERS ? value.slice(0, MAX_EXTRACTED_CHARACTERS) : value;
    setTextState(next);
    if (value.length > MAX_EXTRACTED_CHARACTERS) setNotice("The course text was limited to 250,000 characters so review stays responsive. Split a larger syllabus into sections.");
    if (extraction) setReviewStale(true);
  }

  function commitSyllabusSource({ text: sourceText, name, detail, warnings = [], artifact = null } = {}) {
    if (typeof sourceText !== "string" || !sourceText.trim()) {
      setReadError("No readable course text was returned. Your current syllabus and review were not changed.");
      return false;
    }
    const nextName = String(name || "Syllabus source").trim() || "Syllabus source";
    const nextDetail = String(detail || "this device").trim() || "this device";
    const nextWarnings = Array.isArray(warnings) ? warnings : [];
    const nextInstance = sourceInstanceRef.current + 1;
    sourceInstanceRef.current = nextInstance;
    const nextSourceId = syllabusSourceId(persona.id, nextName, parameters.course, sourceInstanceToken(nextInstance));

    setSourceId(nextSourceId);
    setFileName(nextName);
    setTextState(sourceText);
    setExtraction(null);
    setApproved([]);
    setReviewStale(false);
    setReadError("");
    setScanArtifact(typeof Blob !== "undefined" && artifact instanceof Blob && artifact.type === "application/pdf" ? artifact : null);
    const warningNote = nextWarnings.length ? ` Review the source carefully because ${nextWarnings.length} reading warning${nextWarnings.length === 1 ? " was" : "s were"} reported.` : "";
    setNotice(`${nextName} is ready from ${nextDetail}. Review the highlighted source before conversion.${warningNote}`);
    setSurfacePage("source");
    return true;
  }

  function downloadScanArtifact() {
    if (!scanArtifact) return;
    const url = URL.createObjectURL(scanArtifact);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = scanArtifact.name || "syllabus-scan.pdf";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function handleFile(file) {
    if (!file) return;
    readControllerRef.current?.abort();
    const controller = new AbortController();
    const sequence = readSequenceRef.current + 1;
    readSequenceRef.current = sequence;
    readControllerRef.current = controller;
    setIsReading(true);
    setReadError("");
    setReadProgress("Opening syllabus…");
    try {
      const result = await extractSyllabusFile(file, {
        signal: controller.signal,
        onProgress: (message) => {
          if (readSequenceRef.current === sequence) setReadProgress(message);
        },
      });
      if (readSequenceRef.current !== sequence || controller.signal.aborted) return;
      commitSyllabusSource({ text: result.text, name: file.name, detail: result.detail, warnings: result.warnings });
    } catch (error) {
      if (readSequenceRef.current !== sequence) return;
      if (error?.name === "AbortError") setNotice("Syllabus reading canceled. Your current course text was not changed.");
      else setReadError(error?.message || "The syllabus could not be read. Try another copy or paste the text below.");
    } finally {
      if (readSequenceRef.current === sequence) {
        setIsReading(false);
        setReadProgress("");
        readControllerRef.current = null;
      }
    }
  }

  function runExtraction() {
    const next = extractSyllabus(text, persona, parameters, sourceId);
    setExtraction(next);
    setApproved(next.assignments.map((item) => item.id));
    setReviewStale(false);
    setNotice(`Review ready: ${next.assignments.length} calendar item${next.assignments.length === 1 ? "" : "s"}, ${next.objectives.length} objective${next.objectives.length === 1 ? "" : "s"}, and ${next.books.length} material entr${next.books.length === 1 ? "y" : "ies"}.`);
    return next;
  }

  function addMissingAssignment() {
    const id = `manual-${Date.now()}`;
    const due = withTimeZoneOffset(`${parameters.defaultYear}-09-01T${parameters.defaultTime}`, parameters.timeZone);
    setExtraction((current) => ({ ...current, assignments: [...current.assignments, { id, importSourceId: sourceId, importItemKey: id, course: parameters.course, title: "Untitled calendar item", due, hours: parameters.defaultHours, status: "not-started", priority: "medium", description: "Added during extraction review.", sourceLine: null }] }));
    setApproved((current) => [...current, id]);
  }

  function addApproved() {
    if (!extraction) return;
    if (reviewStale) {
      setNotice("The source changed after extraction. Refresh the review before adding dates so the calendar uses the latest text.");
      return;
    }
    const selected = extraction.assignments.filter((item) => approved.includes(item.id) && item.title.trim() && item.due);
    const priorSourceItems = assignments.filter((item) => item.importSourceId === sourceId);
    const priorByKey = new Map(priorSourceItems.map((item) => [item.importItemKey, item]));
    const selectedKeys = new Set(selected.map((item) => item.importItemKey));
    let updated = 0;
    const synchronizedSource = selected.map((item) => {
      const prior = priorByKey.get(item.importItemKey);
      if (!prior) return item;
      if (["course", "title", "due", "hours"].some((field) => prior[field] !== item[field])) updated += 1;
      return { ...prior, ...item, id: prior.id };
    });
    const preserved = assignments.filter((item) => item.importSourceId !== sourceId);
    const existing = new Set(preserved.map((item) => `${item.course}-${item.title}-${dateKey(item.due)}`));
    let duplicateCount = 0;
    const reconciled = synchronizedSource.filter((item) => {
      const key = `${item.course}-${item.title}-${dateKey(item.due)}`;
      if (existing.has(key)) { duplicateCount += 1; return false; }
      existing.add(key);
      return true;
    });
    const additions = reconciled.filter((item) => !priorByKey.has(item.importItemKey)).length;
    const removed = priorSourceItems.filter((item) => !selectedKeys.has(item.importItemKey)).length;
    setAssignments([...preserved, ...reconciled]);
    setNotice(`${additions} reviewed date${additions === 1 ? "" : "s"} added, ${updated} updated, and ${removed} removed from this syllabus sync.${duplicateCount ? ` ${duplicateCount} exact duplicate${duplicateCount === 1 ? " was" : "s were"} left unchanged.` : ""}`);
  }

  function renderReviewPage(page, navigate) {
    if (page === "source") return (
      <section className="syllabus-fullscreen-page">
        <div className="syllabus-fullscreen-heading"><div><NotebookLabel>EDIT BEFORE CONVERSION</NotebookLabel><h1>Every highlighted line remains under your control.</h1><p>Change the source or the extraction settings, then create a fresh review. Nothing reaches the calendar from this screen.</p></div><div><button type="button" onClick={() => setReportOpen(true)}>Report a problem</button><button className="primary-paper-button" type="button" onClick={() => { runExtraction(); navigate("review"); }}>Extract into review</button></div></div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
        <ParameterControls parameters={parameters} setParameters={(updater) => { setParameters(updater); if (extraction) setReviewStale(true); }} />
        <div className="syllabus-fullscreen-editor-grid"><EditableLineEditor text={text} onChange={setText} analysis={analysis} /><DetectedLinePreview analysis={analysis} /></div>
      </section>
    );
    return (
      <section className="syllabus-fullscreen-page">
        <div className="syllabus-fullscreen-heading"><div><NotebookLabel>EDITABLE OUTPUT</NotebookLabel><h1>Correct the calendar rows before saving.</h1><p>Titles, courses, dates, times, effort, objectives, and materials can all be fixed here.</p></div><div><button type="button" onClick={() => setReportOpen(true)}>Report a problem</button><button className="primary-paper-button" type="button" disabled={!extraction || reviewStale} onClick={addApproved}>Add approved dates</button></div></div>
        {notice && <p className="inline-notice" role="status">{notice}</p>}
        {reviewStale && <div className="syllabus-stale-warning" role="status"><span>The source or extraction settings changed.</span><button type="button" onClick={runExtraction}>Refresh review from latest source</button></div>}
        <ExtractionReview extraction={extraction} setExtraction={setExtraction} approved={approved} setApproved={setApproved} parameters={parameters} onAddAssignment={addMissingAssignment} />
      </section>
    );
  }

  return (
    <div className="workspace-panel-stack">
      <section className="paper-card syllabus-upload-card" aria-busy={isReading}>
        <div className="dashboard-card-heading"><div><NotebookLabel>SYLLABUS REVIEW</NotebookLabel><h1>Upload the syllabus. Check every conversion.</h1><p>Edit the course text and highlighted lines before any date reaches the calendar.</p></div><div className="syllabus-upload-actions"><button type="button" disabled={isReading} onClick={() => setScannerOpen(true)}>Scan paper syllabus</button><button className="primary-paper-button" type="button" disabled={isReading} onClick={() => inputRef.current?.click()}>{isReading ? "Reading syllabus…" : "Upload syllabus"}</button></div></div>
        <input ref={inputRef} className="sr-only" type="file" tabIndex={-1} aria-label="Choose a PDF, Word DOCX, TXT, Markdown, or CSV syllabus" disabled={isReading} accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; handleFile(file); }} />
        {isReading && <div className="syllabus-read-progress" role="status" aria-live="polite"><span aria-hidden="true" /><strong>{readProgress || "Reading syllabus…"}</strong><button type="button" onClick={() => readControllerRef.current?.abort()}>Stop reading syllabus</button></div>}
        {readError && <p className="syllabus-read-error" role="alert">{readError}</p>}
        <div className="syllabus-editor-grid">
          <div><label>Course text<textarea spellCheck disabled={isReading} value={text} rows={14} onChange={(event) => setText(event.target.value)} /></label><div className="file-summary"><span>{fileName || "Sample syllabus text loaded"}</span><small>PDF · Word DOCX · TXT · MD · CSV · read on this device</small>{scanArtifact && <button type="button" onClick={downloadScanArtifact}>Download processed scan (PDF)</button>}</div><div className="syllabus-inline-actions"><button type="button" disabled={isReading} onClick={runExtraction}>{extraction ? "Refresh extraction review" : "Extract course details"}</button><button type="button" disabled={isReading} onClick={() => setSurfacePage("source")}>Open full-screen source review</button><button type="button" onClick={() => setReportOpen(true)}>Report issue</button></div></div>
          <DetectedLinePreview analysis={analysis} />
        </div>
        {reviewStale && <div className="syllabus-stale-warning" role="status"><span>The course text or extraction settings changed. Refresh the review before saving dates.</span><button type="button" onClick={runExtraction}>Refresh review</button></div>}
        {notice && <p className="inline-notice" role="status">{notice}</p>}
      </section>
      {extraction && <section className="paper-card extraction-result-card"><div className="dashboard-card-heading"><div><NotebookLabel>EXTRACTION REVIEW</NotebookLabel><h2>{extraction.title}</h2><p>Detected source lines: {extraction.detectedLines.join(", ") || "none"}</p></div><div className="syllabus-heading-actions"><button type="button" onClick={() => setSurfacePage("review")}>Review full screen</button><button type="button" disabled={reviewStale} onClick={addApproved}>Add approved dates to calendar</button></div></div><ExtractionReview extraction={extraction} setExtraction={setExtraction} approved={approved} setApproved={setApproved} parameters={parameters} onAddAssignment={addMissingAssignment} /></section>}
      {surfacePage && <FullscreenSurface key={surfacePage} title="Syllabus review" pages={REVIEW_PAGES} initialPage={surfacePage} addressPrefix="ednotebook://syllabus" onClose={() => setSurfacePage(null)} renderPage={renderReviewPage} />}
      {reportOpen && <IssueReportDialog persona={persona} fileName={fileName} onClose={() => setReportOpen(false)} onSaved={setNotice} />}
      {scannerOpen && <Suspense fallback={<div className="syllabus-scanner-loading" role="status">Opening the paper scanner…</div>}><SyllabusScanner onClose={() => setScannerOpen(false)} onComplete={(result) => { if (commitSyllabusSource(result)) setScannerOpen(false); }} /></Suspense>}
    </div>
  );
}

export { SyllabusPanel };
