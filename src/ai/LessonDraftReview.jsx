import { useMemo, useState } from "react";

import { generateProfessorLesson } from "./learningAiService.js";
import {
  LESSON_AI_DRAFT_LABEL,
  acceptLessonDraftIntoManifest,
  assessLessonAlignment,
  createEditableLessonDraft,
  createLessonGenerationInput,
  updateEditableLessonDraft,
} from "./lessonGenerationContract.js";
import { DIGITAL_LITERACY_PHASE5_FIXTURE } from "./digitalLiteracyPhase5Fixture.js";
import "./lesson-draft-review.css";

const IS_STAGING = import.meta.env.VITE_APP_ENVIRONMENT === "staging";
const LESSON_AI_ENABLED =
  IS_STAGING && import.meta.env.VITE_LESSON_AI_ENABLED !== "false";

const clean = (value) => String(value ?? "").trim();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const listText = (value) => (Array.isArray(value) ? value : [])
  .map((item) => typeof item === "string" ? item : item?.text)
  .filter(Boolean)
  .join("\n");
const parseList = (value) =>
  String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
const sectionHeading = (section) =>
  clean(section?.heading || section?.title || section?.sectionId);
const sectionBody = (section) =>
  clean(section?.body || section?.content || section?.text);

function recordMatchesCourse(record, course, manifest) {
  if (!record) return false;
  const courseId = clean(course?.id || manifest?.course?.sourceEdNotebookCourseId);
  if (record.courseId && courseId) return clean(record.courseId) === courseId;
  const recordTitle = clean(
    record?.structuredContent?.courseTitle?.value
      || record?.course?.courseTitle
      || record?.course?.title,
  ).toLowerCase();
  const currentTitle = clean(manifest?.course?.title || course?.title).toLowerCase();
  return Boolean(recordTitle && currentTitle && recordTitle === currentTitle);
}

function DraftPreview({ draft, manifest, onClose }) {
  const [mode, setMode] = useState("platform");
  const conceptSections = (draft.sections || []).slice(0, 4);
  return (
    <div
      className="course-preview-overlay phase5-lesson-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase5-preview-title"
    >
      <div className={mode === "standalone" ? "is-standalone-preview" : ""}>
        <header>
          <div>
            <strong id="phase5-preview-title">
              {mode === "platform"
                ? "In-platform student preview"
                : "Standalone course-package preview"}
            </strong>
            <small>{LESSON_AI_DRAFT_LABEL}</small>
          </div>
          <div>
            <button
              type="button"
              aria-pressed={mode === "platform"}
              onClick={() => setMode("platform")}
            >
              In platform
            </button>
            <button
              type="button"
              aria-pressed={mode === "standalone"}
              onClick={() => setMode("standalone")}
            >
              Standalone
            </button>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </header>
        {mode === "platform" && (
          <div className="phase5-platform-preview-bar">
            <strong>{manifest.course.title}</strong>
            <span>Course map</span>
            <span>Assignments</span>
            <span>Notes</span>
            <span>Calendar</span>
          </div>
        )}
        <article className="course-lesson-player phase5-preview-player">
          <section className="course-stage">
            <span className="course-kicker">
              LESSON OVERVIEW · ~{draft.estimatedMinutes} MIN
            </span>
            <h1>{draft.title}</h1>
            <p className="course-subtitle">{draft.subtitle}</p>
            <div className="course-story-card">
              <h2>Why this lesson matters</h2>
              <p>{draft.purpose}</p>
            </div>
            <h2>Learning objectives</h2>
            <ul>
              {(draft.objectives || []).map((item, index) => (
                <li key={item.text || index}>{item.text || item}</li>
              ))}
            </ul>
            <div className="course-concept-grid">
              {conceptSections.map((section, index) => (
                <article key={section.sectionId || section.id || index}>
                  <strong>{sectionHeading(section)}</strong>
                  <p>{sectionBody(section)}</p>
                </article>
              ))}
            </div>
            {(draft.knowledgeChecks || []).slice(0, 1).map((check, index) => (
              <fieldset className="course-question" key={check.checkId || index}>
                <legend>{check.question}</legend>
                {(check.options || []).map((option) => (
                  <label key={option}>
                    <input type="radio" name={`preview-${index}`} disabled />
                    {option}
                  </label>
                ))}
                <p>
                  <strong>Preview answer:</strong>{" "}
                  {check.answer}
                </p>
              </fieldset>
            ))}
          </section>
        </article>
      </div>
    </div>
  );
}

