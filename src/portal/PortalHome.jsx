import { BrandMark } from "../Brand.jsx";
import PortalNav from "./PortalNav.jsx";

const PORTAL_CARDS = [
  {
    id: "student",
    number: "01",
    title: "I’m a student",
    description: "Find your school and classes, keep grades and notes together, join class groups, and build a student page.",
    href: "#/students",
    action: "Open student portal",
    points: ["Search before signing in", "Course work stays locked until enrollment", "Free core learning tools"],
  },
  {
    id: "professor",
    number: "02",
    title: "I teach",
    description: "Create and publish courses, approve rosters, grade work, communicate with students, and preview the student experience.",
    href: "#/professors",
    action: "Open professor portal",
    points: ["Build and publish classes", "Roster and grade controls", "Sensitive areas re-lock automatically"],
  },
  {
    id: "publishing",
    number: "03",
    title: "I publish learning material",
    description: "Prepare books, readings, supplies, and course-ready resources for professor review and student access.",
    href: "#/publishers",
    action: "Open publishing portal",
    points: ["Professor-authored material", "Partner catalog pathway", "Clear access and pricing choices"],
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

export default function PortalHome() {
  return (
    <div className="portal-page portal-home-page">
      <PortalNav />
      <main>
        <section className="portal-choice-hero">
          <div className="portal-choice-copy">
            <span className="portal-kicker">WELCOME TO EDNOTEBOOK</span>
            <h1>Start with the part of learning life that belongs to you.</h1>
            <p>
              Students can turn syllabi into a shared calendar, manage due dates, keep notes and sources, and ask their own learning memory.
              Professors can organize courses, research, advising, feedback, and verified student relationships.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
              <a href="#/tour" style={{ ...actionStyle, color: "#fff", background: "#1d4ed8" }}>Take the interactive tour</a>
              <a href="#/presentation" style={{ ...actionStyle, color: "#153b91", border: "1px solid #9eabd0", background: "#fff" }}>View the presentation</a>
            </div>
          </div>
          <div className="portal-choice-mark"><BrandMark size={82} inverse /><span>One place for assignments, calendars, memory, learning, teaching, and academic identity.</span></div>
        </section>

        <section className="portal-choice-grid" aria-label="Choose an EdNotebook portal">
          {PORTAL_CARDS.map((portal) => (
            <article className={`portal-choice-card is-${portal.id}`} key={portal.id}>
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
            <h2 style={{ margin: "10px 0 8px", fontFamily: '"Zilla Slab", Georgia, serif', fontSize: 34 }}>Brooke, Atlas, and Jaylen make every side of EdNotebook testable.</h2>
            <p style={{ maxWidth: 820, margin: 0, color: "#657086", lineHeight: 1.65 }}>Tour a university student, professor, or K–12 workspace with fictional grades, assignments, conversations, social history, syllabus extraction, overlapping deadlines, reminders, notes, sources, and document-aware AI chat.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 20 }}>
              <a href="#/tour/student" style={{ ...actionStyle, color: "#fff", background: "#18284a" }}>Brooke · University student</a>
              <a href="#/tour/professor" style={{ ...actionStyle, color: "#314174", background: "#eceafa", border: "1px solid #d4d0ec" }}>Atlas · Professor</a>
              <a href="#/tour/k12" style={{ ...actionStyle, color: "#314174", background: "#eceafa", border: "1px solid #d4d0ec" }}>Jaylen · K–12 student</a>
            </div>
          </div>
        </section>

        <section className="portal-home-principle">
          <div><strong>Browse first</strong><span>Public school, class, and demonstration information does not require an account.</span></div>
          <div><strong>Start independently</strong><span>Students can upload syllabi and use planning, notes, sources, literacy courses, and AI search without waiting for a teacher account.</span></div>
          <div><strong>Your view stays yours</strong><span>Students see their own cross-class learning record; professors see only students and classes they are authorized to manage.</span></div>
        </section>
      </main>
      <footer className="portal-simple-footer"><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/tour">Tour</a><a href="#/presentation">Presentation</a><a href="#/about">About & values</a><a href="#/careers">Work with us</a><a href="#/students">Students</a><a href="#/professors">Professors</a><a href="#/publishers">Publishing</a></footer>
    </div>
  );
}
