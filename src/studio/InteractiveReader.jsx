import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { eduBookDownload, readingProgress } from "./edubook.js";

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

export default function InteractiveReader({ publications, loading, onRefresh }) {
  const [selectedId, setSelectedId] = useState(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [note, setNote] = useState("");
  const [annotationType, setAnnotationType] = useState("note");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => publications.find((publication) => publication.id === selectedId) || publications[0] || null,
    [publications, selectedId]
  );
  const manifest = selected?.edubook_manifest || {};
  const chapters = Array.isArray(manifest.chapters) ? manifest.chapters : [];
  const chapter = chapters[chapterIndex] || null;
  const progress = readingProgress(chapterIndex, chapters.length);

  useEffect(() => {
    if (!selected?.id) {
      setAnnotations([]);
      return;
    }
    setChapterIndex(0);
    supabase
      .from("reading_annotations")
      .select("*")
      .eq("publication_id", selected.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: annotationError }) => {
        if (annotationError) setError(annotationError.message);
        else setAnnotations(data || []);
      });
  }, [selected?.id]);

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
            <div className="studio-reader-navigation">
              <button type="button" disabled={chapterIndex === 0} onClick={() => setChapterIndex((index) => Math.max(0, index - 1))}>← Previous</button>
              <button type="button" disabled={chapterIndex === chapters.length - 1} onClick={() => setChapterIndex((index) => Math.min(chapters.length - 1, index + 1))}>Next chapter →</button>
            </div>
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
  );
}
