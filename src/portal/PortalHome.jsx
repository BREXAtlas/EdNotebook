import { BrandMark } from "../Brand.jsx";
import PortalNav from "./PortalNav.jsx";
import ShareEdNotebook from "./ShareEdNotebook.jsx";

const PORTAL_CARDS = [
  {
    id: "student",
    number: "01",
    title: "I’m a student",
    description: "Find your school and classes, keep grades and notes together, join class groups, and build a student page.",
    href: "#/students",
    action: "Open student portal",
    points: ["Search before signing in", "Course work stays locked until enrollment", "Free core learning tools"],
    image: "/landing/landing-university-study.png",
    imageAlt: "University student studying with a notebook and laptop in a campus library",
  },
  {
    id: "professor",
    number: "02",
    title: "I teach",
    description: "Create and publish courses, approve rosters, grade work, communicate with students, and preview the student experience.",
    href: "#/professors",
    action: "Open professor portal",
    points: ["Build and publish classes", "Roster and grade controls", "Sensitive areas re-lock automatically"],
    image: "/landing/landing-professor-planning.png",
    imageAlt: "Professor planning a course with books, notes, and a laptop",
  },
  {
    id: "publishing",
    number: "03",
    title: "I publish learning material",
    description: "Prepare books, readings, supplies, and course-ready resources for professor review and student access.",
    href: "#/publishers",
    action: "Open publishing portal",
    points: ["Professor-authored material", "Partner catalog pathway", "Clear access and pricing choices"],
    image: "/landing/landing-publishing-materials.png",
    imageAlt: "Course books and manuscript pages being reviewed for publication",
  },
];

const actionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "11px 16px",
  borderRadius: 11,
  fontSize: 13,
  fontWeight: 850,
  textDecoration: "none",
};

const LOGO_VARIANTS = [
  { name: "Primary logo", use: "Headers, presentations, and partner materials", src: "/brand/ednotebook-logo-primary.svg", file: "ednotebook-logo-primary.svg" },
  { name: "Compact mark", use: "App icons, avatars, and small spaces", src: "/brand/ednotebook-logo-mark.svg", file: "ednotebook-logo-mark.svg" },
  { name: "One-color logo", use: "Print, embroidery, stamps, and simple backgrounds", src: "/brand/ednotebook-logo-monochrome.svg", file: "ednotebook-logo-monochrome.svg" },
];

