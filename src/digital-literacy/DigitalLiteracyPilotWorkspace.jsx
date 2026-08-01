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
  loadMyActiveDigitalLiteracyResearch,
  loadMyDigitalLiteracyAssignments,
  loadProfessorDigitalLiteracyWorkspace,
  recordDigitalLiteracyResearchChoice,
  requestDigitalLiteracyResearchAction,
  submitDigitalLiteracyResearchResponse,
  syncDigitalLiteracyProgress,
} from "./digitalLiteracyPilotService.js";
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

export function ProfessorDigitalLiteracyPilot({ classes = [] }) {
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
    <section className="dashboard-card dl-pilot-hero"><div><span className="portal-kicker">CANONICAL COURSE · PILOT READINESS</span><h1>Assign the full Digital Literacy course without copying it.</h1><p>Choose any of the 20 Foundations episodes and 20 AI quests from the real BREXAtlas course repository. Students complete them inside EdNotebook; both sides see the same recorded evidence.</p></div><label>Class<select value={courseId} onChange={(event) => { setCourseId(event.target.value); setWorkspace(null); }}><option value="">Choose a class</option>{classes.map((course) => <option key={course.id} value={course.id}>{course.code || course.course_code || "CLASS"} · {course.title}</option>)}</select></label></section>
    {error && <div className="portal-form-error" role="alert">{error}</div>}
    {notice && <div className="portal-form-notice" role="status">{notice}</div>}
    {workspace && <>
      <section className="dashboard-card dl-source-boundary"><div><span>Source of truth</span><strong>{workspace.catalog.title}</strong><a href={workspace.catalog.source_repository} target="_blank" rel="noreferrer">Canonical repository ↗</a></div><dl><div><dt>Release</dt><dd>{workspace.catalog.release_id}</dd></div><div><dt>Catalog</dt><dd>{units.length} units</dd></div><div><dt>Content owner</dt><dd>Canonical repository</dd></div></dl></section>
      <form className="dashboard-card dl-assignment-builder" onSubmit={publish}><div className="dashboard-card-heading"><div><span className="portal-kicker">PROFESSOR ASSIGNMENT</span><h2>Build a chapter path.</h2></div><strong>{selectedUnits.size} selected</strong></div><div className="dl-builder-fields"><label>Assignment title<input required minLength={3} maxLength={220} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Due date and time<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><label className="dl-wide">Student directions<textarea rows={3} maxLength={5000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></div><div className="dl-quick-select"><button type="button" onClick={() => selectPath("foundations")}>All Foundations</button><button type="button" onClick={() => selectPath("ai-quest")}>All AI quests</button><button type="button" onClick={() => selectPath()}>Full 40-unit course</button><button type="button" onClick={() => setSelectedUnits(new Set())}>Clear</button></div><div className="dl-unit-groups">{groups.map((group) => <UnitGroup key={group.key} group={group} selected={selectedUnits} toggle={toggleUnit} />)}</div><fieldset className="dl-recipient-picker"><legend>Assign to</legend><label><input type="radio" name="recipient-mode" checked={recipientMode === "all"} onChange={() => setRecipientMode("all")} />All current students ({workspace.learners.length})</label><label><input type="radio" name="recipient-mode" checked={recipientMode === "selected"} onChange={() => setRecipientMode("selected")} />Selected students</label>{recipientMode === "selected" && <div>{workspace.learners.map((learner) => <label key={learner.student_id}><input type="checkbox" checked={selectedStudents.has(learner.student_id)} onChange={() => toggleStudent(learner.student_id)} />{learner.display_name}</label>)}</div>}</fieldset><button className="primary dl-publish" type="submit" disabled={busy || !selectedUnits.size || (recipientMode === "selected" && !selectedStudents.size)}>{busy ? "Publishing…" : "Publish assignment"}</button><p className="dl-boundary-note">Course work is required only by the professor's assignment. Research participation is always separate and optional.</p></form>
      <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">SHARED EVIDENCE</span><h2>Assignments and student completion.</h2></div><span>{workspace.assignments.length} published</span></div><div className="dl-professor-evidence">{workspace.assignments.length ? workspace.assignments.map((assignment) => <article key={assignment.assignment_id}><header><div><strong>{assignment.title}</strong><span>{assignment.units.length} units · due {readableDue(assignment.due_at)}</span></div><i>{assignment.status}</i></header>{assignment.recipients.map((recipient) => <div className="dl-student-evidence" key={recipient.student_id}><span>{recipient.display_name}</span><progress max={assignment.units.length} value={recipient.completed_units} /><strong>{recipient.completed_units}/{assignment.units.length}</strong><small>{recipient.status}</small></div>)}</article>) : <p>No canonical course assignments have been published for this class.</p>}</div></section>
      <section className="dashboard-card dl-research-readiness"><div className="dashboard-card-heading"><div><span className="portal-kicker">OPTIONAL RESEARCH MODE</span><h2>Digital Literacy pilot research readiness.</h2></div><span className={workspace.research.some((project) => project.status === "active" && !project.blockers.length) ? "is-ready" : "is-blocked"}>{workspace.research.some((project) => project.status === "active" && !project.blockers.length) ? "ACTIVE" : "NOT ACTIVATED"}</span></div><div className="dl-readiness-grid">{["Paired pre/post assessment", "Open-ended survey", "Qualitative interview", "Consent or written waiver", "Pseudonymized governed export"].map((item) => <article key={item}><strong>{item}</strong><span>Uses the immutable research version and exact course-unit scope.</span></article>)}</div>{workspace.research.length ? workspace.research.map((project) => <article className="dl-research-project" key={project.version_id}><strong>{project.project_title} · version {project.version_number}</strong><span>{project.status} · {project.blockers.length ? `${project.blockers.length} blocker${project.blockers.length === 1 ? "" : "s"}` : "gate complete"}</span><p>{project.purpose_statement}</p></article>) : <p>No research project version is active. Assignments, completion, grades, and ordinary course feedback continue normally. An authorized institution reviewer must record the written ASU determination before research collection can open.</p>}</section>
    </>}
  </div>;
}

export function StudentDigitalLiteracyAssignments({ track = "university", session }) {
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
  if (error) return <section className="dashboard-card dl-student-assignments"><span className="portal-kicker">DIGITAL LITERACY COURSE</span><p>{error}</p></section>;
  return <section className="dashboard-card dl-student-assignments"><div className="dashboard-card-heading"><div><span className="portal-kicker">FULL DIGITAL LITERACY COURSE</span><h2>Your assigned chapters and quests.</h2><p>These are live units from the canonical course repository, presented and recorded inside EdNotebook.</p></div><span>{assignments.filter((assignment) => assignment.status !== "completed").length} open</span></div>{assignments.length ? <div>{assignments.map((assignment) => { const summary = assignmentProgressSummary(assignment); const next = firstOpenUnit(assignment); return <article key={assignment.assignment_id}><header><div><span>{assignment.course_code || "COURSE"}</span><strong>{assignment.title}</strong><small>{assignment.course_title} · due {readableDue(assignment.due_at)}</small></div><i>{assignment.status}</i></header><p>{assignment.instructions}</p><div className="dl-progress-row"><progress max={summary.total} value={summary.completed} /><strong>{summary.completed}/{summary.total}</strong><span>{summary.percent}%</span></div><footer><button className="primary" type="button" disabled={!next} onClick={() => { window.location.hash = `#/student/${track}/digital-literacy/${assignment.assignment_id}/${next.unit_id}`; }}>{assignment.status === "completed" ? "Review course" : "Continue next unit"}</button><span>{next ? `${next.unit_id.toUpperCase()} · ${next.title}` : "No units assigned"}</span></footer></article>; })}</div> : <p>No Digital Literacy chapters or quests have been assigned yet.</p>}</section>;
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
      if (!isCanonicalProgressMessage(event, iframeRef.current?.contentWindow)) return;
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(async () => {
        setSyncState("Recording course progress…");
        const results = await Promise.all(normalizeEmbeddedProgress(event.data).map(syncDigitalLiteracyProgress));
        const failed = results.find((result) => result.error);
        if (failed) setSyncState(failed.error.message);
        else { setSyncState("Progress recorded for student and professor"); await refresh(); }
      }, 350);
    }
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); window.clearTimeout(syncTimerRef.current); };
  }, [assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <main className="dl-course-page"><button type="button" onClick={onBack}>← Back to assignments</button><div className="portal-form-error" role="alert">{error}</div></main>;
  if (!assignment) return <main className="dl-course-page" role="status">Opening the canonical Digital Literacy course…</main>;
  const selectedUnit = assignment.units.find((unit) => unit.unit_id === selectedUnitId) || firstOpenUnit(assignment);
  const summary = assignmentProgressSummary(assignment);
  const sourceUrl = buildCanonicalUnitUrl({ assignment, unit: selectedUnit, parentOrigin: window.location.origin });
  return <main className="dl-course-page"><header><button type="button" onClick={onBack}>← Back to assignments</button><div><span>{assignment.course_code || "COURSE"} · {assignment.title}</span><strong>{selectedUnit?.unit_id.toUpperCase()} · {selectedUnit?.title}</strong></div><div className="dl-course-page-progress"><progress max={summary.total} value={summary.completed} /><span>{summary.completed}/{summary.total} complete</span><small>{syncState}</small></div></header><div className="dl-course-shell"><nav aria-label="Assigned Digital Literacy units">{assignment.units.map((unit) => <button type="button" className={`${unit.unit_id === selectedUnit?.unit_id ? "is-active" : ""} ${unit.completed ? "is-complete" : ""}`} key={unit.unit_id} onClick={() => setSelectedUnitId(unit.unit_id)}><span>{unit.unit_id.toUpperCase()}</span><strong>{unit.title}</strong><i>{unit.completed ? `✓ ${unit.stars} star${unit.stars === 1 ? "" : "s"}` : "Open"}</i></button>)}</nav><section className="dl-course-frame"><div><strong>Canonical course content</strong><a href={assignment.source_repository} target="_blank" rel="noreferrer">View source repository ↗</a></div><iframe ref={iframeRef} key={sourceUrl} src={sourceUrl} title={`${selectedUnit?.unit_id} ${selectedUnit?.title}`} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" /></section></div><ResearchParticipationPanel courseId={assignment.course_id} /></main>;
}
