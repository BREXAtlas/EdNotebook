import { useEffect, useRef } from "react";
import BrandLogo, { BrandMark } from "./Brand.jsx";
import FeaturedProductExperience from "./portal/FeaturedProductExperience.jsx";
import FeatureFinder from "./FeatureFinder.jsx";

const CREATOR_STEPS = [
  {
    number: "01",
    title: "Create the course shape",
    text: "Scan a syllabus or paste your notes, choose a learning structure, and turn the source into an editable course map on this device.",
  },
  {
    number: "02",
    title: "Refine every lesson",
    text: "Edit the sections, set quiz and knowledge-check counts, shorten a draft, add an example, and preview the lesson as a student.",
  },
  {
    number: "03",
    title: "Share it your way",
    text: "Review the complete course, export standalone HTML, prepare a class invitation, or publish a broadcast link when cloud sharing is configured.",
  },
];

const CONTENT_TYPES = [
  {
    icon: "T",
    title: "Text that stays editable",
    text: "Build section-based lessons, assignment templates, readings, source notes, headings, and structured papers without locking your content into a generated result.",
  },
  {
    icon: "V",
    title: "Visual material in context",
    text: "Add images, documents, video links, slide layouts, alt text, and visual directions beside the lesson where students will use them.",
  },
  {
    icon: "I",
    title: "Interactive learning moments",
    text: "Place knowledge checks and quizzes inside lessons, run class polls and challenges, and preview the full student path before sharing it.",
  },
];

const EDITING_ACTIONS = [
  ["Edit any section", "Works now"],
  ["Make a section shorter", "Works now"],
  ["Add an example prompt", "Works now"],
  ["Increase the challenge", "Works now"],
  ["Create quiz and check templates", "Works now"],
  ["Improve writing with connected AI", "Coming soon"],
  ["Make writing longer with connected AI", "Coming soon"],
  ["Grammar and tone refinement", "Coming soon"],
  ["Generate topic-specific questions", "Coming soon"],
];

const CAPABILITY_ROWS = [
  ["Syllabus review", "PDF, DOCX, text, Markdown, CSV, pasted text, and scanned pages flow into an editable review.", "Works now"],
  ["Course structure", "Five learning patterns, lesson counts, quiz counts, knowledge-check counts, and a readable course map.", "Works now"],
  ["Lesson editing", "Section editing, undo and redo, editing directions, and student preview.", "Works now"],
  ["Advanced customization", "Themes, learning patterns, course order, section content, lesson timing, visual directions, and publishing appearance.", "Works now"],
  ["Course sharing", "Standalone HTML export and local preview work now; deployed broadcast and enrollment links require the connected backend.", "Setup required"],
  ["AI course creator", "A configured model connection will add generative drafting and refinement inside the same professor-review workflow.", "Coming soon"],
  ["AI writing refinements", "Improve, expand, condense, correct grammar, change tone, and draft topic-specific questions through a connected provider.", "Coming soon"],
  ["AI visuals and translation", "Generate lesson visuals, captions, and translated course variants after provider and review controls are connected.", "Coming soon"],
];

