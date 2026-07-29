import { useEffect, useRef, useState } from "react";

import { generateProfessorContentUnit } from "./learningAiService.js";
import {
  applyContentUnitDraft,
  createContentUnitGenerationInput,
  createEditableContentUnitDraft,
} from "./contentUnitGenerationContract.js";

const TASK_LABELS = Object.freeze({
  lesson_section: "selected section",
  activity: "lesson activity",
  discussion_prompt: "selected discussion prompt",
  knowledge_check: "selected knowledge check",
});

const clean = (value) => String(value ?? "").trim();
const readableId = (value) =>
  clean(value).replace(/^discussion-/, "").replaceAll("-", " ");

function unitSummary(unit) {
  if (unit.taskType === "lesson_section") {
    return {
      title: unit.section.heading,
      body: unit.section.body,
      alignment: unit.section.sourceIds,
    };
  }
  if (unit.taskType === "activity") {
    return {
      title: unit.activity.title,
      body: unit.activity.instructions,
      alignment: [
        ...unit.activity.outcomeIds,
        ...unit.activity.sourceIds,
      ],
    };
  }
  if (unit.taskType === "discussion_prompt") {
    return {
      title: unit.discussion.title,
      body: `${unit.discussion.prompt} ${unit.discussion.learnerDirections}`,
      alignment: [
        ...unit.discussion.outcomeIds,
        ...unit.discussion.sourceIds,
      ],
    };
  }
  return {
    title: unit.items.map((item) => item.question).join(" · "),
    body: unit.items.map((item) => item.explanation).join(" "),
    alignment: unit.items.flatMap((item) => [
      ...item.outcomeIds,
      ...item.sourceIds,
    ]),
  };
}

