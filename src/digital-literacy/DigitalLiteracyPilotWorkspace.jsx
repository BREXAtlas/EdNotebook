import { useEffect, useMemo, useRef, useState } from "react";
import {
  assignmentProgressSummary,
  buildCanonicalUnitUrl,
  firstOpenUnit,
  groupCanonicalUnits,
  instrumentQuestions,
  isCanonicalProgressMessage,
  normalizeEmbeddedProgress,
  researchStatusLabel,
} from "./digitalLiteracyPilotModel.js";
import {
  createDigitalLiteracyAssignment,
  loadDigitalLiteracyCatalog,
  loadMyActiveDigitalLiteracyResearch,
  loadMyDigitalLiteracyAssignments,
  loadProfessorDigitalLiteracyWorkspace,
  recordDigitalLiteracyResearchChoice,
  requestDigitalLiteracyResearchAction,
  submitDigitalLiteracyResearchResponse,
  syncDigitalLiteracyProgress,
} from "./digitalLiteracyPilotService.js";
import { scrollWithinHashRoute } from "../scrollWithinHashRoute.js";
import "./digital-literacy.css";

function localDueDefault() {
  const date = new Date(Date.now() + 7 * 86400000);
  date.setHours(23, 59, 0, 0);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function readableDue(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function UnitGroup({ group, selected, toggle }) {
  return <fieldset className="dl-unit-group"><legend><span>{group.path === "foundations" ? "Foundations" : "AI Quest"} · {group.groupNumber}</span>{group.title}</legend>{group.units.map((unit) => <label key={unit.unit_id}><input type="checkbox" checked={selected.has(unit.unit_id)} onChange={() => toggle(unit.unit_id)} /><span><strong>{unit.unit_id.toUpperCase()}</strong>{unit.title}</span></label>)}</fieldset>;
}

const RESEARCH_LAUNCH_CHECK_COPY = Object.freeze({
  canonical_course_release: ["Canonical 40-unit release", "Course work stays tied to the versioned Digital Literacy repository."],
  immutable_research_version: ["Immutable research version", "Purpose, instruments, dates, data rules, and course scope must be frozen together."],
  written_determination: ["Written ASU determination", "The exact version needs a current IRB/HRPP determination recorded by an authorized reviewer."],
  participant_notice_and_consent: ["Notice and consent boundary", "Approved notice and consent—or a documented written waiver—must match the determination."],
  approved_instrument_scope: ["Pre/post and qualitative scope", "Approved instruments must be versioned, minimized, and tied to their course phase."],
  course_feature_control: ["Institution feature approval", "Human-subjects collection stays disabled until the course-scoped control is explicitly enabled."],
  explicit_version_activation: ["Explicit version activation", "An institution governor must activate the exact blocker-free version."],
  governed_pseudonymized_export: ["Governed research export", "Cohort limits, keyed participant codes, and manual qualitative-text review protect disclosure."],
});

function ResearchLaunchReadiness({ readiness }) {
  const project = readiness?.projects?.[0] || null;
  const projectChecks = new Map((project?.checks || []).map((check) => [check.key, check.status]));
  const checks = Object.entries(RESEARCH_LAUNCH_CHECK_COPY).map(([key, [label, description]]) => ({
    key,
    label,
    description,
    status: key === "canonical_course_release"
      ? readiness?.canonical_course?.status || "blocked"
      : projectChecks.get(key) || "blocked",
  }));
  const collectionActive = Boolean(readiness?.research_collection_active);
  return <section className="dashboard-card dl-research-readiness"><div className="dashboard-card-heading"><div><span className="portal-kicker">FINAL PILOT EVIDENCE GATE</span><h2>Course delivery is ready. Research remains independently governed.</h2><p>This panel reads the database's live launch blockers. It cannot record an approval or activate a study.</p></div><span className={collectionActive ? "is-ready" : "is-blocked"}>{collectionActive ? "APPROVED VERSION ACTIVE" : "RESEARCH OFF"}</span></div><div className="dl-launch-boundary"><article className="is-ready"><span>COURSE WORK</span><strong>Available</strong><p>Assignments, completion, grades, feedback, and ordinary course surveys continue.</p></article><article className={collectionActive ? "is-ready" : "is-blocked"}><span>OPTIONAL RESEARCH</span><strong>{collectionActive ? "Approved version active" : "Not collecting"}</strong><p>Enrollment and course completion never count as research consent.</p></article></div><div className="dl-readiness-grid">{checks.map((check) => <article className={check.status === "pass" ? "is-ready" : "is-blocked"} key={check.key}><header><i aria-hidden="true">{check.status === "pass" ? "✓" : "○"}</i><strong>{check.label}</strong><span>{check.status === "pass" ? "PASS" : "BLOCKED"}</span></header><p>{check.description}</p></article>)}</div>{project ? <article className="dl-research-project"><header><div><strong>{project.project_title} · version {project.version_number}</strong><span>{project.version_status}</span></div><i>{project.blockers.length ? `${project.blockers.length} blocker${project.blockers.length === 1 ? "" : "s"}` : "gate complete"}</i></header><p>{project.purpose_statement}</p></article> : <div className="dl-launch-message"><strong>No research version is configured for this class.</strong><p>This is the correct fail-closed state until an authorized institution reviewer records the real written determination, approved instruments, participant notice, and data rules.</p></div>}<p className="dl-boundary-note">Any authorized dataset is pseudonymized, not anonymous. It excludes direct identifiers, enforces a minimum cohort, and requires manual disclosure review for qualitative text.</p></section>;
}

export function ProfessorDigitalLiteracyPilot({ classes = [] }) {
  const [catalog, setCatalog] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [courseId, setCourseId] = useState(classes[0]?.id || "");
  const [workspace, setWorkspace] = useState(null);
  const [selectedUnits, setSelectedUnits] = useState(() => new Set());
  const [recipientMode, setRecipientMode] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState(() => new Set());
  const [title, setTitle] = useState("Digital Literacy learning path");
  const [instructions, setInstructions] = useState("Complete each assigned chapter or quest in EdNotebook. Your completed units and stars will be recorded for you and your professor.");
  const [dueAt, setDueAt] = useState(localDueDefault);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId && classes[0]?.id) setCourseId(classes[0].id);
  }, [classes, courseId]);

  useEffect(() => {
    let active = true;
    loadDigitalLiteracyCatalog().then((result) => {
      if (active && !result.error) setCatalog(result.data);
    });
    return () => { active = false; };
  }, []);

  const previewUrl = useMemo(() => {
    const url = new URL(catalog?.source_home || "https://brexatlas.github.io/Digital-Literacy-Course/");
    url.searchParams.set("embedded", "1");
    url.searchParams.set("preview", "professor");
    return url.toString();
  }, [catalog?.source_home]);

  async function refresh(nextCourseId = courseId) {
    if (!nextCourseId) return;
    setError("");
    const result = await loadProfessorDigitalLiteracyWorkspace(nextCourseId);
    if (result.error) { setWorkspace(null); setError(result.error.message); return; }
    setWorkspace(result.data);
  }

  useEffect(() => { refresh(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = workspace?.catalog?.units || [];
  const groups = useMemo(() => groupCanonicalUnits(units), [units]);
  function toggleUnit(unitId) {
    setSelectedUnits((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId); else next.add(unitId);
      return next;
    });
  }
  function selectPath(path = null) {
    setSelectedUnits(new Set(units.filter((unit) => !path || unit.path === path).map((unit) => unit.unit_id)));
  }
  function toggleStudent(studentId) {
    setSelectedStudents((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }
  async function publish(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const result = await createDigitalLiteracyAssignment({
      courseId,
      title,
      dueAt: new Date(dueAt).toISOString(),
      unitIds: [...selectedUnits],
      studentIds: recipientMode === "selected" ? [...selectedStudents] : null,
      instructions,
    });
    if (result.error) setError(result.error.message);
    else {
      setNotice(`${result.data.title} published to ${result.data.recipient_count} student${result.data.recipient_count === 1 ? "" : "s"}. It now uses the shared calendar and notification route.`);
      setSelectedUnits(new Set());
      setSelectedStudents(new Set());
      await refresh();
    }
    setBusy(false);
  }

  return <div className="dl-professor-workspace">
    <section className="dashboard-card dl-canonical-course-card"><div><span className="portal-kicker">PLATFORM STANDARD · CANONICAL COURSE</span><h1>Digital Literacy Course</h1><p>Open and review the complete course inside EdNotebook. The same repository-backed release is available to every professor account and stays current when an approved canonical release changes.</p><dl><div><dt>Course</dt><dd>{catalog?.title || "Digital Literacy Course"}</dd></div><div><dt>Release</dt><dd>{catalog?.release_id || "Current canonical release"}</dd></div><div><dt>Content</dt><dd>{catalog?.units?.length || 40} modules, lessons, activities, and checks</dd></div></dl></div><div className="dl-canonical-course-actions"><button className="primary" type="button" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "Close full course preview" : "Open full course preview"}</button><a href="#digital-literacy-assign" onClick={(event) => scrollWithinHashRoute(event, "digital-literacy-assign")}>Assign modules to students</a></div></section>
    {previewOpen && <section className="dashboard-card dl-professor-course-preview" aria-label="Digital Literacy Course professor preview"><header><div><span className="portal-kicker">LEARNER PREVIEW · IN EDNOTEBOOK</span><h2>Full Digital Literacy Course</h2><p>Preview does not create student progress. Use the assignment controls below when you are ready to connect course units to a class.</p></div><button type="button" onClick={() => setPreviewOpen(false)}>Close preview</button></header><iframe src={previewUrl} title="Digital Literacy Course professor preview" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerPolicy="strict-origin-when-cross-origin" /></section>}
    <section id="digital-literacy-assign" tabIndex={-1} className="dashboard-card dl-pilot-hero"><div><span className="portal-kicker">ASSIGN COURSE CONTENT</span><h1>Assign Digital Literacy to any of your students.</h1><p>Every student receives the current canonical 40-unit course automatically. Choose specific Foundations episodes or AI quests for your courses; each student keeps one release-versioned progress record across EdNotebook.</p></div><label>Course<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setWorkspace(null); }}><option value="">Choose a course</option>{classes.map((course) => <option key={course.id} value={course.id}>{course.code || course.course_code || "COURSE"} · {course.title}</option>)}</select></label></section>
    {error && <div className="portal-form-error" role="alert">{error}</div>}
    {notice && <div className="portal-form-notice" role="status">{notice}</div>}
    {workspace && <>
      <section className="dashboard-card dl-source-boundary"><div><span>Source of truth</span><strong>{workspace.catalog.title}</strong><a href={workspace.catalog.source_repository} target="_blank" rel="noreferrer">Canonical repository ↗</a></div><dl><div><dt>Release</dt><dd>{workspace.catalog.release_id}</dd></div><div><dt>Catalog</dt><dd>{units.length} units</dd></div><div><dt>Content owner</dt><dd>Canonical repository</dd></div></dl></section>
      <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">PLATFORM-STANDARD PROGRESS</span><h2>Your students' canonical course progress.</h2><p>One student-owned record follows the active repository release. You see only learners currently enrolled in this class.</p></div><span>Release {workspace.standard_progress?.catalog_release || workspace.catalog.release_id}</span></div><div className="dl-professor-evidence">{(workspace.standard_progress?.learners || []).map((learner) => <div className="dl-student-evidence" key={learner.student_id}><span>{learner.display_name}</span><progress max={workspace.standard_progress.total_units} value={learner.completed_units} /><strong>{learner.completed_units}/{workspace.standard_progress.total_units}</strong><small>{learner.completed_units === workspace.standard_progress.total_units ? "complete" : learner.completed_units ? "in progress" : "ready"}</small></div>)}</div></section>
      <form className="dashboard-card dl-assignment-builder" onSubmit={publish}><div className="dashboard-card-heading"><div><span className="portal-kicker">PROFESSOR ASSIGNMENT</span><h2>Build a chapter path.</h2></div><strong>{selectedUnits.size} selected</strong></div><div className="dl-builder-fields"><label>Assignment title<input required minLength={3} maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Due date and time<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><label className="dl-wide">Student directions<textarea rows={3} maxLength={5000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div><div className="dl-quick-select"><button type="button" onClick={() => selectPath("foundations")}>All Foundations</button><button type="button" onClick={() => selectPath("ai-quest")}>All AI quests</button><button type="button" onClick={() => selectPath()}>Full 40-unit course</button><button type="button" onClick={() => setSelectedUnits(new Set())}>Clear</button></div><div className="dl-unit-groups">{groups.map((group) => <UnitGroup key={group.key} group={group} selected={selectedUnits} toggle={toggleUnit} />)}</div><fieldset className="dl-recipient-picker"><legend>Assign to</legend><label><input type="radio" name="recipient-mode" checked={recipientMode === "all"} onChange={() => setRecipientMode("all")} />All current students ({workspace.learners.length})</label><label><input type="radio" name="recipient-mode" checked={recipientMode === "selected"} onChange={() => setRecipientMode("selected")} />Selected students</label>{recipientMode === "selected" && <div>{workspace.learners.map((learner) => <label key={learner.student_id}><input type="checkbox" checked={selectedStudents.has(learner.student_id)} onChange={() => toggleStudent(learner.student_id)} />{learner.display_name}</label>)}</div>}</fieldset><button className="primary dl-publish" type="submit" disabled={busy || !selectedUnits.size || (recipientMode === "selected" && !selectedStudents.size)}>{busy ? "Publishing…" : "Publish assignment"}</button><p className="dl-boundary-note">Course work is required only by the professor's assignment. Research participation is always separate and optional.</p></form>
      <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">SHARED EVIDENCE</span><h2>Assignments and student completion.</h2></div><span>{workspace.assignments.length} published</span></div><div className="dl-professor-evidence">{workspace.assignments.length ? workspace.assignments.map((assignment) => <article key={assignment.assignment_id}><header><div><strong>{assignment.title}</strong><span>{assignment.units.length} units · due {readableDue(assignment.due_at)}</span></div><i>{assignment.status}</i></header>{assignment.recipients.map((recipient) => <div className="dl-student-evidence" key={recipient.student_id}><span>{recipient.display_name}</span><progress max={assignment.units.length} value={recipient.completed_units} /><strong>{recipient.completed_units}/{assignment.units.length}</strong><small>{recipient.status}</small></div>)}</article>) : <p>No canonical course assignments have been published for this class.</p>}</div></section>
      <ResearchLaunchReadiness readiness={workspace.research_launch_readiness} />
    </>}
  </div>;
}

export function StudentDigitalLiteracyAssignments({ track = "university", session, focusAssignmentId = null }) {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadMyDigitalLiteracyAssignments().then((result) => {
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setAssignments(result.data?.assignments || []);
    });
    return () => { active = false; };
  }, [session?.user?.id]);
  useEffect(() => {
    if (!focusAssignmentId || !assignments.some((assignment) => assignment.assignment_id === focusAssignmentId)) return;
    const assignment = document.getElementById(`digital-literacy-assignment-${focusAssignmentId}`);
    assignment?.scrollIntoView({ behavior: "smooth", block: "center" });
    assignment?.focus({ preventScroll: true });
  }, [assignments, focusAssignmentId]);
  if (error) return <section className="dashboard-card dl-student-assignments"><span className="portal-kicker">DIGITAL LITERACY COURSE</span><p>{error}</p></section>;
  return <section className="dashboard-card dl-student-assignments"><div className="dashboard-card-heading"><div><span className="portal-kicker">YOUR PLATFORM-STANDARD COURSE</span><h2>Digital Literacy is ready when you are.</h2><p>Your full canonical course appears automatically. Professor assignments use the same student-owned, release-versioned progress instead of creating duplicate completion records.</p></div><span>{assignments.filter((assignment) => assignment.status !== "completed").length} open</span></div>{assignments.length ? <div>{assignments.map((assignment) => { const summary = assignmentProgressSummary(assignment); const next = firstOpenUnit(assignment); const notificationFocus = assignment.assignment_id === focusAssignmentId; return <article id={`digital-literacy-assignment-${assignment.assignment_id}`} className={notificationFocus ? "is-notification-focus" : undefined} tabIndex={notificationFocus ? -1 : undefined} key={assignment.assignment_id}><header><div><span>{assignment.course_code || "COURSE"}</span><strong>{assignment.title}</strong><small>{assignment.course_title} · {assignment.due_at ? `due ${readableDue(assignment.due_at)}` : `release ${assignment.catalog_release}`}</small></div><i>{assignment.status}</i></header><p>{assignment.instructions}</p><div className="dl-progress-row"><progress max={summary.total} value={summary.completed} /><strong>{summary.completed}/{summary.total}</strong><span>{summary.percent}%</span></div><footer><button className="primary" type="button" disabled={!next} onClick={() => { window.location.hash = `#/student/${track}/digital-literacy/${assignment.assignment_id}/${next.unit_id}`; }}>{assignment.status === "completed" ? "Review course" : "Continue next unit"}</button><span>{next ? `${next.unit_id.toUpperCase()} · ${next.title}` : "No units assigned"}</span></footer></article>; })}</div> : <p>Your standard Digital Literacy course is being prepared.</p>}</section>;
}

