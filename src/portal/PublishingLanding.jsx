import { useEffect, useMemo, useState } from "react";
import PortalNav from "./PortalNav.jsx";
import { listAlexMorrisonCatalog } from "./portalService.js";

function money(cents) {
  return Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : "";
}

function accessLabel(item) {
  if (item.access_model === "open_free" || item.access_model === "open") return "Free";
  if (item.access_model === "purchase") return `Purchase ${money(item.price_cents)}`.trim();
  if (item.access_model === "rental") return `Rental ${money(item.price_cents)}`.trim();
  return "Course access";
}

function CatalogPreview({ item, onClose, onOpenCourse }) {
  if (!item) return null;
  const freeCourse = item.item_kind === "course" && item.access_model === "open_free";
  const openBook = item.item_kind === "book" && item.access_model === "open";
  const commercial = item.access_model === "purchase" || item.access_model === "rental";
  return <div className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="library-preview-title">
    <div className="portal-modal-card library-preview-card">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close Library preview">×</button>
      <span className="portal-kicker">ALEX B. MORRISON {item.item_kind === "course" ? "COURSE" : "BOOK"}</span>
      <h2 id="library-preview-title">{item.title}</h2>
      <p>{item.description || "A professor-published EdNotebook learning resource."}</p>
      <dl>
        <div><dt>Creator</dt><dd>{item.creator_name}</dd></div>
        <div><dt>Access</dt><dd>{accessLabel(item)}</dd></div>
        <div><dt>Experience</dt><dd>{item.item_kind === "course" || item.reading_mode === "interactive" ? "Interactive learning" : "Read-only book"}</dd></div>
        {item.access_model === "rental" && <div><dt>Rental</dt><dd>{item.rental_days} days</dd></div>}
      </dl>
      {freeCourse && <button className="portal-modal-primary" type="button" onClick={() => onOpenCourse?.(item)}>
        {item.enrollment_policy === "open_self_enroll" ? "Start this free course" : "Request this free course"}
      </button>}
      {openBook && <a className="portal-modal-primary library-modal-link" href={`#/library/book/${item.item_id}`}>Open this free book</a>}
      {commercial && <div className="library-commerce-gate"><strong>Catalog preview only</strong><span>Checkout is not active until seller identity, rights, tax, refund, dispute, and payout controls pass review.</span></div>}
      {item.universal_assignment && <div className="library-assignment-note"><strong>Also assigned to eligible new students</strong><span>Automatic assignment is a professor-controlled course setting; it is separate from this free Library listing.</span></div>}
    </div>
  </div>;
}

