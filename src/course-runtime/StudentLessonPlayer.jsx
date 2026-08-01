import { useEffect, useMemo, useRef, useState } from "react";
import { saveLessonProgress } from "./courseService.js";
import EdNotebookMediaReader from "../media/EdNotebookMediaReader.jsx";
import {
  STUDENT_EXPERIENCE_CONTRACT_VERSION,
  STUDENT_LESSON_STAGES,
  answerIsCorrect,
  lessonQuizExperience,
  lessonRecoveryKey,
  restoreLessonSession,
  stagePhase,
} from "./studentExperienceContract.js";

function readRecovery(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function ConceptCards({ concept }) {
  const groups = [
    [
      "Understand it",
      [
        ["What", concept?.what],
        ["Why it exists", concept?.why],
      ],
    ],
    [
      "Possible value",
      [
        ["How it may help", concept?.how],
        ["Who may benefit", concept?.whoMayBenefit],
      ],
    ],
    [
      "Tradeoffs",
      [
        ["What it may cost", concept?.cost],
        ["Risks or limitations", concept?.risks],
        ["Who may not benefit", concept?.whoMayNotBenefit],
      ],
    ],
    [
      "Use carefully",
      [
        ["When misunderstood", concept?.misunderstandingRisk],
        ["Verify", concept?.verifyNote],
      ],
    ],
  ];
  return (
    <div className="course-concept-grid">
      {groups.map(([title, items]) => (
        <article key={title}>
          <h3>{title}</h3>
          {items
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <strong>{label}</strong>
                <p>{value}</p>
              </div>
            ))}
        </article>
      ))}
    </div>
  );
}

