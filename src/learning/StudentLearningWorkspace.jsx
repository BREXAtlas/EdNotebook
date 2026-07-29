import { useEffect, useMemo, useRef, useState } from "react";
import {
  CITATION_STYLES,
  CITATION_STYLE_METADATA,
  SOURCE_TYPES,
  SOURCE_TYPE_DEFINITIONS,
  CONTRIBUTOR_ROLES,
  OPTIONAL_FIELD_DEFINITIONS,
  createContributor,
  createSourceDraft,
  fieldsForType,
  formatCitationOutput,
  formatInTextCitation,
  checkCitationFormat,
} from "./citationTools.js";
import {
  DIGITAL_LITERACY_SYNTHETIC_CONTEXT,
  appendRecord,
  buildDeviceFileName,
  buildLearningPacket,
  createVersionedRecord,
  downloadLearningPacket,
  latestRecordFor,
  latestRecords,
  migrateLegacyStudentNotes,
  mergeRestoreManifest,
  readDeviceWorkspace,
  recordMatchesQuery,
  writeDeviceWorkspace,
} from "./studentLearningWorkspace.js";
import { appendCloudLearningRecord, loadCloudLearningRecords } from "./studentLearningService.js";
import { downloadDeviceFile, listDeviceFiles, saveDeviceFile } from "../studio/localVault.js";
import "./student-learning-workspace.css";

function courseContext(course) {
  return {
    synthetic: Boolean(course.synthetic),
    courseId: course.courseId || course.id || null,
    courseCode: course.courseCode || course.code || "DIGL-101",
    courseTitle: course.courseTitle || course.title || "Digital Literacy",
    lessons: course.lessons || [],
  };
}

function combineAppendOnly(left, right) {
  const byId = new Map();
  [...left, ...right].forEach((record) => {
    if (!byId.has(record.id) || record.storage === "cloud") byId.set(record.id, record);
  });
  return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function plainAsHtml(value) {
  return String(value || "").replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
}

async function copyCitation(output, onNotice) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/plain": new Blob([output.plain], { type: "text/plain" }),
        "text/html": new Blob([output.html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await navigator.clipboard.writeText(output.plain);
    }
    onNotice("Copied. Italics are included when the destination accepts rich text.");
  } catch {
    onNotice("Copy was blocked by this browser. Select the citation text and copy it manually.");
  }
}

