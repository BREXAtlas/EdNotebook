import { buildDigitalLiteracyName, slugify } from "../studio/fileNaming.js";
import { formatCitationOutput } from "./citationTools.js";

const WORKSPACE_SCHEMA = "EdNotebookStudentLearning/1.0";
const PACKET_SCHEMA = "EdNotebookLearningPacket/1.0";

const DIGITAL_LITERACY_SYNTHETIC_CONTEXT = {
  synthetic: true,
  courseId: null,
  courseCode: "DIGL-101",
  courseTitle: "Digital Literacy",
  lessons: [
    { id: "digl-source-check", title: "Check a source before you share it" },
    { id: "digl-citation-practice", title: "Give creators credit" },
    { id: "digl-file-practice", title: "Name, version, and retrieve your work" },
  ],
};

function makeId(prefix = "record") {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function courseContext(course = DIGITAL_LITERACY_SYNTHETIC_CONTEXT) {
  const source = course || DIGITAL_LITERACY_SYNTHETIC_CONTEXT;
  const synthetic = source.synthetic === true;
  return {
    synthetic,
    courseId: synthetic
      ? null
      : cleanText(source.courseId || source.id) || null,
    courseCode: cleanText(source.courseCode || source.code) || "DIGL-101",
    courseTitle: cleanText(source.courseTitle || source.title) || "Digital Literacy",
    lessons: Array.isArray(source.lessons) ? source.lessons : [],
  };
}

function courseSelectionKey(course) {
  if (!course) return "";
  const context = courseContext(course);
  if (context.courseId) return `course:${context.courseId}`;
  if (!context.synthetic) return "";
  return `synthetic:${context.courseCode.toLowerCase()}::${context.courseTitle.toLowerCase()}`;
}

function selectableCourseContexts(classes = []) {
  const live = (Array.isArray(classes) ? classes : [])
    .map((course) => courseContext(course))
    .filter((course) => course.courseId || course.synthetic);
  const hasDigitalLiteracy = live.some(
    (course) => !course.synthetic && /digital literacy/iu.test(course.courseTitle),
  );
  const candidates = hasDigitalLiteracy
    ? live.filter((course) => !course.synthetic)
    : [...live, courseContext(DIGITAL_LITERACY_SYNTHETIC_CONTEXT)];
  const bySelectionKey = new Map();
  candidates.forEach((course) => {
    const key = courseSelectionKey(course);
    if (key && !bySelectionKey.has(key)) bySelectionKey.set(key, course);
  });
  return [...bySelectionKey.values()];
}

function reconcileCourseContext(current, courses = []) {
  const options = (Array.isArray(courses) ? courses : [])
    .map((course) => courseContext(course))
    .filter((course) => courseSelectionKey(course));
  const safeOptions = options.length
    ? options
    : selectableCourseContexts([]);
  const currentKey = courseSelectionKey(current);
  let selected = safeOptions.find(
    (course) => courseSelectionKey(course) === currentKey,
  );
  if (!selected && current?.synthetic) {
    const currentTitle = cleanText(current.courseTitle).toLowerCase();
    selected = safeOptions.find(
      (course) => !course.synthetic
        && cleanText(course.courseTitle).toLowerCase() === currentTitle,
    );
  }
  selected ||= safeOptions[0];
  const selectedKey = courseSelectionKey(selected);
  const sameCourse = Boolean(currentKey && currentKey === selectedKey);
  const selectedLesson = sameCourse
    ? selected.lessons.find((lesson) => lesson.id === current?.lessonId)
    : null;
  const keepsFreeformLesson = sameCourse && selected.lessons.length === 0;
  return {
    ...selected,
    lessonId: selectedLesson?.id
      || (keepsFreeformLesson ? cleanText(current?.lessonId) : ""),
    lessonTitle: selectedLesson?.title
      || (keepsFreeformLesson ? cleanText(current?.lessonTitle) : ""),
    sourceRootId: sameCourse ? current?.sourceRootId || null : null,
  };
}

function shouldLoadPrivateCloudRecords(storageMode, studentId) {
  return storageMode === "cloud" && Boolean(cleanText(studentId));
}

function toIso(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function workspaceStorageKey(scope) {
  return `ednotebook-${scope || "student"}-learning-workspace-v1`;
}

function emptyWorkspace() {
  return { schema: WORKSPACE_SCHEMA, records: [], savedAt: null };
}

function readDeviceWorkspace(storage, scope) {
  if (!storage) return emptyWorkspace();
  try {
    const stored = JSON.parse(storage.getItem(workspaceStorageKey(scope)));
    if (!stored || stored.schema !== WORKSPACE_SCHEMA || !Array.isArray(stored.records)) return emptyWorkspace();
    return {
      schema: WORKSPACE_SCHEMA,
      records: stored.records.filter((record) => record && record.id && record.rootId && record.kind),
      savedAt: stored.savedAt || null,
    };
  } catch {
    return emptyWorkspace();
  }
}

function writeDeviceWorkspace(storage, scope, records) {
  const workspace = { schema: WORKSPACE_SCHEMA, records, savedAt: new Date().toISOString() };
  storage?.setItem(workspaceStorageKey(scope), JSON.stringify(workspace));
  return workspace;
}

function migrateLegacyStudentNotes(storage, scope, track, existingRecords) {
  if (!storage) return { records: existingRecords, imported: 0 };
  let legacyNotes;
  try {
    legacyNotes = JSON.parse(storage.getItem(`ednotebook-${track}-${scope}-student-notes`));
  } catch {
    legacyNotes = [];
  }
  if (!Array.isArray(legacyNotes) || !legacyNotes.length) return { records: existingRecords, imported: 0 };

  let records = [...existingRecords];
  let imported = 0;
  legacyNotes.forEach((note, index) => {
    const legacyId = slugify(note?.id || `${note?.createdAt || "undated"}-${index}`, `legacy-${index}`);
    if (records.some((record) => record.content?.legacyNoteId === legacyId)) return;
    const body = cleanText(note?.body);
    if (!body) return;
    const courseCode = cleanText(note?.course) || "General";
    const createdAt = toIso(note?.createdAt);
    const words = body.split(/\s+/u).slice(0, 7).join(" ");
    const title = cleanText(note?.title) || `${words}${body.split(/\s+/u).length > 7 ? "…" : ""}`;
    const id = `legacy-note-${legacyId}`;
    const record = {
      id,
      rootId: id,
      previousVersionId: null,
      version: 1,
      kind: "note",
      courseId: null,
      courseCode,
      courseTitle: courseCode === "General" ? "General notes" : courseCode,
      lessonId: "",
      lessonTitle: "",
      sourceRootId: null,
      title,
      filename: buildWorkspaceFileName({ courseCode, kind: "note", title, version: 1, extension: "md", now: createdAt }),
      content: { title, body, legacyNoteId: legacyId, migratedFrom: "student-notes-v1" },
      createdAt,
      storage: "device",
    };
    records = appendRecord(records, record);
    imported += 1;
  });
  return { records, imported };
}

function latestRecordFor(records, rootId) {
  return records
    .filter((record) => record.rootId === rootId)
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

function latestRecords(records, kind = null) {
  const byRoot = new Map();
  records.forEach((record) => {
    if (kind && record.kind !== kind) return;
    const current = byRoot.get(record.rootId);
    if (!current || Number(record.version) > Number(current.version)) byRoot.set(record.rootId, record);
  });
  return [...byRoot.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function buildWorkspaceFileName({ courseCode, kind, title, version, extension = "md", now = new Date() }) {
  const date = toIso(now).slice(0, 10);
  const code = slugify(courseCode || "course", "course");
  const category = slugify(kind || "record", "record");
  const subject = slugify(title || "untitled", "untitled");
  const revision = `v${String(Math.max(1, Number(version) || 1)).padStart(2, "0")}`;
  return `${date}_${code}_${category}_${subject}_${revision}.${slugify(extension, "txt")}`;
}

function createVersionedRecord({ kind, content, context = {}, previous = null, now = new Date() }) {
  const createdAt = toIso(now);
  const rootId = previous?.rootId || makeId(`${kind}-root`);
  const version = previous ? Number(previous.version || 1) + 1 : 1;
  const id = makeId(kind);
  const title = cleanText(content?.title) || (
    kind === "note"
      ? "Untitled note"
      : kind === "feedback"
        ? "Feedback"
        : kind === "document"
          ? "Untitled document"
          : "Untitled record"
  );
  const courseCode = cleanText(context.courseCode || content?.courseCode) || "DIGL-101";
  const extension = kind === "source" ? "json" : kind === "document" ? "html" : "md";
  return {
    id,
    rootId,
    previousVersionId: previous?.id || null,
    version,
    kind,
    courseId: context.courseId || content?.courseId || null,
    courseCode,
    courseTitle: cleanText(context.courseTitle || content?.courseTitle) || "Digital Literacy",
    lessonId: cleanText(context.lessonId || content?.lessonId),
    lessonTitle: cleanText(context.lessonTitle || content?.lessonTitle),
    sourceRootId: content?.sourceRootId || null,
    title,
    filename: buildWorkspaceFileName({ courseCode, kind, title, version, extension, now }),
    content: { ...content, title },
    createdAt,
    storage: "device",
  };
}

function appendRecord(records, record) {
  if (!record?.id || !record?.rootId) throw new Error("A learning record needs an id and root id.");
  if (records.some((item) => item.id === record.id)) return records;
  const collision = records.some((item) => item.rootId === record.rootId && Number(item.version) === Number(record.version));
  if (collision) throw new Error("That version already exists. Create a new version instead of overwriting it.");
  return [record, ...records];
}

function recordMatchesQuery(record, query) {
  const search = cleanText(query).toLowerCase();
  if (!search) return true;
  const content = record?.content || {};
  return [
    record.title,
    record.courseCode,
    record.courseTitle,
    record.lessonTitle,
    record.filename,
    content.body,
    content.note,
    content.citation,
    content.inTextCitation,
    content.summary,
    content.html,
  ].some((value) => String(value || "").toLowerCase().includes(search));
}

function normalizeImportedRecord(record) {
  return {
    ...record,
    id: cleanText(record.id) || makeId(record.kind || "import"),
    rootId: cleanText(record.rootId) || cleanText(record.id) || makeId(`${record.kind || "import"}-root`),
    version: Math.max(1, Number(record.version) || 1),
    previousVersionId: record.previousVersionId || null,
    createdAt: toIso(record.createdAt),
    storage: "device",
    content: record.content && typeof record.content === "object" ? record.content : {},
  };
}

function validateRestoreManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") errors.push("The selected file is not a JSON object.");
  if (manifest?.schema !== PACKET_SCHEMA) errors.push(`Expected ${PACKET_SCHEMA}.`);
  if (!Array.isArray(manifest?.records)) errors.push("The restore manifest has no records array.");
  if (manifest?.records?.length > 1000) errors.push("A restore manifest may contain at most 1,000 records.");
  if (manifest?.records?.some((record) => !["note", "source", "feedback", "document"].includes(record?.kind) || !record?.content || typeof record.content !== "object")) {
    errors.push("One or more records have an unsupported kind or missing content.");
  }
  try {
    if (JSON.stringify(manifest).length > 5 * 1024 * 1024) errors.push("The restore manifest exceeds the five-megabyte safety limit.");
  } catch {
    errors.push("The restore manifest could not be read safely.");
  }
  return { ok: errors.length === 0, errors };
}

function mergeRestoreManifest(existingRecords, manifest) {
  const validation = validateRestoreManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  let merged = [...existingRecords];
  let imported = 0;
  manifest.records.map(normalizeImportedRecord).forEach((record) => {
    if (merged.some((item) => item.id === record.id)) return;
    const rootCollision = merged.some((item) => item.rootId === record.rootId && Number(item.version) === Number(record.version));
    const safeRecord = rootCollision
      ? createVersionedRecord({
          kind: record.kind,
          content: record.content,
          context: record,
          previous: latestRecordFor(merged, record.rootId),
          now: record.createdAt,
        })
      : record;
    merged = appendRecord(merged, safeRecord);
    imported += 1;
  });
  return { records: merged, imported };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
}

function packetRecordHtml(record) {
  const content = record.content || {};
  const context = [record.courseCode, record.lessonTitle].filter(Boolean).join(" · ");
  if (record.kind === "source") {
    const citation = content.source ? formatCitationOutput(content.source) : { html: escapeHtml(content.citation || "") };
    return `<article><h3>${escapeHtml(record.title)}</h3><p class="context">${escapeHtml(context)} · ${escapeHtml(content.citationStyle || "")}</p><p class="citation">${citation.html}</p><p><strong>In-text:</strong> ${escapeHtml(content.inTextCitation || "")}</p>${content.note ? `<p>${escapeHtml(content.note)}</p>` : ""}</article>`;
  }
  if (record.kind === "feedback") {
    return `<article><h3>${escapeHtml(record.title)}</h3><p class="context">${escapeHtml(context)} · Feedback saved by student</p><p>${escapeHtml(content.body || content.summary || "")}</p></article>`;
  }
  if (record.kind === "document") {
    const documentText = String(content.html || "")
      .replace(/<br\s*\/?>/giu, "\n")
      .replace(/<\/p>|<\/h[1-3]>|<\/li>|<\/section>/giu, "\n")
      .replace(/<[^>]+>/gu, " ")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
    return `<article><h3>${escapeHtml(record.title)}</h3><p class="context">${escapeHtml(context)} · ${escapeHtml(record.filename)}</p><p>${escapeHtml(documentText).replace(/\n/gu, "<br>")}</p></article>`;
  }
  return `<article><h3>${escapeHtml(record.title)}</h3><p class="context">${escapeHtml(context)} · ${escapeHtml(record.filename)}</p><p>${escapeHtml(content.body || "").replace(/\n/gu, "<br>")}</p></article>`;
}

function buildLearningPacket({ course, records, selectedRecordIds, files = [], exportedAt = new Date() }) {
  const selected = records.filter((record) => selectedRecordIds.includes(record.id));
  const timestamp = toIso(exportedAt);
  const title = `${course?.courseTitle || course?.title || "Digital Literacy"} learning packet`;
  const manifest = {
    schema: PACKET_SCHEMA,
    exportedAt: timestamp,
    course: {
      id: course?.courseId || course?.id || null,
      code: course?.courseCode || course?.code || "DIGL-101",
      title: course?.courseTitle || course?.title || "Digital Literacy",
      synthetic: Boolean(course?.synthetic),
    },
    records: selected.map((record) => ({ ...record, storage: "portable-export" })),
    files: files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      safeName: file.safeName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256 || null,
      courseId: file.courseId || null,
      courseCode: file.metadata?.courseCode || null,
      courseTitle: file.metadata?.courseTitle || null,
      lessonId: file.metadata?.lessonId || null,
      lessonTitle: file.metadata?.lessonTitle || null,
      createdAt: file.createdAt,
      note: "The binary file is not embedded in this JSON manifest. Export it separately from the device vault.",
    })),
  };
  const fileRows = manifest.files.length
    ? manifest.files.map((file) => `<li><strong>${escapeHtml(file.safeName || file.originalName)}</strong><br>${escapeHtml(file.mimeType)} · ${Number(file.sizeBytes || 0).toLocaleString()} bytes</li>`).join("")
    : "<li>No device files selected.</li>";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{font:16px/1.55 Georgia,serif;color:#182126;max-width:820px;margin:0 auto;padding:48px 28px}
    h1,h2,h3{font-family:Arial,sans-serif;line-height:1.2} header{border-bottom:3px solid #1e6d66;margin-bottom:32px}
    article{break-inside:avoid;border-bottom:1px solid #ccd8d6;padding:16px 0}.context{color:#52625f;font:13px/1.4 Arial,sans-serif}
    .citation{padding-left:32px;text-indent:-32px} footer{margin-top:40px;color:#52625f;font:13px/1.45 Arial,sans-serif}
  </style>
</head>
<body>
  <header><p>EdNotebook portable learning packet</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(manifest.course.code)} · Exported ${escapeHtml(timestamp)}</p></header>
  <main>
    <h2>Selected learning records</h2>
    ${selected.length ? selected.map(packetRecordHtml).join("") : "<p>No notes, sources, or feedback were selected.</p>"}
    <h2>Selected file manifest</h2><ul>${fileRows}</ul>
  </main>
  <footer>This readable HTML copy belongs to the student and opens without EdNotebook. The companion JSON restore manifest preserves structured records for later import. Citation output remains the student's responsibility to compare with the current official style manual.</footer>
</body>
</html>`;
  const baseName = `${timestamp.slice(0, 10)}_${slugify(manifest.course.code, "course")}_learning-packet`;
  return { html, manifest, htmlFilename: `${baseName}.html`, manifestFilename: `${baseName}_restore.json` };
}

function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadLearningPacket(packet) {
  downloadTextFile(packet.html, packet.htmlFilename, "text/html;charset=utf-8");
  downloadTextFile(JSON.stringify(packet.manifest, null, 2), packet.manifestFilename, "application/json;charset=utf-8");
}

function buildDeviceFileName(file, context, version = 1) {
  return buildDigitalLiteracyName({
    file,
    courseCode: context.courseCode,
    category: "student-file",
    title: context.title || file?.name,
    version,
  });
}

export {
  WORKSPACE_SCHEMA,
  PACKET_SCHEMA,
  DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
  courseContext,
  courseSelectionKey,
  selectableCourseContexts,
  reconcileCourseContext,
  shouldLoadPrivateCloudRecords,
  workspaceStorageKey,
  emptyWorkspace,
  readDeviceWorkspace,
  writeDeviceWorkspace,
  migrateLegacyStudentNotes,
  latestRecordFor,
  latestRecords,
  buildWorkspaceFileName,
  buildDeviceFileName,
  createVersionedRecord,
  appendRecord,
  recordMatchesQuery,
  validateRestoreManifest,
  mergeRestoreManifest,
  buildLearningPacket,
  downloadLearningPacket,
};
