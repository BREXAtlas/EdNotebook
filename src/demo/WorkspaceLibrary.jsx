import { useEffect, useState } from "react";
import { safeRead, NotebookLabel } from "./demoShared.jsx";

function SourcesPanel({ persona }) {
  const [notes, setNotes] = useState(() => safeRead(`ed-demo-${persona.id}-notes`, [
    { id: "n1", course: persona.classes[0].code, title: "First-week questions", body: "What is the one concept I should be able to explain without looking at the slides?", created: "Aug 19" },
    { id: "n2", course: persona.id === "professor" ? "DOCTORATE" : persona.classes[1].code, title: "Follow-up", body: persona.id === "professor" ? "Connect student agency literature to the course redesign memo." : "Add the instructor’s example to the study guide before Friday.", created: "Aug 18" },
  ]));
  const [sources, setSources] = useState(persona.sources);
  const [noteDraft, setNoteDraft] = useState({ course: persona.classes[0].code, title: "", body: "" });
  const [sourceDraft, setSourceDraft] = useState({ title: "", author: "", url: "", note: "" });
  const [view, setView] = useState("notes");
  useEffect(() => { setSources(persona.sources); setView("notes"); }, [persona.id]);
  function addNote(event) {
    event.preventDefault();
    if (!noteDraft.title.trim() || !noteDraft.body.trim()) return;
    const next = [{ id: crypto.randomUUID(), ...noteDraft, created: "Now" }, ...notes];
    setNotes(next);
    window.localStorage.setItem(`ed-demo-${persona.id}-notes`, JSON.stringify(next));
    setNoteDraft({ ...noteDraft, title: "", body: "" });
  }
  function addSource(event) {
    event.preventDefault();
    if (!sourceDraft.title.trim()) return;
    setSources([{ ...sourceDraft, type: "Saved source", status: "Needs citation details" }, ...sources]);
    setSourceDraft({ title: "", author: "", url: "", note: "" });
  }
  return (
    <div className="workspace-panel-stack">
      <section className="paper-card library-header-card"><div><NotebookLabel>{persona.id === "professor" ? "RESEARCH & TEACHING LIBRARY" : "NOTES & SOURCE LIBRARY"}</NotebookLabel><h1>Keep the thought, the source, and the class together.</h1><p>Notes and sources are searchable from the workspace assistant. Source coaching keeps citation details visible instead of scattered across browser tabs.</p></div><div className="segmented-control"><button className={view === "notes" ? "is-active" : ""} type="button" onClick={() => setView("notes")}>Notes</button><button className={view === "sources" ? "is-active" : ""} type="button" onClick={() => setView("sources")}>Sources</button><button className={view === "documents" ? "is-active" : ""} type="button" onClick={() => setView("documents")}>Documents</button></div></section>
      {view === "notes" && <section className="library-two-column"><article className="paper-card"><NotebookLabel>ADD A NOTE</NotebookLabel><form className="library-form" onSubmit={addNote}><label>Class<select value={noteDraft.course} onChange={(event) => setNoteDraft({ ...noteDraft, course: event.target.value })}>{persona.classes.map((course) => <option key={course.code}>{course.code}</option>)}{persona.id === "professor" && <option>DOCTORATE</option>}</select></label><label>Title<input value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })} placeholder="What should future-you find?" /></label><label>Note<textarea rows={6} value={noteDraft.body} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })} /></label><button type="submit">Save note</button></form></article><article className="paper-card note-stack"><NotebookLabel>SAVED NOTES</NotebookLabel>{notes.map((note) => <section key={note.id}><div><span>{note.course}</span><small>{note.created}</small></div><strong>{note.title}</strong><p>{note.body}</p></section>)}</article></section>}
      {view === "sources" && <section className="library-two-column"><article className="paper-card"><NotebookLabel>SAVE A SOURCE</NotebookLabel><form className="library-form" onSubmit={addSource}><label>Title<input value={sourceDraft.title} onChange={(event) => setSourceDraft({ ...sourceDraft, title: event.target.value })} /></label><label>Author / organization<input value={sourceDraft.author} onChange={(event) => setSourceDraft({ ...sourceDraft, author: event.target.value })} /></label><label>Link<input type="url" value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} placeholder="https://" /></label><label>Why it matters<textarea rows={4} value={sourceDraft.note} onChange={(event) => setSourceDraft({ ...sourceDraft, note: event.target.value })} /></label><button type="submit">Save source</button></form></article><article className="paper-card source-stack"><NotebookLabel>SOURCE CABINET</NotebookLabel>{sources.map((source) => <section key={`${source.title}-${source.author}`}><div><span>{source.type}</span><b>{source.status}</b></div><a href={source.url || "#"} target="_blank" rel="noreferrer">{source.title}</a><strong>{source.author}</strong><p>{source.note}</p></section>)}</article></section>}
      {view === "documents" && <section className="library-two-column"><article className="paper-card document-list-card"><NotebookLabel>SEARCHABLE DOCUMENTS</NotebookLabel>{persona.documents.map((doc) => <section key={doc.id}><span>{doc.type}</span><strong>{doc.title}</strong><p>{doc.text}</p><button type="button">Open document</button></section>)}</article><article className="paper-card source-coach-card"><NotebookLabel>SOURCE HABITS</NotebookLabel><h2>Store enough information to find and cite it later.</h2><ol><li>Save the full title, author or organization, date, and working link.</li><li>Write one sentence explaining why the source matters.</li><li>Attach the source to a class, assignment, or note.</li><li>Record page numbers or timestamps before closing the source.</li><li>Use the assistant to find saved sources, then check the source before citing it.</li></ol></article></section>}
    </div>
  );
}

export { SourcesPanel };
