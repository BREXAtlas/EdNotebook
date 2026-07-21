import { useEffect, useMemo, useRef, useState } from "react";
import { buildColumnMappings, columnMappingPayload } from "./blackboardColumnMatcher.js";
import { generateBlackboardCsv, createExportPreview, downloadCsv } from "./blackboardCsvGenerator.js";
import { parseBlackboardFile } from "./blackboardCsvParser.js";
import { buildStudentMappings, identityMappingPayload } from "./blackboardIdentityMatcher.js";
import { exportIsReady, issueCounts, sha256Hex, validateMappings } from "./blackboardValidation.js";
import {
  confirmBlackboardExport,
  listBlackboardCourses,
  loadBlackboardCourseContext,
  recordBlackboardAudit,
  recordBlackboardDownload,
  saveBlackboardColumnMappings,
  saveBlackboardIdentityMappings,
} from "./blackboardExportService.js";
import "./blackboard-export.css";

const STEPS = [
  "Choose course",
  "Upload Blackboard file",
  "Identify file structure",
  "Match students",
  "Match grade columns",
  "Review issues",
  "Preview export",
  "Confirm and download",
  "Export history",
];

function StageShell({ step, title, description, children }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  return <section className="blackboard-stage" aria-labelledby={`blackboard-stage-${step}`}>
    <header className="blackboard-stage-heading">
      <span>STEP {step} OF {STEPS.length}</span>
      <h2 id={`blackboard-stage-${step}`} ref={headingRef} tabIndex="-1">{title}</h2>
      <p>{description}</p>
    </header>
    {children}
  </section>;
}

function StepTracker({ current }) {
  return <ol className="blackboard-step-tracker" aria-label="Blackboard export progress">
    {STEPS.map((label, index) => <li key={label} className={index + 1 === current ? "is-current" : index + 1 < current ? "is-complete" : ""} aria-current={index + 1 === current ? "step" : undefined}>
      <span>{index + 1 < current ? "Done" : index + 1}</span><strong>{label}</strong>
    </li>)}
  </ol>;
}

function StageActions({ onBack, onNext, nextLabel = "Continue", nextDisabled = false, busy = false, children }) {
  return <footer className="blackboard-stage-actions">
    <div>{onBack && <button type="button" onClick={onBack} disabled={busy}>Back</button>}{children}</div>
    {onNext && <button className="primary" type="button" onClick={onNext} disabled={nextDisabled || busy}>{busy ? "Saving…" : nextLabel}</button>}
  </footer>;
}

function CourseStage({ courses, selectedCourseId, setSelectedCourseId, loading, onNext, error }) {
  return <StageShell step={1} title="Choose the EdNotebook course." description="Only courses you are authorized to manage appear here. The selected course supplies learners, assignments, and finalized grades.">
    {loading && <div className="blackboard-empty" role="status">Loading your manageable courses…</div>}
    {!loading && !courses.length && <div className="blackboard-empty"><h3>No manageable courses yet.</h3><p>Create a course or ask an institution administrator to add you as a professor before exporting grades.</p></div>}
    {error && <div className="blackboard-error" role="alert">{error}</div>}
    <div className="blackboard-course-grid">
      {courses.map((course) => <label key={course.id} className={selectedCourseId === course.id ? "is-selected" : ""}>
        <input type="radio" name="blackboard-course" value={course.id} checked={selectedCourseId === course.id} onChange={() => setSelectedCourseId(course.id)} />
        <span>{course.course_code || "COURSE"}</span>
        <strong>{course.title}</strong>
        <small>{course.teaching_window || "Teaching window not set"}</small>
        <dl>
          <div><dt>Learners</dt><dd>{course.enrolled_learners || 0}</dd></div>
          <div><dt>Grade items</dt><dd>{course.grade_items || 0}</dd></div>
          <div><dt>Finalized</dt><dd>{course.finalized_grades || 0}</dd></div>
          <div><dt>Awaiting grading</dt><dd>{course.awaiting_grading || 0}</dd></div>
        </dl>
      </label>)}
    </div>
    <StageActions onNext={onNext} nextLabel="Use this course" nextDisabled={!selectedCourseId || loading} />
  </StageShell>;
}

