import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import AssignmentTemplateWorkspace from "../portal/AssignmentTemplateWorkspace.jsx";
import { environmentStorage, STORAGE_KEYS } from "../storage/environmentStorage.js";
import { addLessonToManifest, cloneManifest, COURSE_PRESETS, createStarterManifest, flattenLessons, removeLessonFromManifest, validateCourseManifest } from "./courseManifest.js";
import { adaptBuilderCourseToManifest, readBuilderCourseDraft } from "./builderCourseAdapter.js";
import { gradeCourseProgress, listManageableCourses, listProgressOverview, loadPublicationForCourse, publishCoursePackage, saveCoursePackageDraft, setPublicationState } from "./courseService.js";
import "./course-runtime.css";
import "./course-studio.css";

const IS_STAGING = import.meta.env.VITE_APP_ENVIRONMENT === "staging";
const LessonDraftReview = IS_STAGING
  ? lazy(() => import("../ai/LessonDraftReview.jsx"))
  : null;
const MaterialsWorkspace = lazy(() => import("../studio/MaterialsWorkspace.jsx"));

function updateLesson(manifest, pathId, lessonId, patch) {
  const next = cloneManifest(manifest);
  const path = next.paths.find((item) => item.id === pathId);
  const index = path.nodes.findIndex((item) => item.id === lessonId);
  path.nodes[index] = { ...path.nodes[index], ...patch };
  return next;
}

function updateConcept(manifest, pathId, lessonId, key, value) {
  const lesson = manifest.paths.find((item) => item.id === pathId).nodes.find((item) => item.id === lessonId);
  return updateLesson(manifest, pathId, lessonId, { concept: { ...lesson.concept, [key]: value } });
}

function Preview({ manifest, onClose }) {
  const first = flattenLessons(manifest)[0];
  return <div className="course-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="course-preview-title"><div><header><strong id="course-preview-title">Student course preview</strong><button type="button" onClick={onClose}>Close</button></header><section className="course-preview-hero"><span>{manifest.course.courseCode}</span><h1>{manifest.course.title}</h1><p>{manifest.course.subtitle}</p></section><section className="course-preview-map">{manifest.paths.map((path) => <article key={path.id}><h2>{path.label}</h2>{path.nodes.map((lesson) => <div key={lesson.id}><span>~{lesson.estimatedMinutes} min</span><strong>{lesson.title}</strong></div>)}</article>)}</section>{first && <section className="course-preview-lesson"><span>FIRST LESSON</span><h2>{first.title}</h2><p>{first.openingNarrative}</p><div>{[["What",first.concept?.what],["Why",first.concept?.why],["Value",first.concept?.how],["Verify",first.concept?.verifyNote]].map(([label,value]) => <article key={label}><strong>{label}</strong><p>{value}</p></article>)}</div><h3>{first.scenario?.prompt}</h3>{first.choices?.map((choice) => <p key={choice.id}>• {choice.text}</p>)}</section>}</div></div>;
}

