import { useEffect, useRef } from "react";
import BrandLogo, { BrandMark } from "./Brand.jsx";

const COURSE_STEPS = [
  {
    number: "1 / 6",
    title: "Create the course",
    text: "Name the class, identify the learners, and choose the teaching window before opening the builder.",
  },
  {
    number: "2 / 6",
    title: "Add source content",
    text: "Bring a syllabus, lecture notes, learning outcomes, readings, or an existing outline.",
  },
  {
    number: "3 / 6",
    title: "Choose the learning design",
    text: "Use Ram Ready, Story, Lab, Drill, or Seminar and set the lesson and assessment counts.",
  },
  {
    number: "4 / 6",
    title: "Generate and review",
    text: "Build the course map, open every lesson, edit sections, and approve the academic structure.",
  },
  {
    number: "5 / 6",
    title: "Preview as a learner",
    text: "Experience the pacing, checks, quiz reasoning, XP, badges, and completion flow yourself.",
  },
  {
    number: "6 / 6",
    title: "Publish and invite",
    text: "Move the course from sandbox to live and bring learners in only when it is ready.",
  },
];

const FEATURES = [
  {
    icon: "✦",
    title: "Structured course creation",
    text: "Turn source material into acts, lessons, knowledge checks, quizzes, timing, and an editable content map.",
  },
  {
    icon: "◫",
    title: "Professor-controlled suggestions",
    text: "Draft a course, lesson, or grade for review, then edit and approve it before anything reaches students.",
  },
  {
    icon: "↗",
    title: "A learner experience that moves",
    text: "Quest maps, progress, streaks, badges, and focus mode give rigorous material a clear path forward.",
  },
  {
    icon: "✓",
    title: "Governance made visible",
    text: "Roles, ownership, budget controls, clear data boundaries, and reviewable workflows live in one admin view.",
  },
  {
    icon: "¶",
    title: "Writing without ghostwriting",
    text: "The coach diagnoses weak paragraphs, missing citations, and formatting issues, then gives an exercise instead of rewriting the student’s work.",
  },
  {
    icon: "◎",
    title: "One design across every role",
    text: "Professor, learner, administrator, and owner views share themes, navigation patterns, and the same course model.",
  },
];

const FAQS = [
  [
    "What should I add first?",
    "Start by creating the course shell. EdNotebook then labels every remaining stage from 2 of 6 through 6 of 6, so source content is never mistaken for the first step.",
  ],
  [
    "Can suggested work publish directly to students?",
    "No. Course creation and grading are review workflows. The professor edits and approves the work before a course goes live or a grade is posted.",
  ],
  [
    "Can I use my existing syllabus?",
    "Yes. Paste the syllabus, outcomes, lecture notes, readings, or a compact outline. The clearer the learner level, destination, and constraints, the more useful the generated structure becomes.",
  ],
  [
    "Is EdNotebook an LMS replacement?",
    "The prototype is focused on course creation, interactive delivery, writing support, grading review, and governance. SIS, SSO, and deep LMS integrations belong to the institutional deployment layer.",
  ],
];

