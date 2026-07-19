import { useState } from "react";
import ClassDirectory from "./ClassDirectory.jsx";
import InterestForm from "./InterestForm.jsx";
import PortalNav from "./PortalNav.jsx";
import { STUDENT_PRICING } from "./demoData.js";
import { educationTrack } from "./educationTracks.js";
import UniversityFinder from "./UniversityFinder.jsx";

const STUDENT_FEATURES = [
  ["One school view", "Find campus news, useful links, published classes, professors, and student groups without jumping between five sites."],
  ["One grade picture", "See finalized, pending, and missing work with the same weights your professor publishes."],
  ["Notes that stay useful", "Keep class notes beside the class, calculate what you need on the next assignment, and carry your report card across terms."],
  ["Class life without the noise", "Join enrolled-class groups, public learning groups, and campus conversations with clear audience controls."],
  ["A page you control", "Add a bio, graduation year, work samples, YouTube links, and the parts of your progress you choose to share."],
  ["A path beyond class", "Find future internships, paid student work, course-building opportunities, and entry-level roles as they open."],
];

const K12_FEATURES = [
  ["Your school day in one view", "See classes, assignments, teacher updates, attendance, grades, and school news without hunting through different systems."],
  ["Grades that make sense", "See finalized, pending, and missing work with the same categories and weights your teacher shares."],
  ["A clear next step", "Open any class to see what is due, what needs attention, and where to ask your teacher for help."],
  ["School life without strangers", "Join class and school groups that stay separate from university feeds and outside public social networks."],
  ["A page that grows with you", "Save projects, badges, interests, and milestones now, then carry the learning memory into college later."],
  ["Skills beyond one class", "Find digital literacy, tutoring, clubs, student leadership, and future career exploration connected to school."],
];

