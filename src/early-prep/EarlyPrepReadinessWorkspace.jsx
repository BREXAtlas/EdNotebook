import { lazy, Suspense, useState } from "react";
import {
  EARLY_PREP_READINESS_MODULES,
  buildPracticeResume,
  buildTeacherReadinessAssignment,
  createStudentReadinessPlan,
  interviewPractice,
} from "./readinessCatalog.js";
import "./early-prep-readiness.css";

const AcademicWritingStudio = lazy(() => import("../writing/AcademicWritingStudio.jsx"));
const CHECKLIST_MODULE_IDS = new Set(["career-exploration", "trade-pathway", "summer-job-readiness", "college-readiness"]);

function ModuleSelector({ activeModuleId, onSelect }) {
  return (
    <div className="readiness-module-grid" aria-label="College and career readiness tools">
      {EARLY_PREP_READINESS_MODULES.map((module) => (
        <button
          className={module.id === activeModuleId ? "is-active" : ""}
          type="button"
          key={module.id}
          aria-pressed={module.id === activeModuleId}
          onClick={() => onSelect(module.id)}
        >
          <strong>{module.label}</strong>
          <span>{module.summary}</span>
        </button>
      ))}
    </div>
  );
}

function PracticeBoundary() {
  return (
    <section className="dashboard-card readiness-boundary">
      <span className="portal-kicker">PRACTICE, NOT A DECISION SYSTEM</span>
      <h2>You stay in charge of every next step.</h2>
      <p>EdNotebook does not rank careers, predict admission, score employability, match students to employers, submit applications, contact organizations, or charge for these Grades 9–12 tools. Verify real requirements with an official source and a trusted adult, teacher, counselor, or program representative.</p>
    </section>
  );
}

function TeacherReadinessWorkspace({ onOpenAssignments }) {
  const [activeModuleId, setActiveModuleId] = useState(EARLY_PREP_READINESS_MODULES[0].id);
  const assignment = buildTeacherReadinessAssignment(activeModuleId);
  const module = EARLY_PREP_READINESS_MODULES.find(({ id }) => id === activeModuleId);

  return (
    <div className="early-prep-readiness">
      <section className="dashboard-card readiness-hero">
        <div>
          <span className="portal-kicker">EARLY PREP 9–12 · TEACHER TOOLS</span>
          <h1>Coach college, career, trade, and first-work readiness.</h1>
          <p>Choose a practice module, preview its CTE-adapted assignment, then open the existing assignment workspace when you are ready to tailor it for a class.</p>
        </div>
        <button className="primary" type="button" onClick={onOpenAssignments}>Open Assignments</button>
      </section>

      <ModuleSelector activeModuleId={activeModuleId} onSelect={setActiveModuleId} />

      <section className="dashboard-card readiness-teacher-preview">
        <header><div><span className="portal-kicker">REVIEW-ONLY ASSIGNMENT STARTER</span><h2>{assignment.title}</h2></div><span>CTE adapter · {assignment.version}</span></header>
        <p>{assignment.instructions}</p>
        <div className="readiness-teacher-columns">
          <div><h3>Student prompts</h3><ol>{assignment.sections.map((section) => <li key={section.prompt}><strong>{section.prompt}</strong><span>{section.helpText}</span></li>)}</ol></div>
          <div><h3>Teacher review checks</h3><ul>{module.teacherChecks.map((check) => <li key={check}>{check}</li>)}</ul></div>
        </div>
        <div className="readiness-status-line" role="status"><strong>Draft only</strong><span>No automatic score, publication, student-data request, eligibility decision, or external submission.</span></div>
      </section>

      <PracticeBoundary />
    </div>
  );
}