function UploadStage({ course, onBack, onFile, busy, error }) {
  return <StageShell step={2} title="Upload a Blackboard gradebook CSV." description="Download the current gradebook from Blackboard, then upload that CSV here. EdNotebook will preserve its structure and insert only the grades you approve.">
    <div className="blackboard-upload-card">
      <div><span>SELECTED COURSE</span><strong>{course?.course_code || "COURSE"} · {course?.title}</strong></div>
      <label>
        <strong>Upload a Blackboard gradebook CSV</strong>
        <span>.csv · UTF-8 · comma-delimited · 10 MB maximum</span>
        <input type="file" accept=".csv,text/csv" onChange={(event) => onFile(event.target.files?.[0] || null)} disabled={busy} />
      </label>
      <aside><strong>Private by design</strong><p>The file stays in this browser session. EdNotebook records hashes and export history, not a public copy of the gradebook.</p></aside>
    </div>
    {busy && <div className="blackboard-status" role="status">Reading and checking the Blackboard file…</div>}
    {error && <div className="blackboard-error" role="alert">{error}</div>}
    <StageActions onBack={onBack} />
  </StageShell>;
}

function StructureStage({ sourceFile, structure, onBack, onNext }) {
  const structuralCounts = issueCounts(structure.issues);
  return <StageShell step={3} title="Review the detected file structure." description="EdNotebook keeps the original headers, column order, row order, identifiers, and unknown columns. Review what was detected before matching records.">
    <div className="blackboard-structure-grid">
      <article><span>Source file</span><strong>{sourceFile.name}</strong><small>{structure.encoding}</small></article>
      <article><span>Rows</span><strong>{structure.rowCount}</strong><small>Original order retained</small></article>
      <article><span>Columns</span><strong>{structure.columnCount}</strong><small>{structure.blankColumns.length} blank</small></article>
      <article><span>Likely identity columns</span><strong>{structure.identityColumns.length}</strong><small>{structure.identityColumns.map((item) => item.header).slice(0, 3).join(", ") || "None found"}</small></article>
      <article><span>Likely grade columns</span><strong>{structure.gradeColumns.length}</strong><small>{structure.gradeColumns.map((item) => item.header).slice(0, 3).join(", ") || "None found"}</small></article>
      <article><span>Unknown columns preserved</span><strong>{structure.unknownColumns.length}</strong><small>Never discarded automatically</small></article>
    </div>
    <section className="blackboard-detected-columns"><h3>Detected columns</h3><div>{structure.columns.map((column) => <span key={`${column.index}-${column.header}`}><strong>{column.header || `Blank column ${column.index + 1}`}</strong><small>{column.kind}{column.protected ? " · calculated/protected" : ""}{column.pointsPossible !== null ? ` · ${column.pointsPossible} points` : ""}</small></span>)}</div></section>
    {structure.issues.length > 0 && <section className="blackboard-inline-issues" aria-label="File checks"><h3>File checks</h3>{structure.issues.map((item, index) => <p className={`is-${item.severity}`} key={`${item.code}-${index}`}><strong>{item.severity}</strong>{item.message}</p>)}</section>}
    <StageActions onBack={onBack} onNext={onNext} nextLabel="Match students" nextDisabled={structuralCounts.blocking > 0} />
  </StageShell>;
}