function LessonFigure({ visual }) {
  if (!visual) return null;
  return (
    <figure className="course-learning-figure">
      <figcaption>
        <span>Lesson figure</span>
        <h2>{visual.title}</h2>
      </figcaption>
      <ol className={`is-${visual.type || "flow"}`}>
        {(visual.items || []).map((item, index) => (
          <li key={`${item}-${index}`}>
            <i>{index + 1}</i>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <p>
        <strong>Text alternative:</strong> {visual.textAlternative}
      </p>
    </figure>
  );
}

function LessonReadings({ lesson, manifest, onOpenTool }) {
  const lessonSourceIds = new Set(lesson.sourceIds || []);
  const sources = (manifest.sources || []).filter((source) =>
    lessonSourceIds.has(source.id || source.sourceId),
  );
  const readings = lesson.readings || [];
  if (!readings.length && !sources.length) return null;
  return (
    <section
      className="course-lesson-sources"
      aria-labelledby="course-lesson-sources-title"
    >
      <div>
        <span className="course-kicker">PROFESSOR-APPROVED SOURCES</span>
        <h2 id="course-lesson-sources-title">
          Read, verify, and keep the source trail.
        </h2>
      </div>
      {[...readings, ...sources].map((source, index) => (
        <article
          key={source.readingId || source.id || source.sourceId || index}
        >
          <strong>
            {source.title || source.citation || "Approved course source"}
          </strong>
          {source.citation && source.title && <p>{source.citation}</p>}
          <small>
            {source.required === true ? "Required reading" : "Course source"}
          </small>
        </article>
      ))}
      <button type="button" onClick={() => onOpenTool("notes")}>
        Open notes and citation tools
      </button>
    </section>
  );
}

function QuestionInput({ question, value, onChange, name }) {
  if (question.type === "short_answer") {
    return (
      <label>
        Your answer
        <input
          type="text"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }
  return question.options.map((option) => (
    <label key={option}>
      <input
        type="radio"
        name={name}
        checked={value === option}
        onChange={() => onChange(option)}
      />
      {option}
    </label>
  ));
}

export default function StudentLessonPlayer({
  publication,
  publicationVersion,
  manifest,
  path,
  lesson,
  saved,
  userId,
  onExit,
  onOpenTool,
  onProgress,
  onMediaEvidence,
  resources = [],
}) {
  const recoveryKey = useMemo(
    () =>
      lessonRecoveryKey({
        publicationId: publication.id,
        publicationVersion,
        lessonId: lesson.id,
        userId,
      }),
    [lesson.id, publication.id, publicationVersion, userId],
  );
  const restored = useMemo(
    () =>
      restoreLessonSession({
        cloudProgress: saved,
        localRecovery: readRecovery(recoveryKey),
        publicationVersion,
        lessonId: lesson.id,
      }),
    [lesson.id, publicationVersion, recoveryKey, saved],
  );
  const [stage, setStage] = useState(restored.stage);
  const [interaction, setInteraction] = useState(restored.interactionState);
  const interactionRef = useRef(restored.interactionState);
  const [saveState, setSaveState] = useState(
    restored.recoveredFromDevice
      ? "Recovered on this device · sync pending"
      : "Saved",
  );
  const [summary, setSummary] = useState(null);
  const saveQueueRef = useRef(Promise.resolve());
  const latestSaveRef = useRef(0);
  const mountedRef = useRef(true);
  const stageHeadingRef = useRef(null);
  const quiz = useMemo(() => lessonQuizExperience(lesson), [lesson]);
  const selected = (lesson.choices || []).find(
    (choice) => choice.id === interaction.choiceId,
  );
  const checksComplete = (lesson.knowledgeChecks || []).every(
    (check) =>
      interaction.knowledgeChecked[check.id] === true &&
      answerIsCorrect(check, interaction.knowledgeAnswers[check.id]),
  );
  const quizComplete = quiz.questions.every((question) =>
    String(interaction.quizAnswers[question.id] ?? "").trim(),
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [stage]);

  async function persist(
    nextStage = stage,
    complete = false,
    nextInteraction = interaction,
  ) {
    const saveId = latestSaveRef.current + 1;
    latestSaveRef.current = saveId;
    const recovery = {
      contractVersion: STUDENT_EXPERIENCE_CONTRACT_VERSION,
      publicationVersion,
      lessonId: lesson.id,
      sectionIndex: nextStage,
      interactionState: nextInteraction,
      complete,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(recoveryKey, JSON.stringify(recovery));
    setSaveState("Saving…");
    const request = saveQueueRef.current.then(() =>
      saveLessonProgress({
        publicationId: publication.id,
        pathId: path.id,
        lessonId: lesson.id,
        sectionIndex: nextStage,
        phase: stagePhase(nextStage),
        interactionState: nextInteraction,
        complete,
      }),
    );
    saveQueueRef.current = request.catch(() => {});
    const result = await request;
    if (!mountedRef.current || saveId !== latestSaveRef.current) return result;
    if (result.error) {
      setSaveState("Saved on this device · cloud sync will retry");
      return result;
    }
    window.localStorage.removeItem(recoveryKey);
    setSaveState(
      `Saved · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
    );
    setSummary(result.data);
    onProgress?.(result.data);
    return result;
  }

  useEffect(() => {
    persist(stage, stage === 5, interaction);
    // Opening a lesson records the exact restored place once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateInteraction(patch) {
    const current = interactionRef.current;
    const next = {
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    };
    interactionRef.current = next;
    setInteraction(next);
    persist(stage, false, next);
  }

  function answerKnowledge(check, answer) {
    updateInteraction((current) => ({
      knowledgeAnswers: {
        ...current.knowledgeAnswers,
        [check.id]: answer,
      },
      knowledgeChecked: {
        ...current.knowledgeChecked,
        [check.id]: false,
      },
    }));
  }

  function checkKnowledge(check) {
    updateInteraction((current) => ({
      knowledgeChecked: {
        ...current.knowledgeChecked,
        [check.id]: true,
      },
      knowledgeAttempts: {
        ...current.knowledgeAttempts,
        [check.id]: Number(current.knowledgeAttempts[check.id] || 0) + 1,
      },
    }));
  }

  function retryKnowledge(check) {
    updateInteraction((current) => ({
      knowledgeAnswers: {
        ...current.knowledgeAnswers,
        [check.id]: "",
      },
      knowledgeChecked: {
        ...current.knowledgeChecked,
        [check.id]: false,
      },
    }));
  }

  function answerQuiz(question, answer) {
    updateInteraction((current) => ({
      quizAnswers: {
        ...current.quizAnswers,
        [question.id]: answer,
      },
    }));
  }

  function moveTo(nextStage, complete = false) {
    setStage(nextStage);
    persist(nextStage, complete, interactionRef.current);
  }

  const stageLabel = STUDENT_LESSON_STAGES[stage];
  return (
    <article className="course-lesson-player">
      <header className="course-player-header">
        <button type="button" onClick={onExit}>
          ← Course map
        </button>
        <div>
          <small>{path.label}</small>
          <strong>{lesson.title}</strong>
        </div>
        <span aria-live="polite">{saveState}</span>
      </header>
      <div
        className="course-stage-progress"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin="1"
        aria-valuemax={STUDENT_LESSON_STAGES.length}
        aria-valuenow={stage + 1}
        aria-valuetext={`${stageLabel.label}, step ${stage + 1} of ${STUDENT_LESSON_STAGES.length}`}
      >
        <i
          style={{
            width: `${((stage + 1) / STUDENT_LESSON_STAGES.length) * 100}%`,
          }}
        />
      </div>
      <ol className="course-stage-labels" aria-label="Lesson workflow">
        {STUDENT_LESSON_STAGES.map((item, index) => (
          <li
            key={item.id}
            className={
              index === stage
                ? "is-current"
                : index < stage
                  ? "is-complete"
                  : ""
            }
          >
            <span>{index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {stage === 0 && (
        <section className="course-stage">
          <span className="course-kicker">
            ORIENT · ~{lesson.estimatedMinutes || 15} MIN
          </span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            {lesson.title}
          </h1>
          <p className="course-subtitle">{lesson.subtitle}</p>
          <div className="course-story-card">
            <h2>Why you are here</h2>
            <p>{lesson.purpose || lesson.openingNarrative}</p>
            <p>{lesson.realWorldExample}</p>
          </div>
          <LessonFigure visual={lesson.visual} />
          <h2>What you will be able to do</h2>
          <ul>
            {(lesson.learningObjectives || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <aside className="course-next-action">
            <strong>Next action</strong>
            <span>
              Read the professor-approved lesson, then apply it before checking
              your understanding.
            </span>
          </aside>
        </section>
      )}

      {stage === 1 && (
        <section className="course-stage">
          <span className="course-kicker">
            READ · PROFESSOR-APPROVED LESSON
          </span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            {lesson.title}
          </h1>
          {(lesson.builderSections || []).length ? (
            <div className="course-reading-sections">
              {lesson.builderSections.map((section) => (
                <section
                  key={section.id || section.sectionId || section.heading}
                >
                  <h2>{section.heading}</h2>
                  <p>{section.body}</p>
                </section>
              ))}
            </div>
          ) : (
            <ConceptCards concept={lesson.concept} />
          )}
          <LessonReadings
            lesson={lesson}
            manifest={manifest}
            onOpenTool={onOpenTool}
          />
          {resources.length > 0 && (
            <section className="course-lesson-media" aria-labelledby={`lesson-media-${lesson.id}`}>
              <div>
                <span className="course-kicker">PROFESSOR-PUBLISHED MEDIA</span>
                <h2 id={`lesson-media-${lesson.id}`}>Watch and explore without leaving the lesson.</h2>
              </div>
              {resources.map((resource) => (
                <EdNotebookMediaReader key={resource.id} resource={resource} onEvidence={onMediaEvidence} />
              ))}
            </section>
          )}
        </section>
      )}

      {stage === 2 && (
        <section className="course-stage">
          <span className="course-kicker">ACT · APPLY THE LESSON</span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            {lesson.activity?.title ||
              lesson.scenario?.prompt ||
              "Apply what you learned"}
          </h1>
          {lesson.activity && (
            <article className="course-learning-activity">
              <p>{lesson.activity.instructions}</p>
              <span>~{lesson.activity.estimatedMinutes || 10} minutes</span>
              <h2>Success looks like</h2>
              <ul>
                {(lesson.activity.successCriteria || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button type="button" onClick={() => onOpenTool("notes")}>
                Work in notes
              </button>
            </article>
          )}
          {(lesson.discussionPrompts || []).map((discussion) => (
            <article
              className="course-discussion-prompt"
              key={discussion.discussionId}
            >
              <span className="course-kicker">COURSE DISCUSSION</span>
              <h2>{discussion.title || "Discuss with your course"}</h2>
              <p>{discussion.prompt}</p>
              <p>{discussion.learnerDirections}</p>
              <button type="button" onClick={() => onOpenTool("messages")}>
                Open course discussion
              </button>
            </article>
          ))}
          {(lesson.choices || []).length > 0 && (
            <>
              <h2>{lesson.scenario?.prompt || "Choose a response"}</h2>
              <div className="course-choice-list">
                {lesson.choices.map((choice) => (
                  <article
                    className={
                      choice.id === interaction.choiceId ? "is-selected" : ""
                    }
                    key={choice.id}
                  >
                    <h3>{choice.text}</h3>
                    <p>
                      <strong>Why someone might choose this:</strong>{" "}
                      {choice.whyChosen}
                    </p>
                    <p>
                      <strong>Possible benefit:</strong>{" "}
                      {choice.possibleBenefit}
                    </p>
                    <p>
                      <strong>Possible cost:</strong> {choice.possibleCost}
                    </p>
                    <p>
                      <strong>Possible risk:</strong> {choice.possibleRisk}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateInteraction({ choiceId: choice.id })}
                    >
                      Choose this
                    </button>
                    {choice.id === interaction.choiceId && (
                      <div className="course-choice-result" role="status">
                        <h3>What this choice changes</h3>
                        <p>
                          <strong>Right away:</strong>{" "}
                          {lesson.consequences?.immediate?.[choice.id]}
                        </p>
                        <p>
                          <strong>Later:</strong>{" "}
                          {lesson.consequences?.later?.[choice.id]}
                        </p>
                        <p>
                          <strong>Long term:</strong>{" "}
                          {lesson.consequences?.longTerm?.[choice.id]}
                        </p>
                        <p>
                          <strong>What could change it:</strong>{" "}
                          {choice.whatCouldChangeThisOutcome}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {stage === 3 && (
        <section className="course-stage">
          <span className="course-kicker">CHECK · FEEDBACK AND RECOVERY</span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            Check your understanding.
          </h1>
          {(lesson.knowledgeChecks || []).length === 0 ? (
            <p>No knowledge check is required for this lesson.</p>
          ) : (
            lesson.knowledgeChecks.map((check) => {
              const answer = interaction.knowledgeAnswers[check.id];
              const checked = interaction.knowledgeChecked[check.id] === true;
              const correct = checked && answerIsCorrect(check, answer);
              return (
                <fieldset className="course-question" key={check.id}>
                  <legend>{check.question}</legend>
                  <QuestionInput
                    question={check}
                    value={answer}
                    name={check.id}
                    onChange={(value) => answerKnowledge(check, value)}
                  />
                  {!checked && (
                    <button
                      type="button"
                      disabled={!String(answer ?? "").trim()}
                      onClick={() => checkKnowledge(check)}
                    >
                      Check answer
                    </button>
                  )}
                  {checked && (
                    <div
                      className={
                        correct
                          ? "course-feedback is-correct"
                          : "course-feedback is-recovery"
                      }
                      role="status"
                    >
                      <strong>
                        {correct ? "Correct." : "Not yet—this is recoverable."}
                      </strong>
                      <p>{correct ? check.explanation : lesson.recoveryPath}</p>
                      {!correct && (
                        <div>
                          <button
                            type="button"
                            onClick={() => retryKnowledge(check)}
                          >
                            Try again
                          </button>
                          <button type="button" onClick={() => moveTo(1)}>
                            Review the lesson
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenTool("messages")}
                          >
                            Ask the course
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </fieldset>
              );
            })
          )}
        </section>
      )}

      {stage === 4 && (
        <section className="course-stage">
          <span className="course-kicker">
            {quiz.questions.length ? "REVIEW · LESSON QUIZ" : "REVIEW"}
          </span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            {quiz.title}
          </h1>
          <p>{quiz.instructions}</p>
          {quiz.questions.map((question) => (
            <fieldset className="course-question" key={question.id}>
              <legend>{question.question}</legend>
              <QuestionInput
                question={question}
                value={interaction.quizAnswers[question.id]}
                name={question.id}
                onChange={(value) => answerQuiz(question, value)}
              />
            </fieldset>
          ))}
          <div className="course-review-summary">
            <p>
              <strong>Decision:</strong>{" "}
              {selected?.text || "No decision required"}
            </p>
            <p>
              <strong>Knowledge checks:</strong>{" "}
              {Object.keys(interaction.knowledgeAnswers).length} of{" "}
              {(lesson.knowledgeChecks || []).length}
            </p>
            <p>
              <strong>Quiz:</strong>{" "}
              {
                Object.keys(interaction.quizAnswers).filter(
                  (id) => interaction.quizAnswers[id],
                ).length
              }{" "}
              of {quiz.questions.length}
            </p>
            <small>
              Quiz correctness and explanations appear only after you submit.
            </small>
          </div>
        </section>
      )}

      {stage === 5 && (
        <section className="course-stage course-complete-card">
          <span aria-hidden="true">✓</span>
          <h1 ref={stageHeadingRef} tabIndex="-1">
            Lesson complete
          </h1>
          <p>
            Your submitted lesson progress is connected to the professor’s
            course view.
          </p>
          {quiz.questions.length > 0 && (
            <div className="course-submitted-review">
              <h2>Submitted quiz review</h2>
              {quiz.questions.map((question) => (
                <article key={question.id}>
                  <strong>
                    {answerIsCorrect(
                      question,
                      interaction.quizAnswers[question.id],
                    )
                      ? "Correct"
                      : "Review this item"}
                  </strong>
                  <p>{question.question}</p>
                  <span>
                    Your answer: {interaction.quizAnswers[question.id]}
                  </span>
                  <p>{question.explanation}</p>
                </article>
              ))}
            </div>
          )}
          {summary && (
            <div>
              <strong>
                {summary.completed_lessons} of {summary.total_lessons} lessons
                complete
              </strong>
              <span>{summary.completion_percent}% course completion</span>
              <span>
                {summary.grade_status === "auto_graded"
                  ? `Automatic course grade: ${summary.final_score}%`
                  : summary.grade_status === "awaiting_grading"
                    ? "Course complete · awaiting professor grading"
                    : "Continue to the next lesson"}
              </span>
            </div>
          )}
          {!summary && <p role="status">{saveState}</p>}
          <button type="button" onClick={onExit}>
            Return to course
          </button>
        </section>
      )}

      {stage < 5 && (
        <footer className="course-player-actions">
          <button
            type="button"
            disabled={stage === 0}
            onClick={() => moveTo(Math.max(0, stage - 1))}
          >
            Back
          </button>
          <button
            className="primary"
            type="button"
            disabled={
              (stage === 2 &&
                (lesson.choices || []).length > 0 &&
                !interaction.choiceId) ||
              (stage === 3 && !checksComplete) ||
              (stage === 4 && !quizComplete)
            }
            onClick={() => moveTo(Math.min(5, stage + 1), stage === 4)}
          >
            {stage === 4 ? "Submit lesson quiz" : "Save and continue"}
          </button>
        </footer>
      )}
    </article>
  );
}
