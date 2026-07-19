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
        <aside className="presentation-index"><NotebookLabel>EDNOTEBOOK DEMONSTRATION</NotebookLabel><h1>Product presentation</h1><p>Use the arrows or select a slide.</p><nav>{PRESENTATION_SLIDES.map((item, index) => <button type="button" key={item.kicker} className={slide === index ? "is-active" : ""} onClick={() => setSlide(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}</button>)}</nav><div className="presentation-demo-links"><strong>Open a live demonstration</strong><a href="#/tour/student">Brooke · University</a><a href="#/tour/k12">Jaylen · K–12</a><a href="#/tour/professor">Atlas · Professor</a></div></aside>
        <section className="presentation-stage">
          <div className="slide-progress"><i style={{ width: `${((slide + 1) / PRESENTATION_SLIDES.length) * 100}%` }} /></div>
          <article className="presentation-slide" key={current.kicker}><span>{current.kicker}</span><h2>{current.title}</h2><p>{current.body}</p><ul>{current.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>{slide === 6 && <div className="slide-source-links">{RESEARCH_SOURCES.slice(4).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><strong>{source.label}</strong><span>{source.note}</span></a>)}</div>}{slide === 7 && <div className="slide-source-links">{RESEARCH_SOURCES.slice(0, 4).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><strong>{source.label}</strong><span>{source.note}</span></a>)}</div>}{slide === 8 && <div className="tech-stack-grid">{[["Frontend", "React 18 · Vite 5"], ["Data & identity", "Supabase · row-level security"], ["Hosting", "GitHub Pages · custom domain"], ["Production AI", "Authenticated server-side gateway required"], ["Calendar", ".ics now · provider sync planned"], ["Institution systems", "LTI / LMS / SIS connectors planned"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}{slide === 9 && <div className="presentation-mascots">{Object.values(PERSONAS).map((persona) => <a href={`#/tour/${persona.id}`} key={persona.id}><img src={persona.image} alt="" /><strong>{persona.shortName}</strong><span>{persona.accountType}</span></a>)}</div>}</article>
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
    setNotice("Interest recorded in this demonstration. A production form would use a rate-limited endpoint, consent copy, and a deletion path.");
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
            ["Digital citizenship", "Source storage, privacy choices, respectful communication, AI literacy, and responsible publishing are taught inside the workflow."],
            ["Safety & privacy", "Human verification, separated K–12 and university audiences, limited public data, and production server boundaries reduce avoidable risk."],
            ["Accessibility", "Keyboard-friendly controls, clear hierarchy, readable cards, visible labels, and a commitment to equivalent access guide the interface."],
            ["Caring + accountability", "Alerts are designed to help students recover from missed work, not shame them or make the problem disappear."],
          ].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
          <section className="demo-section team-section"><div className="demo-section-heading"><NotebookLabel>ABOUT US</NotebookLabel><h2>A founder, two AI coworkers, and one student mascot showing the product from every side.</h2></div><div className="team-grid"><TeamCard name="Founder · BREXAtlas" role="Founder, educator, researcher & builder" copy="Building at the intersection of student agency, transformative leadership, digital literacy, financial literacy, responsible AI, and better education interfaces." /><TeamCard name="Brooke" role="Tour-mode AI assistant" image={PERSONAS.student.image} copy="The warm, emotionally intelligent guide who helps students notice the thing they were hoping would magically stop being due." badge="AI coworker" /><TeamCard name="Atlas" role="Professor-mode AI assistant" image={PERSONAS.professor.image} copy="The teacher, mentor, researcher, and tech geek who helps professors organize courses, feedback, advising, and doctoral work." badge="AI coworker" /><TeamCard name="Jaylen" role="K–12 student mascot" image={PERSONAS.k12.image} copy="A high-achieving, college-bound senior who keeps the K–12 experience focused on discipline, opportunity, safety, and future ownership." badge="Demo student" /></div></section>
          <section className="demo-section liaison-section"><article><NotebookLabel>HUMAN LIAISON</NotebookLabel><h2>Questions are welcome during onboarding.</h2><p>EdNotebook’s verification and school onboarding model includes a human liaison. Additional verification may involve contacting a professor, teacher, counselor, school, or institution. The product should explain what is needed and why before requesting information.</p></article><article><NotebookLabel>NOT LEGAL OR POLICY CERTIFICATION</NotebookLabel><h2>Alignment is a design commitment, not a claim of agency approval.</h2><p>The values and references on this demonstration page draw from Texas education priorities and public guidance. School pilots still require institution-specific review, contracts, data decisions, and accessibility testing.</p></article></section>
        </>}
        {section === "careers" && <>
          <section className="demo-section careers-section"><div className="demo-section-heading"><NotebookLabel>WORK WITH US</NotebookLabel><h2>Vacant roles, ambassador programs, and creator partnerships.</h2><p>These are demonstration position cards for the future EdNotebook team and community. Employment terms, compensation, eligibility, and application infrastructure still require formal setup.</p></div><div className="jobs-grid">{JOBS.map((job) => <article key={job.title}><span>{job.type}</span><h3>{job.title}</h3><strong>{job.mode}</strong><p>{job.description}</p><button type="button" onClick={() => setNotice(`${job.title} selected. Complete the interest form below.`)}>Express interest</button></article>)}</div></section>
          <section className="demo-section career-form-section"><div><NotebookLabel>INTEREST FORM</NotebookLabel><h2>Tell us where you could contribute.</h2><p>Ambassadors, educators, students, engineers, researchers, accessibility specialists, community builders, and education-first creators are part of the long-term vision.</p></div><form onSubmit={submitInterest}><label>Name<input required /></label><label>Email<input required type="email" /></label><label>Role or program<select><option>Choose one</option>{JOBS.map((job) => <option key={job.title}>{job.title}</option>)}</select></label><label>What should we know?<textarea rows={5} /></label><button type="submit">Record demo interest</button>{notice && <p className="inline-notice" role="status">{notice}</p>}</form></section>
        </>}
      </main>
      <DemoFooter />
    </div>
  );
}

export { PresentationSite, AboutCareers };
