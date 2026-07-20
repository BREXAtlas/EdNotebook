import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { currentCourseId } from "./storageService.js";
import { PLUGIN_REGISTRY, statusLabel } from "./pluginRegistry.js";

function newSlide(index = 1) {
  return {
    id: crypto.randomUUID(),
    layout: index === 1 ? "title" : "content",
    title: index === 1 ? "Course presentation" : `Slide ${index}`,
    body: index === 1 ? "A clear claim, a visual, and one next step." : "Add the evidence or idea learners should remember.",
    speakerNotes: "",
    visualPrompt: "",
  };
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SlideCanvas({ slide }) {
  return (
    <article className={`studio-slide-canvas layout-${slide.layout}`}>
      <div className="studio-slide-brand">EDNOTEBOOK</div>
      <h2>{slide.title || "Untitled slide"}</h2>
      <p>{slide.body || "Add slide content."}</p>
      {slide.visualPrompt && <div className="studio-slide-visual"><span aria-hidden="true">◫</span><small>VISUAL DIRECTION</small><strong>{slide.visualPrompt}</strong></div>}
      <div className="studio-slide-page">Learning presentation</div>
    </article>
  );
}

function PresentationStudio() {
  const [deckId, setDeckId] = useState(null);
  const [title, setTitle] = useState("Digital Literacy Decision Brief");
  const [slides, setSlides] = useState([newSlide(1), newSlide(2), newSlide(3)]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = slides[selectedIndex] || slides[0];

  useEffect(() => {
    const courseId = currentCourseId();
    if (!courseId) return;
    supabase
      .from("slide_decks")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDeckId(data.id);
        setTitle(data.title);
        if (Array.isArray(data.slides) && data.slides.length) setSlides(data.slides);
      });
  }, []);

  function updateSlide(field, value) {
    setSlides((items) => items.map((slide, index) => index === selectedIndex ? { ...slide, [field]: value } : slide));
  }

  function addSlide() {
    setSlides((items) => {
      const next = [...items, newSlide(items.length + 1)];
      setSelectedIndex(next.length - 1);
      return next;
    });
  }

  function duplicateSlide() {
    const copy = { ...selected, id: crypto.randomUUID(), title: `${selected.title} copy` };
    setSlides((items) => {
      const next = [...items.slice(0, selectedIndex + 1), copy, ...items.slice(selectedIndex + 1)];
      setSelectedIndex(selectedIndex + 1);
      return next;
    });
  }

  function removeSlide() {
    if (slides.length === 1) return;
    setSlides((items) => items.filter((_, index) => index !== selectedIndex));
    setSelectedIndex((index) => Math.max(0, index - 1));
  }

  async function saveDeck() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const payload = {
        owner_id: userData.user.id,
        course_id: currentCourseId(),
        title: title.trim() || "Untitled presentation",
        slides,
        source_plugin: null,
      };
      let saved;
      if (deckId) {
        const { data, error: saveError } = await supabase.from("slide_decks").update(payload).eq("id", deckId).select().single();
        if (saveError) throw saveError;
        saved = data;
      } else {
        const { data, error: saveError } = await supabase.from("slide_decks").insert(payload).select().single();
        if (saveError) throw saveError;
        saved = data;
        setDeckId(data.id);
      }
      setNotice(`${saved.slides.length} slides saved to EdNotebook.`);
    } catch (saveError) {
      setError(saveError.message || "The presentation could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function exportPackage() {
    downloadJson(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "presentation"}.edslides.json`, {
      format: "EdSlides/1.0",
      title,
      slides,
      integrationHints: {
        canva: "Export slides or image assets through the Canva Apps SDK connector.",
        powerpoint: "A server-side converter can map this manifest to PPTX.",
      },
    });
  }

  return (
    <div className="studio-presentation-layout">
      <aside className="studio-slide-list">
        <div className="studio-panel-heading"><div><span className="studio-kicker">SLIDES</span><h3>{slides.length} pages</h3></div><button type="button" onClick={addSlide}>Add slide</button></div>
        {slides.map((slide, index) => (
          <button key={slide.id} type="button" className={selectedIndex === index ? "is-active" : ""} onClick={() => setSelectedIndex(index)}>
            <span>{index + 1}</span><div><strong>{slide.title || "Untitled slide"}</strong><small>{slide.layout}</small></div>
          </button>
        ))}
      </aside>

      <main className="studio-slide-workbench">
        <div className="studio-slide-topbar">
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Presentation title" />
          <button type="button" onClick={duplicateSlide}>Duplicate slide</button>
          <button type="button" onClick={removeSlide} disabled={slides.length === 1}>Delete slide</button>
          <button type="button" onClick={exportPackage}>Download package</button>
          <button className="is-primary" type="button" disabled={busy} onClick={saveDeck}>{busy ? "Saving…" : "Save deck"}</button>
        </div>
        <SlideCanvas slide={selected} />
        <div className="studio-slide-editor">
          <label>Layout<select value={selected.layout} onChange={(event) => updateSlide("layout", event.target.value)}><option value="title">Title</option><option value="content">Content</option><option value="quote">Quote</option><option value="data">Data</option><option value="image">Image-led</option></select></label>
          <label>Slide title<input value={selected.title} onChange={(event) => updateSlide("title", event.target.value)} /></label>
          <label className="is-wide">Slide content<textarea rows={4} value={selected.body} onChange={(event) => updateSlide("body", event.target.value)} /></label>
          <label className="is-wide">Visual direction<input value={selected.visualPrompt} onChange={(event) => updateSlide("visualPrompt", event.target.value)} placeholder="Describe an image, diagram, chart, or Canva design." /></label>
          <label className="is-wide">Speaker notes<textarea rows={3} value={selected.speakerNotes} onChange={(event) => updateSlide("speakerNotes", event.target.value)} /></label>
        </div>
        {notice && <div className="studio-alert is-success">{notice}</div>}
        {error && <div className="studio-alert is-error">{error}</div>}
      </main>
    </div>
  );
}

function IntegrationCenter() {
  return (
    <div className="studio-integration-center">
      <div className="studio-integration-callout">
        <span className="studio-kicker">PLUGIN CONTRACT</span>
        <h3>Every integration maps into EdNotebook’s own course, resource, document, and rights models.</h3>
        <p>A connector can import or export content, but it does not get to bypass ownership, placement, attribution, or access rules.</p>
      </div>
      <div className="studio-plugin-grid">
        {PLUGIN_REGISTRY.map((plugin) => (
          <article key={plugin.id} className={`studio-plugin-card status-${plugin.status}`}>
            <div className="studio-plugin-heading"><span aria-hidden="true">{plugin.category === "Storage" ? "☁" : plugin.category === "Video" ? "▶" : plugin.category === "Design" ? "◫" : plugin.category === "Documents" ? "W" : plugin.category.includes("Publisher") ? "◎" : "↗"}</span><div><small>{plugin.category}</small><h3>{plugin.name}</h3></div><em>{statusLabel(plugin.status)}</em></div>
            <p>{plugin.description}</p>
            <div className="studio-capability-list">{plugin.capabilities.map((capability) => <code key={capability}>{capability}</code>)}</div>
            <footer>{plugin.configuration}</footer>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function SlidesIntegrations() {
  const [tab, setTab] = useState("slides");
  return (
    <section className="studio-workspace" aria-labelledby="slides-integrations-title">
      <div className="studio-section-heading">
        <div><span className="studio-kicker">PRESENTATIONS & PLUG-INS</span><h2 id="slides-integrations-title">Create here; connect to specialist tools without losing the learning structure.</h2><p>EdSlides stores the academic presentation model. Canva, PowerPoint, and future tools can become renderers and editors through the plugin contract.</p></div>
      </div>
      <div className="studio-subtabs" role="tablist" aria-label="Presentations and integrations">
        <button type="button" role="tab" aria-selected={tab === "slides"} className={tab === "slides" ? "is-active" : ""} onClick={() => setTab("slides")}><span aria-hidden="true">▤</span>Slide studio</button>
        <button type="button" role="tab" aria-selected={tab === "plugins"} className={tab === "plugins" ? "is-active" : ""} onClick={() => setTab("plugins")}><span aria-hidden="true">⊕</span>Integration center</button>
      </div>
      {tab === "slides" ? <PresentationStudio /> : <IntegrationCenter />}
    </section>
  );
}
