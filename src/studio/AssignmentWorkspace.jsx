import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { currentCourseId, readCourseDraft } from "./storageService.js";

const DEFAULT_CRITERIA = [
  { id: crypto.randomUUID(), name: "Understanding", points: 30, description: "Uses course concepts accurately and meaningfully." },
  { id: crypto.randomUUID(), name: "Evidence", points: 25, description: "Supports claims with relevant, attributed evidence." },
  { id: crypto.randomUUID(), name: "Reasoning", points: 30, description: "Explains how evidence supports the conclusion." },
  { id: crypto.randomUUID(), name: "Communication", points: 15, description: "Organizes and presents the work for the intended audience." },
];

function localDraftKey(assignmentId) {
  return `ednotebook-assignment-draft-${assignmentId || "preview"}`;
}

function downloadDraft(title, content) {
  const text = `${title}\n\n${content}`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "assignment-draft"}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildSyllabusSection({ title, instructions, dueAt, outcomes, deliverable, points, submissionLabel }) {
  return {
    heading: title || "Untitled assignment",
    purpose: outcomes || "Learners will demonstrate progress toward the course outcomes.",
    description: instructions || "Assignment instructions will be provided in EdNotebook.",
    deliverable: deliverable || "Submit the required work through the assignment sandbox.",
    due: dueAt ? formatDate(dueAt) : "See the course schedule.",
    grading: `${points} points using the attached custom rubric.`,
    submission: submissionLabel,
  };
}

function SyllabusPreview({ section }) {
  return (
    <article className="studio-syllabus-preview">
      <small>SYLLABUS SECTION</small>
      <h3>{section.heading}</h3>
      <dl>
        <div><dt>Purpose</dt><dd>{section.purpose}</dd></div>
        <div><dt>Description</dt><dd>{section.description}</dd></div>
        <div><dt>Deliverable</dt><dd>{section.deliverable}</dd></div>
        <div><dt>Due</dt><dd>{section.due}</dd></div>
        <div><dt>Grading</dt><dd>{section.grading}</dd></div>
        <div><dt>Submission</dt><dd>{section.submission}</dd></div>
      </dl>
    </article>
  );
}

