import { useEffect, useMemo, useState } from "react";
import {
  buildFinancialLiteracyUnitUrl,
  financialLiteracyProgressSummary,
  groupFinancialLiteracyUnits,
  nextFinancialLiteracyUnit,
} from "./financialLiteracyModel.js";
import {
  loadFinancialLiteracyCatalog,
  loadFinancialLiteracyTeacherProgress,
  loadMyFinancialLiteracyCourse,
  recordMyFinancialLiteracyCompletion,
} from "./financialLiteracyService.js";
import "./financial-literacy.css";

function readableDate(value) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function UnitGroups({ units }) {
  const groups = useMemo(() => groupFinancialLiteracyUnits(units), [units]);
  return <div className="fl-unit-groups">{groups.map((group) => <section key={group.key}><header><span>{group.path === "foundations" ? "FOUNDATIONS" : "OPTIONAL WEALTH QUEST"}</span><strong>{group.title}</strong></header><ol>{group.units.map((unit) => <li key={unit.unit_id}><span>{unit.unit_id.toUpperCase()}</span>{unit.title}</li>)}</ol></section>)}</div>;
}

export function ProfessorFinancialLiteracyClass({ classes = [] }) {
  const [catalog, setCatalog] = useState(null);
  const [courseId, setCourseId] = useState(classes[0]?.id || "");
  const [progress, setProgress] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId && classes[0]?.id) setCourseId(classes[0].id);
  }, [classes, courseId]);

  useEffect(() => {
    let active = true;
    loadFinancialLiteracyCatalog().then((response) => {
      if (!active) return;
      if (response.error) setError(response.error.message);
      else setCatalog(response.data);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!courseId) { setProgress(null); return () => { active = false; }; }
    setError("");
    loadFinancialLiteracyTeacherProgress(courseId).then((response) => {
      if (!active) return;
      if (response.error) { setProgress(null); setError(response.error.message); }
      else setProgress(response.data);
    });
    return () => { active = false; };
  }, [courseId]);

  const foundations = catalog?.units?.filter((unit) => unit.path === "foundations") || [];
  const optional = catalog?.units?.filter((unit) => unit.path === "wealth-quest") || [];
  return <div className="fl-professor-workspace">
    <section className="dashboard-card fl-hero"><div><span className="portal-kicker">FREE EARLY PREP CLASS · CANONICAL SOURCE</span><h1>Financial Literacy / Personal Finance</h1><p>Ram Ready Financial Futures is available automatically to Grades 9–12 students. The 20 Financial Foundations episodes form the starter class; 20 Future Wealth quests remain optional enrichment.</p><dl><div><dt>Release</dt><dd>{catalog?.release_id || "Loading…"}</dd></div><div><dt>Foundations</dt><dd>{foundations.length || 20} episodes</dd></div><div><dt>Optional</dt><dd>{optional.length || 20} quests</dd></div></dl></div><div><button className="primary" type="button" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "Close learner preview" : "Open learner preview"}</button><a href={catalog?.source_repository || "https://github.com/BREXAtlas/Financial-Literacy-Course"} target="_blank" rel="noreferrer">Canonical repository ↗</a></div></section>
    <aside className="dashboard-card fl-boundary"><strong>No payment processing</strong><p>This Early Prep class is not sold, rented, listed, or routed through checkout. It stores completion only—never bank credentials, account numbers, tax documents, balances, or individualized financial advice.</p></aside>
    {previewOpen && <section className="dashboard-card fl-preview"><header><div><span className="portal-kicker">LEARNER PREVIEW</span><h2>Ram Ready Financial Futures</h2><p>Preview activity does not create a student completion record.</p></div><button type="button" onClick={() => setPreviewOpen(false)}>Close</button></header><iframe src={catalog?.source_home || "https://brexatlas.github.io/Financial-Literacy-Course/"} title="Financial Literacy learner preview" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" referrerPolicy="strict-origin-when-cross-origin" /></section>}
    {error && <div className="portal-form-error" role="alert">{error}</div>}
    <section className="dashboard-card fl-roster-progress"><div className="dashboard-card-heading"><div><span className="portal-kicker">CLASS-SCOPED PROGRESS</span><h2>See only students in a class you manage.</h2><p>Completion is student-owned and release-versioned. Changing classes never creates a duplicate Financial Literacy record.</p></div><label>Early Prep class<select value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Choose a class</option>{classes.map((course) => <option key={course.id} value={course.id}>{course.code || course.course_code || "CLASS"} · {course.title}</option>)}</select></label></div>{progress?.learners?.length ? <div>{progress.learners.map((learner) => <article key={learner.student_id}><div><strong>{learner.display_name}</strong><span>{learner.foundations_completed}/20 Foundations · {learner.completed_units}/{progress.total_units} total</span></div><progress max={progress.total_units} value={learner.completed_units} /><small>{readableDate(learner.last_activity_at)}</small></article>)}</div> : <p>{courseId ? "No current learners are enrolled in this class yet." : "Create or select an Early Prep class to view its enrolled learners."}</p>}</section>
    {catalog && <section className="dashboard-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">CANONICAL CURRICULUM MAP</span><h2>40 source-backed learning units.</h2><p>EdNotebook references this governed release; it does not duplicate or silently rewrite the curriculum.</p></div><span>Commit {catalog.content_commit?.slice(0, 7)}</span></div><UnitGroups units={catalog.units} /></section>}
  </div>;
}