const FAQS = [
  [
    "Is the course creator using a hosted AI model today?",
    "Not in the current public preview. The working creator uses a deterministic on-device organizer so you can build and edit a course now. Connected AI drafting and refinement are labeled Coming soon until a provider is configured.",
  ],
  [
    "What can I try before creating an account?",
    "You can open the syllabus scanner, build a lesson starter, edit the result, and take Atlas's professor tour. Create a free account when you want to keep the work and connect it to classes.",
  ],
  [
    "Can students see a draft immediately?",
    "No. The course map, lessons, suggested grading work, and sharing choices stay in review until the professor approves the next step.",
  ],
  [
    "Can I use a course outside EdNotebook?",
    "The publishing studio includes standalone HTML export and a course preview. Broadcast and automatic enrollment links become live after the cloud publishing services are deployed.",
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

export default function Landing({ onEnter, onSignup, onDashboard }) {
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    function openRequestedSection() {
      const section = new URLSearchParams(window.location.hash.split("?")[1] || "").get("section");
      if (section) window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    openRequestedSection();
    window.addEventListener("hashchange", openRequestedSection);
    return () => window.removeEventListener("hashchange", openRequestedSection);
  }, []);

  return (
    <div className="landing-page professor-creator-landing">
      <header className="landing-nav">
        <a className="landing-brand" href="#/" aria-label="EdNotebook home">
          <BrandLogo size={42} tagline="Create, teach, and share from one place" />
        </a>
        <nav aria-label="Professor landing navigation">
          <button type="button" onClick={() => goTo("creator-workflow")}>How it works</button>
          <button type="button" onClick={() => goTo("creator-content")}>Content tools</button>
          <button type="button" onClick={() => goTo("creator-status")}>What works now</button>
          <FeatureFinder audience="professor" />
        </nav>
        <button className="nav-cta" type="button" onClick={onDashboard} data-motion="true">
          Educator sign in
        </button>
      </header>

      <main>
        <FeaturedProductExperience audience="professor" onSignup={onSignup} />

        <section className="landing-hero">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="landing-shell hero-grid">
            <div className="hero-copy">
              <div className="hero-eyebrow"><span>COURSE CREATOR NOW</span> · CONNECTED AI REFINEMENT COMING SOON</div>
              <h1>Turn what you teach into a course students can follow.</h1>
              <p className="hero-lead">
                Start with a syllabus, notes, or an outline. EdNotebook organizes the material into an editable course map, keeps every lesson under professor review, and carries the same work into preview, export, and class sharing. No design background required.
              </p>
              <div className="hero-actions">
                <button className="landing-primary" type="button" onClick={onSignup} data-motion="true">
                  Create free educator account
                  <span aria-hidden="true">→</span>
                </button>
                <button className="landing-secondary" type="button" onClick={() => { window.location.hash = "#/tour/professor"; }}>
                  Take the Atlas tour
                </button>
              </div>
              <div className="hero-proof" aria-label="Course creator principles">
                <span>✓ Edit every result</span>
                <span>✓ Preview as a student</span>
                <span>✓ Professor approves sharing</span>
              </div>
              <p className="creator-truth-note">
                The current creator uses an on-device organizer, not a hosted generative model. Connected AI drafting and refinement are clearly marked Coming soon.
              </p>
            </div>

            <div className="hero-visual" aria-label="EdNotebook course creation preview">
              <div className="hero-image-card">
                <img
                  src="/landing/landing-professor-planning.png"
                  alt="Professor planning a course with books, notes, and a laptop"
                  width="1536"
                  height="1024"
                />
                <div className="hero-image-overlay">
                  <BrandMark size={34} />
                  <div>
                    <small>EDNOTEBOOK COURSE CREATOR</small>
                    <strong>Create · Refine · Share</strong>
                  </div>
                  <span>You approve</span>
                </div>
              </div>
              <div className="floating-course-card floating-card-one">
                <span>1</span>
                <div><small>START WITH</small><strong>Your syllabus or notes</strong></div>
              </div>
              <div className="floating-course-card floating-card-two">
                <span>3</span>
                <div><small>FINISH WITH</small><strong>A student-ready preview</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-row" aria-label="EdNotebook course creation targets">
          <div className="landing-shell trust-grid">
            <div><strong>~60 sec</strong><span>syllabus review target</span></div>
            <div><strong>&lt;5 min</strong><span>first lesson starter target</span></div>
            <div><strong>3</strong><span>create, refine, share stages</span></div>
            <div><strong>1</strong><span>professor approval layer</span></div>
          </div>
        </section>

        <section id="creator-workflow" className="landing-section course-path-section">
          <div className="landing-shell">
            <Reveal className="section-intro">
              <div className="section-kicker">HOW THE CREATOR WORKS</div>
              <h2>From source material to a teachable course in three clear moves.</h2>
              <p>
                The fast path is easy to see, but nothing is automatic in the risky sense. Your source stays visible, every lesson stays editable, and sharing waits for your review.
              </p>
            </Reveal>

            <div className="course-path-grid creator-three-step-grid">
              {CREATOR_STEPS.map((step, index) => (
                <Reveal key={step.number} className={`path-card reveal-delay-${index + 1}`}>
                  <div className="path-card-top">
                    <span>{step.number}</span>
                    <i aria-hidden="true">{index === CREATOR_STEPS.length - 1 ? "✓" : "→"}</i>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              ))}
            </div>

            <div className="path-cta-row creator-path-actions">
              <button className="landing-primary" type="button" onClick={onEnter} data-motion="true">
                Open the full course builder
                <span aria-hidden="true">→</span>
              </button>
              <a href="#/professors?tool=lesson">Try a lesson before signing in</a>
            </div>
          </div>
        </section>

        <section id="creator-content" className="landing-section features-section">
          <div className="landing-shell">
            <Reveal className="section-intro centered-intro">
              <div className="section-kicker">TEXT · VISUAL · INTERACTIVE</div>
              <h2>Build the kind of lesson your subject needs.</h2>
              <p>Keep the content, activity, and student experience together instead of moving the course through separate tools.</p>
            </Reveal>
            <div className="feature-grid creator-content-grid">
              {CONTENT_TYPES.map((feature, index) => (
                <Reveal key={feature.title} className={`feature-card reveal-delay-${index + 1}`}>
                  <div className="feature-icon" aria-hidden="true">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section creator-refinement-section" aria-labelledby="refinement-heading">
          <div className="landing-shell creator-refinement-grid">
            <Reveal className="creator-refinement-copy">
              <div className="section-kicker">CREATION AND EDITING THAT STAY UNDER YOUR CONTROL</div>
              <h2 id="refinement-heading">Start fast. Then make every part sound like you.</h2>
              <p>
                EdNotebook separates the tools you can use now from connected AI refinements that are still being prepared. That way, a button never promises a model action that is not actually connected.
              </p>
              <div className="editor-action-list" aria-label="Course editing actions">
                {EDITING_ACTIONS.map(([label, status]) => (
                  <div className={status === "Works now" ? "is-live" : "is-coming"} key={label}>
                    <strong>{label}</strong><span>{status}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal className="creator-customization-card">
              <span className="section-kicker">ADVANCED CUSTOMIZATION</span>
              <h3>Change the structure without rebuilding the course.</h3>
              <ul>
                <li><strong>Five learning patterns</strong><span>Ram Ready, Story, Lab, Drill, and Seminar</span></li>
                <li><strong>Flexible volume</strong><span>Set lesson, quiz, and knowledge-check counts</span></li>
                <li><strong>Editable course map</strong><span>Review the full order before opening individual lessons</span></li>
                <li><strong>Student preview</strong><span>Test pacing, checks, explanations, and completion flow</span></li>
                <li><strong>Publishing appearance</strong><span>Choose a limited theme, font, color, and standalone export</span></li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="creator-status" className="landing-section creator-status-section">
          <div className="landing-shell">
            <Reveal className="section-intro">
              <div className="section-kicker">WHAT WORKS NOW · WHAT COMES NEXT</div>
              <h2>A course creator you can evaluate without guessing.</h2>
              <p>Use the status column to distinguish working product behavior, deployment-dependent features, and the connected AI work that is still ahead.</p>
            </Reveal>
            <div className="creator-status-table-wrap">
              <table className="creator-status-table">
                <thead><tr><th scope="col">Capability</th><th scope="col">What it does</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {CAPABILITY_ROWS.map(([capability, description, status]) => (
                    <tr key={capability}>
                      <th scope="row">{capability}</th>
                      <td>{description}</td>
                      <td><span className={status === "Works now" ? "is-live" : status === "Setup required" ? "is-setup" : "is-coming"}>{status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="landing-section governance-section">
          <div className="landing-shell governance-card">
            <Reveal className="governance-copy">
              <div className="section-kicker light-kicker">YOUR EXPERTISE STAYS IN CHARGE</div>
              <h2>Suggestions stop at review. Professors decide what becomes the course.</h2>
              <p>
                The creator can organize the source and prepare editable starters. You choose the examples, evidence, questions, grade settings, audience, and moment the work is shared.
              </p>
              <div className="governance-tags">
                <span>Editable source</span><span>Professor review</span><span>Student preview</span><span>Controlled sharing</span>
              </div>
            </Reveal>
            <Reveal className="governance-panel">
              <div className="policy-row"><span>Course structure</span><strong>Editable map</strong></div>
              <div className="policy-row"><span>Lesson result</span><strong>Draft until reviewed</strong></div>
              <div className="policy-row"><span>Student view</span><strong>Preview before release</strong></div>
              <div className="policy-row"><span>Publish authority</span><strong>Professor / Admin</strong></div>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="landing-section faq-section">
          <div className="landing-shell faq-grid">
            <Reveal className="faq-heading">
              <div className="section-kicker">BEFORE YOU CREATE</div>
              <h2>Try the working creator. See the roadmap separately.</h2>
              <p>The public preview lets you test the core workflow before you decide whether to create an account.</p>
              <button className="landing-primary" type="button" onClick={onSignup} data-motion="true">
                Create free educator account
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
              <div className="section-kicker light-kicker">READY TO MAKE THE FIRST DRAFT?</div>
              <h2>Bring the syllabus. Leave with a course you can keep shaping.</h2>
              <p>Try the scanner and lesson starter first, tour the professor workspace with Atlas, or create a free educator account.</p>
            </div>
            <button className="gold-cta" type="button" onClick={onSignup} data-motion="true">
              Create free account <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