function RubricEditor({ criteria, setCriteria }) {
  const total = criteria.reduce((sum, criterion) => sum + (Number(criterion.points) || 0), 0);

  function update(id, field, value) {
    setCriteria((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  return (
    <section className="studio-rubric-editor" aria-labelledby="rubric-title">
      <div className="studio-panel-heading">
        <div><span className="studio-kicker">CUSTOM RUBRIC</span><h3 id="rubric-title">Define what quality means for this assignment.</h3></div>
        <strong>{total} points</strong>
      </div>
      <div className="studio-rubric-rows">
        {criteria.map((criterion, index) => (
          <div className="studio-rubric-row" key={criterion.id}>
            <span>{index + 1}</span>
            <label>Criterion<input value={criterion.name} onChange={(event) => update(criterion.id, "name", event.target.value)} /></label>
            <label>Points<input type="number" min="0" max="1000" value={criterion.points} onChange={(event) => update(criterion.id, "points", Number(event.target.value))} /></label>
            <label className="is-wide">Evidence of quality<textarea rows={2} value={criterion.description} onChange={(event) => update(criterion.id, "description", event.target.value)} /></label>
            <button type="button" aria-label={`Remove ${criterion.name}`} onClick={() => setCriteria((items) => items.filter((item) => item.id !== criterion.id))}>×</button>
          </div>
        ))}
      </div>
      <button className="studio-secondary-button" type="button" onClick={() => setCriteria((items) => [...items, { id: crypto.randomUUID(), name: "New criterion", points: 10, description: "Describe the observable evidence." }])}>+ Add rubric criterion</button>
    </section>
  );
}

function LearnerSandbox({ assignmentId, title, instructions, dueAt, deliverable, criteria }) {
  const [view, setView] = useState("learner");
  const [body, setBody] = useState(() => window.localStorage.getItem(localDraftKey(assignmentId)) || "");
  const [storageMode, setStorageMode] = useState("cloud");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const paragraphs = body.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(localDraftKey(assignmentId), body);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [assignmentId, body]);

  async function saveProgress() {
    setNotice("");
    setError("");
    try {
      if (storageMode === "device") {
        window.localStorage.setItem(localDraftKey(assignmentId), body);
        setNotice("Saved to this browser only. The draft will not follow you to another device.");
        return;
      }
      if (!assignmentId) throw new Error("Save the professor assignment before using cloud draft storage.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { error: draftError } = await supabase.from("assignment_drafts").upsert({
        assignment_id: assignmentId,
        student_id: userData.user.id,
        content: { format: "EduSync/1.0", body, words, paragraphs: paragraphs.length },
        storage_mode: "cloud",
        status: "draft",
      }, { onConflict: "assignment_id,student_id" });
      if (draftError) throw draftError;
      setNotice("Progress saved privately to your EdNotebook account.");
    } catch (saveError) {
      setError(saveError.message || "The draft could not be saved.");
    }
  }

  if (view === "review") {
    return (
      <section className="studio-review-preview">
        <div className="studio-preview-switch">
          <button type="button" onClick={() => setView("learner")}>Learner workspace</button>
          <button type="button" className="is-active">Professor review</button>
        </div>
        <div className="studio-review-header"><div><small>PREVIEW · NOT SUBMITTED</small><h3>{title || "Assignment submission"}</h3><p>{words} words · autosaved locally</p></div><span>Draft</span></div>
        <div className="studio-review-document">{body ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="is-empty">The professor sees a clean preview of the learner draft here.</p>}</div>
        <div className="studio-review-rubric">
          <h4>Attached rubric</h4>
          {criteria.map((criterion) => <div key={criterion.id}><strong>{criterion.name}</strong><span>— / {criterion.points}</span><p>{criterion.description}</p></div>)}
        </div>
      </section>
    );
  }

  return (
    <section className="studio-learner-sandbox">
      <div className="studio-preview-switch">
        <button type="button" className="is-active">Learner workspace</button>
        <button type="button" onClick={() => setView("review")}>Professor review</button>
      </div>
      <div className="studio-assignment-brief">
        <div><small>ASSIGNMENT SANDBOX</small><h3>{title || "Untitled assignment"}</h3><p>{instructions || "The professor’s instructions will appear here."}</p></div>
        <dl><div><dt>Due</dt><dd>{formatDate(dueAt)}</dd></div><div><dt>Deliverable</dt><dd>{deliverable || "Course submission"}</dd></div></dl>
      </div>
      <div className="studio-draft-toolbar">
        <span>{words} words · {paragraphs.length} paragraph{paragraphs.length === 1 ? "" : "s"}</span>
        <div><button type="button" className={storageMode === "cloud" ? "is-active" : ""} onClick={() => setStorageMode("cloud")}>Cloud save</button><button type="button" className={storageMode === "device" ? "is-active" : ""} onClick={() => setStorageMode("device")}>Device only</button></div>
      </div>
      <textarea className="studio-draft-editor" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Start the assignment here. Your local draft is autosaved while you write." />
      <div className="studio-draft-actions"><button type="button" onClick={() => downloadDraft(title || "Assignment draft", body)}>Download to device</button><button className="studio-primary-button" type="button" onClick={saveProgress}>Save progress</button></div>
      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}
    </section>
  );
}