function InstrumentForm({ instrument, onSubmitted }) {
  const questions = instrumentQuestions(instrument);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const result = await submitDigitalLiteracyResearchResponse(instrument.instrument_id, values);
    if (result.error) setError(result.error.message); else onSubmitted();
    setBusy(false);
  }
  return <form className="dl-instrument" onSubmit={submit}><header><strong>{instrument.title}</strong><span>{instrument.instrument_kind.replaceAll("_", " ")} · version {instrument.instrument_version}</span></header>{questions.map((question) => <label key={question.key}>{question.label}{question.help && <small>{question.help}</small>}{question.type === "textarea" ? <textarea required={question.required} rows={4} value={values[question.key] || ""} onChange={(event) => setValues({ ...values, [question.key]: event.target.value })} /> : question.type === "select" || question.type === "radio" ? <select required={question.required} value={values[question.key] || ""} onChange={(event) => setValues({ ...values, [question.key]: event.target.value })}><option value="">Choose one</option>{question.options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select> : <input required={question.required} type={question.type} value={values[question.key] || ""} onChange={(event) => setValues({ ...values, [question.key]: question.type === "number" ? Number(event.target.value) : event.target.value })} />}</label>)}{error && <div className="portal-form-error" role="alert">{error}</div>}<button type="submit" disabled={busy || !instrument.available}>{busy ? "Submitting…" : "Submit optional research response"}</button></form>;
}

