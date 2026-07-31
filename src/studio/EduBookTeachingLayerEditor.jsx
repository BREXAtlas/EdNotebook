import { useEffect, useMemo, useState } from "react";
import {
  addEduBookDiscussionPrompt,
  addEduBookQuestion,
  chapterLearningLayer,
  emptyEduBookLearningLayer,
  normalizeEduBookLearningLayer,
  removeEduBookLearningItem,
} from "./edubookLearningModel.js";
import {
  loadPublicationLearningLayerForAuthor,
  savePublicationLearningLayer,
} from "./publishingService.js";

const EMPTY_OPTIONS = ["", "", ""];

function TeachingItemList({ title, items, onRemove }) {
  if (!items.length) return <p className="studio-teaching-empty">No {title.toLowerCase()} added yet.</p>;
  return <div className="studio-teaching-item-list">{items.map((item) => <article key={item.id}>
    <div><strong>{item.prompt}</strong><button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${title.slice(0, -1)}`}>×</button></div>
    {item.options?.length ? <small>{item.options.join(" · ")}</small> : null}
  </article>)}</div>;
}

export default function EduBookTeachingLayerEditor({ publication, chapters, activeChapterIndex, onSaved }) {
  const [layer, setLayer] = useState(emptyEduBookLearningLayer());
  const [questionDestination, setQuestionDestination] = useState("knowledgeChecks");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [discussionPrompt, setDiscussionPrompt] = useState("");
  const [changeSummary, setChangeSummary] = useState("Updated the professor-authored EduBook teaching layer.");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeChapter = chapters[activeChapterIndex] || chapters[0] || null;
  const activeLayer = useMemo(
    () => chapterLearningLayer(layer, activeChapter?.id || ""),
    [activeChapter?.id, layer],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadPublicationLearningLayerForAuthor(publication.id).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message || "The private teaching layer could not be loaded.");
      setLayer(normalizeEduBookLearningLayer(data || publication.edubook_manifest?.learningLayer));
      setLoading(false);
    });
    return () => { active = false; };
  }, [publication.id, publication.current_learning_version]);

  function updateOption(index, value) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? value : option));
  }

  function addQuestion(event) {
    event.preventDefault();
    setError("");
    try {
      const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
      const selectedAnswer = options[correctIndex]?.trim();
      const next = addEduBookQuestion(layer, {
        chapterId: activeChapter?.id,
        destination: questionDestination,
        prompt: questionPrompt,
        options: cleanOptions,
        correctAnswer: selectedAnswer,
        explanation,
      });
      setLayer(next);
      setQuestionPrompt("");
      setOptions(EMPTY_OPTIONS);
      setCorrectIndex(0);
      setExplanation("");
      setNotice("Question added to the unsaved teaching-layer draft.");
    } catch (nextError) {
      setError(nextError.message || "The question could not be added.");
    }
  }

  function addDiscussion(event) {
    event.preventDefault();
    setError("");
    try {
      setLayer(addEduBookDiscussionPrompt(layer, {
        chapterId: activeChapter?.id,
        prompt: discussionPrompt,
      }));
      setDiscussionPrompt("");
      setNotice("Discussion prompt added to the unsaved teaching-layer draft.");
    } catch (nextError) {
      setError(nextError.message || "The discussion prompt could not be added.");
    }
  }

  async function saveLayer() {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await savePublicationLearningLayer({
      publicationId: publication.id,
      learningLayer: layer,
      changeSummary: changeSummary.trim(),
    });
    if (result.error) {
      setError(result.error.message || "The teaching layer could not be saved.");
    } else {
      setNotice(`Teaching layer saved as version ${result.data?.current_learning_version || "next"}. Correct answers remain server-side.`);
      await onSaved?.();
    }
    setBusy(false);
  }

  function removeChapterItem(collection, itemId) {
    setLayer((current) => removeEduBookLearningItem(current, {
      chapterId: activeChapter?.id,
      collection,
      itemId,
    }));
  }

  if (loading) return <section className="studio-teaching-layer"><div className="studio-library-empty">Opening the private professor teaching layer…</div></section>;

  return <section className="studio-teaching-layer" aria-labelledby="edubook-teaching-layer-title">
    <div className="studio-section-heading"><div><span className="studio-kicker">PROFESSOR TEACHING LAYER</span><h3 id="edubook-teaching-layer-title">Add learning without rewriting the book.</h3><p>The source chapters remain unchanged. Checks, discussion, and the final quiz are versioned separately; answer keys never enter the student-facing manifest.</p></div><span className="studio-paid-badge">Version {publication.current_learning_version || 0}</span></div>
    <div className="studio-teaching-context"><strong>{activeChapter?.title || "Choose a chapter"}</strong><span>{activeLayer.knowledgeChecks.length} checks · {activeLayer.discussionPrompts.length} discussions · {layer.finalQuiz.length} final questions</span></div>

    <div className="studio-teaching-drawers">
      <details open>
        <summary>Knowledge checks and final quiz</summary>
        <form onSubmit={addQuestion}>
          <div className="studio-field-grid">
            <label>Placement<select value={questionDestination} onChange={(event) => setQuestionDestination(event.target.value)}><option value="knowledgeChecks">Current chapter check</option><option value="finalQuiz">End-of-book quiz</option></select></label>
            <label>Question<input required minLength={5} value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} /></label>
          </div>
          <div className="studio-answer-choice-grid">{options.map((option, index) => <label key={index}><span><input type="radio" name="correct-edubook-answer" checked={correctIndex === index} onChange={() => setCorrectIndex(index)} /> Correct</span><input required={index < 2} value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Answer choice ${index + 1}`} /></label>)}</div>
          <label>Professor rationale kept in the private answer key<textarea rows={2} value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
          <button className="studio-primary-button" type="submit">Add question</button>
        </form>
        <TeachingItemList title="Chapter checks" items={activeLayer.knowledgeChecks} onRemove={(itemId) => removeChapterItem("knowledgeChecks", itemId)} />
        <TeachingItemList title="Final questions" items={layer.finalQuiz} onRemove={(itemId) => setLayer((current) => removeEduBookLearningItem(current, { collection: "finalQuiz", itemId }))} />
      </details>

      <details>
        <summary>Discussion prompts</summary>
        <form onSubmit={addDiscussion}><label>Prompt for this chapter<textarea required minLength={5} rows={3} value={discussionPrompt} onChange={(event) => setDiscussionPrompt(event.target.value)} /></label><button className="studio-primary-button" type="submit">Add discussion prompt</button></form>
        <TeachingItemList title="Discussion prompts" items={activeLayer.discussionPrompts} onRemove={(itemId) => removeChapterItem("discussionPrompts", itemId)} />
      </details>

      <details>
        <summary>Version note and save</summary>
        <label>What changed?<textarea rows={2} maxLength={1000} value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} /></label>
        <button className="studio-primary-button" type="button" disabled={busy || !chapters.length} onClick={saveLayer}>{busy ? "Saving governed version…" : "Save teaching-layer version"}</button>
      </details>
    </div>
    {notice && <div className="studio-alert is-success" role="status">{notice}</div>}
    {error && <div className="studio-alert is-error" role="alert">{error}</div>}
  </section>;
}
