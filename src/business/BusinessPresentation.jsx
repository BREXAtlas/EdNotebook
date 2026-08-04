import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "../Brand.jsx";
import { scrollWithinHashRoute } from "../scrollWithinHashRoute.js";
import "./business-presentation.css";

const PROOF_AREAS = [
  {
    number: "01",
    title: "Professors and teachers adopt",
    statement: "The first sale",
    copy: "EdNotebook earns its place by reducing the work educators already carry: building the course, organizing the syllabus, answering repeated questions, managing assignments, communicating, and showing what students learned.",
    features: ["Upload a syllabus once", "Create assignments and rubrics", "Preview the student experience", "Send announcements that reach the class", "Connect work to learning outcomes"],
    metrics: ["Time to first course", "First assignment created", "Weekly educator return", "Reduction in repeated questions"],
  },
  {
    number: "02",
    title: "Students return",
    statement: "Proof of daily usefulness",
    copy: "Students return when the platform answers a real question today: what is due, where is the material, what did the professor say, and what should I do next?",
    features: ["See what is due next", "Keep one course calendar", "Open materials in context", "Read, take notes, and research", "Work with classmates when allowed"],
    metrics: ["Day-7 return", "Day-30 return", "Weekly active students", "Assignment completion"],
  },
  {
    number: "03",
    title: "Institutions trust",
    statement: "The path to durable contracts",
    copy: "Institutional use depends on dependable records, controlled access, safe files, accessibility, privacy choices, clear support, and reports leaders can use.",
    features: ["Separate each institution's records", "Check files before they open", "Record important actions", "Manage retention and legal holds", "Connect to existing education systems"],
    metrics: ["Pilot renewal", "Security findings closed", "Department expansion", "Support response time"],
  },
  {
    number: "04",
    title: "Learning outcomes improve",
    statement: "The evidence that makes the platform valuable",
    copy: "The long-term advantage is a clear line from what a course intended to teach to what students did, what evidence they produced, what support they received, and what changed afterward.",
    features: ["Define learning outcomes", "Connect work to outcomes", "Track evidence over time", "Record interventions", "Create quantitative and qualitative reports"],
    metrics: ["Mastery improvement", "Course completion", "Missing-work reduction", "Intervention response"],
  },
];

const REVENUE = [
  { name: "Students", values: [25000, 250000, 1200000, 3500000, 7500000] },
  { name: "Professors", values: [40000, 250000, 900000, 2300000, 5000000] },
  { name: "Higher education", values: [75000, 500000, 2200000, 6000000, 12000000] },
  { name: "K–12", values: [0, 100000, 750000, 3000000, 8000000] },
  { name: "Publishing", values: [20000, 250000, 1300000, 4300000, 10000000] },
  { name: "Evidence & research", values: [20000, 150000, 750000, 2000000, 4000000] },
  { name: "Implementation & training", values: [50000, 300000, 900000, 1700000, 2500000] },
  { name: "Careers", values: [0, 50000, 250000, 750000, 1500000] },
];

const TOTALS = [230000, 1850000, 8250000, 23550000, 50500000];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"];

const DIVISIONS = [
  ["Professor & teacher", "The first adoption engine: courses, pilots, subscriptions, training, and department plans."],
  ["Student", "Daily value, course activity, optional premium tools, books, referrals, and future career services."],
  ["Higher education", "Annual licenses, implementation, integrations, support, reporting, and long-term institutional expansion."],
  ["Alex B. Morrison Library", "Professor-authored books, interactive readings, rentals, sales, course distribution, and publisher services."],
  ["Evidence & research", "Learning outcomes, reports, surveys, program evaluation, approved research, and data visualization."],
  ["K–12", "A later controlled expansion after higher-education proof, child-safety maturity, and district readiness."],
];