function ContextFields({ context, setContext, courses, sourceOptions = [], showSource = false }) {
  const selectedCourse = courses.find((course) => course.courseCode === context.courseCode) || courses[0];
  return (
    <div className="learning-context-grid">
      <label>
        Course
        <select
          value={context.courseCode}
          onChange={(event) => {
            const selected = courses.find((course) => course.courseCode === event.target.value);
            setContext({ ...courseContext(selected), lessonId: "", lessonTitle: "" });
          }}
        >
          {courses.map((course) => <option key={`${course.courseCode}-${course.courseId || "sample"}`} value={course.courseCode}>{course.courseCode} · {course.courseTitle}{course.synthetic ? " (practice)" : ""}</option>)}
        </select>
      </label>
      <label>
        Lesson or learning step
        {selectedCourse?.lessons?.length ? (
          <select
            value={context.lessonId}
            onChange={(event) => {
              const lesson = selectedCourse.lessons.find((item) => item.id === event.target.value);
              setContext({ ...context, lessonId: lesson?.id || "", lessonTitle: lesson?.title || "" });
            }}
          >
            <option value="">Course-wide</option>
            {selectedCourse.lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
          </select>
        ) : <input value={context.lessonTitle} onChange={(event) => setContext({ ...context, lessonId: "", lessonTitle: event.target.value })} placeholder="Optional lesson title" />}
      </label>
      {showSource && (
        <label>
          Related source
          <select value={context.sourceRootId || ""} onChange={(event) => setContext({ ...context, sourceRootId: event.target.value || null })}>
            <option value="">No source linked</option>
            {sourceOptions.map((source) => <option key={source.rootId} value={source.rootId}>{source.title}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function StorageChoice({ mode, setMode, signedIn }) {
  return (
    <section className="learning-storage-choice" aria-labelledby="learning-storage-title">
      <div>
        <span className="portal-kicker">STORAGE CHOICE</span>
        <h2 id="learning-storage-title">Your work should remain yours.</h2>
        <p>Every save stays in this browser first. Private cloud sync is optional, and portable export never requires an EdNotebook account to read.</p>
      </div>
      <div role="group" aria-label="Learning workspace storage">
        <button type="button" className={mode === "device" ? "is-active" : ""} onClick={() => setMode("device")}><strong>This browser</strong><span>Local, immediate, and offline-friendly</span></button>
        <button type="button" disabled={!signedIn} className={mode === "cloud" ? "is-active" : ""} onClick={() => setMode("cloud")}><strong>Private cloud + browser</strong><span>{signedIn ? "Own-account sync when available" : "Sign in to enable"}</span></button>
        <div><strong>Portable packet</strong><span>Readable HTML + restore JSON on your device</span></div>
      </div>
    </section>
  );
}

function NoteWorkspace({ records, courses, onSave, storageMode, notice }) {
  const sources = latestRecords(records, "source");
  const [query, setQuery] = useState("");
  const [context, setContext] = useState(courseContext(courses[0]));
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [editingRootId, setEditingRootId] = useState(null);
  const visible = latestRecords(records, "note").filter((record) => recordMatchesQuery(record, query));

  function save(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) return;
    const previous = editingRootId ? latestRecordFor(records, editingRootId) : null;
    const record = createVersionedRecord({
      kind: "note",
      content: { ...draft, sourceRootId: context.sourceRootId || null },
      context,
      previous,
    });
    onSave(record);
    setDraft({ title: "", body: "" });
    setEditingRootId(null);
  }

  function revise(record) {
    setEditingRootId(record.rootId);
    setContext({
      courseId: record.courseId,
      courseCode: record.courseCode,
      courseTitle: record.courseTitle,
      lessonId: record.lessonId,
      lessonTitle: record.lessonTitle,
      sourceRootId: record.sourceRootId,
      lessons: courses.find((course) => course.courseCode === record.courseCode)?.lessons || [],
    });
    setDraft({ title: record.title, body: record.content.body || "" });
  }

  return (
    <div className="learning-two-column">
      <section className="dashboard-card learning-editor-card">
        <span className="portal-kicker">NOTE + RETRIEVAL PRACTICE</span>
        <h2>{editingRootId ? "Save the next version." : "Keep the thought with its context."}</h2>
        <p>Course, lesson, related source, a safe file name, and version history travel together. Older versions are retained instead of overwritten.</p>
        <form onSubmit={save}>
          <ContextFields context={context} setContext={setContext} courses={courses} sourceOptions={sources} showSource />
          <label>Note title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What this note helps me remember" required /></label>
          <label>Note<textarea rows={8} spellCheck="true" lang="en" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Explain the idea in your own words, capture a question, or plan the next step." required /></label>
          <button className="primary" type="submit">{editingRootId ? `Save version ${(latestRecordFor(records, editingRootId)?.version || 1) + 1}` : `Save to ${storageMode === "cloud" ? "browser + private cloud" : "this browser"}`}</button>
        </form>
        {notice && <p className="learning-notice" role="status">{notice}</p>}
      </section>
      <section className="dashboard-card learning-record-library">
        <div className="dashboard-card-heading"><div><span className="portal-kicker">RETRIEVE</span><h2>Latest note versions</h2></div><span>{visible.length} found</span></div>
        <label className="learning-search">Search title, class, lesson, source, or note<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “source check”" /></label>
        {visible.length ? visible.map((record) => {
          const versions = records.filter((item) => item.rootId === record.rootId).sort((a, b) => Number(b.version) - Number(a.version));
          return (
            <article key={record.id}>
              <div><span>{record.courseCode} · {record.lessonTitle || "Course-wide"}</span><strong>{record.title}</strong><small>{record.filename} · {record.storage === "cloud" ? "cloud copy" : "device copy"}</small></div>
              <p>{record.content.body}</p>
              <footer><button type="button" onClick={() => revise(record)}>Create next version</button><details><summary>{versions.length} version{versions.length === 1 ? "" : "s"}</summary>{versions.map((version) => <p key={version.id}>v{version.version} · {new Date(version.createdAt).toLocaleString()} · {version.filename}</p>)}</details></footer>
            </article>
          );
        }) : <p className="learning-empty">No matching notes yet.</p>}
      </section>
    </div>
  );
}

function PersonEditor({ label, people, onChange, onAdd, onRemove, includeRole = false }) {
  return (
    <fieldset className="citation-people-editor">
      <legend>{label}</legend>
      {people.map((person, index) => (
        <div key={person.id || index}>
          <label>Creator type<select value={person.kind} onChange={(event) => onChange(index, "kind", event.target.value)}><option value="person">Person</option><option value="organization">Organization</option></select></label>
          {person.kind === "organization" ? (
            <label>Organization name<input value={person.literal} onChange={(event) => onChange(index, "literal", event.target.value)} placeholder="Organization or government agency" /></label>
          ) : (
            <>
              <label>Given name<input value={person.given} onChange={(event) => onChange(index, "given", event.target.value)} placeholder="Jordan M." /></label>
              <label>Family name<input value={person.family} onChange={(event) => onChange(index, "family", event.target.value)} placeholder="Rivera" /></label>
            </>
          )}
          {includeRole && <label>Role<select value={person.role} onChange={(event) => onChange(index, "role", event.target.value)}>{CONTRIBUTOR_ROLES.map(([value, roleLabel]) => <option key={value} value={value}>{roleLabel}</option>)}</select></label>}
          {people.length > 1 && <button type="button" onClick={() => onRemove(index)}>Remove</button>}
        </div>
      ))}
      <button type="button" onClick={onAdd}>Add {label.toLowerCase().replace(/s$/u, "")}</button>
    </fieldset>
  );
}

function CitationBuilder({ records, courses, onSave, storageMode, notice }) {
  const [context, setContext] = useState(courseContext(courses[0]));
  const [draft, setDraft] = useState(() => createSourceDraft(courseContext(courses[0])));
  const [editingRootId, setEditingRootId] = useState(null);
  const [copyNotice, setCopyNotice] = useState("");
  const [checkerText, setCheckerText] = useState("");
  const [checkerStyle, setCheckerStyle] = useState("APA");
  const [checkerResult, setCheckerResult] = useState(null);
  const output = useMemo(() => formatCitationOutput({ ...draft, ...context }), [draft, context]);
  const inText = useMemo(() => formatInTextCitation({ ...draft, ...context }), [draft, context]);
  const savedSources = latestRecords(records, "source");
  const recommendedFields = SOURCE_TYPE_DEFINITIONS[draft.sourceType]?.required || [];
  const missingRecommended = recommendedFields.filter((field) => {
    if (field === "authors") return !draft.authors.some((author) => author.literal.trim() || author.family.trim() || author.given.trim());
    return !String(draft[field] || "").trim();
  });

  function setPeople(key, next) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  function updatePerson(key, index, field, value) {
    setPeople(key, draft[key].map((person, itemIndex) => itemIndex === index ? { ...person, [field]: value } : person));
  }

  function save(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.authors.some((author) => author.literal.trim() || author.family.trim() || author.given.trim())) return;
    const previous = editingRootId ? latestRecordFor(records, editingRootId) : null;
    const source = { ...draft, ...context };
    const formatted = formatCitationOutput(source);
    const record = createVersionedRecord({
      kind: "source",
      content: {
        source,
        title: draft.title.trim(),
        citationStyle: draft.citationStyle,
        citation: formatted.plain,
        citationHtml: formatted.html,
        inTextCitation: formatInTextCitation(source),
        note: draft.note.trim(),
      },
      context,
      previous,
    });
    onSave(record);
    setDraft(createSourceDraft(context));
    setEditingRootId(null);
  }

  function revise(record) {
    const source = record.content.source || {};
    setEditingRootId(record.rootId);
    setContext({
      courseId: record.courseId,
      courseCode: record.courseCode,
      courseTitle: record.courseTitle,
      lessonId: record.lessonId,
      lessonTitle: record.lessonTitle,
      lessons: courses.find((course) => course.courseCode === record.courseCode)?.lessons || [],
    });
    setDraft({ ...createSourceDraft(record), ...source, rootId: record.rootId });
  }

  return (
    <div className="citation-workspace">
      <section className="dashboard-card citation-builder-card">
        <span className="portal-kicker">SOURCE BUILDER</span>
        <h2>Learn the pattern while you cite.</h2>
        <p>Choose the source type first. The form asks for the elements that APA 7 or MLA 9 uses for that kind of source.</p>
        <form onSubmit={save}>
          <ContextFields context={context} setContext={setContext} courses={courses} />
          <div className="citation-core-grid">
            <label>Style<select value={draft.citationStyle} onChange={(event) => setDraft({ ...draft, citationStyle: event.target.value })}>{CITATION_STYLES.map((style) => <option key={style} value={style}>{CITATION_STYLE_METADATA[style].label}</option>)}</select></label>
            <label>Source type<select value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value, visibleFields: fieldsForType(event.target.value) })}>{SOURCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Collection<input value={draft.collection} onChange={(event) => setDraft({ ...draft, collection: event.target.value })} /></label>
            <label>Source title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
          </div>
          <p className={`citation-field-guide ${missingRecommended.length ? "needs-details" : "is-ready"}`}><strong>{draft.sourceType} checklist:</strong> {recommendedFields.join(", ")}. {missingRecommended.length ? `Still to collect: ${missingRecommended.join(", ")}.` : "The common core elements are present."}</p>
          <PersonEditor
            label="Authors or organizations"
            people={draft.authors}
            onChange={(index, field, value) => updatePerson("authors", index, field, value)}
            onAdd={() => setPeople("authors", [...draft.authors, createContributor()])}
            onRemove={(index) => setPeople("authors", draft.authors.filter((_, itemIndex) => itemIndex !== index))}
          />
          <PersonEditor
            label="Other contributors"
            people={draft.contributors.length ? draft.contributors : [{ ...createContributor(), role: "editor" }]}
            onChange={(index, field, value) => {
              const people = draft.contributors.length ? draft.contributors : [{ ...createContributor(), role: "editor" }];
              setPeople("contributors", people.map((person, itemIndex) => itemIndex === index ? { ...person, [field]: value } : person));
            }}
            onAdd={() => setPeople("contributors", [...draft.contributors, { ...createContributor(), role: "editor" }])}
            onRemove={(index) => setPeople("contributors", draft.contributors.filter((_, itemIndex) => itemIndex !== index))}
            includeRole
          />
          <div className="citation-detail-grid">
            {fieldsForType(draft.sourceType).map((field) => {
              const definition = OPTIONAL_FIELD_DEFINITIONS[field];
              return <label key={field}>{definition.label}<input type={definition.type || "text"} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} placeholder={definition.placeholder} /></label>;
            })}
          </div>
          <label>Why I saved this source<textarea rows={3} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="How this source supports, challenges, or changes my thinking" /></label>
          <section className="citation-preview" aria-live="polite">
            <span>{CITATION_STYLE_METADATA[draft.citationStyle].label} preview</span>
            <p dangerouslySetInnerHTML={{ __html: output.html }} />
            <p><strong>In-text:</strong> {inText}</p>
            <div><button type="button" onClick={() => copyCitation(output, setCopyNotice)}>Copy reference</button><button type="button" onClick={() => copyCitation({ plain: inText, html: plainAsHtml(inText) }, setCopyNotice)}>Copy in-text citation</button></div>
            {copyNotice && <small role="status">{copyNotice}</small>}
          </section>
          <button className="primary" type="submit">{editingRootId ? "Save next source version" : `Format and save to ${storageMode === "cloud" ? "browser + cloud" : "this browser"}`}</button>
        </form>
        {notice && <p className="learning-notice" role="status">{notice}</p>}
      </section>

      <aside className="citation-side-stack">
        <section className="dashboard-card citation-checker">
          <span className="portal-kicker">PASTED-CITATION FORMAT CHECK</span>
          <h2>Get a teachable second look.</h2>
          <p>This checks recognizable formatting patterns. It cannot verify that names, dates, titles, page numbers, or source claims are true.</p>
          <label>Style<select value={checkerStyle} onChange={(event) => { setCheckerStyle(event.target.value); setCheckerResult(null); }}>{CITATION_STYLES.map((style) => <option key={style}>{style}</option>)}</select></label>
          <label>Pasted citation<textarea rows={6} value={checkerText} onChange={(event) => setCheckerText(event.target.value)} /></label>
          <button type="button" onClick={() => setCheckerResult(checkCitationFormat(checkerText, checkerStyle))}>Check format</button>
          {checkerResult && <div className={`citation-check-result is-${checkerResult.status}`} role="status"><strong>{checkerResult.status.replace(/-/gu, " ")}</strong>{checkerResult.diagnostics.length ? <ul>{checkerResult.diagnostics.map((item) => <li key={item.code}><strong>{item.message}</strong><span>{item.teachingTip}</span></li>)}</ul> : <p>No common pattern issue was found. Compare the entry with the official example for this source type.</p>}<small>{checkerResult.disclaimer}</small></div>}
        </section>
        <section className="dashboard-card saved-source-list">
          <div className="dashboard-card-heading"><div><span className="portal-kicker">SAVED SOURCES</span><h2>Reference cabinet</h2></div><span>{savedSources.length}</span></div>
          {savedSources.length ? savedSources.map((record) => <article key={record.id}><span>{record.courseCode} · {record.content.citationStyle} · v{record.version}</span><strong>{record.title}</strong><p>{record.content.citation}</p><footer><button type="button" onClick={() => copyCitation({ plain: record.content.citation, html: record.content.source ? formatCitationOutput(record.content.source).html : plainAsHtml(record.content.citation) }, setCopyNotice)}>Copy</button><button type="button" onClick={() => revise(record)}>Create next version</button></footer></article>) : <p className="learning-empty">Your first formatted source will appear here.</p>}
        </section>
      </aside>
    </div>
  );
}

function PacketWorkspace({ records, setRecords, courses, storageScope, onSave, notice }) {
  const latest = latestRecords(records).filter((record) => ["note", "source", "feedback"].includes(record.kind));
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [context, setContext] = useState(courseContext(courses[0]));
  const [feedback, setFeedback] = useState({ title: "", body: "" });
  const [file, setFile] = useState(null);
  const [fileTitle, setFileTitle] = useState("");
  const [packetNotice, setPacketNotice] = useState("");
  const restoreRef = useRef(null);

  async function refreshFiles() {
    try {
      const deviceFiles = await listDeviceFiles();
      setFiles(deviceFiles.filter((item) => item.metadata?.workspaceScope === storageScope));
    } catch {
      setFiles([]);
    }
  }

  useEffect(() => { refreshFiles(); }, []);

  function saveFeedback(event) {
    event.preventDefault();
    if (!feedback.title.trim() || !feedback.body.trim()) return;
    onSave(createVersionedRecord({ kind: "feedback", content: feedback, context }));
    setFeedback({ title: "", body: "" });
  }

  async function saveFile(event) {
    event.preventDefault();
    if (!file) return;
    const safeName = buildDeviceFileName(file, { courseCode: context.courseCode, title: fileTitle || file.name });
    try {
      await saveDeviceFile(file, {
        safeName,
        title: fileTitle.trim() || file.name,
        courseId: context.courseId,
        courseCode: context.courseCode,
        courseTitle: context.courseTitle,
        lessonId: context.lessonId,
        lessonTitle: context.lessonTitle,
        version: 1,
        namingConvention: "digital-literacy-v1",
        workspaceScope: storageScope,
      });
      setFile(null);
      setFileTitle("");
      setPacketNotice(`${safeName} is saved in this browser's device vault.`);
      await refreshFiles();
    } catch {
      setPacketNotice("This browser could not save the file. Download or copy your work before leaving this page.");
    }
  }

  async function downloadFile(id) {
    try {
      await downloadDeviceFile(id);
      setPacketNotice("The device file was downloaded.");
    } catch {
      setPacketNotice("This browser could not find or download that device file.");
    }
  }

  function toggle(list, setter, id) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function exportPacket() {
    const selectedFileRecords = files.filter((item) => selectedFiles.includes(item.id));
    const packet = buildLearningPacket({ course: context, records, selectedRecordIds: selectedRecords, files: selectedFileRecords });
    downloadLearningPacket(packet);
    setPacketNotice("Downloaded a readable HTML packet and a JSON restore manifest. Device files remain separate so you control where they go.");
  }

  async function restore(event) {
    const restoreFile = event.target.files?.[0];
    if (!restoreFile) return;
    try {
      if (restoreFile.size > 5 * 1024 * 1024) throw new Error("The restore manifest exceeds the five-megabyte safety limit.");
      const manifest = JSON.parse(await restoreFile.text());
      const result = mergeRestoreManifest(records, manifest);
      setRecords(result.records);
      writeDeviceWorkspace(window.localStorage, storageScope, result.records);
      setPacketNotice(`${result.imported} record${result.imported === 1 ? "" : "s"} restored without overwriting existing versions.`);
    } catch (error) {
      setPacketNotice(`Restore stopped: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="packet-workspace">
      <section className="dashboard-card packet-builder">
        <span className="portal-kicker">PORTABLE LEARNING PACKET</span>
        <h2>Choose what leaves with you.</h2>
        <p>The readable copy opens in any modern browser. The restore manifest preserves structured notes, citations, feedback, versions, and file metadata without trapping the work in EdNotebook.</p>
        <ContextFields context={context} setContext={setContext} courses={courses} />
        <div className="packet-select-list">
          <h3>Notes, sources, and feedback</h3>
          {latest.length ? latest.map((record) => <label key={record.id}><input type="checkbox" checked={selectedRecords.includes(record.id)} onChange={() => toggle(selectedRecords, setSelectedRecords, record.id)} /><span><strong>{record.title}</strong><small>{record.kind} · {record.courseCode} · v{record.version} · {record.filename}</small></span></label>) : <p>No saved learning records yet.</p>}
          <h3>Device file manifest</h3>
          {files.length ? files.map((item) => <div className="packet-file-row" key={item.id}><label><input type="checkbox" checked={selectedFiles.includes(item.id)} onChange={() => toggle(selectedFiles, setSelectedFiles, item.id)} /><span><strong>{item.safeName || item.originalName}</strong><small>{item.mimeType} · stored only in this browser</small></span></label><button type="button" onClick={() => downloadFile(item.id)}>Download file</button></div>) : <p>No device files yet.</p>}
        </div>
        <div className="packet-actions"><button className="primary" type="button" onClick={exportPacket}>Download selected packet</button><button type="button" onClick={() => restoreRef.current?.click()}>Restore from JSON manifest</button><input ref={restoreRef} hidden type="file" accept="application/json,.json" onChange={restore} /></div>
        {(packetNotice || notice) && <p className="learning-notice" role="status">{packetNotice || notice}</p>}
      </section>
      <aside className="packet-side-stack">
        <section className="dashboard-card">
          <span className="portal-kicker">FEEDBACK RECORD</span>
          <h2>Keep feedback beside the work.</h2>
          <form onSubmit={saveFeedback}><ContextFields context={context} setContext={setContext} courses={courses} /><label>Feedback title<input value={feedback.title} onChange={(event) => setFeedback({ ...feedback, title: event.target.value })} placeholder="Feedback on source evaluation" required /></label><label>Feedback text<textarea rows={5} value={feedback.body} onChange={(event) => setFeedback({ ...feedback, body: event.target.value })} placeholder="Paste or summarize feedback you are allowed to keep." required /></label><button type="submit">Save feedback record</button></form>
        </section>
        <section className="dashboard-card">
          <span className="portal-kicker">DEVICE FILE + NAMING PRACTICE</span>
          <h2>Name it so future-you can find it.</h2>
          <p>Files use date · course · category · subject · version. The binary stays in this browser unless you download it.</p>
          <form onSubmit={saveFile}><ContextFields context={context} setContext={setContext} courses={courses} /><label>File title<input value={fileTitle} onChange={(event) => setFileTitle(event.target.value)} placeholder="Source evaluation worksheet" /></label><label>Choose file<input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>{file && <code>{buildDeviceFileName(file, { courseCode: context.courseCode, title: fileTitle || file.name })}</code>}<button type="submit" disabled={!file}>Save to device vault</button></form>
        </section>
      </aside>
    </div>
  );
}

export default function StudentLearningWorkspace({ classes = [], session, storageScope = "student", track = "university" }) {
  const courseOptions = useMemo(() => {
    const live = classes.map((course) => courseContext(course));
    const hasDigitalLiteracy = live.some((course) => /digital literacy/iu.test(course.courseTitle));
    return hasDigitalLiteracy ? live : [...live, DIGITAL_LITERACY_SYNTHETIC_CONTEXT];
  }, [classes]);
  const [section, setSection] = useState("notes");
  const [storageMode, setStorageMode] = useState("device");
  const [records, setRecords] = useState(() => {
    const stored = readDeviceWorkspace(window.localStorage, storageScope).records;
    const migrated = migrateLegacyStudentNotes(window.localStorage, storageScope, track, stored);
    if (migrated.imported) writeDeviceWorkspace(window.localStorage, storageScope, migrated.records);
    return migrated.records;
  });
  const [notice, setNotice] = useState("");
  const studentId = session?.user?.id || null;

  useEffect(() => {
    const stored = readDeviceWorkspace(window.localStorage, storageScope).records;
    const migrated = migrateLegacyStudentNotes(window.localStorage, storageScope, track, stored);
    if (migrated.imported) writeDeviceWorkspace(window.localStorage, storageScope, migrated.records);
    setRecords(migrated.records);
  }, [storageScope, track]);

  useEffect(() => {
    let active = true;
    loadCloudLearningRecords(studentId).then((result) => {
      if (!active || !result.data?.length) return;
      setRecords((current) => {
        const merged = combineAppendOnly(current, result.data);
        writeDeviceWorkspace(window.localStorage, storageScope, merged);
        return merged;
      });
    });
    return () => { active = false; };
  }, [studentId, storageScope]);

  async function saveRecord(record) {
    let next;
    try {
      next = appendRecord(records, record);
      setRecords(next);
      writeDeviceWorkspace(window.localStorage, storageScope, next);
      setNotice(`${record.filename} saved on this browser with append-only version history.`);
    } catch (error) {
      setNotice(error.message);
      return;
    }
    if (storageMode !== "cloud") return;
    const result = await appendCloudLearningRecord(record, studentId);
    if (result.error) {
      setNotice(`${record.filename} is safe on this browser. Private cloud sync is not enabled in this environment yet.`);
      return;
    }
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, storage: "cloud" } : item));
    setNotice(`${record.filename} saved on this browser and in your private cloud workspace.`);
  }

  return (
    <div className={`student-learning-workspace ${track === "k12" ? "is-k12" : ""}`}>
      <section className="learning-workspace-hero">
        <div><span className="portal-kicker">DIGITAL LITERACY · FIRST PRACTICE COURSE</span><h1>Read it. Check it. Credit it. Keep it.</h1><p>Notes, sources, citations, feedback, file habits, and portable copies live in one student workflow. The Digital Literacy example is synthetic practice—not a real ASU course or library record.</p></div>
        <div><strong>{latestRecords(records).length}</strong><span>retrievable records</span><small>{records.length} versions retained</small></div>
      </section>
      <StorageChoice mode={storageMode} setMode={setStorageMode} signedIn={Boolean(studentId)} />
      <nav className="learning-workspace-tabs" aria-label="Student learning workspace">
        {[["notes", "Notes + versions"], ["sources", "Sources + citations"], ["packet", "Files + learning packet"]].map(([id, label]) => <button type="button" key={id} className={section === id ? "is-active" : ""} onClick={() => { setSection(id); setNotice(""); }}>{label}</button>)}
      </nav>
      {section === "notes" && <NoteWorkspace records={records} courses={courseOptions} onSave={saveRecord} storageMode={storageMode} notice={notice} />}
      {section === "sources" && <CitationBuilder records={records} courses={courseOptions} onSave={saveRecord} storageMode={storageMode} notice={notice} />}
      {section === "packet" && <PacketWorkspace records={records} setRecords={setRecords} courses={courseOptions} storageScope={storageScope} onSave={saveRecord} notice={notice} />}
    </div>
  );
}
