import { lazy, Suspense, useEffect, useState } from "react";
import { PERSONAS } from "../demo/demoData.js";
import { SyllabusPanel } from "../demo/WorkspaceSyllabus.jsx";

const LessonBuilder = lazy(() => import("../Builder.jsx"));

const AUDIENCE_COPY = {
  university: {
    host: "Brooke",
    persona: "student",
    kicker: "SMART SYLLABUS REVIEW · CONNECTED AI ASSISTANT COMING SOON",
    title: "Review your syllabus and build a semester plan in about 60 seconds.",
    copy: "The working scanner extracts PDF, Word, text, and paper pages into an editable review. You approve every date. A connected AI assistant is planned for later and is not active in this public preview.",
    tour: "#/tour/student",
    tourLabel: "Take the student tour with Brooke",
    proof: ["Scanner works without hosted AI", "Edit before saving", "Your calendar stays under your control"],
  },
  k12: {
    host: "Jaylen",
    persona: "k12",
    kicker: "SMART SCHOOL PLANNER · CONNECTED AI ASSISTANT COMING SOON",
    title: "Review a class handout and make a school plan in about 60 seconds.",
    copy: "The working scanner reads the file or paper pages, then lets you fix every date before saving. A connected AI helper is planned for later and is not active in this public preview.",
    tour: "#/tour/k12",
    tourLabel: "Take the K–12 tour with Jaylen",
    proof: ["Scanner works without hosted AI", "Check every date first", "Built for the school day"],
  },
  professor: {
    host: "Atlas",
    persona: "professor",
    kicker: "COURSE CREATOR NOW · CONNECTED AI REFINEMENT COMING SOON",
    title: "Review a syllabus in about 60 seconds. Build a first lesson starter in under five minutes.",
    copy: "Try the working scanner and on-device course organizer before signing up. Timing varies with source length and review. A hosted generative model is not connected in the public preview; AI drafting and refinement are marked Coming soon.",
    tour: "#/tour/professor",
    tourLabel: "Take the professor tour with Atlas",
    proof: ["No account for the preview", "Editable before anything is saved", "Professor controls every result"],
  },
};

function GuestSyllabus({ audience, onSignup }) {
  const persona = PERSONAS[AUDIENCE_COPY[audience].persona];
  const [assignments, setAssignmentsState] = useState([]);
  const [readyToSave, setReadyToSave] = useState(false);

  function setAssignments(next) {
    setAssignmentsState(next);
    if (next.length) setReadyToSave(true);
  }

  return <>
    <SyllabusPanel persona={persona} assignments={assignments} setAssignments={setAssignments} />
    {readyToSave && <div className="guest-product-save-prompt" role="status"><div><strong>Your reviewed dates are ready.</strong><span>Create a free account to keep this calendar with your classes.</span></div><button type="button" onClick={onSignup}>Create free account</button></div>}
  </>;
}

function ProductModal({ tool, audience, onClose, onSignup }) {
  const copy = AUDIENCE_COPY[audience];
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("guest-product-open");
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("guest-product-open");
    };
  }, [onClose]);

  return <div className="guest-product-overlay" role="dialog" aria-modal="true" aria-labelledby="guest-product-title">
    <header className="guest-product-toolbar">
      <div><span>LIVE GUEST PREVIEW</span><strong id="guest-product-title">{tool === "lesson" ? "Under-five-minute lesson starter" : "About-60-second syllabus review"}</strong></div>
      <div><button className="guest-product-signup" type="button" onClick={onSignup}>Save with a free account</button><button className="guest-product-close" type="button" onClick={onClose} aria-label="Close product preview">×</button></div>
    </header>
    <div className="guest-product-context"><strong>Try it now—no account required.</strong><span>{tool === "lesson" ? "Build and edit a lesson here. Sign up only when you want to keep the work." : `Use the same scanner ${copy.host} shows inside the full workspace.`}</span></div>
    <div className="guest-product-body">
      {tool === "lesson"
        ? <Suspense fallback={<div className="guest-product-loading">Opening the lesson creator…</div>}><LessonBuilder guest lockedView="professor" onSignup={onSignup} /></Suspense>
        : <GuestSyllabus audience={audience} onSignup={onSignup} />}
    </div>
  </div>;
}

export default function FeaturedProductExperience({ audience = "university", onSignup }) {
  const requestedTool = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tool");
  const requestedToolKey = ["syllabus", "lesson"].includes(requestedTool) ? requestedTool : null;
  const [tool, setTool] = useState(requestedToolKey);
  const copy = AUDIENCE_COPY[audience] || AUDIENCE_COPY.university;
  const professor = audience === "professor";

  useEffect(() => {
    if (requestedToolKey) setTool(requestedToolKey);
  }, [requestedToolKey]);

  return <>
    <section className={`audience-product-feature is-${audience}`} aria-labelledby={`${audience}-product-title`}>
      <div className="audience-product-copy">
        <span className="portal-kicker">{copy.kicker}</span>
        <h1 id={`${audience}-product-title`}>{copy.title}</h1>
        <p>{copy.copy}</p>
        <div className="audience-product-actions">
          <button className="audience-product-primary" type="button" onClick={() => setTool("syllabus")}>Try syllabus review now</button>
          {professor && <button type="button" onClick={() => setTool("lesson")}>Build a lesson starter</button>}
          <a href={copy.tour}>{copy.tourLabel}</a>
        </div>
        <div className="audience-product-proof">{copy.proof.map((item) => <span key={item}>✓ {item}</span>)}</div>
      </div>
      <div className="audience-product-demo" aria-label={`${copy.host} product tour preview`}>
        <img src={PERSONAS[copy.persona].image} alt={`${copy.host}, the ${audience === "professor" ? "professor" : audience === "k12" ? "K–12 student" : "university student"} tour host`} />
        <div><span>{copy.host.toUpperCase()}’S QUICK START</span><strong>{professor ? "Scan → build → review" : "Scan → check → plan"}</strong><p>{professor ? "Start with a syllabus or lesson idea, then keep editing until it fits your class." : "See the dates first, then explore classes, grades, notes, writing, and student life."}</p><a href={copy.tour}>Start the full tour →</a></div>
      </div>
    </section>
    <section className={`landing-referral-band is-${audience}`}>
      <div><span className="portal-kicker">BRING FRIENDS · UNLOCK MORE</span><h2>EdNotebook grows with the people you bring.</h2><p>Every account gets a unique invitation number and link. When a friend creates an account from it, your referral progress updates automatically.</p></div>
      <ol><li><strong>1 friend</strong><span>More weekly media</span></li><li><strong>3 friends</strong><span>Profile color controls</span></li><li><strong>5 friends</strong><span>Expanded creator allowance</span></li></ol>
      <button type="button" onClick={onSignup}>Create your invite link</button>
    </section>
    {tool && <ProductModal tool={tool} audience={audience} onClose={() => setTool(null)} onSignup={onSignup} />}
  </>;
}

export { AUDIENCE_COPY };
