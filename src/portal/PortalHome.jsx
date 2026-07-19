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

export default function PortalHome() {
  return (
    <div className="portal-page portal-home-page">
      <PortalNav />
      <main>
        <section className="portal-choice-hero">
          <div className="portal-choice-copy">
            <span className="portal-kicker">WELCOME TO EDNOTEBOOK</span>
            <h1>Start with the part of campus life that belongs to you.</h1>
            <p>
              Students can find classes and keep their learning life together. Professors can build and run courses.
              Publishers can prepare material for those courses. Choose a portal to get the right starting point.
            </p>
          </div>
          <div className="portal-choice-mark"><BrandMark size={82} inverse /><span>One place for learning, teaching, and course material.</span></div>
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

        <section className="portal-home-principle">
          <div><strong>Browse first</strong><span>Public school and class information does not require an account.</span></div>
          <div><strong>Sign in when work begins</strong><span>Enrollment, grades, submissions, private groups, and saved work use an account.</span></div>
          <div><strong>Your view stays yours</strong><span>Students see their full report card; professors see only students in the classes they manage.</span></div>
        </section>
      </main>
      <footer className="portal-simple-footer"><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/students">Students</a><a href="#/professors">Professors</a><a href="#/publishers">Publishing</a></footer>
    </div>
  );
}