const FEATURE_GROUPS = [
  {
    title: "Ready to demonstrate now",
    tone: "ready",
    items: [
      "Choose a student, professor, or publishing starting point (public portal shell)",
      "Create a course through a guided six-step path (course journey)",
      "Experience prepared student and professor demonstrations (demo workspaces)",
      "Build assignments and custom rubrics (assignment workspace)",
      "Organize files, links, images, quotes, and videos (materials studio)",
      "Read and annotate interactive books (EduBook reader)",
      "Create tables, concept maps, and subject tools (learning tools)",
      "Create and arrange presentations (EdSlides studio)",
      "Use private browser-only notes (device notebook)",
    ],
  },
  {
    title: "Built in part and being connected",
    tone: "connecting",
    items: [
      "Upload a syllabus and turn dates into a usable course plan (syllabus extraction)",
      "Keep course messages in one controlled place (cloud course room)",
      "Send professor announcements and track delivery honestly (announcement system)",
      "Manage student social spaces safely (community feed)",
      "Review messages, complaints, warnings, and appeals (admin communications center)",
      "Check files before learners can open them (malware scanning and quarantine)",
      "Generate safe previews of documents and books (server previews)",
      "Grant free, sponsored, and founding access (entitlement management)",
      "Publish Markdown books into the library (Markdown-to-EduBook workflow)",
      "Connect assignments and rubrics to learning outcomes (evidence mapping)",
    ],
  },
  {
    title: "Preserved but hidden until later",
    tone: "later",
    items: [
      "Book office-hour appointments automatically (scheduling)",
      "Work together in a shared assignment space (live collaboration)",
      "Search and compare scholarly papers (Discover)",
      "Build a research notebook from selected documents (Discover Notebook)",
      "Receive native phone notifications and Due-Next widgets (Capacitor mobile features)",
      "Join a course section and trigger class-forming invitations (section network)",
      "Unlock nonessential perks by inviting classmates (referral entitlements)",
      "Create advanced reports and visualizations (Evidence Studio)",
      "Offer chapter-level publisher supplements (publisher distribution)",
    ],
  },
  {
    title: "Planned after proof and partnerships",
    tone: "planned",
    items: [
      "Connect deeply with university learning systems (LTI and SIS integrations)",
      "Offer institution-wide analytics and accreditation evidence (institution reporting)",
      "Operate a full book and educational-supplies marketplace (marketplace)",
      "Launch district-ready K–12 programs (district platform)",
      "Match students with careers using consented evidence (career services)",
      "Support private branded deployments for large institutions (enterprise deployment)",
    ],
  },
];

const IP = [
  ["Interactive educational books", "EduBook", "Publishing, training, certification, healthcare and professional education"],
  ["Structured presentations", "EdSlides", "Corporate training, conferences, research communication"],
  ["Learning evidence connections", "Learning Evidence Graph", "Workforce development, competency systems, certification"],
  ["Guided course creation", "Course Forge", "Onboarding, compliance, nonprofit and professional training"],
  ["Research notebook", "Discover Notebook", "Biomedical, policy, legal and market research"],
  ["Evidence and report system", "Evidence Studio", "Program evaluation, business analytics and outcome studies"],
  ["Safe communication controls", "Communication control plane", "Communities, youth programs and workplace learning"],
  ["Secure document process", "Secure file pipeline", "Publishing, legal collaboration and research repositories"],
];

