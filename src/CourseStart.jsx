import { useMemo, useState } from "react";
import BrandLogo from "./Brand.jsx";

const JOURNEY = [
  {
    number: 1,
    title: "Create the course",
    text: "Name the class, identify the learners, and choose the teaching window.",
  },
  {
    number: 2,
    title: "Add source content",
    text: "Paste a syllabus, notes, outcomes, readings, or a course outline into Course Forge.",
  },
  {
    number: 3,
    title: "Choose the learning design",
    text: "Select Ram Ready, Story, Lab, Drill, or Seminar and set lesson and assessment counts.",
  },
  {
    number: 4,
    title: "Generate and review",
    text: "Create the course map, open every lesson, and revise the structure before release.",
  },
  {
    number: 5,
    title: "Preview as a learner",
    text: "Walk through knowledge checks, quizzes, pacing, XP, and the completion experience.",
  },
  {
    number: 6,
    title: "Publish and invite",
    text: "Move the course out of the sandbox and invite learners when it is ready.",
  },
];

function readDraft() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem("ednotebook-course-draft"));
  } catch {
    return null;
  }
}

export default function CourseStart({ onContinue, onHome }) {
  const prior = useMemo(readDraft, []);
  const [name, setName] = useState(prior?.name || "");
  const [code, setCode] = useState(prior?.code || "");
  const [audience, setAudience] = useState(prior?.audience || "Undergraduate learners");
  const [length, setLength] = useState(prior?.length || "16 weeks");
  const [error, setError] = useState("");

  const begin = (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the course a working title before continuing.");
      return;
    }

    const draft = {
      name: name.trim(),
      code: code.trim(),
      audience: audience.trim(),
      length,
      createdAt: prior?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem("ednotebook-course-draft", JSON.stringify(draft));
    window.localStorage.setItem("ednotebook-course-step", "2");
    setError("");
    onContinue?.();
  };

  return (
    <main className="course-start-page">
      <header className="course-start-nav">
        <button className="brand-button" type="button" onClick={onHome} aria-label="Return to the EdNotebook landing page">
          <BrandLogo size={40} tagline="Course creation workspace" />
        </button>
        <span className="course-start-status">Professor workspace</span>
      </header>

      <section className="course-start-hero" aria-labelledby="create-course-title">
        <div className="course-start-copy">
          <div className="step-kicker">STEP 1 OF 6 · CREATE A COURSE</div>
          <h1 id="create-course-title">Every EdNotebook course starts here.</h1>
          <p>
            Create the class shell first. Then EdNotebook walks you through source content, learning design,
            generation, learner preview, and publication in a numbered path.
          </p>
          <div className="course-start-promise">
            <span aria-hidden="true">✓</span>
            <span>You always know the current step, what is complete, and what comes next.</span>
          </div>
        </div>

        <form className="course-create-card" onSubmit={begin} aria-label="Create a course">
          <div className="card-step-line">
            <span className="card-step-number">1</span>
            <div>
              <strong>Create course</strong>
              <small>Required before Course Forge</small>
            </div>
          </div>

          <label>
            Course name <span aria-hidden="true">*</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digital Literacy for New College Students"
              autoComplete="off"
            />
          </label>

          <div className="course-field-grid">
            <label>
              Course code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="DLIT 101"
                autoComplete="off"
              />
            </label>
            <label>
              Teaching window
              <select value={length} onChange={(event) => setLength(event.target.value)}>
                <option>4 weeks</option>
                <option>8 weeks</option>
                <option>12 weeks</option>
                <option>16 weeks</option>
                <option>Self-paced</option>
              </select>
            </label>
          </div>

          <label>
            Learner audience
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="First-year non-majors"
              autoComplete="off"
            />
          </label>

          {error && <div className="course-form-error" role="alert">{error}</div>}

          <button className="primary-course-button" type="submit" data-motion="true">
            Save course and continue to Step 2
            <span aria-hidden="true">→</span>
          </button>
          <p className="course-create-note">Saved privately to this browser while the full database course model is connected.</p>
        </form>
      </section>

      <section className="course-journey-section" aria-labelledby="journey-title">
        <div className="section-heading-row">
          <div>
            <div className="section-eyebrow">THE COMPLETE PATH</div>
            <h2 id="journey-title">Six numbered steps from idea to enrolled learners</h2>
          </div>
          <div className="journey-count">1 / 6</div>
        </div>

        <ol className="course-journey-list">
          {JOURNEY.map((step) => (
            <li key={step.number} className={step.number === 1 ? "is-current" : ""}>
              <div className="journey-number">{step.number}</div>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
              <span className="journey-state">{step.number === 1 ? "Current" : `Step ${step.number}`}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
