import { useState } from "react";

/* ============================================================
   EDNOTEBOOK — landing page
   Brand: Ram Ready theme, matching the app
   ============================================================ */

const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&family=Newsreader:wght@400;500;600&display=swap');`;

const T = {
  ink: "#101B33", body: "#2A3350", slate: "#5B6478",
  paper: "#F6F7FB", card: "#FFFFFF", line: "#DDE2EE",
  primary: "#1D4ED8", primaryDark: "#173BA3", accent: "#F2B33D", accentDark: "#C98A12",
  good: "#1E9E6A", bad: "#D14343",
  display: "'Zilla Slab', serif", bodyFont: "'Inter', sans-serif", mono: "'IBM Plex Mono', monospace",
};

const PLANS = [
  { key: "free", name: "Free", price: "$0", cadence: "forever", tag: "Start here",
    features: ["1 class", "Up to 50 students", "Ram Ready template", "Community support"] },
  { key: "perCourse", name: "Per-Course", price: "$59–99", cadence: "per 8 or 16-week course", tag: null,
    features: ["1 class per purchase", "All 5 lesson templates", "AI paper grader", "Pay only when you're teaching"] },
  { key: "semester", name: "Semester", price: "$179", cadence: "per semester", tag: "Most popular",
    features: ["Up to 5 classes", "Writing coach for students", "Priority support"] },
  { key: "annual", name: "Annual", price: "$549", cadence: "per year", tag: "Best value",
    features: ["Up to 10 classes", "Save ~35% vs. semester", "Priority support", "Early access features"] },
];

const STEPS = [
  { n: "01", title: "Paste your content", text: "A syllabus, lecture notes, a chapter outline — anything you already have." },
  { n: "02", title: "Pick a template", text: "Story, Lab, Drill, Seminar, or Ram Ready — the six-question spine from Digital Literacy." },
  { n: "03", title: "AI builds the course", text: "Acts, episodes, knowledge checks, and a quiz — structured, not just summarized." },
  { n: "04", title: "Students play it", text: "XP, streaks, and badges wrap material that stays exactly as rigorous as you wrote it." },
];

const DEMO_EPISODES = [
  { id: "d1", title: "Your First File System", done: true },
  { id: "d2", title: "Email a Professor Without Fear", current: true },
  { id: "d3", title: "AI: Tool, Tutor, or Trap?", locked: true },
];
const DEMO_LESSON = {
  sections: [
    { heading: "What it is", body: "A professional email has a subject that says what you need, a greeting with your professor's actual title, two or three sentences of context, one clear ask, and your name and course section at the bottom." },
    { heading: "Why it exists", body: "Your professor reads dozens of emails a day between three or four different classes. A vague subject line like 'question' gets read last, if at all. A specific one gets answered first." },
  ],
  quiz: { q: "Which subject line gets answered fastest?", options: ["question", "hey", "PHIL 201 — makeup exam request for Thu 10/2", "URGENT!!"], answer: 2, why: "It names the course, the situation, and the date in one glance — your professor doesn't have to open it to triage it." },
};

const TEMPLATE_OPTIONS = ["Ram Ready", "Story", "Lab", "Drill", "Seminar"];

