import { useState } from "react";
import { currentCourseId, saveResourceRecord } from "./storageService.js";

const SUBJECT_BLUEPRINTS = {
  mathematics: [
    ["Scientific calculator", "Expressions, trigonometry, logarithms, roots, constants, and reusable calculation history."],
    ["Worked-example table", "Prompt, known values, formula choice, substitutions, result, and unit check."],
    ["Error-analysis card", "Compare a correct solution with a plausible misconception and ask where reasoning changed."],
  ],
  science: [
    ["Lab data table", "Independent variable, dependent variable, units, trials, mean, observation, and uncertainty."],
    ["Unit-conversion station", "A dimensional-analysis scaffold that requires units at every step."],
    ["Claim–evidence–reasoning map", "Organize a conclusion around a claim, evidence, and explanatory mechanism."],
  ],
  history: [
    ["Evidence timeline", "Place events, primary sources, and interpretations on a shared chronological line."],
    ["Source comparison table", "Author, audience, context, claim, evidence, omission, and reliability."],
    ["Causation map", "Connect structural causes, triggers, actors, turning points, and consequences."],
  ],
  language: [
    ["Vocabulary studio", "Term, pronunciation, context sentence, morphology, image cue, and retrieval schedule."],
    ["Close-reading panel", "Text passage, annotation, rhetorical move, interpretation, and supporting line."],
    ["Conversation builder", "Role, communicative goal, required structures, vocabulary constraints, and reflection."],
  ],
  business: [
    ["Break-even calculator", "Fixed costs, unit price, variable cost, contribution margin, and break-even quantity."],
    ["Decision matrix", "Weighted criteria, alternatives, evidence notes, score, and sensitivity check."],
    ["Budget table", "Category, forecast, actual, variance, owner, and next action."],
  ],
  computing: [
    ["Trace table", "Step through variables, conditions, loops, output, and detected logic errors."],
    ["Test-case generator", "Inputs, expected result, edge condition, actual result, and pass/fail reasoning."],
    ["System map", "User, interface, API, data store, external service, trust boundary, and failure path."],
  ],
  arts: [
    ["Critique board", "Intent, formal choices, context, evidence, interpretation, and revision decision."],
    ["Storyboard map", "Scene, purpose, framing, movement, sound, timing, and transition."],
    ["Portfolio reflection", "Artifact, process evidence, feedback received, change made, and next experiment."],
  ],
};

export default function SubjectGenerator() {
  const [subject, setSubject] = useState("mathematics");
  const [learningGoal, setLearningGoal] = useState("Learners will explain their reasoning and verify the result.");
  const [selected, setSelected] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const blueprint = SUBJECT_BLUEPRINTS[subject];

  async function save() {
    if (!selected.length) return;
    setNotice("");
    setError("");
    try {
      await saveResourceRecord({
        course_id: currentCourseId(),
        resource_type: "other",
        title: `${subject[0].toUpperCase()}${subject.slice(1)} learning tool set`,
        description: learningGoal,
        placement: "lesson",
        storage_mode: "metadata",
        visibility: currentCourseId() ? "course" : "private",
        metadata: {
          format: "EdSubjectTools/1.0",
          subject,
          learningGoal,
          tools: selected.map((index) => ({
            title: blueprint[index][0],
            description: blueprint[index][1],
          })),
        },
      });
      setNotice("Subject tool set saved to the course library.");
    } catch (saveError) {
      setError(saveError.message || "The tool set could not be saved.");
    }
  }

  return (
    <div className="studio-subject-generator">
      <div className="studio-subject-controls">
        <label>
          Subject
          <select
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setSelected([]);
            }}
          >
            {Object.keys(SUBJECT_BLUEPRINTS).map((key) => (
              <option key={key} value={key}>{key[0].toUpperCase() + key.slice(1)}</option>
            ))}
          </select>
        </label>
        <label>
          Learning goal
          <textarea rows={3} value={learningGoal} onChange={(event) => setLearningGoal(event.target.value)} />
        </label>
        <p>Choose tools because they support the goal—not because they are available.</p>
      </div>

      <div className="studio-blueprint-grid">
        {blueprint.map(([name, description], index) => {
          const active = selected.includes(index);
          return (
            <button
              key={name}
              type="button"
              className={active ? "is-active" : ""}
              onClick={() => setSelected((items) => (
                active ? items.filter((item) => item !== index) : [...items, index]
              ))}
            >
              <span>{active ? "✓" : "+"}</span>
              <strong>{name}</strong>
              <p>{description}</p>
            </button>
          );
        })}
      </div>

      <div className="studio-generator-footer">
        <span>{selected.length} selected</span>
        <button className="studio-primary-button" type="button" disabled={!selected.length} onClick={save}>
          Add selected tools to course
        </button>
      </div>
      {notice && <div className="studio-alert is-success">{notice}</div>}
      {error && <div className="studio-alert is-error">{error}</div>}
    </div>
  );
}
