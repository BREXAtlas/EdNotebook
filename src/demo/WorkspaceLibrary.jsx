import { useEffect, useMemo, useState } from "react";
import { safeRead, NotebookLabel } from "./demoShared.jsx";
import FullscreenSurface from "../FullscreenSurface.jsx";
import {
  CITATION_STYLES,
  SOURCE_TYPES,
  OPTIONAL_FIELD_DEFINITIONS,
  DEFAULT_COLLECTIONS,
  createSourceDraft,
  fieldsForType,
  formatCitation,
  normalizeSource,
} from "./citationTools.js";

function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The demo remains usable when device storage is unavailable.
  }
}

function makeId(prefix) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function savedTime() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function starterNotes(persona) {
  return [
    { id: "n1", course: persona.classes[0].code, title: "First-week questions", body: "What is the one concept I should be able to explain without looking at the slides?", created: "Aug 19" },
    { id: "n2", course: persona.id === "professor" ? "DOCTORATE" : persona.classes[1].code, title: "Follow-up", body: persona.id === "professor" ? "Connect student agency literature to the course redesign memo." : "Add the instructor's example to the study guide before Friday.", created: "Aug 18" },
  ];
}

function readSources(persona) {
  const fallback = persona.sources.map((source, index) => normalizeSource(source, persona, index));
  return safeRead(`ed-demo-${persona.id}-sources-v2`, fallback).map((source, index) => normalizeSource(source, persona, index));
}

function inferDocumentCourse(document, persona) {
  const searchable = `${document.title} ${document.text}`.toLowerCase();
  const match = persona.classes.find((course) => searchable.includes(course.code.toLowerCase()) || searchable.includes(course.title.toLowerCase()));
  return match?.code || "General";
}

function documentCollection(type) {
  const lower = type.toLowerCase();
  if (lower.includes("syllabus")) return "Course materials";
  if (lower.includes("note")) return "Class notes";
  if (lower.includes("conversation")) return "Saved conversations";
  if (lower.includes("planning")) return "Planning";
  return "Reference files";
}

