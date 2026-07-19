import BrandLogo from "../Brand.jsx";
import { CORE_LEARNING, DEMO_NOW, PERSONAS } from "./demoData.js";

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

function safeRead(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function dateKey(value) {
  return value.slice(0, 10);
}

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: options.year ? "numeric" : undefined,
    timeZone: options.timeZone || "America/Chicago",
  }).format(new Date(value));
}

function formatDateTime(value, timeZone = "America/Chicago", hour12 = true) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
    timeZone,
  }).format(new Date(value));
}

function dueLabel(value) {
  const delta = new Date(value).getTime() - new Date(DEMO_NOW).getTime();
  const hours = Math.round(delta / 36e5);
  if (hours < 0) return `${Math.abs(hours)}h overdue`;
  if (hours < 24) return `Due in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

function statusLabel(status, professor = false) {
  const labels = {
    "not-started": professor ? "Not reviewed" : "Not started",
    "in-progress": "In progress",
    complete: professor ? "Feedback sent" : "Complete",
    "needs-rescue": professor ? "Follow-up overdue" : "Needs rescue",
  };
  return labels[status] || status;
}

function nextAssignmentStatus(status) {
  if (status === "not-started" || status === "needs-rescue") return "in-progress";
  if (status === "in-progress") return "complete";
  return "not-started";
}

function iconForType(type) {
  const icons = {
    assignment: "✓",
    class: "▣",
    activity: "✦",
    life: "♡",
    college: "⌂",
    verification: "◆",
    research: "⌁",
  };
  return icons[type] || "•";
}

function routeSection(route) {
  if (route.startsWith("#/presentation")) return "presentation";
  if (route.startsWith("#/about")) return "about";
  if (route.startsWith("#/careers")) return "careers";
  if (route.startsWith("#/tour/")) return "workspace";
  return "tour";
}

function DemoNav({ active = "tour", compact = false }) {
  return (
    <header className={cx("demo-nav", compact && "is-compact")}>
      <a className="demo-brand" href="#/" aria-label="EdNotebook home">
        <BrandLogo size={38} tagline="Fun, connected learning" />
      </a>
      <nav aria-label="EdNotebook demonstration navigation">
        <a className={active === "tour" ? "is-active" : ""} href="#/tour">Tour</a>
        <a className={active === "presentation" ? "is-active" : ""} href="#/presentation">Presentation</a>
        <a className={active === "careers" ? "is-active" : ""} href="#/careers">Work with us</a>
      </nav>
      <a className="demo-nav-cta" href="#/students">Open live portals</a>
    </header>
  );
}

function VerifiedBadge({ label, small = false }) {
  return <span className={cx("verified-badge", small && "is-small")} title="Manually verified by a human"><span aria-hidden="true">✓</span>{label}</span>;
}

function OnlineBadge({ value }) {
  const labels = { online: "Online", away: "Away", focus: "Focus mode", offline: "Offline" };
  return <span className={cx("online-badge", `is-${value}`)}><i aria-hidden="true" />{labels[value]}</span>;
}

function NotebookLabel({ children }) {
  return <span className="notebook-label">{children}</span>;
}

function DemoFooter() {
  return (
    <footer className="demo-footer">
      <div>
        <BrandLogo size={42} tagline="Fun, connected learning" />
        <p>Classes, plans, people, and progress in one friendly place.</p>
      </div>
      <div>
        <strong>Explore</strong>
        <a href="#/tour">Take the tour</a>
        <a href="#/presentation">Presentation</a>
        <a href="#/students">Student portals</a>
        <a href="#/professors">Professor portal</a>
      </div>
      <div>
        <strong>Company</strong>
        <a href="#/about">About us</a>
        <a href="#/careers">Vacant positions</a>
        <a href="#/careers">Ambassadors</a>
        <a href="#/careers">Creator partners</a>
      </div>
      <div>
        <strong>Demo note</strong>
        <p>Brooke, Atlas, and Jaylen are fictional demonstration accounts. Their grades, schools, relationships, schedules, and posts are mock data.</p>
      </div>
      <small>© {new Date().getFullYear()} EdNotebook · Transform Ontology Systems</small>
    </footer>
  );
}

function PersonaCard({ persona, featured = false }) {
  return (
    <article className={cx("persona-card", featured && "is-featured")}>
      <div className="persona-photo-wrap">
        <img src={persona.image} alt={`${persona.name}, fictional EdNotebook ${persona.accountType.toLowerCase()} mascot`} />
        <OnlineBadge value={persona.status} />
      </div>
      <div className="persona-card-copy">
        <NotebookLabel>{persona.accountType}</NotebookLabel>
        <h3>{persona.name}</h3>
        <VerifiedBadge label={persona.verifiedTitle} small />
        <p>{persona.profile.bio}</p>
        <div className="persona-tags">{persona.profile.traits.slice(0, 4).map((trait) => <span key={trait}>{trait}</span>)}</div>
        <a href={`#/tour/${persona.id}`}>{persona.id === "student" ? "Tour with Brooke" : `Open ${persona.shortName}'s demo`}<span aria-hidden="true">→</span></a>
      </div>
    </article>
  );
}