export default function PortalHome() {
  return (
    <div className="portal-page portal-home-page">
      <PortalNav />
      <main>
        <section className="portal-choice-hero">
          <div className="portal-choice-copy">
            <span className="portal-kicker">WELCOME TO EDNOTEBOOK</span>
            <h1>Choose where you want to start.</h1>
            <p>
              Students keep classes, dates, notes, and people together. Professors build courses, manage feedback, and stay connected with their classes.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
              <a href="#/tour" style={{ ...actionStyle, color: "#fff", background: "#1d4ed8" }}>Take the interactive tour</a>
              <a href="#/presentation" style={{ ...actionStyle, color: "#153b91", border: "1px solid #9eabd0", background: "#fff" }}>View the presentation</a>
            </div>
          </div>
          <div className="portal-choice-mark">
            <img className="portal-choice-hero-image" src="/landing/landing-learning-planner.png" alt="An organized learning desk with notebook, planner, books, and laptop" width="1536" height="1024" fetchpriority="high" />
            <BrandMark size={82} inverse />
            <span>Making learning fun, connected, and high tech.</span>
          </div>
        </section>

        <section className="portal-choice-grid" aria-label="Choose an EdNotebook portal">
          {PORTAL_CARDS.map((portal) => (
            <article className={`portal-choice-card is-${portal.id}`} key={portal.id}>
              <img className="portal-choice-card-image" src={portal.image} alt={portal.imageAlt} width="1536" height="1024" loading="lazy" />
              <span className="portal-card-number">{portal.number}</span>
              <h2>{portal.title}</h2>
              <p>{portal.description}</p>
              <ul>{portal.points.map((point) => <li key={point}>{point}</li>)}</ul>
              <a href={portal.href}>{portal.action}<span aria-hidden="true">→</span></a>
            </article>
          ))}
        </section>

        <section style={{ maxWidth: 1180, margin: "0 auto 54px", padding: "0 28px" }} aria-label="Interactive demonstration accounts">
          <div style={{ padding: 28, color: "#18284a", background: "#fffdf8", border: "1px solid #ded6c8", borderRadius: 22, boxShadow: "0 18px 50px rgba(16,27,51,.08)" }}>
            <span className="portal-kicker">MEET THE DEMO TEAM</span>
            <h2 style={{ margin: "10px 0 8px", fontFamily: '"Zilla Slab", Georgia, serif', fontSize: 34 }}>Meet Brooke, Atlas, and Jaylen.</h2>
            <p style={{ maxWidth: 820, margin: 0, color: "#657086", lineHeight: 1.65 }}>Open a ready-made student, professor, or K–12 workspace and try the features for yourself.</p>
            <div className="portal-demo-team">
              <a href="#/tour/student"><img src="/demo-media/brooke-portrait.png" alt="Brooke, student tour guide" /><span><strong>Brooke</strong><small>University student</small></span></a>
              <a href="#/tour/professor"><img src="/demo-media/atlas-portrait.png" alt="Atlas, professor guide" /><span><strong>Atlas</strong><small>Professor</small></span></a>
              <a href="#/tour/k12"><img src="/demo-media/jaylen-portrait.png" alt="Jaylen, K–12 student guide" /><span><strong>Jaylen</strong><small>K–12 student</small></span></a>
            </div>
          </div>
        </section>

        <section className="portal-home-share" aria-labelledby="portal-home-share-title">
          <div>
            <span className="portal-kicker">SHARE EDNOTEBOOK</span>
            <h2 id="portal-home-share-title">Invite students, friends, and professors.</h2>
            <p>Send the website directly, post it to social media, or download the ready-to-share invitation graphic for a class group, campus page, or message.</p>
            <ShareEdNotebook buttonLabel="Share or download the invitation" targetPath="#/" />
          </div>
          <img src="/ednotebook-share-card.png" alt="EdNotebook invitation to find classes and people and join free" />
        </section>

        <section className="portal-brand-kit" aria-labelledby="portal-brand-kit-title">
          <div className="portal-brand-kit-heading"><div><span className="portal-kicker">EDNOTEBOOK LOGO KIT</span><h2 id="portal-brand-kit-title">Three marks for every setting.</h2></div><p>Use the primary logo whenever space allows, the compact mark for small placements, and the one-color logo when full color is not practical.</p></div>
          <div className="portal-brand-variant-grid">{LOGO_VARIANTS.map((logo) => <article key={logo.name}><div className={logo.name === "One-color logo" ? "is-monochrome" : ""}><img src={logo.src} alt={`${logo.name} for EdNotebook`} /></div><strong>{logo.name}</strong><span>{logo.use}</span><a href={logo.src} download={logo.file}>Download SVG</a></article>)}</div>
        </section>

        <section className="portal-home-principle">
          <div><strong>Browse first</strong><span>Public school, class, and demonstration information does not require an account.</span></div>
          <div><strong>Start independently</strong><span>Students can upload syllabi and use planning, notes, sources, literacy courses, and learning search without waiting for a teacher account.</span></div>
          <div><strong>Your view stays yours</strong><span>Students see their own cross-class learning record; professors see only students and classes they are authorized to manage.</span></div>
        </section>
      </main>
      <footer className="portal-simple-footer portal-home-footer"><img src="/brand/ednotebook-logo-monochrome.svg" alt="EdNotebook" /><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/tour">Tour</a><a href="#/presentation">Presentation</a><a href="#/about">About & values</a><a href="#/careers">Work with us</a><a href="#/students">Students</a><a href="#/professors">Professors</a><a href="#/publishers">Publishing</a></footer>
    </div>
  );
}
