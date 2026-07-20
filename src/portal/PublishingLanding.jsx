import PortalNav from "./PortalNav.jsx";

export default function PublishingLanding({ onEnter }) {
  return (
    <div className="portal-page publishing-landing-page">
      <PortalNav active="publishing" action={onEnter} actionLabel="Open publishing studio" />
      <main>
        <section className="publishing-hero">
          <span className="portal-kicker">EDNOTEBOOK PUBLISHING</span>
          <h1>Prepare material that fits the course instead of sitting beside it.</h1>
          <p>Professors can turn their own material into readings and interactive books. Publishing partners can prepare catalogs for course placement, student access, and optional purchase.</p>
          <div><button type="button" onClick={onEnter}>Open publishing studio</button><button className="publishing-secondary-action" type="button" onClick={() => document.getElementById("publishing-path")?.scrollIntoView({ behavior: "smooth", block: "start" })}>See the publishing path</button></div>
          <figure className="publishing-hero-image">
            <img src="/landing/landing-publishing-materials.png" alt="Course books and manuscript pages being reviewed for publication" width="1536" height="1024" />
            <figcaption><strong>From source to course-ready.</strong><span>Review structure, access, and placement before material reaches students.</span></figcaption>
          </figure>
        </section>
        <section id="publishing-path" className="publishing-path-grid">
          <article><span>01</span><h2>Bring the source</h2><p>Start with text, a document, a book file, or a structured catalog entry.</p></article>
          <article><span>02</span><h2>Build the learning version</h2><p>Create chapters, navigation, knowledge checks, annotations, accessibility information, and course placement.</p></article>
          <article><span>03</span><h2>Choose access</h2><p>Keep material private, share it with a class, make it openly available, or prepare a commercial listing.</p></article>
          <article><span>04</span><h2>Professor review</h2><p>The professor decides where the material belongs and when learners can open it.</p></article>
        </section>
        <section className="publishing-audience-grid">
          <article><span className="portal-kicker">PROFESSOR AUTHORS</span><h2>Write and assign your own material.</h2><p>Create course readers and short books without joining a commercial marketplace. Class-only publishing is part of the professor workflow.</p></article>
          <article><span className="portal-kicker">PUBLISHING PARTNERS</span><h2>Prepare a catalog for course use.</h2><p>Commercial listings add the identity, distribution, pricing, accessibility, payout, and support checks needed for that feature.</p></article>
          <article><span className="portal-kicker">LEARNING SUPPLIERS</span><h2>Connect books and supplies to the assignment.</h2><p>Give professors a clear preview and let students see why an item is needed before purchase.</p></article>
        </section>
      </main>
    </div>
  );
}