function StudentStage({ context, mappings, setMappings, onBack, onNext, busy, error }) {
  const changeLearner = (rowIndex, learnerId) => setMappings(mappings.map((mapping) => mapping.rowIndex === rowIndex ? { ...mapping, learnerId, confidence: "manual", method: "Professor selected", status: learnerId ? "review" : "unmatched", excluded: false } : mapping));
  const update = (rowIndex, changes) => setMappings(mappings.map((mapping) => mapping.rowIndex === rowIndex ? { ...mapping, ...changes } : mapping));
  return <StageShell step={4} title="Match Blackboard students to EdNotebook learners." description="Exact saved IDs and emails can be high confidence. Similar names are never accepted automatically. Review uncertain rows before continuing.">
    <div className="blackboard-table-scroll" tabIndex="0" aria-label="Student mapping table, horizontally scrollable">
      <table className="blackboard-mapping-table">
        <thead><tr><th scope="col">Blackboard student</th><th scope="col">EdNotebook learner</th><th scope="col">Match</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
        <tbody>{mappings.map((mapping) => <tr key={mapping.rowIndex}>
          <td><strong>{mapping.displayName}</strong><small>{mapping.username || mapping.sis_user_id || mapping.student_id || mapping.email || "No identifier"}</small></td>
          <td><label><span className="sr-only">EdNotebook learner for {mapping.displayName}</span><select value={mapping.learnerId} onChange={(event) => changeLearner(mapping.rowIndex, event.target.value)} disabled={mapping.excluded}><option value="">Leave unmatched</option>{context.learners.map((learner) => <option value={learner.id} key={learner.id}>{learner.full_name || learner.email} · {learner.email || "no email"}</option>)}</select></label></td>
          <td><strong>{mapping.method}</strong><small>{mapping.confidence === "none" ? "No confidence" : `${mapping.confidence} confidence`}</small></td>
          <td><span className={`blackboard-status-pill is-${mapping.excluded ? "excluded" : mapping.status}`}>{mapping.excluded ? "Excluded" : mapping.status}</span></td>
          <td><div className="blackboard-row-actions">
            {mapping.learnerId && !mapping.excluded && mapping.status !== "accepted" && <button type="button" onClick={() => update(mapping.rowIndex, { status: "accepted", confidence: mapping.confidence === "none" ? "manual" : mapping.confidence })}>Accept match</button>}
            <button type="button" onClick={() => update(mapping.rowIndex, { excluded: !mapping.excluded, status: mapping.excluded ? (mapping.learnerId ? "review" : "unmatched") : "excluded" })}>{mapping.excluded ? "Include" : "Exclude"}</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
    {error && <div className="blackboard-error" role="alert">{error}</div>}
    <StageActions onBack={onBack} onNext={onNext} nextLabel="Save student matches" busy={busy} />
  </StageShell>;
}

function mappingSelectionValue(mapping) {
  return mapping.mappingType === "grade_item" ? `grade:${mapping.gradeItemId}` : mapping.mappingType;
}

function ColumnStage({ context, mappings, setMappings, onBack, onNext, busy, error }) {
  const update = (columnIndex, changes) => setMappings(mappings.map((mapping) => mapping.columnIndex === columnIndex ? { ...mapping, ...changes } : mapping));
  const choose = (mapping, value) => {
    if (value.startsWith("grade:")) {
      const gradeItemId = value.slice(6);
      const item = context.gradeItems.find((candidate) => candidate.id === gradeItemId);
      const sameMaximum = mapping.pointsPossible !== null && Math.abs(Number(mapping.pointsPossible) - Number(item?.max_points)) < 0.001;
      update(mapping.columnIndex, { mappingType: "grade_item", gradeItemId, scalingMode: sameMaximum ? "raw" : "none", status: "review", confidence: "manual", method: "Professor selected" });
    } else {
      update(mapping.columnIndex, { mappingType: value, gradeItemId: "", scalingMode: value === "ignore" ? "none" : "percentage", status: "accepted", confidence: "manual", method: "Professor selected" });
    }
  };
  return <StageShell step={5} title="Match Blackboard grade columns." description="Choose the EdNotebook grade source for each Blackboard column. When maximum points differ, select an explicit scaling rule and review the calculation before export.">
    <div className="blackboard-table-scroll" tabIndex="0" aria-label="Grade column mapping table, horizontally scrollable">
      <table className="blackboard-mapping-table blackboard-column-table">
        <thead><tr><th scope="col">Blackboard column</th><th scope="col">EdNotebook source</th><th scope="col">Scaling</th><th scope="col">Match</th><th scope="col">Action</th></tr></thead>
        <tbody>{mappings.map((mapping) => <tr key={mapping.columnIndex}>
          <td><strong>{mapping.columnName}</strong><small>{mapping.pointsPossible !== null ? `${mapping.pointsPossible} points possible` : "Points not detected"}{mapping.protected ? " · calculated/protected" : ""}</small></td>
          <td><label><span className="sr-only">EdNotebook source for {mapping.columnName}</span><select value={mappingSelectionValue(mapping)} onChange={(event) => choose(mapping, event.target.value)}><option value="ignore">Do not update</option><option value="course_completion">Course completion score</option><option value="final_course_grade">Final course grade</option>{context.gradeItems.map((item) => <option value={`grade:${item.id}`} key={item.id}>{item.title} · {item.max_points} points</option>)}</select></label></td>
          <td>{mapping.mappingType === "grade_item" ? <label><span className="sr-only">Scaling for {mapping.columnName}</span><select value={mapping.scalingMode} onChange={(event) => update(mapping.columnIndex, { scalingMode: event.target.value, status: "review" })}><option value="none">Choose a rule</option><option value="raw">Preserve raw score</option><option value="proportional">Scale proportionally</option><option value="percentage">Export percentage</option></select></label> : <span>{mapping.mappingType === "ignore" ? "No change" : "Percentage"}</span>}</td>
          <td><strong>{mapping.method}</strong><small>{mapping.confidence === "none" ? "No automatic match" : `${mapping.confidence} confidence`}</small></td>
          <td>{mapping.mappingType !== "ignore" && mapping.status !== "accepted" ? <button type="button" onClick={() => update(mapping.columnIndex, { status: "accepted" })} disabled={mapping.mappingType === "grade_item" && mapping.scalingMode === "none"}>Accept mapping</button> : <span className={`blackboard-status-pill is-${mapping.status}`}>{mapping.mappingType === "ignore" ? "Unchanged" : "Accepted"}</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {error && <div className="blackboard-error" role="alert">{error}</div>}
    <StageActions onBack={onBack} onNext={onNext} nextLabel="Save column matches" busy={busy} />
  </StageShell>;
}

function IssueStage({ issues, onBack, onNext }) {
  const counts = issueCounts(issues);
  return <StageShell step={6} title="Review unmatched records and grade checks." description="Blocking issues must be resolved before export. Warnings explain records that will remain unchanged; information confirms intentional exclusions.">
    <div className="blackboard-issue-summary"><article><strong>{counts.blocking}</strong><span>Blocking</span></article><article><strong>{counts.warning}</strong><span>Warnings</span></article><article><strong>{counts.information}</strong><span>Information</span></article></div>
    {!issues.length && <div className="blackboard-success"><strong>Ready for preview.</strong><p>No mapping or grade issues were found.</p></div>}
    <div className="blackboard-issue-list">{issues.map((item, index) => <article className={`is-${item.severity}`} key={`${item.code}-${index}`}><span>{item.severity}</span><p>{item.message}</p></article>)}</div>
    <StageActions onBack={onBack} onNext={onNext} nextLabel="Generate preview" nextDisabled={counts.blocking > 0} />
  </StageShell>;
}

function PreviewStage({ course, sourceFile, preview, issues, filter, setFilter, onBack, onNext }) {
  const counts = issueCounts(issues);
  const visible = preview.rows.filter((row) => filter === "all" || (filter === "changed" ? row.status === "Changed" : filter === "unchanged" ? row.status === "Unchanged" : filter === "missing" ? !["Changed", "Unchanged"].includes(row.status) : true));
  return <StageShell step={7} title="Preview the exact grade changes." description="This preview shows each approved Blackboard row and column before the file is generated. Unrelated and unknown columns remain untouched.">
    <div className="blackboard-preview-summary">
      <article><span>Blackboard rows</span><strong>{preview.sourceRows}</strong></article><article><span>Matched learners</span><strong>{preview.matchedStudents}</strong></article><article><span>Grades changing</span><strong>{preview.changedGradeCells}</strong></article><article><span>Unchanged mapped cells</span><strong>{preview.unchangedCells}</strong></article><article><span>Warnings</span><strong>{counts.warning}</strong></article>
    </div>
    <div className="blackboard-preview-meta"><span><strong>Course</strong>{course.course_code} · {course.title}</span><span><strong>Source</strong>{sourceFile.name}</span><span><strong>Generated</strong>{new Date(preview.generatedAt).toLocaleString()}</span></div>
    <div className="blackboard-filter-bar" aria-label="Filter export preview"><button className={filter === "all" ? "is-active" : ""} type="button" onClick={() => setFilter("all")}>All</button><button className={filter === "changed" ? "is-active" : ""} type="button" onClick={() => setFilter("changed")}>Changed</button><button className={filter === "unchanged" ? "is-active" : ""} type="button" onClick={() => setFilter("unchanged")}>Unchanged</button><button className={filter === "missing" ? "is-active" : ""} type="button" onClick={() => setFilter("missing")}>Missing or pending</button></div>
    <div className="blackboard-table-scroll" tabIndex="0" aria-label="Export preview table, horizontally scrollable">
      <table className="blackboard-preview-table"><thead><tr><th scope="col">Blackboard learner</th><th scope="col">Identifier</th><th scope="col">EdNotebook learner</th><th scope="col">Grade column</th><th scope="col">Previous</th><th scope="col">New</th><th scope="col">Maximum</th><th scope="col">Status</th></tr></thead><tbody>{visible.slice(0, 500).map((row, index) => <tr key={`${row.rowIndex}-${row.columnIndex}-${index}`}><td>{row.blackboardLearner}</td><td>{row.blackboardIdentifier}</td><td>{row.ednotebookLearner}</td><td>{row.gradeColumn}</td><td>{row.previousValue || "Blank"}</td><td>{row.newValue || "No change"}</td><td>{row.maximumPoints ?? "Not detected"}</td><td>{row.status}</td></tr>)}</tbody></table>
    </div>
    {visible.length > 500 && <p className="blackboard-table-note">Showing the first 500 preview rows. The downloaded CSV includes all approved changes.</p>}
    <StageActions onBack={onBack} onNext={onNext} nextLabel="Review confirmation" nextDisabled={!preview.changedGradeCells || counts.blocking > 0} />
  </StageShell>;
}

function ConfirmStage({ course, sourceFile, exportFilename, preview, issues, confirmed, setConfirmed, onBack, onConfirm, busy, error }) {
  const counts = issueCounts(issues);
  return <StageShell step={8} title="Confirm and download the Blackboard file." description="The CSV updates Blackboard only after you upload it there. EdNotebook does not sign in to Blackboard or send grades automatically.">
    <div className="blackboard-confirm-card">
      <dl><div><dt>Course</dt><dd>{course.course_code} · {course.title}</dd></div><div><dt>Matched learners</dt><dd>{preview.matchedStudents}</dd></div><div><dt>Grade cells changing</dt><dd>{preview.changedGradeCells}</dd></div><div><dt>Warnings reviewed</dt><dd>{counts.warning}</dd></div><div><dt>File</dt><dd>{exportFilename}</dd></div></dl>
      <label className="blackboard-confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the student matches, assignment mappings, grade values, and warnings. I understand that this file will update Blackboard only after I upload it there.</span></label>
      <p><strong>Uploaded template:</strong> {sourceFile.name}. EdNotebook will preserve its original structure and modify only approved grade cells.</p>
    </div>
    {error && <div className="blackboard-error" role="alert">{error}</div>}
    <StageActions onBack={onBack} onNext={onConfirm} nextLabel="Confirm and download CSV" nextDisabled={!confirmed || counts.blocking > 0} busy={busy} />
  </StageShell>;
}

function HistoryStage({ course, context, exportRecord, onStartOver, onClose }) {
  const history = exportRecord ? [exportRecord, ...(context.history || []).filter((item) => item.id !== exportRecord.id)] : context.history || [];
  return <StageShell step={9} title="Export history." description="EdNotebook keeps permanent reconciliation metadata and hashes. The Blackboard gradebook file itself is not stored publicly or placed in GitHub.">
    {exportRecord && <div className="blackboard-success" role="status"><strong>Your Blackboard-compatible CSV was generated.</strong><p>Upload the downloaded file in Blackboard when you are ready. Original EdNotebook grades were not changed.</p></div>}
    <div className="blackboard-history-list">{history.length ? history.map((item) => <article key={item.id}><header><div><strong>{item.export_filename}</strong><span>{new Date(item.generated_at || item.created_at).toLocaleString()}</span></div><span className="blackboard-status-pill is-accepted">{item.status}</span></header><dl><div><dt>Source file</dt><dd>{item.source_filename}</dd></div><div><dt>Matched students</dt><dd>{item.matched_students}</dd></div><div><dt>Grades changed</dt><dd>{item.changed_grade_cells}</dd></div><div><dt>Warnings</dt><dd>{item.warning_count}</dd></div></dl></article>) : <div className="blackboard-empty"><h3>No exports recorded for this course.</h3><p>The first confirmed export will appear here.</p></div>}</div>
    <StageActions><button type="button" onClick={onStartOver}>Create another export</button><button className="primary" type="button" onClick={onClose}>Return to gradebook</button></StageActions>
  </StageShell>;
}

function safeFilenamePart(value, fallback) {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function buildExportFilename(course) {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return `blackboard-grades-${safeFilenamePart(course.course_code, "course")}-${stamp}.csv`;
}

export default function BlackboardExportWorkspace({ onClose }) {
  const [step, setStep] = useState(1);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [context, setContext] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceFileHash, setSourceFileHash] = useState("");
  const [parsed, setParsed] = useState(null);
  const [structure, setStructure] = useState(null);
  const [studentMappings, setStudentMappings] = useState([]);
  const [columnMappings, setColumnMappings] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [confirmed, setConfirmed] = useState(false);
  const [exportRecord, setExportRecord] = useState(null);
  const historyAuditRecorded = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    listBlackboardCourses().then(({ data }) => {
      if (!active) return;
      setCourses(data);
      if (data.length === 1) setSelectedCourseId(data[0].id);
    }).catch((loadError) => active && setError(loadError.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (step !== 9 || !selectedCourseId || historyAuditRecorded.current) return;
    historyAuditRecorded.current = true;
    recordBlackboardAudit(selectedCourseId, "blackboard.history_viewed", {
      export_id: exportRecord?.id || null,
    }).catch(() => { /* History remains readable if the optional view audit cannot be recorded. */ });
  }, [step, selectedCourseId, exportRecord?.id]);

  const course = context?.course || courses.find((item) => item.id === selectedCourseId) || null;
  const issues = useMemo(() => structure && context ? validateMappings({ structure, context, studentMappings, columnMappings, preview }) : [], [structure, context, studentMappings, columnMappings, preview]);
  const exportFilename = course ? buildExportFilename(course) : "blackboard-grades.csv";

  async function chooseCourse() {
    setBusy(true); setError("");
    try {
      const loaded = await loadBlackboardCourseContext(selectedCourseId);
      setContext(loaded);
      setStep(2);
      setAnnouncement(`Loaded ${loaded.course?.title || "course"} for Blackboard export.`);
    } catch (loadError) { setError(loadError.message); } finally { setBusy(false); }
  }

  async function readFile(file) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseBlackboardFile(file);
      const students = buildStudentMappings({ parsed: result.parsed, structure: result.structure, learners: context.learners, savedMappings: context.identityMappings });
      const columns = buildColumnMappings({ structure: result.structure, gradeItems: context.gradeItems, savedMappings: context.columnMappings });
      setSourceFile(file);
      setSourceFileHash(await sha256Hex(buffer));
      setParsed(result.parsed);
      setStructure(result.structure);
      setStudentMappings(students);
      setColumnMappings(columns);
      setPreview(null);
      setStep(3);
      setAnnouncement(`Parsed ${result.structure.rowCount} rows and ${result.structure.columnCount} columns from ${file.name}.`);
      await recordBlackboardAudit(selectedCourseId, "blackboard.template_uploaded", { source_filename: file.name, total_rows: result.structure.rowCount, total_columns: result.structure.columnCount });
    } catch (fileError) { setError(fileError.message || "The Blackboard file could not be read."); } finally { setBusy(false); }
  }

  async function saveStudents() {
    setBusy(true); setError("");
    try {
      const accepted = studentMappings.filter((mapping) => mapping.status === "accepted" && mapping.learnerId && !mapping.excluded).map(identityMappingPayload);
      await saveBlackboardIdentityMappings(selectedCourseId, accepted);
      setStep(5);
      setAnnouncement(`${accepted.length} student match${accepted.length === 1 ? "" : "es"} saved.`);
    } catch (saveError) { setError(saveError.message); } finally { setBusy(false); }
  }

  async function saveColumns() {
    setBusy(true); setError("");
    try {
      const payload = columnMappings.filter((mapping) => mapping.status === "accepted").map(columnMappingPayload);
      await saveBlackboardColumnMappings(selectedCourseId, payload);
      setStep(6);
      setAnnouncement(`${payload.length} Blackboard column decision${payload.length === 1 ? "" : "s"} saved.`);
    } catch (saveError) { setError(saveError.message); } finally { setBusy(false); }
  }

  async function generatePreview() {
    const generated = createExportPreview({ parsed, context, studentMappings, columnMappings });
    const complete = { ...generated, sourceRows: parsed.rows.length, generatedAt: new Date().toISOString() };
    setPreview(complete);
    setPreviewFilter("all");
    setStep(7);
    setAnnouncement(`Preview generated with ${complete.changedGradeCells} grade changes.`);
    try { await recordBlackboardAudit(selectedCourseId, "blackboard.preview_generated", { changed_grade_cells: complete.changedGradeCells, matched_students: complete.matchedStudents }); } catch { /* Confirmation RPC still records the final audit trail. */ }
  }

  async function confirmAndDownload() {
    setBusy(true); setError("");
    try {
      const currentIssues = validateMappings({ structure, context, studentMappings, columnMappings, preview });
      if (!exportIsReady(currentIssues)) throw new Error("Return to Review issues and resolve the blocking items before downloading.");
      const csv = generateBlackboardCsv(parsed, preview.changes);
      const outputBytes = new TextEncoder().encode(csv);
      const outputFileHash = await sha256Hex(outputBytes);
      const mappingSnapshot = {
        students: studentMappings.filter((mapping) => mapping.status === "accepted" && !mapping.excluded).map((mapping) => ({ row_key: mapping.rowKey, learner_id: mapping.learnerId, match_method: mapping.method })),
        columns: columnMappings.filter((mapping) => mapping.status === "accepted").map(columnMappingPayload),
      };
      const counts = issueCounts(currentIssues);
      const result = await confirmBlackboardExport({
        courseId: selectedCourseId,
        sourceFilename: sourceFile.name,
        sourceFileHash,
        outputFileHash,
        outputByteLength: outputBytes.byteLength,
        exportFilename,
        formatDetected: `Blackboard CSV · ${structure.encoding}`,
        totalRows: parsed.rows.length,
        matchedStudents: preview.matchedStudents,
        unmatchedStudents: studentMappings.filter((mapping) => !mapping.excluded && mapping.status !== "accepted").length,
        mappedColumns: columnMappings.filter((mapping) => mapping.status === "accepted" && mapping.mappingType !== "ignore").length,
        changedGradeCells: preview.changedGradeCells,
        warningCount: counts.warning,
        mappingSnapshot,
        gradeSnapshot: preview.gradeSnapshot,
      });
      downloadCsv(csv, exportFilename);
      await recordBlackboardDownload(result.data.id);
      const record = {
        ...result.data,
        status: "downloaded",
        source_filename: sourceFile.name,
        export_filename: exportFilename,
        matched_students: preview.matchedStudents,
        changed_grade_cells: preview.changedGradeCells,
        warning_count: counts.warning,
        generated_at: result.data.generated_at || new Date().toISOString(),
      };
      setExportRecord(record);
      const refreshed = await loadBlackboardCourseContext(selectedCourseId);
      setContext(refreshed);
      setStep(9);
      setAnnouncement("Blackboard-compatible CSV downloaded and export history recorded.");
    } catch (confirmError) { setError(confirmError.message || "The Blackboard export could not be generated."); } finally { setBusy(false); }
  }

  function startOver() {
    historyAuditRecorded.current = false;
    setSourceFile(null); setSourceFileHash(""); setParsed(null); setStructure(null); setStudentMappings([]); setColumnMappings([]); setPreview(null); setConfirmed(false); setExportRecord(null); setError(""); setStep(2);
  }

  return <section className="blackboard-export-workspace">
    <header className="blackboard-export-header"><div><span className="portal-kicker">EXPORT &amp; INTEGRATIONS</span><h1>Export grades to Blackboard</h1><p>Use the Blackboard gradebook file as the template, review every match, and download an updated CSV for manual upload.</p></div><button type="button" onClick={onClose}>Close export</button></header>
    {context?.source === "demo" && <div className="blackboard-demo-note"><strong>Demonstration data</strong><span>Connect the Supabase migration to use real courses, grades, mappings, and permanent history.</span></div>}
    <StepTracker current={step} />
    <div className="sr-only" aria-live="polite">{announcement}</div>
    {step === 1 && <CourseStage courses={courses} selectedCourseId={selectedCourseId} setSelectedCourseId={setSelectedCourseId} loading={loading || busy} onNext={chooseCourse} error={error} />}
    {step === 2 && <UploadStage course={course} onBack={() => setStep(1)} onFile={readFile} busy={busy} error={error} />}
    {step === 3 && <StructureStage sourceFile={sourceFile} structure={structure} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
    {step === 4 && <StudentStage context={context} mappings={studentMappings} setMappings={setStudentMappings} onBack={() => setStep(3)} onNext={saveStudents} busy={busy} error={error} />}
    {step === 5 && <ColumnStage context={context} mappings={columnMappings} setMappings={setColumnMappings} onBack={() => setStep(4)} onNext={saveColumns} busy={busy} error={error} />}
    {step === 6 && <IssueStage issues={issues} onBack={() => setStep(5)} onNext={generatePreview} />}
    {step === 7 && <PreviewStage course={course} sourceFile={sourceFile} preview={preview} issues={issues} filter={previewFilter} setFilter={setPreviewFilter} onBack={() => { setPreview(null); setStep(6); }} onNext={() => setStep(8)} />}
    {step === 8 && <ConfirmStage course={course} sourceFile={sourceFile} exportFilename={exportFilename} preview={preview} issues={issues} confirmed={confirmed} setConfirmed={setConfirmed} onBack={() => setStep(7)} onConfirm={confirmAndDownload} busy={busy} error={error} />}
    {step === 9 && <HistoryStage course={course} context={context} exportRecord={exportRecord} onStartOver={startOver} onClose={onClose} />}
  </section>;
}
