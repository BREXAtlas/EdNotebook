import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { eduBookDownload, readingProgress } from "./edubook.js";
import EduBookTeachingLayerEditor from "./EduBookTeachingLayerEditor.jsx";
import {
  chapterLearningLayer,
  eduBookCompletionReadiness,
  learningLayerFromManifest,
  withEduBookAnswer,
  withEduBookDiscussionResponse,
} from "./edubookLearningModel.js";
import {
  loadPublicationReadingProgress,
  savePublicationReadingProgress,
  setPublicationLibraryAccess,
} from "./publishingService.js";

function accessLabel(publication) {
  const labels = {
    private: "Private draft",
    assigned: "Assigned reading",
    purchase: publication.price_cents ? `Purchase · $${(publication.price_cents / 100).toFixed(2)}` : "Purchase",
    rental: publication.price_cents ? `Rental · $${(publication.price_cents / 100).toFixed(2)}` : "Rental",
    open: "Open access",
  };
  return labels[publication.access_model] || publication.access_model;
}

export default function InteractiveReader({ publications, courses = [], currentUserId = "", loading, onRefresh, libraryMode = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [note, setNote] = useState("");
  const [annotationType, setAnnotationType] = useState("note");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [accessModel, setAccessModel] = useState("private");
  const [readingMode, setReadingMode] = useState("interactive");
  const [courseId, setCourseId] = useState("");
  const [price, setPrice] = useState("");
  const [rentalDays, setRentalDays] = useState(30);
  const [publishBusy, setPublishBusy] = useState(false);
  const [readerProgress, setReaderProgress] = useState(null);
  const [interactionState, setInteractionState] = useState({});
  const [progressBusy, setProgressBusy] = useState(false);

  const selected = useMemo(
    () => publications.find((publication) => publication.id === selectedId) || publications[0] || null,
    [publications, selectedId]
  );
  const manifest = selected?.edubook_manifest || {};
  const chapters = Array.isArray(manifest.chapters) ? manifest.chapters : [];
  const chapter = chapters[chapterIndex] || null;
  const localProgress = readingProgress(chapterIndex, chapters.length);
  const progress = Math.max(Number(readerProgress?.completion_percent) || 0, localProgress);
  const learningLayer = useMemo(() => learningLayerFromManifest(manifest), [manifest]);
  const activeChapterLayer = useMemo(
    () => chapterLearningLayer(learningLayer, chapter?.id || ""),
    [chapter?.id, learningLayer],
  );
  const isFinalChapter = chapters.length > 0 && chapterIndex === chapters.length - 1;
  const completionReadiness = useMemo(
    () => eduBookCompletionReadiness(learningLayer, interactionState),
    [interactionState, learningLayer],
  );
  const isOwner = Boolean(selected?.owner_id && selected.owner_id === currentUserId);
  const showLearnerProgress = Boolean(selected?.status === "published" && (libraryMode || !isOwner));

  useEffect(() => {
    if (!selected?.id) {
      setAnnotations([]);
      return;
    }
    let active = true;
    Promise.all([
      supabase
        .from("reading_annotations")
        .select("*")
        .eq("publication_id", selected.id)
        .order("created_at", { ascending: false }),
      selected.status === "published"
        ? loadPublicationReadingProgress(selected.id, currentUserId)
        : Promise.resolve({ data: null, error: null }),
    ]).then(([annotationResult, progressResult]) => {
      if (!active) return;
      if (annotationResult.error) setError(annotationResult.error.message);
      else setAnnotations(annotationResult.data || []);
      if (progressResult.error) setError(progressResult.error.message);
      const saved = progressResult.data || null;
      setReaderProgress(saved);
      setInteractionState(saved?.interaction_state || {});
      setChapterIndex(saved && saved.chapter_index < chapters.length
        ? saved.chapter_index
        : 0);
    });
    return () => { active = false; };
  }, [chapters.length, currentUserId, selected?.id, selected?.status]);

  useEffect(() => {
    setAccessModel(selected?.access_model || "private");
    setReadingMode(selected?.reading_mode || "interactive");
    setCourseId(selected?.course_id || "");
    setPrice(selected?.price_cents ? (selected.price_cents / 100).toFixed(2) : "");
    setRentalDays(selected?.rental_days || 30);
  }, [
    selected?.access_model,
    selected?.course_id,
    selected?.id,
    selected?.price_cents,
    selected?.reading_mode,
    selected?.rental_days,
  ]);

  async function saveLibraryAccess() {
    setPublishBusy(true);
    setNotice("");
    setError("");
    const commercial = accessModel === "purchase" || accessModel === "rental";
    const result = await setPublicationLibraryAccess({
      publicationId: selected.id,
      accessModel,
      readingMode,
      courseId: courseId || null,
      priceCents: commercial ? Math.round(Number(price) * 100) : null,
      rentalDays: accessModel === "rental" ? Number(rentalDays) : null,
    });
    if (result.error) {
      setError(result.error.message || "The Library access settings could not be saved.");
    } else {
      setNotice(accessModel === "open"
        ? "Open Library book published. Students can find and read it after signing in."
        : accessModel === "assigned"
          ? "The same publication is now assigned to the selected course. No duplicate book was created."
          : accessModel === "private"
            ? "Publication returned to private draft."
            : "Commercial catalog preview submitted for review. Checkout remains unavailable.");
      await onRefresh?.();
    }
    setPublishBusy(false);
  }

  async function saveAnnotation() {
    setNotice("");
    setError("");
    if (!selected?.id || !note.trim()) return;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { data, error: saveError } = await supabase
        .from("reading_annotations")
        .insert({
          publication_id: selected.id,
          user_id: userData.user.id,
          locator: chapter ? `chapter:${chapter.id}` : "book",
          selected_text: "",
          note: note.trim(),
          annotation_type: annotationType,
          metadata: { chapterTitle: chapter?.title || null, progress },
        })
        .select()
        .single();
      if (saveError) throw saveError;
      setAnnotations((items) => [data, ...items]);
      setNote("");
      setNotice("Annotation saved privately to your reader account.");
    } catch (saveError) {
      setError(saveError.message || "The annotation could not be saved.");
    }
  }

  async function removeAnnotation(id) {
    const { error: removeError } = await supabase.from("reading_annotations").delete().eq("id", id);
    if (removeError) setError(removeError.message);
    else setAnnotations((items) => items.filter((item) => item.id !== id));
  }

  async function persistProgress(nextChapterIndex = chapterIndex, complete = false) {
    const nextChapter = chapters[nextChapterIndex];
    if (!selected?.id || !nextChapter || selected.status !== "published") return false;
    setProgressBusy(true);
    setError("");
    setNotice("");
    const result = await savePublicationReadingProgress({
      publicationId: selected.id,
      chapterIndex: nextChapterIndex,
      chapterId: nextChapter.id,
      interactionState,
      complete,
    });
    if (result.error) {
      setError(result.error.message || "Your reading progress could not be saved.");
      setProgressBusy(false);
      return false;
    }
    setReaderProgress(result.data || null);
    setNotice(complete
      ? `Book completed${result.data?.auto_score === null || result.data?.auto_score === undefined ? "." : ` · knowledge score ${Number(result.data.auto_score).toFixed(0)}%.`}`
      : "Reading place, answers, and private discussion notes saved.");
    setProgressBusy(false);
    return true;
  }

  async function moveChapter(nextChapterIndex) {
    setChapterIndex(nextChapterIndex);
    if (showLearnerProgress) await persistProgress(nextChapterIndex, false);
  }

  async function completeBook() {
    if (selected.reading_mode === "interactive" && !completionReadiness.ready) {
      setError(`Answer ${completionReadiness.remaining} remaining knowledge or quiz question${completionReadiness.remaining === 1 ? "" : "s"} before completing this EduBook.`);
      return;
    }
    await persistProgress(chapterIndex, true);
  }

  if (loading) return <div className="studio-library-empty">Loading the reading library…</div>;
  if (!selected) {
    return (
      <div className="studio-reader-empty">
        <span aria-hidden="true">📖</span>
        <h3>No interactive books yet</h3>
        <p>Use Import & convert to create an EduBook from text or upload a source file for the conversion queue.</p>
        <button type="button" onClick={onRefresh}>Refresh library</button>
      </div>
    );
  }

  return (
    <>
      {!libraryMode && isOwner && <section className="studio-publication-release-panel">
        <div><span className="studio-kicker">ALEX B. MORRISON PLACEMENT</span><h3>Publish once, then choose where this book belongs.</h3><p>Keep one source record. It can stay private, be assigned to a course, open in the public Library, or enter commercial review.</p></div>
        <div className="studio-field-grid">
          <label>Book experience<select value={readingMode} disabled={publishBusy} onChange={(event) => setReadingMode(event.target.value)}><option value="read_only">Read-only book</option><option value="interactive">Interactive EduBook · checks, quizzes, notes, progress</option></select></label>
          <label>Access and placement<select value={accessModel} disabled={publishBusy} onChange={(event) => setAccessModel(event.target.value)}><option value="private">Private draft</option><option value="assigned">Assign to one of my courses</option><option value="open">Free and open in Library</option><option value="purchase">Bookstore purchase · submit for review</option><option value="rental">Bookstore rental · submit for review</option></select></label>
          {(accessModel === "assigned" || courseId) && <label>Linked course<select value={courseId} disabled={publishBusy} onChange={(event) => setCourseId(event.target.value)}><option value="">No linked course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.course_code || "COURSE"} · {course.title}</option>)}</select></label>}
          {(accessModel === "purchase" || accessModel === "rental") && <label>Price (USD)<input type="number" min="0.01" step="0.01" value={price} disabled={publishBusy} onChange={(event) => setPrice(event.target.value)} /></label>}
          {accessModel === "rental" && <label>Rental days<input type="number" min="1" max="365" value={rentalDays} disabled={publishBusy} onChange={(event) => setRentalDays(event.target.value)} /></label>}
        </div>
        <div className="studio-publication-release-actions"><button className="studio-primary-button" type="button" disabled={publishBusy || (accessModel === "assigned" && !courseId) || (["purchase", "rental"].includes(accessModel) && Number(price) <= 0)} onClick={saveLibraryAccess}>{publishBusy ? "Saving placement…" : "Save publication placement"}</button><span>Current record · {selected.status} · {accessLabel(selected)}</span></div>
        {["purchase", "rental"].includes(accessModel) && <p className="studio-commerce-review-note">A price prepares the catalog record only. The browser cannot grant paid access, charge a student, or release seller funds.</p>}
      </section>}
      {!libraryMode && isOwner && selected.reading_mode === "interactive" && selected.conversion_status === "ready" && <EduBookTeachingLayerEditor publication={selected} chapters={chapters} activeChapterIndex={chapterIndex} onSaved={onRefresh} />}
      <div className="studio-reader-layout">
      <aside className="studio-reader-library">
        <div className="studio-panel-heading">
          <div><span className="studio-kicker">READING LIBRARY</span><h3>Books and assigned readings</h3></div>
          <button type="button" onClick={onRefresh}>↻</button>
        </div>
        {publications.map((publication) => (
          <button
            type="button"
            key={publication.id}
            className={publication.id === selected.id ? "is-active" : ""}
            onClick={() => setSelectedId(publication.id)}
          >
            <span aria-hidden="true">{publication.conversion_status === "ready" ? "📖" : "⏳"}</span>
            <div><strong>{publication.title}</strong><small>{publication.author_name || "Unknown author"}</small><em>{accessLabel(publication)}</em></div>
          </button>
        ))}
      </aside>

      <main className="studio-book-reader">
        <header>
          <div>
            <small>{selected.edubook_manifest?.format || selected.source_format || "SOURCE FILE"}</small>
            <h2>{selected.title}</h2>
            <p>{selected.author_name || "Unknown author"} · {accessLabel(selected)}</p>
          </div>
          <div className="studio-reader-actions">
            {chapters.length > 0 && <button type="button" onClick={() => eduBookDownload(manifest)}>Download EduBook</button>}
            <span>{progress}% read</span>
          </div>
        </header>

        <div className="studio-reader-progress"><span style={{ width: `${progress}%` }} /></div>

        {selected.conversion_status !== "ready" || !chapter ? (
          <div className="studio-conversion-pending">
            <span aria-hidden="true">⟳</span>
            <h3>{selected.conversion_status === "failed" ? "Conversion needs attention" : "Source secured; conversion is queued"}</h3>
            <p>
              PDF, EPUB, Word, and publisher packages are stored privately now. The server-side conversion worker will extract structure, validate rights metadata, and produce the same EduBook manifest this reader uses.
            </p>
          </div>
        ) : (
          <article className="studio-reader-page">
            <div className="studio-reader-chapter-label">CHAPTER {chapterIndex + 1} OF {chapters.length}</div>
            <h3>{chapter.title}</h3>
            {(chapter.blocks || []).map((block) => (
              block.type === "heading"
                ? <h4 key={block.id}>{block.text}</h4>
                : <p key={block.id}>{block.text}</p>
            ))}
            {selected.reading_mode === "interactive" && activeChapterLayer.knowledgeChecks.length > 0 && <section className="studio-reader-learning-block"><span className="studio-kicker">KNOWLEDGE CHECK</span><h4>Check what you understood.</h4>{activeChapterLayer.knowledgeChecks.map((question) => <fieldset key={question.id}><legend>{question.prompt}</legend>{question.options.map((option) => <label key={option}><input type="radio" name={`edubook-${question.id}`} checked={interactionState.answers?.[question.id] === option} onChange={() => setInteractionState((current) => withEduBookAnswer(current, question.id, option))} /> {option}</label>)}</fieldset>)}</section>}
            {selected.reading_mode === "interactive" && activeChapterLayer.discussionPrompts.length > 0 && <section className="studio-reader-learning-block"><span className="studio-kicker">REFLECT &amp; DISCUSS</span><h4>Develop the thought before sharing it.</h4>{activeChapterLayer.discussionPrompts.map((prompt) => <label key={prompt.id}>{prompt.prompt}<textarea rows={3} value={interactionState.discussionResponses?.[prompt.id] || ""} onChange={(event) => setInteractionState((current) => withEduBookDiscussionResponse(current, prompt.id, event.target.value))} placeholder="Keep a private draft here. Course discussion sharing remains a separate action." /></label>)}</section>}
            {selected.reading_mode === "interactive" && isFinalChapter && learningLayer.finalQuiz.length > 0 && <section className="studio-reader-learning-block is-final"><span className="studio-kicker">FINAL QUIZ</span><h4>Finish the book with a short review.</h4>{learningLayer.finalQuiz.map((question) => <fieldset key={question.id}><legend>{question.prompt}</legend>{question.options.map((option) => <label key={option}><input type="radio" name={`edubook-${question.id}`} checked={interactionState.answers?.[question.id] === option} onChange={() => setInteractionState((current) => withEduBookAnswer(current, question.id, option))} /> {option}</label>)}</fieldset>)}</section>}
            <div className="studio-reader-navigation">
              <button type="button" disabled={chapterIndex === 0 || progressBusy} onClick={() => moveChapter(Math.max(0, chapterIndex - 1))}>← Previous</button>
              {!isFinalChapter && <button type="button" disabled={progressBusy} onClick={() => moveChapter(Math.min(chapters.length - 1, chapterIndex + 1))}>{progressBusy ? "Saving…" : "Next chapter →"}</button>}
            </div>
            {showLearnerProgress && <div className="studio-reader-completion-actions"><button type="button" disabled={progressBusy} onClick={() => persistProgress(chapterIndex, false)}>{progressBusy ? "Saving…" : "Save my place"}</button>{isFinalChapter && <button className="studio-primary-button" type="button" disabled={progressBusy || (selected.reading_mode === "interactive" && !completionReadiness.ready)} onClick={completeBook}>{readerProgress?.status === "completed" ? "Completed" : completionReadiness.remaining ? `${completionReadiness.remaining} questions remaining` : "Complete this book"}</button>}<span>{readerProgress?.status === "completed" ? "Completed" : `${Math.round(progress)}% read`}</span></div>}
          </article>
        )}
      </main>

      <aside className="studio-annotation-panel">
        <span className="studio-kicker">PRIVATE NOTEBOOK</span>
        <h3>Annotate the reading</h3>
        <div className="studio-annotation-types">
          {["note", "highlight", "question", "bookmark"].map((type) => (
            <button type="button" key={type} className={annotationType === type ? "is-active" : ""} onClick={() => setAnnotationType(type)}>{type}</button>
          ))}
        </div>
        <textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder={`Add a ${annotationType} for ${chapter?.title || "this book"}.`} />
        <button className="studio-primary-button" type="button" disabled={!note.trim()} onClick={saveAnnotation}>Save annotation</button>
        {notice && <div className="studio-alert is-success">{notice}</div>}
        {error && <div className="studio-alert is-error">{error}</div>}
        <div className="studio-annotation-list">
          {annotations.length === 0 ? <p>No annotations yet.</p> : annotations.map((annotation) => (
            <article key={annotation.id}>
              <div><strong>{annotation.annotation_type}</strong><button type="button" aria-label="Delete annotation" onClick={() => removeAnnotation(annotation.id)}>×</button></div>
              <p>{annotation.note}</p>
              <small>{annotation.metadata?.chapterTitle || annotation.locator}</small>
            </article>
          ))}
        </div>
      </aside>
      </div>
    </>
  );
}