/* ---------- primitives ---------- */
function Btn({ children, onClick, variant = "solid", size = "md", full, style }) {
  const pads = { sm: "8px 16px", md: "11px 22px", lg: "15px 30px" };
  const fonts = { sm: 13, md: 15, lg: 17 };
  const variants = {
    solid: { background: T.accent, color: T.ink },
    ghost: { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.5)" },
    outline: { background: "transparent", color: T.primary, border: `1px solid ${T.primary}` },
    quiet: { background: "transparent", color: T.slate, border: `1px solid ${T.line}` },
  };
  return (
    <button onClick={onClick} style={{ fontFamily: T.bodyFont, fontWeight: 700, fontSize: fonts[size], padding: pads[size], borderRadius: 999,
      cursor: "pointer", border: "1px solid transparent", width: full ? "100%" : "auto", ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
function Section({ children, style, id }) {
  return <section id={id} style={{ maxWidth: 640, margin: "0 auto", padding: "0 18px", ...style }}>{children}</section>;
}
function Eyebrow({ children }) {
  return <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: T.accentDark }}>{children}</div>;
}

/* ---------- mini interactive demo ---------- */
function LiveDemo() {
  const [open, setOpen] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [pick, setPick] = useState(null);

  if (open) {
    const l = DEMO_LESSON;
    return (
      <div className="cc-rise" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <button onClick={() => { setOpen(null); setAnswered(false); setPick(null); }} style={{ background: "none", border: "none", color: T.slate, fontFamily: T.mono, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12 }}>← Back to quest map</button>
        {l.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentDark, letterSpacing: ".08em" }}>{s.heading.toUpperCase()}</div>
            <div style={{ fontSize: 14.5, color: T.body, lineHeight: 1.6, marginTop: 4 }}>{s.body}</div>
          </div>
        ))}
        <div style={{ background: T.paper, borderRadius: 12, padding: 13, border: `1px solid ${T.accent}55` }}>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentDark, marginBottom: 6 }}>KNOWLEDGE CHECK</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 9 }}>{l.quiz.q}</div>
          {l.quiz.options.map((o, i) => {
            const picked = pick === i, right = i === l.quiz.answer;
            return (
              <button key={i} onClick={() => { if (answered) return; setPick(i); setAnswered(true); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px", marginBottom: 6, borderRadius: 10, fontSize: 13.5, cursor: "pointer",
                  fontFamily: T.bodyFont, color: T.ink, border: `1px solid ${picked ? (right ? T.good : T.bad) : T.line}`, background: picked ? (right ? T.good + "18" : T.bad + "18") : "#fff" }}>
                {o}
              </button>
            );
          })}
          {answered && <div style={{ fontSize: 13, color: T.body, lineHeight: 1.5, marginTop: 6 }}>{pick === l.quiz.answer ? "✓ " : ""}{l.quiz.why}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.slate, marginBottom: 4 }}>RAM READY · DIGITAL LITERACY</div>
      <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Act II · Communication</div>
      {DEMO_EPISODES.map((ep) => (
        <button key={ep.id} disabled={ep.locked} onClick={() => ep.current && setOpen(ep.id)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, marginBottom: 8, cursor: ep.current ? "pointer" : "default", opacity: ep.locked ? 0.4 : 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            background: ep.done ? T.good : ep.current ? T.accent : T.line, color: ep.done ? "#fff" : ep.current ? T.ink : T.slate, fontSize: 12 }}>{ep.done ? "✓" : ep.current ? "▶" : "🔒"}</div>
          <div style={{ flex: 1, border: `1px solid ${ep.current ? T.accent : T.line}`, borderRadius: 12, padding: "9px 12px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{ep.title}</div>
            {ep.current && <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentDark, marginTop: 2 }}>tap to try this lesson</div>}
          </div>
        </button>
      ))}
      <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.slate, marginTop: 4 }}>Independent pilot demo — not official university policy.</div>
    </div>
  );
}