function ReviewIssues({ draft, resolutions, onResolve }) {
  const groups = [
    ["sourceGaps", "Source gaps"],
    ["uncertainties", "Uncertainties"],
    ["conflicts", "Conflicts"],
  ];
  const unresolved = groups.flatMap(([key]) =>
    (draft[key] || []).map((_, index) => `${key}-${index}`),
  );
  if (!unresolved.length && !(draft.reviewBlocks || []).length) {
    return (
      <section className="phase5-review-issues is-clear">
        <strong>No returned gaps, uncertainties, conflicts, or review blocks.</strong>
      </section>
    );
  }
  return (
    <section className="phase5-review-issues">
      <div>
        <span className="studio-kicker">RESOLUTION QUEUE</span>
        <h3>Nothing is hidden or silently cleared.</h3>
      </div>
      {groups.map(([key, label]) =>
        (draft[key] || []).map((item, index) => {
          const issueKey = `${key}-${index}`;
          return (
            <article key={issueKey}>
              <div>
                <span>{label}</span>
                <p>{typeof item === "string" ? item : item.description || JSON.stringify(item)}</p>
              </div>
              <button
                type="button"
                className={resolutions[issueKey] ? "is-resolved" : ""}
                onClick={() => onResolve(issueKey, item)}
              >
                {resolutions[issueKey] ? "Professor reviewed" : "Mark reviewed"}
              </button>
            </article>
          );
        }),
      )}
      {(draft.reviewBlocks || []).map((item, index) => (
        <article className="is-blocked" key={`review-block-${index}`}>
          <div>
            <span>Router review block</span>
            <p>{typeof item === "string" ? item : item.message || JSON.stringify(item)}</p>
          </div>
          <strong>Regenerate or reject</strong>
        </article>
      ))}
    </section>
  );
}

export default function LessonDraftReview(props) {
  if (!IS_STAGING) return null;
  return <StagingLessonDraftReview {...props} />;
}