function ResearchParticipationPanel({ courseId }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true); setError("");
    if (!courseId) { setProject(null); setLoading(false); return; }
    const result = await loadMyActiveDigitalLiteracyResearch(courseId);
    if (result.error) setError(result.error.message);
    else setProject(result.data?.projects?.[0] || null);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function choose(choice) {
    setError(""); setNotice("");
    const result = await recordDigitalLiteracyResearchChoice({ versionId: project.version_id, choice, noticeVersion: project.notice.version });
    if (result.error) setError(result.error.message); else { setNotice(choice === "consented" ? "Your optional participation choice was recorded." : "You declined research participation. Your course access and grades are unchanged."); await refresh(); }
  }
  async function request(requestType) {
    setError(""); setNotice("");
    const result = await requestDigitalLiteracyResearchAction(project.version_id, requestType);
    if (result.error) setError(result.error.message); else { setNotice(`${requestType} request recorded.`); await refresh(); }
  }
  if (loading) return <aside className="dl-research-participation" role="status">Checking optional research status…</aside>;
  if (error) return <aside className="dl-research-participation"><strong>Optional research is unavailable.</strong><p>{error} Course work continues normally.</p></aside>;
  if (!project) return <aside className="dl-research-participation"><strong>Research is not activated.</strong><p>No assessment or survey is collecting research data. Your course work and ordinary course feedback continue normally.</p></aside>;
  const status = project.participation_status;
  return <aside className="dl-research-participation"><header><div><span>OPTIONAL RESEARCH · SEPARATE FROM COURSE WORK</span><strong>{project.title}</strong></div><i>{researchStatusLabel(status)}</i></header><p>{project.purpose_statement}</p><div className="dl-participant-notice"><strong>Participant notice · {project.notice.version}</strong><p>{project.notice.participant_notice}</p></div>{notice && <div className="portal-form-notice" role="status">{notice}</div>}{error && <div className="portal-form-error" role="alert">{error}</div>}{status !== "consented" && status !== "withdrawn" && <div className="dl-choice-actions"><button type="button" onClick={() => choose("consented")}>I choose to participate</button><button type="button" onClick={() => choose("declined")}>No · continue course only</button></div>}{status === "consented" && <><div className="dl-instrument-list">{project.instruments.map((instrument) => instrument.submitted ? <article key={instrument.instrument_id}><strong>{instrument.title}</strong><span>Submitted {readableDue(instrument.submitted_at)}</span></article> : instrument.available ? <InstrumentForm key={instrument.instrument_id} instrument={instrument} onSubmitted={refresh} /> : <article key={instrument.instrument_id}><strong>{instrument.title}</strong><span>Opens at its approved course phase.</span></article>)}</div><div className="dl-subject-actions"><button type="button" onClick={() => request("export")}>Request my research data</button><button type="button" onClick={() => request("deletion")}>Request deletion</button><button type="button" onClick={() => request("withdrawal")}>Withdraw from research</button></div></>}{status === "withdrawn" && <p>You withdrew from this research version. Course access and completion records remain ordinary course records, not research responses.</p>}</aside>;
}