function Reveal({ children, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-block ${className}`.trim()}>
      {children}
    </div>
  );
}

export default function Landing({ onEnter, onDashboard, onStudentPortal, onPublishingPortal }) {
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#/" aria-label="EdNotebook home">
          <BrandLogo size={42} tagline="Build courses learners can finish" />
        </a>
        <nav aria-label="Primary navigation">
          <button type="button" onClick={() => goTo("course-path")}>How it works</button>
          <button type="button" onClick={() => goTo("features")}>Features</button>
          <button type="button" onClick={() => goTo("faq")}>FAQ</button>
          <button type="button" onClick={onStudentPortal}>Student portal</button>
          <button type="button" onClick={onPublishingPortal}>Publishing portal</button>
        </nav>
        <button className="nav-cta" type="button" onClick={onDashboard} data-motion="true">
          Professor sign in
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="landing-shell hero-grid">
            <div className="hero-copy">
              <div className="hero-eyebrow"><span>COURSE BUILDER</span> FOR PROFESSORS & UNIVERSITIES</div>
              <h1>Create the course first. Then build it step by step.</h1>
              <p className="hero-lead">
                EdNotebook turns source material into an interactive university course while keeping the professor in control.
                A numbered six-step path takes you from a course shell to learner preview and publication.
              </p>
              <div className="hero-actions">
                <button className="landing-primary" type="button" onClick={onEnter} data-motion="true">
                  Start Step 1 — create a course
                  <span aria-hidden="true">→</span>
                </button>
                <button className="landing-secondary" type="button" onClick={() => goTo("course-path")}>
                  See all six steps
                </button>
              </div>
              <div className="hero-proof" aria-label="Product principles">
                <span>✓ Free course shell</span>
                <span>✓ Professor approval</span>
                <span>✓ Learner preview</span>
              </div>
            </div>

            <div className="hero-visual" aria-label="EdNotebook course creation preview">
              <div className="hero-image-card">
                <img
                  src="/landing/landing-professor-planning.png"
                  alt="Professor planning a course with books, notes, and a laptop"
                  width="1536"
                  height="1024"
                  fetchPriority="high"
                />
                <div className="hero-image-overlay">
                  <BrandMark size={34} />
                  <div>
                    <small>COURSE JOURNEY</small>
                    <strong>Step 1 of 6</strong>
                  </div>
                  <span>Create course</span>
                </div>
              </div>
              <div className="floating-course-card floating-card-one">
                <span>1</span>
                <div><small>FIRST STEP</small><strong>Name the course</strong></div>
              </div>
              <div className="floating-course-card floating-card-two">
                <span>6</span>
                <div><small>FINAL STEP</small><strong>Publish & invite</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-row" aria-label="EdNotebook workflow highlights">
          <div className="landing-shell trust-grid">
            <div><strong>6</strong><span>clear creation steps</span></div>
            <div><strong>5</strong><span>learning templates</span></div>
            <div><strong>4</strong><span>role-based views</span></div>
            <div><strong>1</strong><span>professor approval layer</span></div>
          </div>
        </section>

        <section id="course-path" className="landing-section course-path-section">
          <div className="landing-shell">
            <Reveal className="section-intro">
              <div className="section-kicker">HOW EDNOTEBOOK WORKS</div>
              <h2>No guessing. The product tells you the next step.</h2>
              <p>
                Course creation starts with the class itself—not a blank prompt. Each stage is numbered from 1 of 6 until the course is published.
              </p>
            </Reveal>

            <div className="course-path-grid">
              {COURSE_STEPS.map((step, index) => (
                <Reveal key={step.number} className={`path-card reveal-delay-${(index % 3) + 1}`}>
                  <div className="path-card-top">
                    <span>{step.number}</span>
                    <i aria-hidden="true">{index === COURSE_STEPS.length - 1 ? "✓" : "→"}</i>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              ))}
            </div>

            <div className="path-cta-row">
              <button className="landing-primary" type="button" onClick={onEnter} data-motion="true">
                Begin with Step 1
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>

        <section className="landing-section story-section">
          <div className="landing-shell story-grid">
            <Reveal className="story-image-wrap">
              <img
                src="/landing/landing-professor-seminar.png"
                alt="Professor guiding an engaged small university seminar"
                width="1536"
                height="1024"
                loading="lazy"
              />
              <div className="story-image-note">
                <strong>Teach first.</strong>
                <span>Technology supports the instructional decision; it does not replace it.</span>
              </div>
            </Reveal>

            <Reveal className="story-copy">
              <div className="section-kicker">RIGOROUS CONTENT · CLEAR WRAPPER</div>
              <h2>Built around the work professors already do.</h2>
              <p>
                EdNotebook starts with your subject matter, outcomes, readings, assessments, and constraints. It then helps organize that work into a course students can navigate.
              </p>
              <ul className="check-list">
                <li><span>01</span><div><strong>Source-aware structure</strong><p>Keep the syllabus and learning outcomes at the center of the build.</p></div></li>
                <li><span>02</span><div><strong>Editable before deploy</strong><p>Read the whole map, revise individual lessons, and preview the learner experience.</p></div></li>
                <li><span>03</span><div><strong>Approval before action</strong><p>Generated courses and suggested grades remain drafts until a professor decides otherwise.</p></div></li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="features" className="landing-section features-section">
          <div className="landing-shell">
            <Reveal className="section-intro centered-intro">
              <div className="section-kicker">ONE PLATFORM · EVERY ROLE</div>
              <h2>Course building, learning, grading, and governance stay connected.</h2>
            </Reveal>
            <div className="feature-grid">
              {FEATURES.map((feature, index) => (
                <Reveal key={feature.title} className={`feature-card reveal-delay-${(index % 3) + 1}`}>
                  <div className="feature-icon" aria-hidden="true">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section governance-section">
          <div className="landing-shell governance-card">
            <Reveal className="governance-copy">
              <div className="section-kicker light-kicker">THE OWNERSHIP LAYER</div>
              <h2>Designed for the questions institutions ask before they buy.</h2>
              <p>
                Who owns the course? Which tools are allowed? What can be suggested? Who approves a grade? How is learner data separated from public content?
                EdNotebook makes those decisions visible instead of burying them inside a workflow.
              </p>
              <div className="governance-tags">
                <span>Role controls</span><span>Usage budget</span><span>Professor approval</span><span>Scoped data access</span>
              </div>
            </Reveal>
            <Reveal className="governance-panel">
              <div className="policy-row"><span>Course owner</span><strong>Professor</strong></div>
              <div className="policy-row"><span>Grade status</span><strong>Suggested · not posted</strong></div>
              <div className="policy-row"><span>Learner records</span><strong>Authenticated access</strong></div>
              <div className="policy-row"><span>Publish authority</span><strong>Professor / Admin</strong></div>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="landing-section faq-section">
          <div className="landing-shell faq-grid">
            <Reveal className="faq-heading">
              <div className="section-kicker">QUESTIONS BEFORE STEP 1</div>
              <h2>Start with a clear course shell, not a blank canvas.</h2>
              <p>Open the builder free, create the class, and follow the numbered path.</p>
              <button className="landing-primary" type="button" onClick={onEnter} data-motion="true">
                Create a course
                <span aria-hidden="true">→</span>
              </button>
            </Reveal>
            <div className="faq-list">
              {FAQS.map(([question, answer], index) => (
                <Reveal key={question} className={`reveal-delay-${(index % 2) + 1}`}>
                  <details>
                    <summary>{question}<span aria-hidden="true">+</span></summary>
                    <p>{answer}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta-section">
          <div className="landing-shell final-cta-card">
            <BrandMark size={58} inverse />
            <div>
              <div className="section-kicker light-kicker">READY TO BEGIN?</div>
              <h2>Step 1 of 6: create your course.</h2>
              <p>Name the class now. Add content and choose the learning design next.</p>
            </div>
            <button className="gold-cta" type="button" onClick={onEnter} data-motion="true">
              Create course <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell footer-grid">
          <div>
            <BrandLogo inverse size={40} tagline="Course creation with professor control" />
            <p>Transform source material into an interactive course through a clear, reviewable workflow.</p>
          </div>
          <div>
            <strong>Product</strong>
            <button type="button" onClick={() => goTo("course-path")}>Course journey</button>
            <button type="button" onClick={() => goTo("features")}>Features</button>
            <button type="button" onClick={onEnter}>Sign in</button>
          </div>
          <div>
            <strong>Open image credits</strong>
            <a href="https://commons.wikimedia.org/wiki/File:Virtual_Learning_Student_Illustration.jpg" target="_blank" rel="noreferrer">Virtual learning illustration · Digits.co.uk Images · CC BY 2.0</a>
            <a href="https://commons.wikimedia.org/wiki/File:Instructor_speaking_to_students_in_classroom.jpg" target="_blank" rel="noreferrer">Classroom photo · Ryan Hagerty / USFWS · Public domain</a>
          </div>
        </div>
        <div className="landing-shell footer-bottom">
          <span>© {new Date().getFullYear()} EdNotebook</span>
          <span>Built by Transform Ontology Systems</span>
        </div>
      </footer>
    </div>
  );
}