export function StudentFinancialLiteracyClass({ track = "k12" }) {
  const [course, setCourse] = useState(null);
  const [badges, setBadges] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (track !== "k12") return undefined;
    let active = true;
    loadMyFinancialLiteracyCourse().then((response) => {
      if (!active) return;
      if (response.error) setError(response.error.message);
      else { setCourse(response.data?.course || null); setBadges(response.data?.badges || []); }
    });
    return () => { active = false; };
  }, [track]);
  if (track !== "k12") return null;
  if (error) return <section className="dashboard-card fl-student-card"><strong>Financial Literacy is being prepared.</strong><p>{error}</p></section>;
  if (!course) return <section className="dashboard-card fl-student-card" role="status">Opening your Financial Literacy class…</section>;
  const summary = financialLiteracyProgressSummary(course);
  const next = nextFinancialLiteracyUnit(course);
  return <section className="dashboard-card fl-student-card"><div className="dashboard-card-heading"><div><span className="portal-kicker">YOUR FREE PLATFORM-STANDARD CLASS</span><h2>Financial Literacy / Personal Finance</h2><p>Start with 20 Financial Foundations episodes. The 20 advanced Wealth quests are optional and do not involve buying or selling anything.</p></div><i>{course.status}</i></div>{badges.map((badge) => <aside className="fl-badge" key={badge.id}><span aria-hidden="true">★</span><div><strong>{badge.title}</strong><p>{badge.description}</p><small>Earned {readableDate(badge.earned_at)}</small></div></aside>)}<div className="fl-progress"><progress max={summary.total} value={summary.completed} /><strong>{summary.completed}/{summary.total}</strong><span>{summary.percent}%</span></div><footer><button className="primary" type="button" disabled={!next} onClick={() => { window.location.hash = `#/student/k12/financial-literacy/${next.unit_id}`; }}>{summary.completed ? "Continue class" : "Start Financial Foundations"}</button><span>{next ? `${next.unit_id.toUpperCase()} · ${next.title}` : "Course catalog unavailable"}</span></footer></section>;
}

export function FinancialLiteracyCoursePage({ unitId, onBack }) {
  const [course, setCourse] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(unitId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await loadMyFinancialLiteracyCourse();
    if (response.error) { setError(response.error.message); return; }
    const nextCourse = response.data?.course || null;
    if (!nextCourse) { setError("Financial Literacy is available only in the Early Prep student path."); return; }
    setCourse(nextCourse);
    if (!nextCourse.units.some((unit) => unit.unit_id === selectedUnitId)) {
      setSelectedUnitId(nextFinancialLiteracyUnit(nextCourse)?.unit_id || nextCourse.units[0]?.unit_id || "");
    }
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function markComplete() {
    setBusy(true); setError(""); setNotice("");
    const response = await recordMyFinancialLiteracyCompletion(selectedUnitId, course.catalog_release);
    if (response.error) setError(response.error.message);
    else { setCourse(response.data?.course || course); setNotice("Completion recorded in your private Early Prep progress."); }
    setBusy(false);
  }

  if (error && !course) return <main className="fl-course-page"><button type="button" onClick={onBack}>← Back to assignments</button><div className="portal-form-error" role="alert">{error}</div></main>;
  if (!course) return <main className="fl-course-page" role="status">Opening Financial Literacy…</main>;
  const selectedUnit = course.units.find((unit) => unit.unit_id === selectedUnitId) || nextFinancialLiteracyUnit(course);
  const summary = financialLiteracyProgressSummary(course);
  const sourceUrl = buildFinancialLiteracyUnitUrl(course, selectedUnit);
  return <main className="fl-course-page"><header><button type="button" onClick={onBack}>← Back to assignments</button><div><span>EARLY PREP · FINANCIAL LITERACY</span><strong>{selectedUnit?.unit_id.toUpperCase()} · {selectedUnit?.title}</strong></div><div><progress max={summary.total} value={summary.completed} /><span>{summary.completed}/{summary.total} complete</span></div></header>{error && <div className="portal-form-error" role="alert">{error}</div>}{notice && <div className="portal-form-notice" role="status">{notice}</div>}<div className="fl-course-shell"><nav aria-label="Financial Literacy units">{course.units.map((unit) => <button type="button" className={`${unit.unit_id === selectedUnit?.unit_id ? "is-active" : ""} ${unit.completed ? "is-complete" : ""}`} key={unit.unit_id} onClick={() => { setSelectedUnitId(unit.unit_id); setNotice(""); }}><span>{unit.unit_id.toUpperCase()}</span><strong>{unit.title}</strong><i>{unit.completed ? "✓ Complete" : unit.path === "foundations" ? "Foundation" : "Optional"}</i></button>)}</nav><section className="fl-course-frame"><div><div><strong>Canonical course content</strong><span>Educational information—not individualized financial advice</span></div><a href={sourceUrl} target="_blank" rel="noreferrer">Open source lesson ↗</a></div><iframe key={sourceUrl} src={sourceUrl} title={`${selectedUnit?.unit_id} ${selectedUnit?.title}`} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" /><footer><p>After you finish the scenario and knowledge check above, confirm completion here. EdNotebook stores only the unit ID and completion time.</p><button className="primary" type="button" disabled={busy || selectedUnit?.completed} onClick={markComplete}>{selectedUnit?.completed ? "Completed" : busy ? "Recording…" : "I finished this unit"}</button></footer></section></div></main>;
}
