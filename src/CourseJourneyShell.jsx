import { useMemo, useState } from "react";
import { BrandMark } from "./Brand.jsx";

const STEPS = [
  "Create course",
  "Add content",
  "Choose design",
  "Generate & review",
  "Preview",
  "Publish",
];

function readStep() {
  if (typeof window === "undefined") return 2;
  const saved = Number(window.localStorage.getItem("ednotebook-course-step"));
  return Number.isFinite(saved) ? Math.min(6, Math.max(2, saved)) : 2;
}

function readCourseName() {
  if (typeof window === "undefined") return "Untitled course";
  try {
    return JSON.parse(window.localStorage.getItem("ednotebook-course-draft"))?.name || "Untitled course";
  } catch {
    return "Untitled course";
  }
}

export default function CourseJourneyShell({ children, onBack }) {
  const [currentStep, setCurrentStep] = useState(readStep);
  const [visible, setVisible] = useState(true);
  const courseName = useMemo(readCourseName, []);

  const advance = (next) => {
    const safeStep = Math.min(6, Math.max(2, next));
    setCurrentStep((existing) => {
      const value = Math.max(existing, safeStep);
      window.localStorage.setItem("ednotebook-course-step", String(value));
      return value;
    });
  };

  const handleCapture = (event) => {
    const target = event.target.closest("button, textarea, input, select, [role='tab']");
    if (!target) return;
    const label = target.textContent?.replace(/\s+/g, " ").trim() || "";

    if (label === "Learner" || label === "Admin" || label.includes("Mastermind")) setVisible(false);
    if (label === "Professor") setVisible(true);

    if (target.matches("textarea") || label === "Forge") advance(2);
    if (["Ram Ready ★", "Story", "Lab", "Drill", "Seminar"].includes(label)) advance(3);
    if (label.includes("Generate course") || label === "Course") advance(4);
    if (label.includes("Preview as student")) advance(5);
    if (label.includes("Publish course to this class")) advance(6);
  };

  return (
    <div className="course-builder-shell" onClickCapture={handleCapture} onFocusCapture={handleCapture}>
      {visible && (
        <section className="builder-journey-bar" aria-label="Course creation progress">
          <div className="builder-journey-summary">
            <BrandMark size={38} />
            <div>
              <div className="builder-journey-kicker">COURSE BUILD · STEP {currentStep} OF 6</div>
              <strong>{courseName}</strong>
              <span>{STEPS[currentStep - 1]}</span>
            </div>
            <button type="button" onClick={onBack} data-motion="true">Course setup</button>
          </div>
          <ol className="builder-step-track">
            {STEPS.map((label, index) => {
              const step = index + 1;
              const done = step < currentStep;
              const active = step === currentStep;
              return (
                <li key={label} className={`${done ? "is-done" : ""}${active ? " is-active" : ""}`} aria-current={active ? "step" : undefined}>
                  <span>{done ? "✓" : step}</span>
                  <small>{label}</small>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {children}
    </div>
  );
}