export default function StudentLanding({ onEnter, track = "university" }) {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const k12 = track === "k12";
  const copy = educationTrack(track);
  const features = k12 ? K12_FEATURES : STUDENT_FEATURES;

  function openCourse(course) {
    setSelectedCourse(course);
  }

  return (
    <div className={`portal-page student-landing-page ${k12 ? "is-k12" : "is-university"}`}>
      <PortalNav active="student" action={onEnter} actionLabel={`${copy.shortLabel} student sign in`} />
      <main>
        <section className="student-hero">
          <div className="student-hero-copy">
            <span className="portal-kicker">{k12 ? "YOUR SCHOOL DAY, ALL TOGETHER" : "THE UNIVERSITY STUDENT SIDE OF EDNOTEBOOK"}</span>
            <h1>{k12 ? "Know what’s next. Keep school moving." : "Find your course. Keep the whole semester in view."}</h1>
            <p>
              {k12
                ? "Find your school, teacher, and class before creating an account. When you join, your student ID is matched to the teacher’s class list and your private school dashboard opens."
                : "Search your university and professor before creating an account. When you are ready to join a course, your university ID is matched to the professor’s approved roster and your private dashboard opens."}
            </p>
            <div className="student-hero-actions"><a href="#class-search">Find a class</a><button type="button" onClick={onEnter}>Open student dashboard</button></div>
            <div className="student-hero-points"><span>No account to browse</span><span>Free school tools</span><span>{k12 ? "School-only social spaces" : "Private grades by default"}</span></div>
          </div>
          <div className={`student-dashboard-preview ${k12 ? "k12-dashboard-preview" : ""}`} aria-label={`${copy.shortLabel} student dashboard preview`}>
            {k12 && <img className="k12-student-hero-image" src="/k12-student-hero.png" alt="High school students learning together with notebooks and a laptop" />}
            <div className="student-preview-top"><span>Good morning, Maya</span><strong>{k12 ? "1,705 points" : "1,645 points"}</strong></div>
            <div className="student-preview-grid"><div><small>Classes</small><strong>3</strong></div><div><small>Overall</small><strong>{k12 ? "89.1%" : "88.1%"}</strong></div><div><small>Streak</small><strong>11 days</strong></div></div>
            <div className="student-preview-class"><div><strong>{k12 ? "ENG 10" : "SCI 101"}</strong><span>{k12 ? "Stories and Evidence" : "What Is a Cell?"}</span></div><b>{k12 ? "71%" : "64%"}</b></div>
            <div className="student-preview-progress"><i style={{ width: k12 ? "71%" : "64%" }} /></div>
            <div className="student-preview-note">Next: {k12 ? "evidence paragraph · tomorrow" : "membranes knowledge check · Thursday"}</div>
          </div>
        </section>

        {!k12 && <div className="student-directory-shell"><UniversityFinder /></div>}
        <div id="class-search" className="student-directory-shell"><ClassDirectory track={track} onOpen={openCourse} /></div>

        <section className="student-how-section">
          <div className="student-section-heading"><span className="portal-kicker">HOW IT WORKS</span><h2>Open browsing, then a confirmed handoff into the class.</h2></div>
          <ol className="student-how-grid">
            <li><span>1</span><strong>Choose your {k12 ? "school" : "university"}</strong><p>See class listings, {k12 ? "teachers" : "professors"}, schedules, school news, and tips.</p></li>
            <li><span>2</span><strong>Find the {copy.classLabel}</strong><p>Search by code, title, subject, or {copy.teacherLabel}.</p></li>
            <li><span>3</span><strong>Match your {copy.idLabel}</strong><p>Create an account when you join. Your ID is matched without making it public.</p></li>
            <li><span>4</span><strong>{copy.teacherLabel[0].toUpperCase() + copy.teacherLabel.slice(1)} confirms access</strong><p>The class-list link is confirmed. Protected lessons, grades, and class groups then open.</p></li>
          </ol>
        </section>

        <section className="student-feature-section">
          <div className="student-section-heading"><span className="portal-kicker">WHAT STUDENTS GET</span><h2>Less hunting. Fewer surprises. More ways to stay connected.</h2><p>{k12 ? "School work stays at the center. Points, profiles, clubs, and communities support learning without mixing students into university feeds." : "Course work remains the center; community, profiles, points, and paid extras support it instead of getting in its way."}</p></div>
          <div className="student-feature-grid">{features.map(([title, featureCopy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{featureCopy}</p></article>)}</div>
        </section>

        <section className="student-life-explainer">
          <div><span className="portal-kicker">STUDENT LIFE</span><h2>{k12 ? "Your school, your classes, and a K–12 learning network—with no university crossover." : "A campus feed, a class room, and a public learning network—with separate audiences."}</h2><p>{k12 ? "Share a study streak, project, club update, or milestone only when you choose. Class groups require enrollment, school groups require a linked school, and K–12 social profiles never appear in university feeds." : "Share a study streak, points, assignment progress, a finished project, or a grade only when you choose. Class groups require enrollment. Public groups focus on learning and networking."}</p></div>
          <div className="student-life-layers"><article><strong>{k12 ? "School" : "Campus"}</strong><span>School news, tips, clubs, events, and student highlights</span></article><article><strong>Class</strong><span>Classmates, {copy.teacherLabel} announcements, study groups, and progress</span></article><article><strong>{k12 ? "K–12 network" : "Public"}</strong><span>{k12 ? "School-verified learning topics and digital skills" : "Learning topics, digital literacy, portfolios, and academic networking"}</span></article></div>
        </section>

        <section className="student-pricing-section">
          <div className="student-section-heading"><span className="portal-kicker">FREE FIRST, SMALL EXTRAS LATER</span><h2>Course access and core learning tools stay free.</h2><p>Optional personalization and cloud conveniences pay for themselves in small steps. Founding students keep the features they test free under the legacy program.</p></div>
          <div className="student-pricing-grid">{STUDENT_PRICING.map((plan) => <article key={plan.name}><span>{plan.name}</span><strong>{plan.price}</strong><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><button type="button">Join pricing waitlist</button></article>)}</div>
        </section>

        <section className="student-opportunity-section">
          <InterestForm kind="feature_feedback" title="Tell us what students need" description={`Suggest a feature or describe what should be easier during the ${k12 ? "school day" : "semester"}.`} submitLabel="Save feature suggestion" />
          <InterestForm kind="student_opportunities" title={k12 ? "Explore student opportunities" : "Work with EdNotebook"} description={k12 ? "Join the waitlist for future student testing, digital literacy, peer mentoring, clubs, and age-appropriate learning opportunities." : "Join the waitlist for future internships, student research support, course testing, design, community, and entry-level roles."} submitLabel="Join opportunity waitlist" emailRequired />
        </section>
      </main>

      {selectedCourse && (
        <div className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="class-preview-title">
          <div className="portal-modal-card">
            <button className="modal-close" type="button" onClick={() => setSelectedCourse(null)} aria-label="Close class preview">×</button>
            <span className="portal-kicker">PUBLIC CLASS PREVIEW</span>
            <h2 id="class-preview-title">{selectedCourse.code} · {selectedCourse.title}</h2>
            <p>{selectedCourse.summary}</p>
            <dl><div><dt>{copy.schoolLabel}</dt><dd>{selectedCourse.school.name}</dd></div><div><dt>{copy.teacherLabel}</dt><dd>{selectedCourse.professor}</dd></div><div><dt>Term</dt><dd>{selectedCourse.term}</dd></div><div><dt>Schedule</dt><dd>{selectedCourse.schedule}</dd></div></dl>
            <div className="class-preview-lock"><strong>Protected after this point</strong><span>Lessons, assignments, classmates, messages, and grades open after sign-in and confirmed enrollment.</span></div>
            <button className="portal-modal-primary" type="button" onClick={() => onEnter?.(selectedCourse)}>Sign in to request this class</button>
          </div>
        </div>
      )}
      <footer className="portal-simple-footer"><span>© {new Date().getFullYear()} EdNotebook</span><a href="#/students">Student paths</a><a href="#class-search">Find classes</a><a href="#/professors">Educator portal</a></footer>
    </div>
  );
}
