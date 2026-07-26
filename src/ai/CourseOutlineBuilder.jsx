import { useMemo, useState } from "react";

import { syncBuilderCoursePackage } from "../course-runtime/builderCourseAdapter.js";
import {
  createEditableOutline,
  outlineToBuilderCourse,
  splitProfessorList,
  validateCourseOutlineArtifact,
} from "./courseOutlineContract.js";
import { generateProfessorCourseOutline } from "./learningAiService.js";
import "./course-outline-builder.css";

const TEMPLATE_OPTIONS = [
  { value: "ramready", label: "Ram Ready", help: "Six-question evidence and verification structure" },
  { value: "story", label: "Story", help: "Narrative scenes, problems, turns, and application" },
  { value: "lab", label: "Lab", help: "Hands-on procedure before explanation" },
  { value: "drill", label: "Drill", help: "Worked examples and graduated practice" },
  { value: "seminar", label: "Seminar", help: "Sources, competing readings, and discussion" },
];

function readCourseDraft() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("ednotebook-course-draft")) || {};
  } catch {
    return {};
  }
}

function listText(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function Field({ label, hint, children }) {
  return (
    <label className="ai-outline-field">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      {children}
    </label>
  );
}

function DraftEditor({ draft, setDraft }) {
  const updateUnit = (unitIndex, update) => {
    setDraft((current) => ({
      ...current,
      units: current.units.map((unit, index) => (index === unitIndex ? { ...unit, ...update } : unit)),
    }));
  };

  const updateLesson = (unitIndex, lessonIndex, update) => {
    setDraft((current) => ({
      ...current,
      units: current.units.map((unit, index) => {
        if (index !== unitIndex) return unit;
        return {
          ...unit,
          lessons: unit.lessons.map((lesson, currentLessonIndex) => (
            currentLessonIndex === lessonIndex ? { ...lesson, ...update } : lesson
          )),
        };
      }),
    }));
  };

  return (
    <section className="ai-outline-draft" aria-labelledby="ai-outline-draft-title">
      <header className="ai-outline-draft__header">
        <div>
          <span className="ai-outline-badge">AI DRAFT · NOT PUBLISHED</span>
          <h2 id="ai-outline-draft-title">Review every part of the proposed course map</h2>
          <p>The model produced a draft. You remain the author and approving professor.</p>
        </div>
        <dl className="ai-outline-provenance">
          <div><dt>Provider route</dt><dd>{draft.provenance.provider || "Governed route"}</dd></div>
          <div><dt>Model</dt><dd>{draft.provenance.model || "Recorded by TOS"}</dd></div>
          <div><dt>Tier</dt><dd>{draft.provenance.tier ?? "—"}</dd></div>
          <div><dt>Prompt / policy</dt><dd>{draft.provenance.promptVersion || "—"} / {draft.provenance.policyVersion || "—"}</dd></div>
        </dl>
      </header>

      <div className="ai-outline-grid ai-outline-grid--two">
        <Field label="Course title">
          <input value={draft.courseTitle} onChange={(event) => setDraft({ ...draft, courseTitle: event.target.value })} />
        </Field>
        <Field label="Subtitle">
          <input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} />
        </Field>
      </div>

      <div className="ai-outline-grid ai-outline-grid--two">
        <Field label="Learning objectives" hint="One objective per line">
          <textarea
            rows={5}
            value={listText(draft.learningObjectives)}
            onChange={(event) => setDraft({ ...draft, learningObjectives: splitProfessorList(event.target.value) })}
          />
        </Field>
        <Field label="Assessment plan" hint="One assessment approach per line">
          <textarea
            rows={5}
            value={listText(draft.assessmentPlan)}
            onChange={(event) => setDraft({ ...draft, assessmentPlan: splitProfessorList(event.target.value, 30, 500) })}
          />
        </Field>
      </div>

      <div className="ai-outline-units">
        {draft.units.map((unit, unitIndex) => (
          <article className="ai-outline-unit" key={`unit-${unitIndex}`}>
            <div className="ai-outline-unit__title">
              <span>Unit {unitIndex + 1}</span>
              <input
                aria-label={`Unit ${unitIndex + 1} title`}
                value={unit.title}
                onChange={(event) => updateUnit(unitIndex, { title: event.target.value })}
              />
            </div>
            <div className="ai-outline-lessons">
              {unit.lessons.map((lesson, lessonIndex) => (
                <div className="ai-outline-lesson" key={`lesson-${unitIndex}-${lessonIndex}`}>
                  <span className="ai-outline-lesson__number">{lessonIndex + 1}</span>
                  <input
                    aria-label={`Lesson ${lessonIndex + 1} title in unit ${unitIndex + 1}`}
                    value={lesson.title}
                    onChange={(event) => updateLesson(unitIndex, lessonIndex, { title: event.target.value })}
                  />
                  <select
                    aria-label={`Lesson ${lessonIndex + 1} type in unit ${unitIndex + 1}`}
                    value={lesson.lessonType}
                    onChange={(event) => updateLesson(unitIndex, lessonIndex, { lessonType: event.target.value })}
                  >
                    <option value="story">Story</option>
                    <option value="lab">Lab</option>
                    <option value="drill">Drill</option>
                    <option value="seminar">Seminar</option>
                  </select>
                  <label className="ai-outline-minutes">
                    <span>Minutes</span>
                    <input
                      type="number"
                      min="5"
                      max="600"
                      value={lesson.estimatedMinutes}
                      onChange={(event) => updateLesson(unitIndex, lessonIndex, { estimatedMinutes: Number(event.target.value) })}
                    />
                  </label>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {draft.sourceGaps.length ? (
        <aside className="ai-outline-gaps" aria-label="Source gaps identified by the AI router">
          <strong>Source gaps to resolve before detailed content generation</strong>
          <ul>{draft.sourceGaps.map((gap, index) => <li key={`${gap}-${index}`}>{gap}</li>)}</ul>
        </aside>
      ) : null}
    </section>
  );
}

export default function CourseOutlineBuilder({ session, onBack, onStudio, onCourseOutput }) {
  const existingCourse = useMemo(readCourseDraft, []);
  const [form, setForm] = useState({
    courseTitle: existingCourse.name || "",
    subject: existingCourse.subject || "Interdisciplinary",
    audience: existingCourse.audience || "Undergraduate learners",
    academicLevel: "Undergraduate",
    duration: existingCourse.length || "16 weeks",
    learningObjectives: "",
    templateKey: "ramready",
    teachingApproach: "Professor-directed learning with discussion, application, and human-reviewed assessment.",
    sourceMaterials: "",
    assessmentPreferences: "Discussion\nReflective writing\nApplied project",
  });
  const [phase, setPhase] = useState("input");
  const [draft, setDraft] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("The TOS router is ready for one governed course-outline task.");

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const requestInput = () => ({
    courseTitle: form.courseTitle.trim(),
    subject: form.subject.trim(),
    audience: form.audience.trim(),
    academicLevel: form.academicLevel.trim(),
    duration: form.duration.trim(),
    learningObjectives: splitProfessorList(form.learningObjectives, 20, 500),
    templateKey: form.templateKey,
    teachingApproach: form.teachingApproach.trim(),
    sourceMaterials: splitProfessorList(form.sourceMaterials, 20, 1000),
    assessmentPreferences: splitProfessorList(form.assessmentPreferences, 20, 500),
  });

  async function generateOutline() {
    const input = requestInput();
    if (!input.courseTitle) {
      setError("Add a course title before generating the outline.");
      return;
    }
    if (!input.subject || !input.audience || !input.academicLevel || !input.duration || !input.teachingApproach) {
      setError("Complete the subject, audience, academic level, duration, and teaching approach.");
      return;
    }
    if (input.learningObjectives.length === 0) {
      setError("Add at least one professor-written learning objective.");
      return;
    }

    setPhase("generating");
    setError("");
    setMessage("TOS is checking your role, task policy, free capacity, and approved model route…");
    setReviewConfirmed(false);
    setAccepted(null);
    try {
      const result = await generateProfessorCourseOutline(input, {
        courseId: existingCourse.id || window.localStorage.getItem("ednotebook-course-id") || "",
      });
      setDraft(createEditableOutline(result, input));
      setPhase("review");
      setMessage("Outline returned as an unpublished AI draft. Review and edit it before acceptance.");
      window.localStorage.setItem("ednotebook-course-step", "4");
    } catch (generateError) {
      setPhase("input");
      setError(generateError.message || "The governed course outline could not be generated.");
      setMessage("Your course inputs are still here. No draft was published or silently replaced.");
    }
  }

  async function acceptOutline() {
    if (!draft || !reviewConfirmed) return;
    setPhase("saving");
    setError("");
    try {
      validateCourseOutlineArtifact(draft);
      const builderCourse = outlineToBuilderCourse(draft);
      const syncResult = await syncBuilderCoursePackage({ course: builderCourse, lessons: {}, session });
      const record = {
        format: "EdNotebookProfessorOutline/1.0",
        reviewState: "professor_accepted",
        acceptedAt: builderCourse.aiDraft.acceptedAt,
        course: builderCourse,
        syncSource: syncResult.source || "device",
      };
      window.localStorage.setItem("ednotebook-ai-course-outline", JSON.stringify(record));
      window.localStorage.setItem("ednotebook-course-step", "4");
      setAccepted(record);
      setPhase("accepted");
      setMessage(syncResult.error
        ? "The reviewed outline is saved on this device. Cloud course-package sync can be retried without regenerating it."
        : "The reviewed outline is accepted and synchronized to Course Output as a title-only course map.");
    } catch (saveError) {
      setPhase("review");
      setError(saveError.message || "The reviewed outline could not be saved.");
    }
  }

  function rejectOutline() {
    setDraft(null);
    setAccepted(null);
    setReviewConfirmed(false);
    setPhase("input");
    setError("");
    setMessage("The AI draft was rejected. Your professor-written inputs remain available for revision.");
  }

  return (
    <main className="ai-outline-page" aria-labelledby="ai-outline-title">
      <header className="ai-outline-hero">
        <div>
          <span>PHASE 2 · PROFESSOR COURSE-OUTLINE GENERATION</span>
          <h1 id="ai-outline-title">Build the course map first. Keep the professor in control.</h1>
          <p>EdNotebook sends one structured course-outline task to the TOS AI Learning Router. The browser never chooses a provider, sees a model key, or publishes the result.</p>
        </div>
        <div className="ai-outline-boundaries" aria-label="AI workflow boundaries">
          <span>Free-only routing</span>
          <span>Human review required</span>
          <span>No automatic publication</span>
          <span>No paid fallback</span>
        </div>
      </header>

      <section className="ai-outline-status" role="status" aria-live="polite">
        <strong>Current status</strong>
        <p>{message}</p>
      </section>

      <section className="ai-outline-form" aria-labelledby="outline-input-title">
        <div className="ai-outline-section-heading">
          <div><span>1 · PROFESSOR INPUT</span><h2 id="outline-input-title">Describe the course and its destination</h2></div>
          <button type="button" className="ai-outline-secondary" onClick={onBack}>Back to course setup</button>
        </div>

        <div className="ai-outline-grid ai-outline-grid--two">
          <Field label="Course title"><input value={form.courseTitle} onChange={(event) => setField("courseTitle", event.target.value)} /></Field>
          <Field label="Subject"><input value={form.subject} onChange={(event) => setField("subject", event.target.value)} /></Field>
          <Field label="Learner audience"><input value={form.audience} onChange={(event) => setField("audience", event.target.value)} /></Field>
          <Field label="Academic level"><input value={form.academicLevel} onChange={(event) => setField("academicLevel", event.target.value)} /></Field>
          <Field label="Course duration"><input value={form.duration} onChange={(event) => setField("duration", event.target.value)} /></Field>
          <Field label="Learning design">
            <select value={form.templateKey} onChange={(event) => setField("templateKey", event.target.value)}>
              {TEMPLATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small>{TEMPLATE_OPTIONS.find((option) => option.value === form.templateKey)?.help}</small>
          </Field>
        </div>

        <div className="ai-outline-grid ai-outline-grid--two">
          <Field label="Learning objectives" hint="Required. One professor-written objective per line.">
            <textarea rows={7} value={form.learningObjectives} onChange={(event) => setField("learningObjectives", event.target.value)} placeholder="Analyze leadership through systems thinking&#10;Apply transformative leadership concepts to an organizational challenge" />
          </Field>
          <Field label="Source materials and constraints" hint="One source, required reading, syllabus note, or constraint per line. Do not include student records.">
            <textarea rows={7} value={form.sourceMaterials} onChange={(event) => setField("sourceMaterials", event.target.value)} placeholder="Department outcome: evaluate evidence&#10;Required text: professor-approved course reader&#10;No student names, IDs, grades, or private messages" />
          </Field>
          <Field label="Teaching approach"><textarea rows={5} value={form.teachingApproach} onChange={(event) => setField("teachingApproach", event.target.value)} /></Field>
          <Field label="Assessment preferences" hint="One approach per line"><textarea rows={5} value={form.assessmentPreferences} onChange={(event) => setField("assessmentPreferences", event.target.value)} /></Field>
        </div>

        {error ? <div className="ai-outline-error" role="alert">{error}</div> : null}

        <div className="ai-outline-actions">
          <button type="button" className="ai-outline-primary" disabled={phase === "generating" || phase === "saving"} onClick={generateOutline}>
            {phase === "generating" ? "Generating governed outline…" : draft ? "Regenerate entire outline" : "Generate course outline"}
          </button>
          <button type="button" className="ai-outline-secondary" onClick={onStudio}>Open materials and tools</button>
        </div>
      </section>

      {draft ? <DraftEditor draft={draft} setDraft={setDraft} /> : null}

      {draft && phase !== "accepted" ? (
        <section className="ai-outline-approval" aria-labelledby="outline-approval-title">
          <div>
            <span>2 · HUMAN DECISION</span>
            <h2 id="outline-approval-title">Accept, revise, regenerate, or reject</h2>
            <p>Accepting saves the title-only map. It does not generate lessons, quizzes, activities, grades, or publication.</p>
          </div>
          <label className="ai-outline-confirmation">
            <input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />
            <span>I reviewed the title, objectives, unit sequence, lesson titles, lesson types, timing, assessment plan, and source gaps.</span>
          </label>
          <div className="ai-outline-actions">
            <button type="button" className="ai-outline-primary" disabled={!reviewConfirmed || phase === "saving"} onClick={acceptOutline}>
              {phase === "saving" ? "Saving reviewed outline…" : "Accept outline and save to Course Output"}
            </button>
            <button type="button" className="ai-outline-secondary" disabled={phase === "saving"} onClick={generateOutline}>Regenerate outline</button>
            <button type="button" className="ai-outline-danger" disabled={phase === "saving"} onClick={rejectOutline}>Reject AI draft</button>
          </div>
          <p className="ai-outline-phase-note"><strong>Section-specific regeneration and lesson, quiz, and activity generation remain locked.</strong> Those capabilities belong to the later reviewed content-generation phase, not this outline gate.</p>
        </section>
      ) : null}

      {accepted ? (
        <section className="ai-outline-accepted" aria-labelledby="outline-accepted-title">
          <span>PROFESSOR ACCEPTED · STILL NOT PUBLISHED</span>
          <h2 id="outline-accepted-title">The course map is ready in Course Output</h2>
          <p>{accepted.course.acts.reduce((total, unit) => total + unit.episodes.length, 0)} title-only lessons are mapped. Detailed lesson content must be generated and reviewed later.</p>
          <div className="ai-outline-actions">
            <button type="button" className="ai-outline-primary" onClick={onCourseOutput}>Continue to Course Output</button>
            <button type="button" className="ai-outline-secondary" onClick={() => { setPhase("review"); setAccepted(null); }}>Return to outline review</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