/* ---------- onboarding stepper ---------- */
function Onboarding({ onClose, onFinish }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: "", email: "", institution: "", subject: "", length: "16", template: "Ram Ready" });
  const set = (k, v) => setData({ ...data, [k]: v });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,22,.72)", zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="cc-pop" style={{ background: T.paper, borderRadius: "20px 20px 0 0", maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accentDark, letterSpacing: ".1em" }}>TEACHER SETUP · STEP {Math.min(step + 1, 4)} OF 4</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: T.slate, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ height: 4, background: T.line, borderRadius: 999, marginBottom: 18 }}>
          <div style={{ height: 4, width: `${Math.min(step + 1, 4) * 25}%`, background: T.accent, borderRadius: 999, transition: "width .3s ease" }} />
        </div>

        {step === 0 && (
          <div className="cc-rise">
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Your info</div>
            {[["name", "Full name"], ["email", "Email"], ["institution", "Institution"]].map(([k, label]) => (
              <input key={k} value={data[k]} onChange={(e) => set(k, e.target.value)} placeholder={label}
                style={{ width: "100%", padding: 12, fontSize: 14, fontFamily: T.bodyFont, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
            ))}
            <Btn full onClick={() => setStep(1)} style={{ marginTop: 6 }} disabled={!data.name}>Continue</Btn>
          </div>
        )}

        {step === 1 && (
          <div className="cc-rise">
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 12 }}>What are you teaching?</div>
            <input value={data.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. SCI 101 — Introduction to Biology"
              style={{ width: "100%", padding: 12, fontSize: 14, fontFamily: T.bodyFont, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, outline: "none", marginBottom: 14, boxSizing: "border-box" }} />
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.slate, marginBottom: 6 }}>COURSE LENGTH</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["8", "16"].map((w) => (
                <button key={w} onClick={() => set("length", w)} style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: T.bodyFont, border: `1px solid ${data.length === w ? T.primary : T.line}`, background: data.length === w ? T.primary : "#fff", color: data.length === w ? "#fff" : T.slate }}>{w} weeks</button>
              ))}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.slate, marginBottom: 6 }}>TEMPLATE</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TEMPLATE_OPTIONS.map((tp) => (
                <button key={tp} onClick={() => set("template", tp)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  fontFamily: T.bodyFont, border: `1px solid ${data.template === tp ? T.primary : T.line}`, background: data.template === tp ? T.primary : "#fff", color: data.template === tp ? "#fff" : T.slate }}>{tp}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Btn variant="quiet" onClick={() => setStep(0)}>Back</Btn>
              <Btn full onClick={() => setStep(2)} disabled={!data.subject}>Continue</Btn>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="cc-rise">
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Building your free class…</div>
            <div style={{ fontSize: 14, color: T.body, marginBottom: 16 }}>{data.subject} · {data.length}-week · {data.template} template</div>
            {["Creating your class shell", "Loading the " + data.template + " template", "Setting your free-plan seat cap (50 students)", "Opening Course Forge"].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: T.good }} />
                <span style={{ fontSize: 13.5, color: T.ink }}>{s}</span>
              </div>
            ))}
            <Btn full style={{ marginTop: 16 }} onClick={() => setStep(3)}>Continue</Btn>
          </div>
        )}

        {step === 3 && (
          <div className="cc-pop" style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44 }}>🎉</div>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.ink, margin: "8px 0 6px" }}>Your free class is ready</div>
            <div style={{ fontSize: 14, color: T.body, lineHeight: 1.55, marginBottom: 18 }}>
              {data.subject || "Your class"} is live on the Free plan — 1 class, up to 50 students. Course Forge is exactly what you tried above: paste your syllabus and generate.
            </div>
            <Btn full onClick={onFinish}>Continue to your builder →</Btn>
            <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.slate, marginTop: 10 }}>Opening Course Forge, signed in as {data.email || "you"}.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function Landing({ onEnter }) {
  const [onboard, setOnboard] = useState(false);
  const [courseLength, setCourseLength] = useState("16");

  return (
    <div style={{ background: T.paper, minHeight: "100vh", fontFamily: T.bodyFont }}>
      <style>{FONT_LINK + `
        @keyframes ccRise { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
        .cc-rise { animation: ccRise .5s cubic-bezier(.2,.8,.3,1) both; }
        @keyframes ccPop { 0% { opacity:0; transform: scale(.95) } 100% { opacity:1; transform: scale(1) } }
        .cc-pop { animation: ccPop .35s ease both; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      {onboard && <Onboarding onClose={() => setOnboard(false)} onFinish={() => { setOnboard(false); onEnter && onEnter(); }} />}

      {/* Nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 15, background: T.ink, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color: "#fff" }}>Ed<span style={{ color: T.accent }}>Notebook</span></div>
        <div style={{ marginLeft: "auto" }}>
          <Btn variant="solid" size="sm" onClick={() => setOnboard(true)}>Get started free</Btn>
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(180deg,#101B33,#173BA3)", padding: "40px 0 46px", color: "#fff" }}>
        <Section>
          <Eyebrow>FOR PROFESSORS & UNIVERSITIES</Eyebrow>
          <h1 style={{ fontFamily: T.display, fontSize: 34, fontWeight: 700, lineHeight: 1.12, margin: "10px 0 12px" }}>
            Paste your content.<br />We build a course students actually finish.
          </h1>
          <p style={{ fontSize: 15.5, opacity: 0.85, lineHeight: 1.6, marginBottom: 20 }}>
            EdNotebook turns a syllabus into an interactive, gamified course in minutes — built on the same template behind Ram Ready Digital Literacy, shown live below.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn size="lg" onClick={() => setOnboard(true)}>Get started free</Btn>
            <Btn variant="ghost" size="lg" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>Try the live demo ↓</Btn>
          </div>
        </Section>
      </div>

      {/* How it works */}
      <Section style={{ padding: "44px 18px 8px" }}>
        <Eyebrow>HOW IT WORKS</Eyebrow>
        <h2 style={{ fontFamily: T.display, fontSize: 24, fontWeight: 700, color: T.ink, margin: "8px 0 20px" }}>Four steps, no LMS training required</h2>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 18 }}>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 700, color: T.accentDark, width: 34, flexShrink: 0 }}>{s.n}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: T.body, lineHeight: 1.55 }}>{s.text}</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Live demo */}
      <Section id="demo" style={{ padding: "20px 18px 48px" }}>
        <Eyebrow>TRY IT NOW</Eyebrow>
        <h2 style={{ fontFamily: T.display, fontSize: 24, fontWeight: 700, color: T.ink, margin: "8px 0 6px" }}>Ram Ready Digital Literacy</h2>
        <p style={{ fontSize: 14, color: T.slate, marginBottom: 16, lineHeight: 1.55 }}>
          This is a real EdNotebook course, playable right here. It's the same Ram Ready template every new class starts from.
        </p>
        <LiveDemo />
      </Section>

      {/* Pricing */}
      <div style={{ background: T.card, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, padding: "44px 0" }}>
        <Section>
          <Eyebrow>PRICING</Eyebrow>
          <h2 style={{ fontFamily: T.display, fontSize: 24, fontWeight: 700, color: T.ink, margin: "8px 0 4px" }}>Free to start. Pay as you teach.</h2>
          <p style={{ fontSize: 14, color: T.slate, marginBottom: 18 }}>Every class holds up to 50 students, on every plan.</p>
          {PLANS.map((p) => (
            <div key={p.key} style={{ border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>{p.name}</div>
                {p.tag && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.accentDark, background: T.accent + "1F", padding: "2px 9px", borderRadius: 999 }}>{p.tag.toUpperCase()}</span>}
              </div>
              <div style={{ margin: "6px 0 10px" }}>
                <span style={{ fontFamily: T.display, fontSize: 26, fontWeight: 700, color: T.ink }}>{p.price}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.slate }}> {p.cadence}</span>
              </div>
              {p.key === "perCourse" && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["8", "16"].map((w) => (
                    <button key={w} onClick={() => setCourseLength(w)} style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: T.bodyFont, border: `1px solid ${courseLength === w ? T.primary : T.line}`, background: courseLength === w ? T.primary : "transparent", color: courseLength === w ? "#fff" : T.slate }}>
                      {w}-week · ${w === "8" ? "59" : "99"}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 12 }}>{p.features.map((f, i) => <div key={i} style={{ fontSize: 13, color: T.body, padding: "2px 0" }}>✓ {f}</div>)}</div>
              <Btn variant={p.key === "free" ? "solid" : "outline"} full onClick={() => setOnboard(true)}>{p.key === "free" ? "Get started free" : "Start with " + p.name}</Btn>
            </div>
          ))}

          <div style={{ border: `1px solid ${T.primary}`, borderRadius: 16, padding: 16, background: T.primary + "08", marginTop: 14 }}>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 700, color: T.ink }}>University Enterprise</div>
            <div style={{ fontSize: 13.5, color: T.body, lineHeight: 1.55, margin: "6px 0 12px" }}>
              Seat-based licensing for your whole institution. SIS/SSO sync, FERPA data residency, unlimited classes and seats, dedicated onboarding — the same setup piloted with Angelo State.
            </div>
            <Btn variant="outline" full>Talk to us about your campus</Btn>
          </div>
        </Section>
      </div>

      {/* Footer */}
      <Section style={{ padding: "36px 18px 44px" }}>
        <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17, color: T.ink, marginBottom: 8 }}>Ed<span style={{ color: T.accentDark }}>Notebook</span></div>
        <div style={{ fontSize: 13, color: T.slate, lineHeight: 1.6, marginBottom: 10 }}>
          Ram Ready Digital Literacy, shown above as a live demo, is an independent pilot and not official policy of any university — verify current course requirements with your own instructor.
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.slate, lineHeight: 1.8 }}>
          github.com/BREXAtlas/EdNotebook · not yet published<br />
          github.com/Brexatlas/Digital-Literacy-Course · flagship demo<br />
          github.com/Brexatlas/Financial-Literacy-Course · next in the Ram Ready sequence
        </div>
      </Section>
    </div>
  );
}