function normalizeDocuments(persona) {
  return persona.documents.map((document, index) => ({
    ...document,
    course: document.course || inferDocumentCourse(document, persona),
    collection: document.collection || documentCollection(document.type),
    updated: document.updated || (index === 0 ? "Recently added" : "Saved in workspace"),
    wordCount: document.text.trim().split(/\s+/u).filter(Boolean).length,
  }));
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function VersionHistory({ entries }) {
  return (
    <aside className="library-version-log" aria-label="Recent library saves">
      <div>
        <NotebookLabel>RECENT SAVES</NotebookLabel>
        <span>Stored on this device</span>
      </div>
      {entries.length ? entries.slice(0, 4).map((entry) => (
        <p key={entry.id}><strong>{entry.action}</strong><span>{entry.label}</span><time>{entry.time}</time></p>
      )) : <p className="is-empty">New note and source versions will appear here.</p>}
    </aside>
  );
}

function LibraryFilters({ query, setQuery, values, filters, setFilters, label }) {
  return (
    <div className="library-filter-bar">
      <label className="library-search-field">
        <span>{label}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, details, or citations" />
      </label>
      {[
        ["course", "Class", values.courses],
        ["type", "Type", values.types],
        ["collection", "Collection", values.collections],
      ].map(([key, fieldLabel, options]) => (
        <label key={key}>
          <span>{fieldLabel}</span>
          <select value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}>
            <option value="all">All</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

function SourcesPanel({ persona }) {
  const [notes, setNotes] = useState(() => safeRead(`ed-demo-${persona.id}-notes`, starterNotes(persona)));
  const [sources, setSources] = useState(() => readSources(persona));
  const [history, setHistory] = useState(() => safeRead(`ed-demo-${persona.id}-library-history-v1`, []));
  const [noteDraft, setNoteDraft] = useState({ course: persona.classes[0].code, title: "", body: "" });
  const [sourceDraft, setSourceDraft] = useState(() => createSourceDraft(persona));
  const [sourceMessage, setSourceMessage] = useState("");
  const [view, setView] = useState("notes");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceFilters, setSourceFilters] = useState({ course: "all", type: "all", collection: "all" });
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentFilters, setDocumentFilters] = useState({ course: "all", type: "all", collection: "all" });
  const documents = useMemo(() => normalizeDocuments(persona), [persona]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(() => documents[0]?.id || "");
  const [documentOpen, setDocumentOpen] = useState(false);

  useEffect(() => {
    setNotes(safeRead(`ed-demo-${persona.id}-notes`, starterNotes(persona)));
    setSources(readSources(persona));
    setHistory(safeRead(`ed-demo-${persona.id}-library-history-v1`, []));
    setNoteDraft({ course: persona.classes[0].code, title: "", body: "" });
    setSourceDraft(createSourceDraft(persona));
    setSelectedDocumentId(persona.documents[0]?.id || "");
    setDocumentOpen(false);
    setSourceMessage("");
    setView("notes");
  }, [persona]);

  function addHistory(action, label) {
    const next = [{ id: makeId("history"), action, label, time: savedTime() }, ...history].slice(0, 20);
    setHistory(next);
    saveLocal(`ed-demo-${persona.id}-library-history-v1`, next);
  }

  function addNote(event) {
    event.preventDefault();
    if (!noteDraft.title.trim() || !noteDraft.body.trim()) return;
    const now = savedTime();
    const next = [{ id: makeId("note"), ...noteDraft, created: now }, ...notes];
    setNotes(next);
    saveLocal(`ed-demo-${persona.id}-notes`, next);
    addHistory("Note saved", noteDraft.title.trim());
    setNoteDraft({ ...noteDraft, title: "", body: "" });
  }

  function updateSourceDraft(key, value) {
    setSourceMessage("");
    setSourceDraft((current) => ({ ...current, [key]: value }));
  }

  function chooseSourceType(sourceType) {
    setSourceDraft((current) => ({ ...current, sourceType, visibleFields: fieldsForType(sourceType) }));
  }

  function toggleOptionalField(field) {
    setSourceDraft((current) => ({
      ...current,
      visibleFields: current.visibleFields.includes(field)
        ? current.visibleFields.filter((item) => item !== field)
        : [...current.visibleFields, field],
    }));
  }

  function addCustomElement() {
    setSourceDraft((current) => ({
      ...current,
      customElements: [...current.customElements, { id: makeId("element"), label: "", value: "" }],
    }));
  }

  function updateCustomElement(id, key, value) {
    setSourceDraft((current) => ({
      ...current,
      customElements: current.customElements.map((item) => item.id === id ? { ...item, [key]: value } : item),
    }));
  }

  function removeCustomElement(id) {
    setSourceDraft((current) => ({ ...current, customElements: current.customElements.filter((item) => item.id !== id) }));
  }

  function addSource(event) {
    event.preventDefault();
    if (!sourceDraft.title.trim()) {
      setSourceMessage("Add a source title before saving.");
      return;
    }
    const savedAt = savedTime();
    const source = {
      ...sourceDraft,
      id: makeId("source"),
      title: sourceDraft.title.trim(),
      author: sourceDraft.author.trim(),
      collection: sourceDraft.collection.trim() || "Unfiled",
      citation: formatCitation(sourceDraft),
      status: `Formatted ${sourceDraft.citationStyle}`,
      savedAt,
    };
    const next = [source, ...sources];
    setSources(next);
    saveLocal(`ed-demo-${persona.id}-sources-v2`, next);
    addHistory(`${source.citationStyle} source saved`, source.title);
    setSourceDraft(createSourceDraft(persona));
    setSourceMessage(`${source.title} was formatted and saved to ${source.collection}.`);
  }

  const citationPreview = formatCitation(sourceDraft);
  const sourceValues = {
    courses: uniqueValues(sources, "course"),
    types: uniqueValues(sources, "sourceType"),
    collections: uniqueValues(sources, "collection"),
  };
  const filteredSources = sources.filter((source) => {
    const searchText = `${source.title} ${source.author} ${source.note} ${source.citation}`.toLowerCase();
    return (!sourceQuery.trim() || searchText.includes(sourceQuery.trim().toLowerCase()))
      && (sourceFilters.course === "all" || source.course === sourceFilters.course)
      && (sourceFilters.type === "all" || source.sourceType === sourceFilters.type)
      && (sourceFilters.collection === "all" || source.collection === sourceFilters.collection);
  });
  const groupedSources = Object.groupBy
    ? Object.groupBy(filteredSources, (source) => source.collection)
    : filteredSources.reduce((groups, source) => ({ ...groups, [source.collection]: [...(groups[source.collection] || []), source] }), {});

  const documentValues = {
    courses: uniqueValues(documents, "course"),
    types: uniqueValues(documents, "type"),
    collections: uniqueValues(documents, "collection"),
  };
  const filteredDocuments = documents.filter((document) => {
    const searchText = `${document.title} ${document.type} ${document.text}`.toLowerCase();
    return (!documentQuery.trim() || searchText.includes(documentQuery.trim().toLowerCase()))
      && (documentFilters.course === "all" || document.course === documentFilters.course)
      && (documentFilters.type === "all" || document.type === documentFilters.type)
      && (documentFilters.collection === "all" || document.collection === documentFilters.collection);
  });
  const groupedDocuments = Object.groupBy
    ? Object.groupBy(filteredDocuments, (document) => document.collection)
    : filteredDocuments.reduce((groups, document) => ({ ...groups, [document.collection]: [...(groups[document.collection] || []), document] }), {});
  const selectedDocument = filteredDocuments.find((document) => document.id === selectedDocumentId) || filteredDocuments[0];
  const collectionOptions = [...new Set([...DEFAULT_COLLECTIONS, ...sourceValues.collections])];

  return (
    <div className="workspace-panel-stack">
      <section className="paper-card library-header-card">
        <div>
          <NotebookLabel>{persona.id === "professor" ? "RESEARCH & TEACHING LIBRARY" : "NOTES & SOURCE LIBRARY"}</NotebookLabel>
          <h1>Keep the thought, the source, and the class together.</h1>
          <p>Build APA or MLA citations, file sources by class and collection, and preview saved documents without hunting across tabs.</p>
        </div>
        <div className="segmented-control" aria-label="Library section">
          <button className={view === "notes" ? "is-active" : ""} type="button" onClick={() => setView("notes")}>Notes</button>
          <button className={view === "sources" ? "is-active" : ""} type="button" onClick={() => setView("sources")}>Sources</button>
          <button className={view === "documents" ? "is-active" : ""} type="button" onClick={() => setView("documents")}>Documents</button>
        </div>
      </section>

      {view === "notes" && (
        <>
          <section className="library-two-column">
            <article className="paper-card">
              <NotebookLabel>ADD A NOTE</NotebookLabel>
              <form className="library-form" onSubmit={addNote}>
                <label>Class
                  <select value={noteDraft.course} onChange={(event) => setNoteDraft({ ...noteDraft, course: event.target.value })}>
                    {persona.classes.map((course) => <option key={course.code}>{course.code}</option>)}
                    {persona.id === "professor" && <option>DOCTORATE</option>}
                  </select>
                </label>
                <label>Title<input value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })} placeholder="What should future-you find?" /></label>
                <label>Note<textarea rows={6} value={noteDraft.body} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })} /></label>
                <button type="submit">Save note</button>
              </form>
            </article>
            <article className="paper-card note-stack">
              <NotebookLabel>SAVED NOTES</NotebookLabel>
              {notes.map((note) => <section key={note.id}><div><span>{note.course}</span><small>{note.created}</small></div><strong>{note.title}</strong><p>{note.body}</p></section>)}
            </article>
          </section>
          <VersionHistory entries={history} />
        </>
      )}

      {view === "sources" && (
        <>
          <section className="library-source-layout">
            <article className="paper-card citation-builder-card">
              <div className="citation-builder-heading">
                <div><NotebookLabel>SAVE A SOURCE</NotebookLabel><h2>Build the citation as you save it.</h2></div>
                <div className="citation-style-switch" aria-label="Citation style">
                  {CITATION_STYLES.map((style) => <button className={sourceDraft.citationStyle === style ? "is-active" : ""} type="button" key={style} onClick={() => updateSourceDraft("citationStyle", style)}>{style}</button>)}
                </div>
              </div>
              <form className="library-form citation-form" onSubmit={addSource}>
                <div className="citation-form-grid">
                  <label>Source type
                    <select value={sourceDraft.sourceType} onChange={(event) => chooseSourceType(event.target.value)}>{SOURCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                  </label>
                  <label>Class
                    <select value={sourceDraft.course} onChange={(event) => updateSourceDraft("course", event.target.value)}>
                      <option>General</option>
                      {persona.classes.map((course) => <option key={course.code}>{course.code}</option>)}
                      {persona.id === "professor" && <option>DOCTORATE</option>}
                    </select>
                  </label>
                  <label>Collection / folder
                    <input list={`source-collections-${persona.id}`} value={sourceDraft.collection} onChange={(event) => updateSourceDraft("collection", event.target.value)} />
                    <datalist id={`source-collections-${persona.id}`}>{collectionOptions.map((collection) => <option key={collection} value={collection} />)}</datalist>
                  </label>
                </div>
                <label>Title<input value={sourceDraft.title} onChange={(event) => updateSourceDraft("title", event.target.value)} placeholder="Full source title" /></label>
                <label>Author / organization<input value={sourceDraft.author} onChange={(event) => updateSourceDraft("author", event.target.value)} placeholder="Last name, First name or organization" /></label>

                <fieldset className="citation-field-picker">
                  <legend>Source details <span>Choose every element this source needs.</span></legend>
                  <div>
                    {Object.entries(OPTIONAL_FIELD_DEFINITIONS).map(([key, definition]) => (
                      <label key={key}><input type="checkbox" checked={sourceDraft.visibleFields.includes(key)} onChange={() => toggleOptionalField(key)} /><span>{definition.label}</span></label>
                    ))}
                  </div>
                </fieldset>

                <div className="citation-optional-grid">
                  {sourceDraft.visibleFields.map((key) => {
                    const field = OPTIONAL_FIELD_DEFINITIONS[key];
                    if (!field) return null;
                    return <label key={key}>{field.label}<input type={field.type || "text"} value={sourceDraft[key]} onChange={(event) => updateSourceDraft(key, event.target.value)} placeholder={field.placeholder} /></label>;
                  })}
                </div>

                <div className="custom-source-elements">
                  <div><strong>Custom elements</strong><button type="button" onClick={addCustomElement}>+ Add element</button></div>
                  {sourceDraft.customElements.map((element) => (
                    <div className="custom-source-row" key={element.id}>
                      <input aria-label="Custom element name" value={element.label} onChange={(event) => updateCustomElement(element.id, "label", event.target.value)} placeholder="Element name" />
                      <input aria-label="Custom element value" value={element.value} onChange={(event) => updateCustomElement(element.id, "value", event.target.value)} placeholder="Value" />
                      <button type="button" onClick={() => removeCustomElement(element.id)} aria-label={`Remove ${element.label || "custom element"}`}>Remove custom field</button>
                    </div>
                  ))}
                </div>

                <label>Why it matters<textarea rows={3} value={sourceDraft.note} onChange={(event) => updateSourceDraft("note", event.target.value)} placeholder="Connect this source to the class or assignment." /></label>
                <div className="citation-preview" aria-live="polite"><span>{sourceDraft.citationStyle} preview</span><p>{citationPreview}</p></div>
                {sourceMessage && <p className="library-form-message" role="status">{sourceMessage}</p>}
                <button type="submit">Format and save source</button>
              </form>
            </article>

            <article className="paper-card source-cabinet-card">
              <div className="source-cabinet-heading"><div><NotebookLabel>SOURCE CABINET</NotebookLabel><h2>{filteredSources.length} source{filteredSources.length === 1 ? "" : "s"}</h2></div><span>Saved by class and folder</span></div>
              <LibraryFilters query={sourceQuery} setQuery={setSourceQuery} values={sourceValues} filters={sourceFilters} setFilters={setSourceFilters} label="Search sources" />
              <div className="source-collection-stack">
                {Object.entries(groupedSources).map(([collection, collectionSources]) => (
                  <section className="source-collection-group" key={collection}>
                    <header><strong>{collection}</strong><span>{collectionSources.length}</span></header>
                    {collectionSources.map((source) => (
                      <article key={source.id}>
                        <div className="source-record-meta"><span>{source.course}</span><span>{source.sourceType}</span><b>{source.citationStyle}</b></div>
                        <h3>{source.title}</h3>
                        <p className="citation-record">{source.citation || formatCitation(source)}</p>
                        {source.note && <p>{source.note}</p>}
                        <footer><span>{source.savedAt}</span>{/^https?:\/\//iu.test(source.url || "") && <a href={source.url} target="_blank" rel="noreferrer">Open source</a>}</footer>
                      </article>
                    ))}
                  </section>
                ))}
                {!filteredSources.length && <div className="library-empty-state"><strong>No sources match these filters.</strong><p>Clear a filter or save a new source to this collection.</p></div>}
              </div>
            </article>
          </section>
          <VersionHistory entries={history} />
        </>
      )}

      {view === "documents" && (
        <section className="library-document-workspace">
          <article className="paper-card document-browser-card">
            <div className="document-browser-heading"><div><NotebookLabel>DOCUMENT STORAGE</NotebookLabel><h2>Find files by class, type, or collection.</h2></div><span>{filteredDocuments.length} visible</span></div>
            <LibraryFilters query={documentQuery} setQuery={setDocumentQuery} values={documentValues} filters={documentFilters} setFilters={setDocumentFilters} label="Search documents" />
            <div className="document-collection-stack">
              {Object.entries(groupedDocuments).map(([collection, collectionDocuments]) => (
                <section key={collection}>
                  <header><strong>{collection}</strong><span>{collectionDocuments.length} file{collectionDocuments.length === 1 ? "" : "s"}</span></header>
                  {collectionDocuments.map((document) => (
                    <button className={selectedDocument?.id === document.id ? "is-selected" : ""} type="button" key={document.id} onClick={() => setSelectedDocumentId(document.id)}>
                      <span className="document-type-icon">{document.type.slice(0, 3).toUpperCase()}</span>
                      <span><strong>{document.title}</strong><small>{document.course} · {document.type} · {document.wordCount} words</small></span>
                      <span aria-hidden="true">Open</span>
                    </button>
                  ))}
                </section>
              ))}
              {!filteredDocuments.length && <div className="library-empty-state"><strong>No documents match these filters.</strong><p>Try another class, type, or search phrase.</p></div>}
            </div>
          </article>

          <aside className="paper-card document-preview-card">
            {selectedDocument ? (
              <>
                <div className="document-preview-meta"><span>{selectedDocument.type}</span><b>{selectedDocument.collection}</b></div>
                <h2>{selectedDocument.title}</h2>
                <dl>
                  <div><dt>Class</dt><dd>{selectedDocument.course}</dd></div>
                  <div><dt>Updated</dt><dd>{selectedDocument.updated}</dd></div>
                  <div><dt>Length</dt><dd>{selectedDocument.wordCount} words</dd></div>
                </dl>
                <div className="document-text-preview"><span>Document preview</span><p>{selectedDocument.text}</p></div>
                <button type="button" onClick={() => setDocumentOpen(true)}>Open in workspace</button>
                <p className="document-preview-note">This demo opens a readable preview. Connected storage can later replace the sample text with the original file.</p>
              </>
            ) : <div className="library-empty-state"><strong>Select a document.</strong><p>Its details and readable text will appear here.</p></div>}
          </aside>
        </section>
      )}
      {documentOpen && selectedDocument && <FullscreenSurface title={selectedDocument.title} pages={[{ id: "document", label: "Document" }]} initialPage="document" addressPrefix="ednotebook://library" onClose={() => setDocumentOpen(false)} renderPage={() => <section className="syllabus-fullscreen-page"><div className="syllabus-fullscreen-heading"><div><NotebookLabel>{selectedDocument.collection}</NotebookLabel><h1>{selectedDocument.title}</h1><p>{selectedDocument.course} · {selectedDocument.type} · {selectedDocument.wordCount} words</p></div></div><article className="paper-card document-text-preview"><span>Readable document</span><p>{selectedDocument.text}</p></article></section>} />}
    </div>
  );
}

export { SourcesPanel };