function StagingLessonDraftReview({
  manifest,
  pathId,
  lesson,
  course,
  syllabusRecord,
  outlineRecord,
  onAccept,
}) {
  const [phase, setPhase] = useState("ready");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");
  const [resolutions, setResolutions] = useState({});

  const matchingSyllabus = useMemo(
    () => recordMatchesCourse(syllabusRecord, course, manifest)
      ? syllabusRecord
      : null,
    [course, manifest, syllabusRecord],
  );
  const matchingOutline = useMemo(
    () => recordMatchesCourse(outlineRecord, course, manifest)
      ? outlineRecord
      : null,
    [course, manifest, outlineRecord],
  );
  const institutionId = clean(course.institution_id);
  const preparation = useMemo(() => {
    try {
      if (!UUID_PATTERN.test(institutionId)) {
        throw new Error("Connect this cloud course to its approved institution context.");
      }
      return {
        input: createLessonGenerationInput({
          manifest,
          pathId,
          lessonId: lesson.id,
          course,
          syllabusRecord: matchingSyllabus,
          outlineRecord: matchingOutline,
          professorInstruction: instruction,
        }),
        error: "",
      };
    } catch (preparationError) {
      return {
        input: null,
        error:
          preparationError.message
          || "The selected lesson is not ready for governed generation.",
      };
    }
  }, [
    course,
    institutionId,
    instruction,
    lesson,
    manifest,
    matchingOutline,
    matchingSyllabus,
    pathId,
  ]);
  const requestInput = preparation.input;
  const alignment = useMemo(
    () => draft && requestInput
      ? assessLessonAlignment(draft, requestInput)
      : [],
    [draft, requestInput],
  );
  const issueCount = draft
    ? ["sourceGaps", "uncertainties", "conflicts"]
      .reduce((count, key) => count + (draft[key] || []).length, 0)
    : 0;
  const resolvedCount = Object.keys(resolutions).length;
  const canAccept = Boolean(
    draft
      && reviewConfirmed
      && resolvedCount === issueCount
      && (draft.reviewBlocks || []).length === 0,
  );

  async function generate({ regenerate = false } = {}) {
    if (!LESSON_AI_ENABLED || !requestInput) return;
    setPhase("generating");
    setError("");
    setMessage(
      regenerate
        ? "Regenerating the same selected lesson through the governed route…"
        : "Generating one selected lesson through the governed route…",
    );
    setReviewConfirmed(false);
    setResolutions({});
    try {
      const result = await generateProfessorLesson(requestInput, {
        courseId: course.id,
        institutionId,
      });
      const next = createEditableLessonDraft(
        result,
        requestInput,
        regenerate ? draft : null,
      );
      setDraft(next);
      setSelectedSection(clean(next.sections?.[0]?.sectionId || next.sections?.[0]?.id));
      setPhase("review");
      setMessage(
        "One unpublished lesson draft returned. Compare, edit, resolve, preview, and accept or reject it.",
      );
    } catch (generationError) {
      setPhase(draft ? "review" : "ready");
      setError(
        generationError.message
        || "The governed selected lesson could not be generated.",
      );
      setMessage("The existing course package and professor work were preserved.");
    }
  }

  function changeTopLevel(key, value) {
    setDraft((current) => updateEditableLessonDraft(current, { [key]: value }));
  }

  function changeObjectives(value) {
    const texts = parseList(value);
    setDraft((current) => updateEditableLessonDraft(current, {
      objectives: texts.map((text, index) => ({
        ...(current.objectives[index] || {}),
        text,
        outcomeIds:
          current.objectives[index]?.outcomeIds
          || [...current.alignment.outcomeIds],
        sourceIds:
          current.objectives[index]?.sourceIds
          || [current.alignment.sourceIds[0]],
      })),
    }));
  }

  function changeSection(index, key, value) {
    setDraft((current) => {
      const sections = current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [key]: value } : section);
      return updateEditableLessonDraft(current, { sections });
    });
  }

  function changeCheck(index, key, value) {
    setDraft((current) => {
      const knowledgeChecks = current.knowledgeChecks.map((check, checkIndex) =>
        checkIndex === index ? { ...check, [key]: value } : check);
      return updateEditableLessonDraft(current, { knowledgeChecks });
    });
  }

  function toggleResolution(issueKey, issue) {
    setResolutions((current) => {
      if (current[issueKey]) {
        const next = { ...current };
        delete next[issueKey];
        return next;
      }
      return {
        ...current,
        [issueKey]: {
          issue,
          action: "professor_reviewed_in_lesson_editor",
          at: new Date().toISOString(),
        },
      };
    });
  }

  function reject() {
    setDraft(null);
    setPhase("ready");
    setMessage("The AI lesson draft was rejected. The existing lesson remains unchanged.");
    setError("");
    setReviewConfirmed(false);
    setResolutions({});
    setPreview(false);
  }

  function accept() {
    try {
      const reviewedDraft = {
        ...draft,
        professorResolutions: Object.values(resolutions),
      };
      const nextManifest = acceptLessonDraftIntoManifest(
        manifest,
        pathId,
        lesson.id,
        reviewedDraft,
      );
      onAccept(nextManifest);
      setDraft(reviewedDraft);
      setPhase("accepted");
      setMessage(
        "Professor-accepted lesson added to the existing course-package draft. It is still not published.",
      );
    } catch (acceptError) {
      setError(acceptError.message || "The lesson draft could not be accepted.");
    }
  }

  const connectedSourceCount = requestInput?.authoritativeSources?.length || 0;
  return (
    <section className="phase5-lesson-review" aria-labelledby="phase5-lesson-title">
      <div className="phase5-lesson-heading">
        <div>
          <span className="studio-kicker">
            PHASE 5 · ONE SELECTED LESSON
          </span>
          <h2 id="phase5-lesson-title">Generate, compare, and review this lesson.</h2>
          <p>
            Digital Literacy is the first subject/test fixture. The same
            existing course package powers this professor review, the signed-in
            student view, and standalone export.
          </p>
        </div>
        <span className="phase5-reference-badge">
          Reference {DIGITAL_LITERACY_PHASE5_FIXTURE.reference.commit.slice(0, 7)}
        </span>
      </div>

      {!LESSON_AI_ENABLED && (
        <div className="phase5-disabled-note" role="status">
          <strong>Governed lesson generation is staging-only.</strong>
          <span>
            Production remains unchanged. Existing editing, preview, saving,
            and publishing continue to work.
          </span>
        </div>
      )}

      <div className="phase5-context-grid">
        <article>
          <span>Selected lesson</span>
          <strong>{lesson.title}</strong>
          <small>One lesson only · never the whole course</small>
        </article>
        <article>
          <span>Approved syllabus</span>
          <strong>{matchingSyllabus ? "Connected" : "Needs connection"}</strong>
          <small>{requestInput?.alignments?.syllabusSectionIds?.length || 0} applicable sections</small>
        </article>
        <article>
          <span>Professor outline</span>
          <strong>{matchingOutline ? "Connected" : "Needs connection"}</strong>
          <small>{requestInput?.alignments?.outcomeIds?.length || 0} outcome IDs</small>
        </article>
        <article>
          <span>Approved sources</span>
          <strong>{connectedSourceCount}</strong>
          <small>Only bounded excerpts and rights metadata are sent</small>
        </article>
      </div>
      {preparation.error && !draft && (
        <p className="phase5-readiness-note" role="status">
          <strong>Generation gate:</strong> {preparation.error} Existing
          professor editing and preview remain available.
        </p>
      )}

      {!draft && (
        <div className="phase5-generate-panel">
          <label>
            Bounded professor instruction
            <textarea
              rows={4}
              maxLength={2_000}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="What should this one lesson emphasize, preserve, or avoid?"
            />
          </label>
          <div>
            <p>
              This action cannot publish, change the syllabus, collect student
              research data, or create a second course/site.
            </p>
            <button
              className="primary"
              type="button"
              disabled={!LESSON_AI_ENABLED || phase === "generating" || !requestInput}
              onClick={() => generate()}
            >
              {phase === "generating"
                ? "Generating selected lesson…"
                : "Generate selected lesson"}
            </button>
          </div>
        </div>
      )}

      {message && <p className="phase5-status" role="status">{message}</p>}
      {error && <p className="phase5-error" role="alert">{error}</p>}

      {draft && (
        <div className="phase5-draft-shell">
          <header>
            <div>
              <span>{draft.statusLabel}</span>
              <h2>{draft.title}</h2>
              <p>
                {draft.provenance.provider || "governed provider"} ·{" "}
                {draft.provenance.model || "approved model"} · prompt{" "}
                {draft.provenance.promptVersion || "version not returned"}
              </p>
            </div>
            <strong>{phase === "accepted" ? "Accepted into draft package" : "Professor review required"}</strong>
          </header>

          <section className="phase5-alignment-report">
            <div>
              <span className="studio-kicker">ALIGNMENT REPORT</span>
              <h3>Compare before accepting.</h3>
              <p>
                This view shows only evidence applicable to the selected lesson.
                It does not infer missing course-level requirements; supplied
                gaps stay visible as Review items or generation gates.
              </p>
            </div>
            <div>
              {alignment.map((item) => (
                <article className={`is-${item.status}`} key={item.key}>
                  <span>{item.status === "aligned" ? "Aligned" : "Review"}</span>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="phase5-edit-grid">
            <label>
              Lesson title
              <input
                maxLength={180}
                value={draft.title}
                onChange={(event) => changeTopLevel("title", event.target.value)}
              />
            </label>
            <label>
              Subtitle
              <input
                maxLength={300}
                value={draft.subtitle || ""}
                onChange={(event) => changeTopLevel("subtitle", event.target.value)}
              />
            </label>
            <label>
              Estimated minutes
              <input
                type="number"
                min="5"
                max={requestInput.selectedLesson.maxMinutes}
                value={draft.estimatedMinutes}
                onChange={(event) =>
                  changeTopLevel("estimatedMinutes", Number(event.target.value))}
              />
            </label>
            <label className="is-wide">
              Purpose
              <textarea
                rows={3}
                maxLength={1_000}
                value={draft.purpose}
                onChange={(event) => changeTopLevel("purpose", event.target.value)}
              />
            </label>
            <label className="is-wide">
              Measurable objectives, one per line
              <textarea
                rows={4}
                maxLength={6_000}
                value={listText(draft.objectives)}
                onChange={(event) => changeObjectives(event.target.value)}
              />
            </label>
          </div>

          <section className="phase5-section-editor">
            <div className="studio-section-heading">
              <div>
                <span className="studio-kicker">TEACHING SECTIONS</span>
                <h3>Read and edit the lesson in order.</h3>
              </div>
              <label>
                Selected section
                <select
                  value={selectedSection}
                  onChange={(event) => setSelectedSection(event.target.value)}
                >
                  {(draft.sections || []).map((section, index) => (
                    <option
                      value={section.sectionId || section.id || String(index)}
                      key={section.sectionId || section.id || index}
                    >
                      {sectionHeading(section)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(draft.sections || []).map((section, index) => {
              const sectionKey = section.sectionId || section.id || String(index);
              const headingKey = Object.hasOwn(section, "heading") ? "heading" : "title";
              const bodyKey = Object.hasOwn(section, "body") ? "body" : "content";
              return (
                <article
                  className={selectedSection === sectionKey ? "is-selected" : ""}
                  key={sectionKey}
                >
                  <label>
                    Heading
                    <input
                      maxLength={500}
                      value={sectionHeading(section)}
                      onFocus={() => setSelectedSection(sectionKey)}
                      onChange={(event) =>
                        changeSection(index, headingKey, event.target.value)}
                    />
                  </label>
                  <label>
                    Lesson text
                    <textarea
                      rows={6}
                      maxLength={8_000}
                      value={sectionBody(section)}
                      onFocus={() => setSelectedSection(sectionKey)}
                      onChange={(event) =>
                        changeSection(index, bodyKey, event.target.value)}
                    />
                  </label>
                  <small>
                    Sources:{" "}
                    {(section.sourceIds || section.sourceReferences || []).join(", ")
                    || "No source ID returned"}
                  </small>
                </article>
              );
            })}
            <div className="phase5-section-regeneration">
              <button type="button" disabled>
                Regenerate selected section
              </button>
              <span>
                Deferred until the separate <code>lesson_section</code> task,
                schema, provider evaluation, and route are approved.
              </span>
            </div>
          </section>

          <section className="phase5-check-editor">
            <span className="studio-kicker">FORMATIVE KNOWLEDGE CHECKS</span>
            {(draft.knowledgeChecks || []).map((check, index) => (
              <article key={check.checkId || index}>
                <label>
                  Question
                  <textarea
                    rows={2}
                    maxLength={1_000}
                    value={check.question || ""}
                    onChange={(event) =>
                      changeCheck(index, "question", event.target.value)}
                  />
                </label>
                <label>
                  Expected/correct answer
                  <textarea
                    rows={2}
                    maxLength={2_000}
                    value={check.answer || ""}
                    onChange={(event) =>
                      changeCheck(index, "answer", event.target.value)}
                  />
                </label>
                <label>
                  Explanation and recovery feedback
                  <textarea
                    rows={3}
                    maxLength={2_000}
                    value={check.explanation || ""}
                    onChange={(event) =>
                      changeCheck(index, "explanation", event.target.value)}
                  />
                </label>
              </article>
            ))}
          </section>

          <ReviewIssues
            draft={draft}
            resolutions={resolutions}
            onResolve={toggleResolution}
          />

          <label className="phase5-review-confirm">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
            />
            I compared this draft with the approved syllabus, outline,
            outcomes, sources, and quality-profile report. Acceptance creates a
            course-package draft revision; it does not publish.
          </label>

          <footer className="phase5-review-actions">
            <button type="button" onClick={() => setPreview(true)}>
              Preview lesson
            </button>
            <button type="button" onClick={reject}>Reject draft</button>
            <button
              type="button"
              disabled={phase === "generating" || phase === "accepted"}
              onClick={() => generate({ regenerate: true })}
            >
              {phase === "generating" ? "Regenerating…" : "Regenerate whole lesson"}
            </button>
            <button
              className="primary"
              type="button"
              disabled={!canAccept || phase === "accepted"}
              onClick={accept}
            >
              Accept into course-package draft
            </button>
          </footer>
        </div>
      )}

      {preview && draft && (
        <DraftPreview
          draft={draft}
          manifest={manifest}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}