function ProgressTable({ courseId, publicationId }) {
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  async function refresh() { const result = await listProgressOverview(courseId); setRows(result.data || []); if (result.error) setNotice(result.error.message); }
  useEffect(() => { if (courseId) refresh(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveGrade(row) {
    const result = await gradeCourseProgress(publicationId || row.publication_id, row.user_id, score, feedback);
    if (result.error) { setNotice(result.error.message); return; }
    setNotice("Grade published to the learner and gradebook."); setEditing(null); setScore(""); setFeedback(""); refresh();
  }

  return <section className="course-progress-manager"><div className="studio-section-heading"><div><span>LEARNER PROGRESS</span><h2>Completion and grades stay connected.</h2></div><button type="button" onClick={refresh}>Refresh</button></div>{notice && <p className="studio-notice" role="status">{notice}</p>}{rows.length === 0 ? <div className="studio-empty"><strong>No learner progress yet.</strong><p>After an enrolled learner opens the course, progress appears here.</p></div> : <div className="course-progress-table"><div className="is-head"><span>Learner</span><span>Progress</span><span>Automatic score</span><span>Grade status</span><span>Action</span></div>{rows.map((row) => <div key={row.user_id}><span><strong>{row.student_name}</strong><small>{row.student_email}</small></span><span>{row.completed_lessons}/{row.total_lessons} · {row.completion_percent}%</span><span>{row.auto_score === null ? "—" : `${row.auto_score}%`}</span><span>{row.grade_status.replaceAll("_", " ")}{row.final_score !== null && ` · ${row.final_score}%`}</span><span><button type="button" onClick={() => { setEditing(row.user_id); setScore(row.final_score ?? row.auto_score ?? ""); setFeedback(row.feedback || ""); }}>Grade</button></span>{editing === row.user_id && <form onSubmit={(event) => { event.preventDefault(); saveGrade(row); }}><label>Final score (0–100)<input required type="number" min="0" max="100" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} /></label><label>Professor feedback<textarea rows="3" value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><div><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary" type="submit">Publish grade</button></div></form>}</div>)}</div>}</section>;
}

export default function CoursePackageStudio({ session, onBack, onOpenStudentCourse }) {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(() => window.localStorage.getItem("ednotebook-course-id") || "");
  const [publication, setPublication] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("course");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [syllabusRecord] = useState(
    () => environmentStorage.getJson(STORAGE_KEYS.structuredSyllabus, null),
  );
  const [outlineRecord] = useState(
    () => environmentStorage.getJson(STORAGE_KEYS.aiCourseOutline, null),
  );
  const validation = useMemo(() => validateCourseManifest(manifest), [manifest]);
  const selectedLesson = selected && manifest?.paths.find((path) => path.id === selected.pathId)?.nodes.find((lesson) => lesson.id === selected.lessonId);

  useEffect(() => { (async () => { const result = await listManageableCourses(); const next = result.data || []; setCourses(next); const active = next.find((course) => course.id === courseId) || next[0]; if (active) setCourseId(active.id); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const course = courses.find((item) => item.id === courseId);
      if (!course) return;
      const result = await loadPublicationForCourse(courseId);
      const cloudManifest = result.data?.draft_manifest?.format ? result.data.draft_manifest : null;
      const localBuilderDraft = readBuilderCourseDraft();
      const localUpdatedAt = Date.parse(localBuilderDraft?.updatedAt || "") || 0;
      const cloudBuilderUpdatedAt = Date.parse(cloudManifest?.builderSource?.updatedAt || "") || 0;
      const nextManifest = localBuilderDraft?.course && (!cloudManifest || localUpdatedAt > cloudBuilderUpdatedAt)
        ? adaptBuilderCourseToManifest({
            builderCourse: localBuilderDraft.course,
            builderLessons: localBuilderDraft.lessons || {},
            platformCourse: course,
            existingManifest: cloudManifest,
            updatedAt: localBuilderDraft.updatedAt,
          })
        : cloudManifest || createStarterManifest(course);
      setPublication(result.data || null); setManifest(nextManifest); setSelected(null); setNotice(
        localBuilderDraft?.course && (!cloudManifest || localUpdatedAt > cloudBuilderUpdatedAt)
          ? "Latest Course Forge lessons loaded from this device. Save the draft to synchronize them to the class."
          : ""
      );
      window.localStorage.setItem("ednotebook-course-id", courseId);
    })();
  }, [courseId, courses]);

  function updateCourse(key, value) { setManifest({ ...manifest, course: { ...manifest.course, [key]: value }, grading: key === "title" ? { ...manifest.grading, title: `Course completion · ${value}` } : manifest.grading }); }
  function updateGrading(key, value) { setManifest({ ...manifest, grading: { ...manifest.grading, [key]: value } }); }

  async function saveDraft() {
    setBusy(true); setNotice("");
    const result = await saveCoursePackageDraft(courseId, manifest, { displayMode: publication?.display_mode || "full_course", themePreset: manifest.preset.id, gradingMode: manifest.grading.mode });
    setBusy(false); if (result.error) setNotice(result.error.message); else { setPublication(result.data); setNotice("Course package saved. Students cannot see this draft yet."); }
  }

  async function publish() {
    if (!validation.valid) { setNotice(validation.errors.join(" ")); return; }
    setBusy(true); setNotice("");
    const result = await publishCoursePackage(courseId, manifest, { displayMode: publication?.display_mode || "full_course", themePreset: manifest.preset.id, gradingMode: manifest.grading.mode, changeSummary: publication?.current_version ? "Updated course package" : "Initial course publication" });
    setBusy(false); if (result.error) setNotice(result.error.message); else { setPublication(result.data); setNotice(`Course published as version ${result.data.current_version}. Enrollment, student access, progress, and gradebook sync are active.`); }
  }

  async function unpublish() {
    if (!publication?.id) return;
    const result = await setPublicationState(publication.id, publication.status === "published" ? "unpublished" : "published");
    if (result.error) setNotice(result.error.message); else { setPublication(result.data); setNotice(result.data.status === "published" ? "Course restored at the same student address." : "Course unpublished. Records and progress were preserved."); }
  }

  if (!courses.length) return <main className="course-studio-status"><h1>Create a course first.</h1><p>The Course Output Studio connects to an existing authenticated course record.</p><button onClick={onBack}>Return to course setup</button></main>;
  if (!manifest) return <main className="course-studio-status"><h1>Opening Course Output Studio…</h1></main>;
  const activeCourse = courses.find((course) => course.id === courseId);
  const classes = [{ id: activeCourse.id, code: activeCourse.course_code || "COURSE", title: activeCourse.title, division: activeCourse.education_division || "university" }];

  return <main className="course-output-studio">
    <header className="course-studio-topbar"><button type="button" onClick={onBack}>← Course builder</button><div><span>COURSE OUTPUT STUDIO</span><strong>Build once. Publish inside EdNotebook.</strong></div><label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option value={course.id} key={course.id}>{course.course_code || "COURSE"} · {course.title}</option>)}</select></label></header>
    <nav className="course-studio-tabs">{[["course","Course"],["lessons","Lessons"],["resources","Media & resources"],["assignments","Assignments"],["progress","Progress & grading"]].map(([id,label]) => <button className={tab === id ? "is-active" : ""} type="button" onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>
    {notice && <div className="studio-notice" role="status">{notice}</div>}

    {tab === "course" && <div className="studio-two-column"><section className="studio-card"><span className="studio-kicker">COURSE IDENTITY</span><h1>Prepare the student destination.</h1><label>Course title<input value={manifest.course.title} onChange={(event) => updateCourse("title", event.target.value)} /></label><label>Subtitle<input value={manifest.course.subtitle} onChange={(event) => updateCourse("subtitle", event.target.value)} /></label><label>Description<textarea rows="4" value={manifest.course.description} onChange={(event) => updateCourse("description", event.target.value)} /></label><div className="studio-field-grid"><label>Course code<input value={manifest.course.courseCode} onChange={(event) => updateCourse("courseCode", event.target.value)} /></label><label>Subject<input value={manifest.course.subject} onChange={(event) => updateCourse("subject", event.target.value)} /></label></div><label>Learner audience<input value={manifest.course.audience} onChange={(event) => updateCourse("audience", event.target.value)} /></label></section><section className="studio-card"><span className="studio-kicker">PUBLISHING RULES</span><h2>Choose how the course appears and grades.</h2><label>Course look<select value={manifest.preset.id} onChange={(event) => setManifest({ ...manifest, preset: { id: event.target.value, version: "1.0" } })}>{Object.values(COURSE_PRESETS).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><label>Grading<select value={manifest.grading.mode} onChange={(event) => updateGrading("mode", event.target.value)}><option value="auto">Automatic from course checks</option><option value="manual">Course completion awaits professor grade</option><option value="mixed">Automatic course score plus professor assignments</option></select></label><label>Completion points<input type="number" min="1" max="1000" value={manifest.grading.maxPoints} onChange={(event) => updateGrading("maxPoints", Number(event.target.value))} /></label><label>Course due date<input type="datetime-local" value={manifest.grading.dueAt ? manifest.grading.dueAt.slice(0,16) : ""} onChange={(event) => updateGrading("dueAt", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label><div className="studio-publish-status"><span>{publication?.status || "draft"}</span><strong>{publication?.current_version ? `Version ${publication.current_version}` : "Not published"}</strong>{publication?.id && <code>ednotebook.com/#/student/course/{publication.id}</code>}</div></section></div>}

    {tab === "lessons" && <div className="studio-lesson-layout"><aside className="studio-card"><div className="studio-section-heading"><div><span className="studio-kicker">COURSE MAP</span><h2>{manifest.paths[0].label}</h2></div><button type="button" onClick={() => setManifest(addLessonToManifest(manifest, manifest.paths[0].id, manifest.paths[0].groups[0].id))}>Add lesson</button></div>{manifest.paths[0].nodes.map((lesson, index) => <button className={selected?.lessonId === lesson.id ? "is-active" : ""} type="button" onClick={() => setSelected({ pathId: manifest.paths[0].id, lessonId: lesson.id })} key={lesson.id}><span>{index + 1}</span><strong>{lesson.title}</strong><small>~{lesson.estimatedMinutes} min</small></button>)}</aside><section className="studio-card lesson-editor">{!selectedLesson ? <div className="studio-empty"><strong>Select a lesson.</strong><p>Edit its narrative, concepts, choices, checks, and sources.</p></div> : <><div className="studio-section-heading"><div><span className="studio-kicker">LESSON EDITOR</span><h1>{selectedLesson.title}</h1></div><button type="button" disabled={manifest.paths[0].nodes.length <= 1} onClick={() => { setManifest(removeLessonFromManifest(manifest, selected.pathId, selected.lessonId)); setSelected(null); }}>Remove lesson</button></div><label>Lesson title<input value={selectedLesson.title} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { title: event.target.value }))} /></label><label>Subtitle<input value={selectedLesson.subtitle} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { subtitle: event.target.value }))} /></label><label>Estimated minutes<input type="number" min="1" max="240" value={selectedLesson.estimatedMinutes} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { estimatedMinutes: Number(event.target.value) }))} /></label><label>What is happening<textarea rows="4" value={selectedLesson.openingNarrative} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { openingNarrative: event.target.value }))} /></label><label>Real-world example<textarea rows="3" value={selectedLesson.realWorldExample} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { realWorldExample: event.target.value }))} /></label><div className="studio-field-grid">{[["what","What it is"],["why","Why it exists"],["how","How it may help"],["whoMayBenefit","Who may benefit"],["cost","What it may cost"],["risks","Risks or limitations"],["whoMayNotBenefit","Who may not benefit"],["misunderstandingRisk","When misunderstood"],["verifyNote","What to verify"]].map(([key,label]) => <label key={key}>{label}<textarea rows="3" value={selectedLesson.concept?.[key] || ""} onChange={(event) => setManifest(updateConcept(manifest, selected.pathId, selected.lessonId, key, event.target.value))} /></label>)}</div><label>Scenario question<textarea rows="2" value={selectedLesson.scenario?.prompt || ""} onChange={(event) => setManifest(updateLesson(manifest, selected.pathId, selected.lessonId, { scenario: { ...selectedLesson.scenario, prompt: event.target.value } }))} /></label><section className="lesson-check-preview"><span>KNOWLEDGE CHECK</span><strong>{selectedLesson.knowledgeChecks?.[0]?.question}</strong><small>Correct answer: {selectedLesson.knowledgeChecks?.[0]?.correctAnswer}</small></section></>}</section></div>}

    {IS_STAGING && LessonDraftReview && tab === "lessons" && selectedLesson && (
      <div className="phase5-studio-slot">
        <Suspense fallback={<p role="status">Opening governed lesson review…</p>}>
          <LessonDraftReview
            key={`${activeCourse.id}:${selectedLesson.id}`}
            manifest={manifest}
            pathId={selected.pathId}
            lesson={selectedLesson}
            course={activeCourse}
            syllabusRecord={syllabusRecord}
            outlineRecord={outlineRecord}
            onAccept={(nextManifest) => {
              setManifest(nextManifest);
              setNotice(
                "Professor-accepted lesson added to the existing unpublished course-package draft. Save draft when ready.",
              );
            }}
          />
        </Suspense>
      </div>
    )}
    {tab === "assignments" && <AssignmentTemplateWorkspace mode="professor" session={session} track={activeCourse.education_division || "university"} classes={classes} />}
    {tab === "resources" && (
      <Suspense fallback={<main className="course-studio-status"><h1>Opening media studio…</h1></main>}>
        <MaterialsWorkspace courseOverride={activeCourse} manifestOverride={manifest} />
      </Suspense>
    )}
    {tab === "progress" && <ProgressTable courseId={courseId} publicationId={publication?.id} />}

    <footer className="course-studio-actions"><div>{validation.valid ? <span className="is-valid">✓ Course package is ready to publish</span> : <span>{validation.errors.length} item{validation.errors.length === 1 ? "" : "s"} need attention</span>}</div><button type="button" onClick={() => setPreview(true)}>Preview as student</button><button type="button" disabled={busy} onClick={saveDraft}>Save draft</button><button className="primary" type="button" disabled={busy || !validation.valid} onClick={publish}>{busy ? "Saving…" : publication?.status === "published" ? "Publish updated version" : "Publish course"}</button>{publication?.id && <button type="button" onClick={unpublish}>{publication.status === "published" ? "Unpublish" : "Restore"}</button>}{publication?.status === "published" && <button type="button" onClick={() => onOpenStudentCourse(publication.id)}>Open student course</button>}</footer>
    {preview && <Preview manifest={manifest} onClose={() => setPreview(false)} />}
  </main>;
}
