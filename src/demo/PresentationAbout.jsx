import { useEffect, useState } from "react";
import { JOBS, PERSONAS, PRESENTATION_SLIDES, RESEARCH_SOURCES } from "./demoData.js";
import { DemoNav, NotebookLabel, DemoFooter, VerifiedBadge } from "./demoShared.jsx";

function PresentationSite() {
  const [slide, setSlide] = useState(0);
  const current = PRESENTATION_SLIDES[slide];
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") setSlide((value) => Math.min(PRESENTATION_SLIDES.length - 1, value + 1));
      if (event.key === "ArrowLeft") setSlide((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="demo-page presentation-page">
      <DemoNav active="presentation" compact />
      <main className="presentation-shell">
        <aside className="presentation-index"><NotebookLabel>EDNOTEBOOK DEMONSTRATION</NotebookLabel><h1>Product presentation</h1><p>Use the arrows or select a slide.</p><nav>{PRESENTATION_SLIDES.map((item, index) => <button type="button" key={item.kicker} className={slide === index ? "is-active" : ""} onClick={() => setSlide(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}</nav><div className="presentation-demo-links"><strong>Open a live demonstration</strong><a href="#/tour/student">Brooke · University</a><a href="#/tour/k12">Jaylen · K–12</a><a href="#/tour/professor">Atlas · Professor</a><a href="#/business-presentation">Business presentation</a></div></aside>
        <section className="presentation-stage">
          <div className="slide-progress"><i style={{ width: `${((slide + 1) / PRESENTATION_SLIDES.length) * 100}%` }} /></div>
          <article className="presentation-slide" key={current.kicker}><span>{current.kicker}</span><h2>{current.title}</h2><p>{current.body}</p><ul>{current.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>{slide === 6 && <div className="slide-source-links">{RESEARCH_SOURCES.slice(4).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><strong>{source.label}</strong><span>{source.note}</span></a>)}</div>}{slide === 7 && <div className="slide-source-links">{RESEARCH_SOURCES.slice(0, 4).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><strong>{source.label}</strong><span>{source.note}</span></a>)}</div>}{slide === 8 && <div className="tech-stack-grid">{[["Frontend", "React 18 · Vite 5"], ["Data & identity", "Supabase · row-level security"], ["Hosting", "GitHub Pages · custom domain"], ["Workspace assistant", "Authenticated server-side service planned"], ["Calendar", ".ics now · provider sync planned"], ["Institution systems", "LTI / LMS / SIS connectors planned"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}{slide === 9 && <div className="presentation-mascots">{Object.values(PERSONAS).map((persona) => <a href={`#/tour/${persona.id}`} key={persona.id}><img src={persona.image} alt="" /><strong>{persona.shortName}</strong><span>{persona.accountType}</span></a>)}</div>}</article>
          <footer className="presentation-controls"><button type="button" disabled={slide === 0} onClick={() => setSlide(Math.max(0, slide - 1))}>← Previous</button><span>{slide + 1} / {PRESENTATION_SLIDES.length}</span><button type="button" disabled={slide === PRESENTATION_SLIDES.length - 1} onClick={() => setSlide(Math.min(PRESENTATION_SLIDES.length - 1, slide + 1))}>Next →</button></footer>
        </section>
      </main>
      <section className="presentation-research-section"><div className="demo-section-heading"><NotebookLabel>RESEARCH & POLICY SOURCES</NotebookLabel><h2>Sources linked directly from the presentation.</h2><p>These links support the problem framing, design principles, digital and financial literacy alignment, and accessibility goals.</p></div><div className="research-source-grid">{RESEARCH_SOURCES.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><span>{source.organization}</span><strong>{source.label}</strong><p>{source.note}</p><b>Open source ↗</b></a>)}</div></section>
      <DemoFooter />
    </div>
  );
}

function TeamCard({ name, role, image = "", copy, badge = "" }) {
  return <article className="team-card">{image ? <img src={image} alt="" /> : <div className="founder-avatar">BRE</div>}<div><span>{role}</span><h3>{name}</h3>{badge && <VerifiedBadge label={badge} small />}<p>{copy}</p></div></article>;
}

function AboutCareers({ careersFirst = false }) {
  const [section, setSection] = useState(careersFirst ? "careers" : "about");
  const [notice, setNotice] = useState("");
  function submitInterest(event) {
    event.preventDefault();
    setNotice("Interest recorded in this demonstration. The connected form can send this to the team when the form endpoint is enabled.");
  }
  return (
    <div className="demo-page about-page">
      <DemoNav active={section === "careers" ? "careers" : "about"} />
      <main>
        <section className="about-hero"><NotebookLabel>ABOUT EDNOTEBOOK</NotebookLabel><h1>Education should feel connected, understandable, and humane.</h1><p>EdNotebook is being designed as a learning command center: a place where students can see the work, understand the why, keep the evidence, ask better questions, and build a learning identity they control.</p><div><button className={section === "about" ? "is-active" : ""} type="button" onClick={() => setSection("about")}>Purpose & team</button><button className={section === "careers" ? "is-active" : ""} type="button" onClick={() => setSection("careers")}>Work with us</button></div></section>
        {section === "about" && <>
          <section className="demo-section values-section"><div className="demo-section-heading"><NotebookLabel>PURPOSE & VALUES</NotebookLabel><h2>Aligned with practical education priorities—not just feature lists.</h2></div><div className="values-grid">{[
            ["Student agency", "Students review extracted information, control reminders, choose profile visibility, and retain a clear view of their own learning."],
            ["Equitable access", "Core digital and financial literacy remain available without requiring a teacher account or a paid social profile."],
            ["Digital citizenship", "Source storage, privacy choices, respectful communication, and responsible publishing are taught inside the workflow."],
            ["Safety & privacy", "Human verification, separated K–12 and university audiences, limited public data, and production server boundaries reduce avoidable risk."],
            ["Accessibility", "Keyboard-friendly controls, clear hierarchy, readable cards, visible labels, and a commitment to equivalent access guide the interface."],
            ["Caring + accountability", "Alerts are designed to help students recover from missed work, not shame them or make the problem disappear."],
          ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
          <section className="demo-section team-section"><div className="demo-section-heading"><NotebookLabel>ABOUT US</NotebookLabel><h2>A founder and three friendly guides showing EdNotebook from every side.</h2></div><div className="team-grid"><TeamCard name="Founder · BREXAtlas" role="Founder, educator, researcher & builder" copy="Building practical tools for student agency, teaching, digital literacy, financial literacy, and better education interfaces." /><TeamCard name="Brooke" role="University student tour guide" image={PERSONAS.student.image} copy="The friendly guide who walks students through dates, classes, people, and progress." badge="Tour guide" /><TeamCard name="Atlas" role="Professor guide" image={PERSONAS.professor.image} copy="The teacher, mentor, researcher, and technology enthusiast who shows the professor side." badge="Professor guide" /><TeamCard name="Jaylen" role="K–12 student guide" image={PERSONAS.k12.image} copy="A college-bound senior who keeps the K–12 experience focused on discipline, opportunity, safety, and the future." badge="Student guide" /></div></section>
          <section className="demo-section liaison-section"><article><NotebookLabel>HUMAN HELP</NotebookLabel><h2>Questions are welcome during onboarding.</h2><p>EdNotebook includes a real person for verification and school onboarding questions.</p></article><article><NotebookLabel>BUILT TO BE TESTED</NotebookLabel><h2>Try the workflow and tell us what needs work.</h2><p>The demonstration uses sample accounts and sample class information so visitors can explore without setting up a real course.</p></article></section>
        </>}
        {section === "careers" && <>
          <section className="demo-section" aria-labelledby="business-presentation-card-title"><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(240px,.7fr)", gap: 28, alignItems: "center", padding: 32, color: "#fff", borderRadius: 24, background: "linear-gradient(135deg,#101b33,#234e9e)" }}><div><NotebookLabel>BUSINESS PRESENTATION</NotebookLabel><h2 id="business-presentation-card-title" style={{ margin: "12px 0", fontSize: 38 }}>See the platform, business model, and path forward.</h2><p style={{ margin: 0, color: "#d8e0f2", lineHeight: 1.7 }}>Explore the four-part growth strategy, current product focus, feature activation map, publishing direction, revenue planning, valuation evidence, reusable assets, and partnership opportunities.</p></div><a href="#/business-presentation" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 50, padding: "12px 18px", borderRadius: 12, color: "#101b33", background: "#f0c45b", textDecoration: "none", fontWeight: 900 }}>Open business presentation →</a></div></section>
          <section className="demo-section careers-section"><div className="demo-section-heading"><NotebookLabel>WORK WITH US</NotebookLabel><h2>Vacant roles, ambassador programs, and creator partnerships.</h2><p>These are demonstration position cards for the future EdNotebook team and community. Employment terms, compensation, eligibility, and application infrastructure still require formal setup.</p></div><div className="jobs-grid">{JOBS.map((job) => <article key={job.title}><span>{job.type}</span><h3>{job.title}</h3><strong>{job.mode}</strong><p>{job.description}</p><button type="button" onClick={() => setNotice(`${job.title} selected. Complete the interest form below.`)}>Express interest</button></article>)}</div></section>
          <section className="demo-section career-form-section"><div><NotebookLabel>INTEREST FORM</NotebookLabel><h2>Tell us where you could contribute.</h2><p>Ambassadors, educators, students, engineers, researchers, accessibility specialists, community builders, and education-first creators are part of the long-term vision.</p></div><form onSubmit={submitInterest}><label>Name<input required /></label><label>Email<input required type="email" /></label><label>Role or program<select><option>Choose one</option>{JOBS.map((job) => <option key={job.title}>{job.title}</option>)}</select></label><label>What should we know?<textarea rows={5} /></label><button type="submit">Record demo interest</button>{notice && <p className="inline-notice" role="status">{notice}</p>}</form></section>
        </>}
      </main>
      <DemoFooter />
    </div>
  );
}

export { PresentationSite, AboutCareers };
