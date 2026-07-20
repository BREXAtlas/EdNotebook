import { useEffect, useMemo, useState } from "react";
import AssignmentTemplateWorkspace from "../portal/AssignmentTemplateWorkspace.jsx";
import { COURSE_PRESETS, flattenLessons } from "./courseManifest.js";
import { loadLearnerProgress, loadPublishedCourse, listCourseDueWork, saveLessonProgress } from "./courseService.js";
import "./course-runtime.css";

function phaseFor(index) {
  return ["lesson", "lesson", "scenario", "knowledge", "quiz", "complete"][index] || "lesson";
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ConceptCards({ concept }) {
  const groups = [
    ["Understand it", [["What", concept?.what], ["Why it exists", concept?.why]]],
    ["Possible value", [["How it may help", concept?.how], ["Who may benefit", concept?.whoMayBenefit]]],
    ["Tradeoffs", [["What it may cost", concept?.cost], ["Risks or limitations", concept?.risks], ["Who may not benefit", concept?.whoMayNotBenefit]]],
    ["Use carefully", [["When misunderstood", concept?.misunderstandingRisk], ["Verify", concept?.verifyNote]]],
  ];
  return <div className="course-concept-grid">{groups.map(([title, items]) => <article key={title}><h3>{title}</h3>{items.filter(([, value]) => value).map(([label, value]) => <div key={label}><strong>{label}</strong><p>{value}</p></div>)}</article>)}</div>;
}

function LessonFigure({ visual }) {
  if (!visual) return null;
  return <figure className="course-learning-figure"><figcaption><span>Lesson figure</span><h2>{visual.title}</h2></figcaption><ol className={`is-${visual.type || "flow"}`}>{(visual.items || []).map((item, index) => <li key={`${item}-${index}`}><i>{index + 1}</i><span>{item}</span></li>)}</ol><p><strong>Text alternative:</strong> {visual.textAlternative}</p></figure>;
}

function LessonPlayer({ publication, manifest, path, lesson, saved, onExit, onProgress }) {
  const [stage, setStage] = useState(() => Math.min(4, Math.max(0, saved?.section_index || 0)));
  const [choiceId, setChoiceId] = useState(saved?.interaction_state?.choiceId || "");
  const [knowledgeAnswers, setKnowledgeAnswers] = useState(saved?.interaction_state?.knowledgeAnswers || {});
  const [quizAnswers, setQuizAnswers] = useState(saved?.interaction_state?.quizAnswers || {});
  const [saveState, setSaveState] = useState("Saved");
  const [summary, setSummary] = useState(null);
  const interactionState = useMemo(() => ({ choiceId, knowledgeAnswers, quizAnswers }), [choiceId, knowledgeAnswers, quizAnswers]);
  const checksComplete = (lesson.knowledgeChecks || []).every((check) => knowledgeAnswers[check.id] !== undefined);
  const quizComplete = (lesson.endQuiz || []).every((check) => quizAnswers[check.id] !== undefined);

  async function persist(nextStage = stage, complete = false, state = interactionState) {
    setSaveState("Saving…");
    const localKey = `ednotebook-course-recovery-${publication.id}-${lesson.id}`;
    window.localStorage.setItem(localKey, JSON.stringify({ stage: nextStage, interactionState: state, savedAt: new Date().toISOString() }));
    const result = await saveLessonProgress({ publicationId: publication.id, pathId: path.id, lessonId: lesson.id, sectionIndex: nextStage, phase: phaseFor(nextStage), interactionState: state, complete });
    if (result.error) { setSaveState("Save failed · retry"); return result; }
    window.localStorage.removeItem(localKey);
    setSaveState("Saved"); setSummary(result.data); onProgress?.(result.data); return result;
  }

  useEffect(() => { persist(stage, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function next() {
    const nextStage = Math.min(5, stage + 1);
    if (nextStage === 5) await persist(nextStage, true);
    else await persist(nextStage, false);
    setStage(nextStage);
  }

  function answerKnowledge(check, answer) {
    const next = { ...knowledgeAnswers, [check.id]: answer };
    setKnowledgeAnswers(next); persist(stage, false, { choiceId, knowledgeAnswers: next, quizAnswers });
  }

  function answerQuiz(check, answer) {
    const next = { ...quizAnswers, [check.id]: answer };
    setQuizAnswers(next); persist(stage, false, { choiceId, knowledgeAnswers, quizAnswers: next });
  }

  const selected = (lesson.choices || []).find((choice) => choice.id === choiceId);
  return <article className="course-lesson-player">
    <header className="course-player-header"><button type="button" onClick={onExit}>← Course map</button><div><small>{path.label}</small><strong>{lesson.title}</strong></div><span>{saveState}</span></header>
    <div className="course-stage-progress"><i style={{ width: `${((stage + 1) / 6) * 100}%` }} /></div>

    {stage === 0 && <section className="course-stage"><span className="course-kicker">LESSON OVERVIEW · ~{lesson.estimatedMinutes || 15} MIN</span><h1>{lesson.title}</h1><p className="course-subtitle">{lesson.subtitle}</p><div className="course-story-card"><h2>What’s happening</h2><p>{lesson.openingNarrative}</p><p>{lesson.realWorldExample}</p></div><LessonFigure visual={lesson.visual} /><h2>Learning objectives</h2><ul>{(lesson.learningObjectives || []).map((item) => <li key={item}>{item}</li>)}</ul></section>}

    {stage === 1 && <section className="course-stage"><span className="course-kicker">UNDERSTAND THE CONCEPT</span><h1>{lesson.title}</h1><ConceptCards concept={lesson.concept} /></section>}

    {stage === 2 && <section className="course-stage"><span className="course-kicker">MAKE A DECISION</span><h1>{lesson.scenario?.prompt || "Choose a response"}</h1><div className="course-choice-list">{(lesson.choices || []).map((choice) => <article className={choice.id === choiceId ? "is-selected" : ""} key={choice.id}><h2>{choice.text}</h2><p><strong>Why someone might choose this:</strong> {choice.whyChosen}</p><p><strong>Possible benefit:</strong> {choice.possibleBenefit}</p><p><strong>Possible cost:</strong> {choice.possibleCost}</p><p><strong>Possible risk:</strong> {choice.possibleRisk}</p><button type="button" onClick={() => { setChoiceId(choice.id); persist(stage, false, { choiceId: choice.id, knowledgeAnswers, quizAnswers }); }}>Choose this</button>{choice.id === choiceId && <div className="course-choice-result" role="status" tabIndex="-1"><h3>What this choice changes</h3><p><strong>Right away:</strong> {lesson.consequences?.immediate?.[choice.id]}</p><p><strong>Later:</strong> {lesson.consequences?.later?.[choice.id]}</p><p><strong>Long term:</strong> {lesson.consequences?.longTerm?.[choice.id]}</p><p><strong>What could change it:</strong> {choice.whatCouldChangeThisOutcome}</p><p><strong>Recovery:</strong> {lesson.recoveryPath}</p></div>}</article>)}</div></section>}

    {stage === 3 && <section className="course-stage"><span className="course-kicker">KNOWLEDGE CHECK</span><h1>Explain what you learned.</h1>{(lesson.knowledgeChecks || []).length === 0 ? <p>No knowledge check is required for this lesson.</p> : (lesson.knowledgeChecks || []).map((check) => <fieldset className="course-question" key={check.id}><legend>{check.question}</legend>{check.options.map((option) => <label key={option}><input type="radio" name={check.id} checked={knowledgeAnswers[check.id] === option} onChange={() => answerKnowledge(check, option)} />{option}</label>)}{knowledgeAnswers[check.id] !== undefined && <p role="status"><strong>{knowledgeAnswers[check.id] === check.correctAnswer ? "Correct." : `Not quite. The answer is “${check.correctAnswer}.”`}</strong> {check.explanation}</p>}</fieldset>)}</section>}

    {stage === 4 && <section className="course-stage"><span className="course-kicker">{(lesson.endQuiz || []).length ? "END QUIZ" : "REVIEW"}</span><h1>{(lesson.endQuiz || []).length ? "Complete the lesson quiz." : "Your lesson interactions are ready to submit."}</h1>{(lesson.endQuiz || []).map((check) => <fieldset className="course-question" key={check.id}><legend>{check.question}</legend>{check.options.map((option) => <label key={option}><input type="radio" name={check.id} checked={quizAnswers[check.id] === option} onChange={() => answerQuiz(check, option)} />{option}</label>)}{quizAnswers[check.id] !== undefined && <p role="status"><strong>{quizAnswers[check.id] === check.correctAnswer ? "Correct." : `Not quite. The answer is “${check.correctAnswer}.”`}</strong> {check.explanation}</p>}</fieldset>)}<div className="course-review-summary"><p><strong>Decision:</strong> {selected?.text || "Not selected"}</p><p><strong>Knowledge checks:</strong> {Object.keys(knowledgeAnswers).length} of {(lesson.knowledgeChecks || []).length}</p><p><strong>Quiz:</strong> {Object.keys(quizAnswers).length} of {(lesson.endQuiz || []).length}</p></div></section>}

    {stage === 5 && <section className="course-stage course-complete-card"><span aria-hidden="true">✓</span><h1>Lesson complete</h1><p>Your answers, progress, and course grade status were synchronized.</p>{summary && <div><strong>{summary.completed_lessons} of {summary.total_lessons} lessons complete</strong><span>{summary.completion_percent}% course completion</span><span>{summary.grade_status === "auto_graded" ? `Automatic course grade: ${summary.final_score}%` : summary.grade_status === "awaiting_grading" ? "Course complete · awaiting professor grading" : "Continue to the next lesson"}</span></div>}<button type="button" onClick={onExit}>Return to course</button></section>}

    {stage < 5 && <footer className="course-player-actions"><button type="button" disabled={stage === 0} onClick={() => { const previous = Math.max(0, stage - 1); setStage(previous); persist(previous, false); }}>Back</button><button className="primary" type="button" disabled={(stage === 2 && !choiceId) || (stage === 3 && !checksComplete) || (stage === 4 && !quizComplete)} onClick={next}>{stage === 4 ? "Finish lesson" : "Save and continue"}</button></footer>}
  </article>;
}

export default function CourseRuntimePage({ publicationId, session, profile, track = "university", onBack }) {
  const [state, setState] = useState({ loading: true, error: "", publication: null, manifest: null, progress: null, dueWork: null });
  const [view, setView] = useState("home");
  const [active, setActive] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const courseResult = await loadPublishedCourse(publicationId);
      if (!live) return;
      if (courseResult.error) { setState((current) => ({ ...current, loading: false, error: courseResult.error.message })); return; }
      const { publication, manifest } = courseResult.data;
      const [progressResult, dueResult] = await Promise.all([loadLearnerProgress(publication.id, session?.user?.id), listCourseDueWork(publication.course_id)]);
      if (!live) return;
      setState({ loading: false, error: "", publication, manifest, progress: progressResult.data, dueWork: dueResult.data });
    })();
    return () => { live = false; };
  }, [publicationId, session?.user?.id]);

  const preset = COURSE_PRESETS[state.manifest?.preset?.id] || COURSE_PRESETS["ednotebook-default"];
  const lessons = useMemo(() => flattenLessons(state.manifest), [state.manifest]);
  const completed = new Set((state.progress?.lessons || []).filter((item) => item.status === "completed").map((item) => item.lesson_id));
  const course = state.publication?.courses;

  function openLesson(lesson) {
    const saved = (state.progress?.lessons || []).find((item) => item.lesson_id === lesson.id && item.path_id === lesson.pathId);
    setActive({ lesson, path: state.manifest.paths.find((item) => item.id === lesson.pathId), saved }); setView("lesson");
  }

  function continueLesson() {
    const current = state.progress?.summary;
    const lesson = lessons.find((item) => item.id === current?.current_lesson_id) || lessons.find((item) => !completed.has(item.id)) || lessons[0];
    if (lesson) openLesson(lesson);
  }

  if (state.loading) return <main className="course-runtime-status"><strong>Opening course…</strong><span>Checking enrollment and loading your saved place.</span></main>;
  if (state.error) return <main className="course-runtime-status is-error"><strong>Course unavailable</strong><span>{state.error}</span><button type="button" onClick={onBack}>Back to classes</button></main>;

  const style = { "--course-primary": preset.primary, "--course-primary-dark": preset.primaryDark, "--course-accent": preset.accent, "--course-surface": preset.surface, "--course-bg": preset.background, "--course-text": preset.text, "--course-muted": preset.muted, "--course-border": preset.border, "--course-success": preset.success, "--course-error": preset.error };
  const courseClass = { id: course.id, code: course.course_code || "COURSE", title: course.title, division: course.education_division || track };

  return <div className="course-account-shell" style={style}>
    <header className="course-account-header"><button type="button" onClick={onBack}>← My classes</button><a href={`#/student/${track}/app`}>Dashboard</a><a href={`#/student/${track}/app`}>Assignments</a><a href={`#/student/${track}/app`}>Messages</a><span>{profile?.full_name || session?.user?.email || "Learner"}</span></header>
    <div className="course-shell-grid">
      <aside className="course-rail"><div><small>{course.course_code || "COURSE"}</small><strong>{state.manifest.course.title}</strong><span>Version {state.publication.current_version}</span></div><nav><button className={view === "home" ? "is-active" : ""} onClick={() => setView("home")}>Course home</button><button className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>Course map</button><button className={view === "assignments" ? "is-active" : ""} onClick={() => setView("assignments")}>Assignments</button><button onClick={continueLesson}>Continue lesson</button></nav><section><span>Progress</span><strong>{state.progress?.summary?.completion_percent || 0}%</strong><div><i style={{ width: `${state.progress?.summary?.completion_percent || 0}%` }} /></div><small>{state.progress?.summary?.grade_status === "auto_graded" ? `Grade ${state.progress.summary.final_score}%` : state.progress?.summary?.grade_status === "awaiting_grading" ? "Awaiting grading" : "In progress"}</small></section></aside>
      <main className="course-viewport">
        {view === "home" && <><section className="course-hero"><span>{state.manifest.template.family} course</span><h1>{state.manifest.course.title}</h1><p>{state.manifest.course.subtitle}</p><p>{state.manifest.course.description}</p><div><button type="button" onClick={continueLesson}>Continue learning</button><button type="button" onClick={() => setView("map")}>View course map</button></div></section><section className="course-due-panel"><div><span className="course-kicker">DUE NEXT</span><h2>Course work and dates</h2></div>{(state.dueWork?.gradeItems || []).filter((item) => item.due_at).slice(0, 4).map((item) => <article key={item.id}><strong>{item.title}</strong><span>{formatDate(item.due_at)}</span></article>)}{!(state.dueWork?.gradeItems || []).some((item) => item.due_at) && <p>No dated work has been published yet.</p>}</section></>}
        {view === "map" && <section className="course-map-view"><span className="course-kicker">COURSE MAP</span><h1>{state.manifest.course.title}</h1>{state.manifest.paths.map((path) => <div key={path.id}><h2>{path.label}</h2><p>{path.description}</p>{path.groups.map((group) => <section key={group.id}><h3>{group.title}</h3><div>{path.nodes.filter((node) => group.nodeIds.includes(node.id)).map((lesson) => <button key={lesson.id} onClick={() => openLesson({ ...lesson, pathId: path.id, pathLabel: path.label })}><span>{completed.has(lesson.id) ? "✓ Completed" : "Available"}</span><strong>{lesson.title}</strong><small>~{lesson.estimatedMinutes || 15} min</small></button>)}</div></section>)}</div>)}</section>}
        {view === "lesson" && active && <LessonPlayer publication={state.publication} manifest={state.manifest} path={active.path} lesson={active.lesson} saved={active.saved} onExit={() => { setActive(null); setView("map"); loadLearnerProgress(state.publication.id, session?.user?.id).then((result) => setState((current) => ({ ...current, progress: result.data }))); }} onProgress={(progress) => setState((current) => ({ ...current, progress: { ...current.progress, summary: progress } }))} />}
        {view === "assignments" && <section className="course-assignment-frame"><AssignmentTemplateWorkspace mode="student" session={session} track={track} classes={[courseClass]} /></section>}
      </main>
    </div>
  </div>;
}