export function DigitalLiteracyCoursePage({ assignmentId, unitId, track = "university", onBack }) {
  const [assignment, setAssignment] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(unitId);
  const [error, setError] = useState("");
  const [syncState, setSyncState] = useState("Waiting for course activity");
  const iframeRef = useRef(null);
  const syncTimerRef = useRef(null);
  async function refresh() {
    const result = await loadMyDigitalLiteracyAssignments();
    if (result.error) { setError(result.error.message); return; }
    const next = (result.data?.assignments || []).find((item) => item.assignment_id === assignmentId);
    if (!next) { setError("This Digital Literacy assignment is not available to this student."); return; }
    setAssignment(next);
    if (!next.units.some((unit) => unit.unit_id === selectedUnitId)) setSelectedUnitId(firstOpenUnit(next)?.unit_id || next.units[0]?.unit_id || "");
  }
  useEffect(() => { refresh(); }, [assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    function receive(event) {
      if (!isCanonicalProgressMessage(event, iframeRef.current?.contentWindow, assignment?.catalog_release)) return;
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(async () => {
        setSyncState("Recording course progress…");
        const results = await Promise.all(normalizeEmbeddedProgress(event.data).map((progress) => syncDigitalLiteracyProgress({ ...progress, catalogRelease: assignment.catalog_release })));
        const failed = results.find((result) => result.error);
        if (failed) setSyncState(failed.error.message);
        else { setSyncState("Progress recorded for student and professor"); await refresh(); }
      }, 350);
    }
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); window.clearTimeout(syncTimerRef.current); };
  }, [assignmentId, assignment?.catalog_release]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <main className="dl-course-page"><button type="button" onClick={onBack}>← Back to assignments</button><div className="portal-form-error" role="alert">{error}</div></main>;
  if (!assignment) return <main className="dl-course-page" role="status">Opening the canonical Digital Literacy course…</main>;
  const selectedUnit = assignment.units.find((unit) => unit.unit_id === selectedUnitId) || firstOpenUnit(assignment);
  const summary = assignmentProgressSummary(assignment);
  const sourceUrl = buildCanonicalUnitUrl({ assignment, unit: selectedUnit, parentOrigin: window.location.origin });
  return <main className="dl-course-page"><header><button type="button" onClick={onBack}>← Back to assignments</button><div><span>{assignment.course_code || "COURSE"} · {assignment.title}</span><strong>{selectedUnit?.unit_id.toUpperCase()} · {selectedUnit?.title}</strong></div><div className="dl-course-page-progress"><progress max={summary.total} value={summary.completed} /><span>{summary.completed}/{summary.total} complete</span><small>{syncState}</small></div></header><div className="dl-course-shell"><nav aria-label="Assigned Digital Literacy units">{assignment.units.map((unit) => <button type="button" className={`${unit.unit_id === selectedUnit?.unit_id ? "is-active" : ""} ${unit.completed ? "is-complete" : ""}`} key={unit.unit_id} onClick={() => setSelectedUnitId(unit.unit_id)}><span>{unit.unit_id.toUpperCase()}</span><strong>{unit.title}</strong><i>{unit.completed ? `✓ ${unit.stars} star${unit.stars === 1 ? "" : "s"}` : "Open"}</i></button>)}</nav><section className="dl-course-frame"><div><strong>Canonical course content</strong><a href={assignment.source_repository} target="_blank" rel="noreferrer">View source repository ↗</a></div><iframe ref={iframeRef} key={sourceUrl} src={sourceUrl} title={`${selectedUnit?.unit_id} ${selectedUnit?.title}`} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" /></section></div><ResearchParticipationPanel courseId={assignment.course_id} /></main>;
}