function money(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 ? 2 : 0)}M`;
  return `$${Math.round(value / 1000)}K`;
}

function RevenueChart() {
  const max = Math.max(...TOTALS);
  return (
    <div className="bp-chart-card">
      <div className="bp-chart-heading"><div><span>FIVE-YEAR BASE SCENARIO</span><h3>Revenue grows as the divisions reinforce one another.</h3></div><small>Internal planning scenario — not a guarantee.</small></div>
      <div className="bp-bars" aria-label="Five-year projected revenue">
        {TOTALS.map((total, index) => (
          <div className="bp-bar-column" key={YEARS[index]}>
            <strong>{money(total)}</strong>
            <div className="bp-bar-track"><i style={{ height: `${Math.max(4, (total / max) * 100)}%` }} /></div>
            <span>{YEARS[index]}</span>
          </div>
        ))}
      </div>
      <details><summary>View the planning data</summary><div className="bp-table-wrap"><table><thead><tr><th>Revenue stream</th>{YEARS.map((year) => <th key={year}>{year}</th>)}</tr></thead><tbody>{REVENUE.map((row) => <tr key={row.name}><th>{row.name}</th>{row.values.map((value, index) => <td key={`${row.name}-${index}`}>{money(value)}</td>)}</tr>)}<tr className="is-total"><th>Total</th>{TOTALS.map((value, index) => <td key={index}>{money(value)}</td>)}</tr></tbody></table></div></details>
    </div>
  );
}

function FourAreaFlow() {
  return <div className="bp-flywheel" aria-label="EdNotebook business flywheel">{PROOF_AREAS.map((area, index) => <div className="bp-flywheel-node" key={area.number}><span>{area.number}</span><strong>{area.title}</strong><small>{area.statement}</small>{index < PROOF_AREAS.length - 1 && <b aria-hidden="true">→</b>}</div>)}</div>;
}

export default function BusinessPresentation() {
  const [featureStatus, setFeatureStatus] = useState("all");
  const visibleFeatures = useMemo(() => featureStatus === "all" ? FEATURE_GROUPS : FEATURE_GROUPS.filter((group) => group.tone === featureStatus), [featureStatus]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "EdNotebook Business Presentation | Platform, Growth & Partnership";
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content") || "";
    description?.setAttribute("content", "Explore EdNotebook's professor-led growth strategy, student value, institutional path, learning-evidence model, revenue planning, publishing vision, and partnership opportunities.");
    return () => {
      document.title = previousTitle;
      description?.setAttribute("content", previousDescription);
    };
  }, []);

  return (
    <div className="bp-page">
      <header className="bp-nav"><a href="#/" className="bp-brand"><BrandMark size={40} /><span><strong>EdNotebook</strong><small>Business presentation</small></span></a><nav><a href="#four-areas" onClick={(event) => scrollWithinHashRoute(event, "four-areas")}>The strategy</a><a href="#features" onClick={(event) => scrollWithinHashRoute(event, "features")}>Feature map</a><a href="#financials" onClick={(event) => scrollWithinHashRoute(event, "financials")}>Financials</a><a href="#partnership" onClick={(event) => scrollWithinHashRoute(event, "partnership")}>Work with us</a></nav><a className="bp-nav-cta" href="#/professors">Explore EdNotebook</a></header>

      <main>
        <section className="bp-hero">
          <div className="bp-hero-copy"><span className="bp-kicker">PLATFORM · EVIDENCE · PUBLISHING</span><h1>Teaching starts the relationship.<br />Evidence builds the institution.</h1><p>EdNotebook connects course creation, student work, communication, educational content, publishing, and evidence of learning in one platform.</p><div className="bp-actions"><a href="#/professors">Open the live platform</a><a className="is-secondary" href="#partnership" onClick={(event) => scrollWithinHashRoute(event, "partnership")}>See where you could contribute</a></div><div className="bp-stage-note"><i /> Platform shell built · Core workflows are now being connected and tested</div></div>
          <div className="bp-hero-visual"><div className="bp-journey-line">{["Course plan", "Student activity", "Evidence", "Outcomes", "Institutional trust"].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>)}</div></div>
        </section>

        <section className="bp-focus-strip"><strong>The current discipline</strong><div>{["Preserve", "Finish", "Connect", "Test", "Simplify", "Reveal"].map((item, index) => <span key={item}>{item}{index < 5 && <b>→</b>}</span>)}</div><p>The next stage is not adding more feature categories. It is making the strongest journeys dependable enough for real educators and students.</p></section>

        <section id="four-areas" className="bp-section bp-proof-section"><div className="bp-section-heading"><span className="bp-kicker">THE FOUR-PART BUSINESS</span><h2>One platform, four proof obligations.</h2><p>Professor adoption starts the sale. Student return proves usefulness. Institutional trust creates durable contracts. Learning evidence proves value.</p></div><FourAreaFlow /><div className="bp-proof-grid">{PROOF_AREAS.map((area) => <article key={area.number}><span>{area.number} · {area.statement}</span><h3>{area.title}</h3><p>{area.copy}</p><div className="bp-card-columns"><div><strong>What users need</strong><ul>{area.features.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>What proves it</strong><ul>{area.metrics.map((item) => <li key={item}>{item}</li>)}</ul></div></div></article>)}</div></section>

        <section className="bp-section bp-current"><div className="bp-section-heading"><span className="bp-kicker">WHAT EXISTS TODAY</span><h2>A substantial platform shell—not an isolated prompt.</h2><p>Course building, student experiences, secure materials, assignments, interactive books, communication, publishing, and administration already have visible foundations. The work now is to connect and test them as one dependable experience.</p></div><div className="bp-current-grid">{[["Professor workspace", "Course creation, source materials, assignments, rubrics, learner preview, presentations and course communication."], ["Student workspace", "Course experience, assignments, reading, notes, learning tools, progress and research foundations."], ["Institution controls", "Accounts, private records, safe file handling, audit history, storage limits, retention and access controls."], ["Publishing", "Markdown-based book creation, interactive reading, publisher applications and the Alex B. Morrison Library direction."], ["Evidence", "Learning outcomes, assignment evidence, surveys, reports, qualitative analysis and research-governance foundations."]].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

        <section className="bp-section bp-digital"><div className="bp-digital-copy"><span className="bp-kicker">PROOF EXAMPLE</span><h2>The Digital Literacy Course shows how the model becomes a product.</h2><p>A structured course can become a reusable EdNotebook template, be customized by a professor, assigned to students, measured through evidence and feedback, and improved as a future edition.</p><div className="bp-pathway">{["Digital Literacy Course", "EdNotebook template", "Professor customization", "Student use", "Evidence & feedback", "Improved edition"].map((item, index) => <span key={item}>{item}{index < 5 && <b>→</b>}</span>)}</div><a href="https://brexatlas.github.io/Digital-Literacy-Course/" target="_blank" rel="noreferrer">Open the Digital Literacy Course ↗</a></div><div className="bp-digital-card"><strong>What it already demonstrates</strong><ul><li>A guided starting point</li><li>Structured chapters</li><li>Activities and checks</li><li>Progress and achievement</li><li>Accessible web delivery</li><li>A model reusable across subjects</li></ul></div></section>

        <section id="features" className="bp-section bp-features"><div className="bp-section-heading"><span className="bp-kicker">FEATURE ACTIVATION MAP</span><h2>Keep the full vision. Reveal it in stages.</h2><p>Repository presence does not automatically mean production readiness. The first experience stays focused while later capabilities remain preserved.</p></div><div className="bp-filter" role="group" aria-label="Filter features by status"><button className={featureStatus === "all" ? "is-active" : ""} onClick={() => setFeatureStatus("all")}>All</button>{FEATURE_GROUPS.map((group) => <button key={group.tone} className={featureStatus === group.tone ? "is-active" : ""} onClick={() => setFeatureStatus(group.tone)}>{group.title}</button>)}</div><div className="bp-feature-groups">{visibleFeatures.map((group) => <article className={`is-${group.tone}`} key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>

        <section className="bp-section bp-divisions"><div className="bp-section-heading"><span className="bp-kicker">PLATFORM DIVISIONS</span><h2>Each division makes the others more valuable.</h2></div><div className="bp-division-map">{DIVISIONS.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

        <section id="financials" className="bp-section bp-financials"><div className="bp-section-heading"><span className="bp-kicker">BUSINESS MODEL & FINANCIAL PLAN</span><h2>A multi-sided platform with recurring, service, publishing, and marketplace revenue.</h2><p>The early commercial wedge is professor-led higher education. Institution contracts are the destination; publishing and evidence create additional growth engines.</p></div><RevenueChart /><div className="bp-financial-grid"><article><span>CONSERVATIVE YEAR 5</span><strong>$10M–$18M</strong><p>Controlled adoption with slower institution and marketplace growth.</p></article><article><span>BASE YEAR 5</span><strong>$50.5M</strong><p>Professor-led adoption, institution expansion, publishing and evidence services.</p></article><article><span>GROWTH YEAR 5</span><strong>$100M–$200M</strong><p>Requires unusually strong contracts, retention, publishing and network effects.</p></article></div></section>

        <section className="bp-section bp-valuation"><div className="bp-section-heading"><span className="bp-kicker">VALUATION EVIDENCE LADDER</span><h2>Value rises when evidence replaces possibility.</h2><p>Illustrative internal planning ranges—not a formal appraisal.</p></div><div className="bp-ladder">{[["Working platform", "$500K–$2M"], ["Stable beta", "$2M–$5M"], ["Signed institutional pilot", "$4M–$8M"], ["$250K–$500K ARR + evidence", "$6M–$12M"], ["$1M ARR + growth", "$10M–$25M"]].map(([stage, value], index) => <div key={stage} style={{ "--step": index + 1 }}><span>{stage}</span><strong>{value}</strong></div>)}</div><p className="bp-disclaimer">Illustrative internal planning range — not a formal appraisal.</p></section>

        <section className="bp-section bp-reinvestment"><div><span className="bp-kicker">FINANCIAL DISCIPLINE</span><h2>Revenue funds the next level of quality.</h2><p>The $2M–$8M replacement-cost estimate is not a bill due today and not the company valuation. It describes what a professional team might spend to recreate the full planned platform from the beginning.</p><p>EdNotebook instead improves module by module, reinvesting as real users, contracts, and responsibilities grow.</p></div><div className="bp-allocation">{[["Product quality, testing, security and accessibility", "35%–50%"], ["Customer implementation and support", "15%–25%"], ["Pilots, partnerships and sales", "15%–25%"], ["Legal, compliance and administration", "5%–15%"], ["Reserve and contingency", "10%–20%"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}<small>Planning share of gross profit before durable product-market fit.</small></div></section>

        <section className="bp-section bp-ip"><div className="bp-section-heading"><span className="bp-kicker">REUSABLE ASSETS</span><h2>EdNotebook creates systems that can support other ventures.</h2><p>Potential intellectual-property and reusable platform assets. Patent or trademark status is not implied.</p></div><div className="bp-ip-grid">{IP.map(([title, technical, uses]) => <article key={title}><span>{technical}</span><h3>{title}</h3><p>{uses}</p></article>)}</div></section>

        <section className="bp-section bp-timeline"><div className="bp-section-heading"><span className="bp-kicker">WHERE WE GO NEXT</span><h2>Focused execution before broad expansion.</h2></div><div className="bp-timeline-grid"><article><span>NOW → CONTROLLED BETA</span><h3>Finish and connect</h3><ul><li>Split oversized modules</li><li>Finish professor and student paths</li><li>Hide unfinished features</li><li>Run controlled tests</li></ul></article><article><span>FIRST ACADEMIC TERM</span><h3>Prove recurring use</h3><ul><li>Measure professor adoption</li><li>Measure student return</li><li>Produce pilot evidence</li><li>Improve from feedback</li></ul></article><article><span>12–24 MONTHS</span><h3>Convert to institutions</h3><ul><li>Department pilots</li><li>Institution connections</li><li>Outcome reporting</li><li>Selected publishing activation</li></ul></article><article><span>24–60 MONTHS</span><h3>Operate the platform</h3><ul><li>Institution contracts</li><li>Alex B. Morrison Library growth</li><li>Publisher intelligence</li><li>Selected K–12 pilots</li></ul></article></div></section>

        <section id="partnership" className="bp-section bp-partnership"><div><span className="bp-kicker">WORK WITH EDNOTEBOOK</span><h2>The platform has reached the stage where focused collaborators can change its trajectory.</h2><p>Useful contributions include professor pilots, institution partnerships, product strategy, technical leadership, testing, accessibility, learning analytics, publishing relationships, customer success, legal review, grants, and community development.</p></div><div className="bp-partner-actions"><a href="#/careers">Explore ways to contribute</a><a href="#/publishers">Publish with the library</a><a href="#/professors">Review the professor experience</a><a href="mailto:hello@transformontologysystems.com">Contact the team</a></div></section>
      </main>

      <footer className="bp-footer"><div><BrandMark size={34} /><span><strong>EdNotebook</strong><small>Transform Ontology Systems</small></span></div><p>Professor adoption → student return → institutional trust → improved outcomes.</p><nav><a href="#/">Home</a><a href="#/careers">Work with us</a><a href="#/publishers">Publishing</a></nav></footer>
    </div>
  );
}