function StudentReadinessWorkspace({ onOpenLearningWorkspace, onOpenPortfolio }) {
  const [activeModuleId, setActiveModuleId] = useState(EARLY_PREP_READINESS_MODULES[0].id);
  const [goalText, setGoalText] = useState("");
  const [planNotice, setPlanNotice] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerNotes, setAnswerNotes] = useState("");
  const [completedSteps, setCompletedSteps] = useState([]);
  const [resumeDraft, setResumeDraft] = useState({ displayName: "", summary: "", education: "", skills: "", experience: "" });
  const [resumeDocument, setResumeDocument] = useState("");
  const [writingOpen, setWritingOpen] = useState(false);
  const [resumeNotice, setResumeNotice] = useState("");
  const module = EARLY_PREP_READINESS_MODULES.find(({ id }) => id === activeModuleId);
  const interview = interviewPractice({ questionIndex });

  function savePracticePlan() {
    const plan = createStudentReadinessPlan({ selectedModuleIds: [activeModuleId], goalText });
    setPlanNotice(`Practice plan ready for ${plan.selectedModules[0].label}. Nothing was shared or submitted.`);
  }

  function updateResume(field, value) {
    setResumeDraft((current) => ({ ...current, [field]: value }));
  }

  function openResumeStudio() {
    const document = buildPracticeResume(resumeDraft);
    setResumeDocument(document.html);
    setResumeNotice("Private practice draft created in memory. Contact details were intentionally omitted.");
    setWritingOpen(true);
  }

  function toggleStep(stepId) {
    setCompletedSteps((current) => current.includes(stepId)
      ? current.filter((id) => id !== stepId)
      : [...current, stepId]);
  }

  return (
    <div className="early-prep-readiness">
      <section className="dashboard-card readiness-hero">
        <div>
          <span className="portal-kicker">EARLY PREP 9–12 · COLLEGE & CAREER</span>
          <h1>Explore choices, build evidence, and practice safely.</h1>
          <p>Use these tools to prepare questions and drafts. They do not decide your path, predict an outcome, or send anything outside EdNotebook.</p>
        </div>
        <button className="primary" type="button" onClick={onOpenLearningWorkspace}>Open Learning Workspace</button>
      </section>

      <ModuleSelector activeModuleId={activeModuleId} onSelect={(moduleId) => { setActiveModuleId(moduleId); setPlanNotice(""); }} />

      <section className="dashboard-card readiness-active-module">
        <header><div><span className="portal-kicker">SELF-DIRECTED PRACTICE</span><h2>{module.title}</h2></div><span>{module.label}</span></header>
        <p>{module.summary}</p>
        <div className="readiness-module-columns">
          <div><h3>Build toward</h3><ul>{module.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul></div>
          <div><h3>Questions to work through</h3><ol>{module.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol></div>
        </div>
        <label>Your goal for this practice<textarea rows={3} value={goalText} onChange={(event) => setGoalText(event.target.value)} placeholder="Example: Compare two training routes and write down three questions." /></label>
        <button type="button" onClick={savePracticePlan}>Create private practice plan</button>
        {planNotice ? <div className="portal-form-notice" role="status">{planNotice}</div> : null}
      </section>

      {activeModuleId === "resume-practice" ? (
        <section className="dashboard-card readiness-resume-builder">
          <span className="portal-kicker">PRIVATE RESUME PRACTICE</span>
          <h2>Turn school, projects, service, and activities into evidence.</h2>
          <p>Keep addresses, birth dates, government IDs, banking details, passwords, and other sensitive information out. Add contact details only after a trusted adult or educator reviews where the resume will go.</p>
          <div className="readiness-form-grid">
            <label>Display name<input value={resumeDraft.displayName} onChange={(event) => updateResume("displayName", event.target.value)} placeholder="Student Name" /></label>
            <label>Short summary<input value={resumeDraft.summary} onChange={(event) => updateResume("summary", event.target.value)} placeholder="What you are learning and ready to contribute" /></label>
            <label>Education and learning<textarea rows={3} value={resumeDraft.education} onChange={(event) => updateResume("education", event.target.value)} placeholder="Relevant classes, training, or certifications in progress" /></label>
            <label>Skills<textarea rows={3} value={resumeDraft.skills} onChange={(event) => updateResume("skills", event.target.value)} placeholder="Skills you can demonstrate with evidence" /></label>
            <label className="is-wide">Projects, service, activities, or experience<textarea rows={5} value={resumeDraft.experience} onChange={(event) => updateResume("experience", event.target.value)} placeholder="Use action + evidence statements. Do not invent experience." /></label>
          </div>
          <div className="readiness-actions"><button className="primary" type="button" onClick={openResumeStudio}>Open in Academic Writing Studio</button><button type="button" onClick={onOpenPortfolio}>Review my private page</button></div>
          {resumeNotice ? <div className="portal-form-notice" role="status">{resumeNotice}</div> : null}
        </section>
      ) : null}

      {activeModuleId === "interview-practice" ? (
        <section className="dashboard-card readiness-interview">
          <span className="portal-kicker">INTERVIEW PRACTICE · QUESTION {interview.questionIndex + 1} OF {interview.questionCount}</span>
          <h2>{interview.question}</h2>
          <label>Private practice notes<textarea rows={6} value={answerNotes} onChange={(event) => setAnswerNotes(event.target.value)} placeholder="Situation, your action, result, and what you learned" /></label>
          <ul>{interview.coachChecks.map((check) => <li key={check}>{check}</li>)}</ul>
          <div className="readiness-actions"><button type="button" onClick={() => setQuestionIndex((current) => (current + interview.questionCount - 1) % interview.questionCount)}>Previous question</button><button className="primary" type="button" onClick={() => setQuestionIndex((current) => (current + 1) % interview.questionCount)}>Next question</button></div>
          <p className="readiness-no-score">No camera, microphone, personality analysis, or automated interview score is used.</p>
        </section>
      ) : null}

      {CHECKLIST_MODULE_IDS.has(activeModuleId) ? (
        <section className="dashboard-card readiness-checklist">
          <span className="portal-kicker">PRIVATE PRACTICE CHECKLIST</span>
          <h2>Work through this path at your own pace.</h2>
          <p>{module.outcomes.filter((_, index) => completedSteps.includes(`${activeModuleId}:${index}`)).length} of {module.outcomes.length} practice steps checked. This is your checklist, not a readiness score.</p>
          <div>{module.outcomes.map((outcome, index) => {
            const stepId = `${activeModuleId}:${index}`;
            return <label key={stepId}><input type="checkbox" checked={completedSteps.includes(stepId)} onChange={() => toggleStep(stepId)} /><span>{outcome}</span></label>;
          })}</div>
        </section>
      ) : null}

      <PracticeBoundary />

      {writingOpen ? (
        <Suspense fallback={<section className="dashboard-card" role="status">Opening Academic Writing Studio…</section>}>
          <AcademicWritingStudio
            title="Practice Resume"
            content={resumeDocument}
            setContent={setResumeDocument}
            onClose={() => setWritingOpen(false)}
            onSave={(safeContent) => { setResumeDocument(safeContent); setResumeNotice("Practice resume saved in this open workspace only. Nothing was shared or submitted."); }}
            status="Private practice draft"
            saving={false}
            spellCheck
            wordLimit={0}
            saveLabel="Keep practice draft"
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default function EarlyPrepReadinessWorkspace({ mode = "student", onOpenAssignments, onOpenLearningWorkspace, onOpenPortfolio }) {
  if (mode === "teacher") return <TeacherReadinessWorkspace onOpenAssignments={onOpenAssignments} />;
  return <StudentReadinessWorkspace onOpenLearningWorkspace={onOpenLearningWorkspace} onOpenPortfolio={onOpenPortfolio} />;
}