export default function AssignmentWorkspace() {
  const course = useMemo(readCourseDraft, []);
  const courseId = currentCourseId();
  const [mode, setMode] = useState("professor");
  const [assignmentId, setAssignmentId] = useState(null);
  const [title, setTitle] = useState("Evidence-Based Digital Decision Brief");
  const [instructions, setInstructions] = useState("Choose a digital tool or platform. Explain what it is, why it exists, how it may help, what it may cost, who benefits, and how your claims can be verified.");
  const [outcomes, setOutcomes] = useState("Evaluate a digital system using evidence, stakeholder analysis, and verification practices.");
  const [deliverable, setDeliverable] = useState("1,000–1,250 word decision brief with at least four attributed sources");
  const [dueAt, setDueAt] = useState("");
  const [submissionLabel, setSubmissionLabel] = useState("Write in the EdNotebook sandbox or attach an approved document format.");
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [syllabusSection, setSyllabusSection] = useState(null);
  const [status, setStatus] = useState("draft");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const totalPoints = criteria.reduce((sum, criterion) => sum + (Number(criterion.points) || 0), 0);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    supabase.from("assignments").select("*,rubrics(*)").eq("course_id", courseId).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      setAssignmentId(data.id);
      setTitle(data.title);
      setInstructions(data.instructions || "");
      setDueAt(data.due_at ? new Date(data.due_at).toISOString().slice(0, 16) : "");
      setStatus(data.status);
      setSyllabusSection(data.syllabus_section && Object.keys(data.syllabus_section).length ? data.syllabus_section : null);
      setOutcomes(data.settings?.outcomes || outcomes);
      setDeliverable(data.settings?.deliverable || deliverable);
      setSubmissionLabel(data.settings?.submissionLabel || submissionLabel);
      const rubric = Array.isArray(data.rubrics) ? data.rubrics[0] : data.rubrics;
      if (rubric?.criteria?.length) setCriteria(rubric.criteria);
    });
    return () => { active = false; };
  }, [courseId]);

  function generateSyllabus() {
    setSyllabusSection(buildSyllabusSection({ title, instructions, dueAt, outcomes, deliverable, points: totalPoints, submissionLabel }));
  }

  async function saveAssignment(nextStatus = status) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (!courseId) throw new Error("Save the course shell before creating an assignment.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const generatedSyllabus = syllabusSection || buildSyllabusSection({ title, instructions, dueAt, outcomes, deliverable, points: totalPoints, submissionLabel });
      const payload = {
        course_id: courseId,
        professor_id: userData.user.id,
        title: title.trim() || "Untitled assignment",
        instructions,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: nextStatus,
        syllabus_section: generatedSyllabus,
        learner_preview: { title, instructions, dueAt, deliverable, totalPoints },
        settings: { outcomes, deliverable, submissionLabel, courseTitle: course.name },
      };

      let saved;
      if (assignmentId) {
        const { data, error: assignmentError } = await supabase.from("assignments").update(payload).eq("id", assignmentId).select().single();
        if (assignmentError) throw assignmentError;
        saved = data;
      } else {
        const { data, error: assignmentError } = await supabase.from("assignments").insert(payload).select().single();
        if (assignmentError) throw assignmentError;
        saved = data;
        setAssignmentId(data.id);
      }

      const { error: rubricError } = await supabase.from("rubrics").upsert({
        assignment_id: saved.id,
        owner_id: userData.user.id,
        title: `${saved.title} rubric`,
        total_points: totalPoints || 100,
        criteria,
      }, { onConflict: "assignment_id" });
      if (rubricError) throw rubricError;

      setStatus(nextStatus);
      setSyllabusSection(generatedSyllabus);
      setNotice(nextStatus === "published" ? "Assignment published. The learner preview is now the delivery contract." : "Assignment, rubric, syllabus section, and preview saved.");
    } catch (saveError) {
      setError(saveError.message || "The assignment could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "learner") {
    return (
      <section className="studio-workspace" aria-labelledby="assignment-sandbox-title">
        <div className="studio-section-heading"><div><span className="studio-kicker">ASSIGNMENT SANDBOX</span><h2 id="assignment-sandbox-title">Preview the work before students receive it.</h2><p>Write, save, download, and switch to the professor review view without affecting a live submission.</p></div><button className="studio-secondary-button" type="button" onClick={() => setMode("professor")}>Back to professor builder</button></div>
        <LearnerSandbox assignmentId={assignmentId} title={title} instructions={instructions} dueAt={dueAt} deliverable={deliverable} criteria={criteria} />
      </section>
    );
  }

  return (
    <section className="studio-workspace" aria-labelledby="assignment-builder-title">
      <div className="studio-section-heading"><div><span className="studio-kicker">ASSIGNMENT BUILDER</span><h2 id="assignment-builder-title">Build the task, rubric, syllabus language, and learner view together.</h2><p>The learner-facing preview is not a separate mockup. It is generated from the same saved assignment record.</p></div><div className="studio-heading-actions"><span className={`studio-status-pill is-${status}`}>{status}</span><button className="studio-secondary-button" type="button" onClick={() => setMode("learner")}>Preview as learner</button></div></div>
      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}

      <div className="studio-assignment-grid">
        <form className="studio-form studio-assignment-form" onSubmit={(event) => { event.preventDefault(); saveAssignment(); }}>
          <label>Assignment title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Learning outcome<textarea rows={3} value={outcomes} onChange={(event) => setOutcomes(event.target.value)} /></label>
          <label>Instructions<textarea rows={7} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
          <div className="studio-field-grid"><label>Deliverable<input value={deliverable} onChange={(event) => setDeliverable(event.target.value)} /></label><label>Due date and time<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div>
          <label>Submission options<input value={submissionLabel} onChange={(event) => setSubmissionLabel(event.target.value)} /></label>
          <div className="studio-inline-actions"><button type="button" onClick={generateSyllabus}>Generate syllabus section</button><button className="studio-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save assignment"}</button><button className="studio-publish-button" type="button" disabled={busy} onClick={() => saveAssignment("published")}>Publish</button></div>
        </form>
        <SyllabusPreview section={syllabusSection || buildSyllabusSection({ title, instructions, dueAt, outcomes, deliverable, points: totalPoints, submissionLabel })} />
      </div>

      <RubricEditor criteria={criteria} setCriteria={setCriteria} />
    </section>
  );
}
