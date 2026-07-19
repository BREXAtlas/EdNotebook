import BrandLogo from "../Brand.jsx";
import PortalNav from "./PortalNav.jsx";

const PATHS = [
  {
    id: "university",
    number: "01",
    title: "University & college",
    copy: "Find universities, professors, courses, campus groups, grades, notes, and opportunities built around college life.",
    href: "#/students/university",
    points: ["University finder", "Course and professor search", "Campus and class communities"],
  },
  {
    id: "k12",
    number: "02",
    title: "K–12 school",
    copy: "Keep classes, teachers, assignments, grades, attendance, clubs, and school updates together in a student-friendly space.",
    href: "#/students/k12",
    points: ["School and teacher search", "School-only social spaces", "Memory that can move into college"],
  },
];

export default function StudentAudienceChooser() {
  return (
    <div className="portal-page student-audience-page">
      <PortalNav active="student" />
      <main className="student-audience-main">
        <section className="student-audience-heading">
          <span className="portal-kicker">CHOOSE YOUR STUDENT SPACE</span>
          <h1>Same learning tools. The right school language.</h1>
          <p>Choose where you are now. A K–12 account can move into the university experience later while keeping learning history and saved work. Social profiles and feeds remain separate.</p>
        </section>
        <section className="student-audience-grid">
          {PATHS.map((path) => (
            <article className={`student-audience-card is-${path.id}`} key={path.id}>
              <span>{path.number}</span>
              <h2>{path.title}</h2>
              <p>{path.copy}</p>
              <ul>{path.points.map((point) => <li key={point}>{point}</li>)}</ul>
              <a href={path.href}>Open {path.title}<b aria-hidden="true">→</b></a>
            </article>
          ))}
        </section>
        <section className="student-continuity-card">
          <BrandLogo size={42} tagline="One account across school stages" />
          <div><strong>Your progress can move forward.</strong><span>Classes, milestones, selected notes, badges, and portfolio work can transfer from K–12 to university. K–12 and university social audiences never merge automatically.</span></div>
        </section>
      </main>
    </div>
  );
}