export default function ContentUnitReviewPanel({
  draft,
  lessonContract,
  selectedSectionId,
  courseId,
  institutionId,
  disabled = false,
  onApply,
}) {
  const firstCheckId = clean(draft.knowledgeChecks?.[0]?.checkId);
  const firstDiscussionId = clean(draft.connections?.discussionIds?.[0]);
  const [selectedCheckId, setSelectedCheckId] = useState(firstCheckId);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(
    firstDiscussionId,
  );
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState("ready");
  const [unitDraft, setUnitDraft] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const checkIds = (draft.knowledgeChecks || []).map((check) => check.checkId);
    if (!checkIds.includes(selectedCheckId)) {
      setSelectedCheckId(clean(checkIds[0]));
      setUnitDraft(null);
      setReviewConfirmed(false);
    }
  }, [draft.knowledgeChecks, selectedCheckId]);

  useEffect(() => {
    const discussionIds = draft.connections?.discussionIds || [];
    if (!discussionIds.includes(selectedDiscussionId)) {
      setSelectedDiscussionId(clean(discussionIds[0]));
      setUnitDraft(null);
      setReviewConfirmed(false);
    }
  }, [draft.connections?.discussionIds, selectedDiscussionId]);

  useEffect(() => {
    requestSequence.current += 1;
    setUnitDraft(null);
    setReviewConfirmed(false);
    setError("");
    setMessage("");
    setPhase("ready");
  }, [draft.lessonId, selectedSectionId]);

  async function generate(taskType) {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setPhase("generating");
    setUnitDraft(null);
    setReviewConfirmed(false);
    setError("");
    setMessage(`Generating one ${TASK_LABELS[taskType]} revision…`);

    try {
      const input = createContentUnitGenerationInput({
        taskType,
        lessonContract,
        editableDraft: draft,
        targetId:
          taskType === "lesson_section"
            ? selectedSectionId
            : taskType === "discussion_prompt"
              ? selectedDiscussionId
            : taskType === "knowledge_check"
              ? selectedCheckId
              : null,
        instruction,
      });
      const result = await generateProfessorContentUnit(taskType, input, {
        courseId,
        institutionId,
      });
      if (requestSequence.current !== sequence) return;
      const next = createEditableContentUnitDraft(result, taskType, input);
      setUnitDraft(next);
      setPhase("review");
      setMessage(
        `One unpublished ${TASK_LABELS[taskType]} revision returned. Compare it before applying.`,
      );
    } catch (generationError) {
      if (requestSequence.current !== sequence) return;
      setPhase("ready");
      setError(
        generationError.message
        || "The selected content unit could not be generated.",
      );
      setMessage("The current lesson draft was preserved.");
    }
  }

  function reject() {
    requestSequence.current += 1;
    setUnitDraft(null);
    setReviewConfirmed(false);
    setPhase("ready");
    setError("");
    setMessage("The content-unit revision was rejected. No lesson content changed.");
  }

  function apply() {
    try {
      const nextDraft = applyContentUnitDraft(draft, unitDraft);
      onApply(nextDraft, unitDraft.taskType);
      setUnitDraft(null);
      setReviewConfirmed(false);
      setPhase("ready");
      setError("");
      setMessage(
        `Professor-applied ${TASK_LABELS[unitDraft.taskType]} revision. The whole lesson is still an unpublished draft.`,
      );
    } catch (applyError) {
      setError(
        applyError.message || "The content-unit revision could not be applied.",
      );
    }
  }

  const summary = unitDraft ? unitSummary(unitDraft) : null;
  const reviewBlockCount = unitDraft?.reviewBlocks?.length || 0;
  const issueCount = unitDraft
    ? ["sourceGaps", "uncertainties", "conflicts"].reduce(
      (count, key) => count + (unitDraft[key]?.length || 0),
      0,
    )
    : 0;
  const busy = disabled || phase === "generating";

  return (
    <section
      className="phase5-content-unit-review"
      aria-labelledby="phase5-content-unit-title"
    >
      <div className="studio-section-heading">
        <div>
          <span className="studio-kicker">CONTROLLED CONTENT UNITS</span>
          <h3 id="phase5-content-unit-title">
            Revise one part without replacing the whole lesson.
          </h3>
          <p>
            Every result is an AI Draft — Not Published. Applying it changes
            only this lesson draft and never publishes the course.
          </p>
        </div>
      </div>

      <label>
        Optional bounded instruction
        <textarea
          rows={3}
          maxLength={1_000}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="What should this selected part clarify, preserve, or avoid?"
        />
      </label>

      <div className="phase5-content-unit-actions" aria-label="Content-unit actions">
        <button
          type="button"
          disabled={busy || !selectedSectionId}
          onClick={() => generate("lesson_section")}
        >
          Regenerate selected section
        </button>
        <button
          type="button"
          disabled={busy || !draft.activity}
          onClick={() => generate("activity")}
        >
          Regenerate activity
        </button>
        <label>
          Connected discussion
          <select
            value={selectedDiscussionId}
            disabled={busy || !draft.connections?.discussionIds?.length}
            onChange={(event) => {
              requestSequence.current += 1;
              setSelectedDiscussionId(event.target.value);
              setUnitDraft(null);
              setReviewConfirmed(false);
            }}
          >
            {(draft.connections?.discussionIds || []).map((discussionId) => (
              <option value={discussionId} key={discussionId}>
                {readableId(discussionId)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !selectedDiscussionId}
          onClick={() => generate("discussion_prompt")}
        >
          Regenerate discussion prompt
        </button>
        <label>
          Selected check
          <select
            value={selectedCheckId}
            disabled={busy || !draft.knowledgeChecks?.length}
            onChange={(event) => {
              requestSequence.current += 1;
              setSelectedCheckId(event.target.value);
              setUnitDraft(null);
              setReviewConfirmed(false);
            }}
          >
            {(draft.knowledgeChecks || []).map((check) => (
              <option value={check.checkId} key={check.checkId}>
                {check.question}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !selectedCheckId}
          onClick={() => generate("knowledge_check")}
        >
          Regenerate selected check
        </button>
      </div>

      {message && <p className="phase5-status" role="status">{message}</p>}
      {error && <p className="phase5-error" role="alert">{error}</p>}

      {unitDraft && (
        <article className="phase5-content-unit-result">
          <header>
            <div>
              <span>{unitDraft.statusLabel}</span>
              <strong>{TASK_LABELS[unitDraft.taskType]}</strong>
            </div>
            <small>
              {unitDraft.provenance.provider} · {unitDraft.provenance.model}
            </small>
          </header>
          <h4>{summary.title}</h4>
          <p>{summary.body}</p>
          <small>
            Approved alignment: {Array.from(new Set(summary.alignment)).join(", ")}
          </small>
          {unitDraft.taskType === "discussion_prompt" && (
            <div className="phase5-discussion-review-details">
              <section>
                <h5>Initial post</h5>
                <ul>
                  {unitDraft.discussion.initialPostRequirements.map(
                    (item, index) => (
                      <li key={`${index}:${item}`}>{item}</li>
                    ),
                  )}
                </ul>
              </section>
              <section>
                <h5>Peer response</h5>
                <ul>
                  {unitDraft.discussion.peerResponseRequirements.map(
                    (item, index) => (
                      <li key={`${index}:${item}`}>{item}</li>
                    ),
                  )}
                </ul>
              </section>
              <section>
                <h5>Student safeguards</h5>
                <ul>
                  <li>{unitDraft.discussion.safetyGuidance.privacy}</li>
                  <li>{unitDraft.discussion.safetyGuidance.civility}</li>
                  <li>{unitDraft.discussion.safetyGuidance.aiUse}</li>
                </ul>
              </section>
              <section>
                <h5>Professor facilitation</h5>
                <p>{unitDraft.discussion.facilitatorGuidance}</p>
              </section>
            </div>
          )}
          <div className="phase5-content-unit-evidence">
            <span>{issueCount} review item{issueCount === 1 ? "" : "s"}</span>
            <span>
              {reviewBlockCount} blocking item{reviewBlockCount === 1 ? "" : "s"}
            </span>
          </div>
          {reviewBlockCount > 0 && (
            <p className="phase5-error" role="alert">
              This revision has a router review block. Reject or regenerate it;
              it cannot be applied.
            </p>
          )}
          <label className="phase5-review-confirm">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
            />
            I compared this selected revision with the current lesson, approved
            sources, outcomes, and course-version provenance.
          </label>
          <footer>
            <button type="button" onClick={reject}>Reject revision</button>
            <button
              className="primary"
              type="button"
              disabled={!reviewConfirmed || reviewBlockCount > 0}
              onClick={apply}
            >
              Apply to unpublished lesson draft
            </button>
          </footer>
        </article>
      )}
    </section>
  );
}