export default function PublishingLanding({ onEnter, onOpenCourse }) {
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    listAlexMorrisonCatalog().then((result) => {
      if (!active) return;
      setCatalog(result.data || []);
      setNotice(result.error ? "The governed Library catalog is not connected in this environment yet." : "");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!catalog.length) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const courseId = params.get("course");
    if (courseId) setSelected(catalog.find((item) => item.item_kind === "course" && item.course_id === courseId) || null);
  }, [catalog]);

  const visible = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const kindMatch = kind === "all"
        || item.item_kind === kind
        || (kind === "free" && ["open_free", "open"].includes(item.access_model))
        || (kind === "commercial" && ["purchase", "rental"].includes(item.access_model));
      const queryMatch = !clean || `${item.title} ${item.creator_name} ${item.description}`.toLowerCase().includes(clean);
      return kindMatch && queryMatch;
    });
  }, [catalog, kind, query]);

  return (
    <div className="portal-page publishing-landing-page">
      <PortalNav active="publishing" action={onEnter} actionLabel="Professor publishing studio" />
      <main>
        <section className="publishing-hero">
          <span className="portal-kicker">ALEX B. MORRISON LIBRARY &amp; BOOKSTORE</span>
          <h1>Find a free course, open a professor’s book, or preview what is coming to the bookstore.</h1>
          <p>One governed catalog connects approved courses, read-only books, interactive EduBooks, and assigned readings. Digital Literacy is the first free course example; professor assignment remains a separate choice.</p>
          <div><a href="#library-catalog">Browse the Library</a><button type="button" onClick={onEnter}>Professor publishing studio</button></div>
          <figure className="publishing-hero-image">
            <img src="/landing/landing-publishing-materials.png" alt="Course books and manuscript pages being reviewed for publication" width="1536" height="1024" fetchPriority="high" />
            <figcaption><strong>Courses and books, connected.</strong><span>Publish one approved source, then choose Library, class assignment, open access, or governed commercial review.</span></figcaption>
          </figure>
        </section>

        <section id="library-catalog" className="library-catalog-section" aria-labelledby="library-catalog-title">
          <div className="student-section-heading"><span className="portal-kicker">SEARCHABLE CATALOG</span><h2 id="library-catalog-title">Alex B. Morrison Library</h2><p>Free items open now. Commercial items remain previews until checkout governance is approved.</p></div>
          <div className="library-catalog-controls">
            <label>Search Library<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, professor, author, or topic" /></label>
            <label>Show<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All courses and books</option><option value="free">Free</option><option value="course">Courses</option><option value="book">Books</option><option value="commercial">Bookstore previews</option></select></label>
          </div>
          {notice && <div className="portal-form-notice" role="status">{notice}</div>}
          {loading ? <div className="directory-empty">Opening the Library catalog…</div> : visible.length === 0 ? <div className="directory-empty">No Library items match this search yet.</div> : <div className="library-catalog-grid">{visible.map((item) => <article key={`${item.item_kind}-${item.item_id}`}>
            <div className="library-item-heading"><span>{item.item_kind === "course" ? "COURSE" : item.reading_mode === "interactive" ? "INTERACTIVE EDUBOOK" : "READ-ONLY BOOK"}</span><i className={item.listing_status === "review" ? "is-review" : "is-ready"}>{item.listing_status === "review" ? "under review" : "available"}</i></div>
            <h3>{item.title}</h3>
            <strong>{item.creator_name}</strong>
            <p>{item.description || "Professor-published learning material in EdNotebook."}</p>
            <footer><span>{accessLabel(item)}</span><button type="button" onClick={() => setSelected(item)}>View details</button></footer>
          </article>)}</div>}
        </section>

        <section id="publishing-path" className="publishing-path-grid">
          <article><span>01</span><h2>Bring one source</h2><p>Start with an approved course package, original book, licensed reading, or structured publisher file.</p></article>
          <article><span>02</span><h2>Choose the experience</h2><p>Keep a book read-only or build an interactive EduBook with progress, annotations, checks, quizzes, and discussion.</p></article>
          <article><span>03</span><h2>Choose placement</h2><p>Keep it private, assign the same book to a course, make it openly available, or prepare a commercial listing.</p></article>
          <article><span>04</span><h2>Govern release</h2><p>The professor releases free and assigned material. Commercial checkout waits for marketplace review and controls.</p></article>
        </section>
        <section className="publishing-audience-grid">
          <article><span className="portal-kicker">PROFESSOR AUTHORS</span><h2>Publish courses and books.</h2><p>List the approved course itself, publish a standalone book, or link the same book to a course without creating another source copy.</p></article>
          <article><span className="portal-kicker">STUDENTS</span><h2>Browse before enrolling.</h2><p>Search the Library, preview the learning experience, start free courses, and open free books from one familiar place.</p></article>
          <article><span className="portal-kicker">BOOKSTORE GOVERNANCE</span><h2>Prepare commerce honestly.</h2><p>Pricing and catalog previews can be reviewed now. Charging and payout stay off until the full marketplace gate passes.</p></article>
        </section>
      </main>
      <CatalogPreview item={selected} onClose={() => setSelected(null)} onOpenCourse={onOpenCourse} />
      <footer className="portal-simple-footer"><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/">Portal home</a><a href="#/students">Student portal</a><a href="#/professors">Professor portal</a></footer>
    </div>
  );
}