function DemoLanding() {
  return (
    <div className="demo-page demo-landing-page">
      <DemoNav active="tour" />
      <main>
        <section className="demo-hero">
          <div className="demo-hero-copy">
            <NotebookLabel>INTERACTIVE PRODUCT TOUR</NotebookLabel>
            <h1>Meet Brooke. See your semester in one clear view.</h1>
            <p>Choose a student or professor demo and click around. Brooke moves the tour to each feature so you can try it before continuing.</p>
            <div className="demo-hero-actions">
              <a className="demo-primary" href="#/tour/student">Start with Brooke</a>
              <a className="demo-secondary" href="#/presentation">Open the presentation</a>
            </div>
            <div className="demo-hero-points">
              <span>✓ Syllabus-to-calendar</span>
              <span>✓ Busy-day alerts</span>
              <span>✓ Workspace assistant</span>
              <span>✓ Private sharing controls</span>
            </div>
          </div>
          <div className="brooke-guide-card">
            <img src={PERSONAS.student.image} alt="Brooke, the EdNotebook tour guide" />
            <div>
              <span className="hand-note">“Let’s see where everything is. You can try each part as we go.”</span>
              <strong>Brooke · your tour guide</strong>
              <p>Brooke keeps the tour friendly, clear, and practical.</p>
            </div>
          </div>
        </section>

        <section className="demo-section persona-section">
          <div className="demo-section-heading">
            <NotebookLabel>THREE DEMONSTRATION ACCOUNTS</NotebookLabel>
            <h2>See EdNotebook from each point of view.</h2>
            <p>Open a university student, K–12 student, or professor workspace. Each one is ready to explore.</p>
          </div>
          <div className="persona-grid">
            <PersonaCard persona={PERSONAS.student} featured />
            <PersonaCard persona={PERSONAS.k12} />
            <PersonaCard persona={PERSONAS.professor} />
          </div>
        </section>

        <section className="demo-section platform-preview-section">
          <div className="demo-section-heading">
            <NotebookLabel>HOW THE TOUR WORKS</NotebookLabel>
            <h2>Brooke takes you to the feature, then lets you try it.</h2>
          </div>
          <div className="workflow-grid">
            {[
              ["01", "Move", "Each tour slide opens the right section and brings it into view."],
              ["02", "Highlight", "An outline and arrow show exactly what Brooke is describing."],
              ["03", "Try it", "The page stays active, so you can click, type, and explore before moving on."],
              ["04", "Continue", "Next and Previous let you move at your own pace."],
              ["05", "Ask", "The workspace assistant can look through the material saved in the demo."],
              ["06", "Explore", "Community, personal page, and story open in a full-screen space without leaving your dashboard."],
            ].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className="demo-section literacy-band">
          <div>
            <NotebookLabel>AVAILABLE TO ALL STUDENTS</NotebookLabel>
            <h2>Digital literacy and financial literacy do not depend on a teacher joining.</h2>
            <p>Both learning paths remain available in independent student mode and can be used alongside any school’s classes.</p>
          </div>
          <div className="literacy-mini-grid">
            {CORE_LEARNING.map((course) => <article key={course.id}><span>{course.badge}</span><h3>{course.title}</h3><p>{course.description}</p><strong>{course.lessons} practical lessons</strong></article>)}
          </div>
        </section>

        <section className="demo-section trust-section">
          <article>
            <NotebookLabel>HUMAN VERIFICATION</NotebookLabel>
            <h2>A badge means a human confirmed the educational relationship.</h2>
            <p>Verified students are actively enrolled. They may be confirmed by a verified professor, teacher, counselor, or school contact. Verification is manual and may require EdNotebook’s liaison team to contact the educator or institution.</p>
          </article>
          <article>
            <NotebookLabel>CONTROL</NotebookLabel>
            <h2>Verification does not turn the profile into an automatic transcript.</h2>
            <p>Students choose which cards appear. Grades do not enter the social feed automatically. K–12 and university audiences remain separate, and private class records keep their own access boundaries.</p>
          </article>
        </section>
      </main>
      <DemoFooter />
    </div>
  );
}

export {
  cx, safeRead, dateKey, formatDate, formatDateTime, dueLabel, statusLabel, nextAssignmentStatus, iconForType, routeSection,
  DemoNav, VerifiedBadge, OnlineBadge, NotebookLabel, DemoFooter, DemoLanding,
};
