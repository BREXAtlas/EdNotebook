import { useState, useEffect, useMemo } from "react";

/* ============================================================
   EDNOTEBOOK — university course platform
   Roles: Learner · Professor · Admin (institution) · Mastermind (owner)
   ============================================================ */

const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Karla:wght@400;500;700&family=Space+Mono:wght@400;700&family=Archivo+Black&family=Newsreader:wght@400;500;600&display=swap');`;

/* ---------- THEMES ---------- */
const THEMES = {
  ramready: {
    name: "Ram Ready", blurb: "University blue & gold",
    ink: "#101B33", body: "#2A3350", slate: "#5B6478",
    paper: "#F6F7FB", card: "#FFFFFF", line: "#DDE2EE",
    primary: "#1D4ED8", primaryDark: "#173BA3", accent: "#F2B33D", accentDark: "#C98A12",
    good: "#1E9E6A", bad: "#D14343",
    display: "'Zilla Slab', serif", bodyFont: "'Inter', sans-serif", mono: "'IBM Plex Mono', monospace",
    radius: "16px", heroGrad: "linear-gradient(135deg,#101B33,#173BA3)",
  },
  nightshift: {
    name: "Nightshift", blurb: "Low-light study mode",
    ink: "#E8ECF4", body: "#C3CAD9", slate: "#8A94A8",
    paper: "#0E1116", card: "#171B22", line: "#262C38",
    primary: "#6D8FFF", primaryDark: "#4C6BE0", accent: "#4ADE80", accentDark: "#22C55E",
    good: "#4ADE80", bad: "#F87171",
    display: "'Space Grotesk', sans-serif", bodyFont: "'Inter', sans-serif", mono: "'JetBrains Mono', monospace",
    radius: "14px", heroGrad: "linear-gradient(135deg,#171B22,#26304A)",
  },
  fieldnotes: {
    name: "Field Notes", blurb: "Warm, seminar-room calm",
    ink: "#2B2A25", body: "#463F35", slate: "#7A6F60",
    paper: "#FBF7EE", card: "#FFFDF8", line: "#E4DACA",
    primary: "#2F6B4F", primaryDark: "#22503B", accent: "#C2703D", accentDark: "#9B542A",
    good: "#2F6B4F", bad: "#B3452F",
    display: "'Fraunces', serif", bodyFont: "'Karla', sans-serif", mono: "'Space Mono', monospace",
    radius: "10px", heroGrad: "linear-gradient(135deg,#2B2A25,#3F5A48)",
  },
  letterpress: {
    name: "Letterpress", blurb: "High-contrast, no decoration",
    ink: "#111111", body: "#2B2B2B", slate: "#6B6B6B",
    paper: "#FFFFFF", card: "#FFFFFF", line: "#111111",
    primary: "#111111", primaryDark: "#000000", accent: "#E0342C", accentDark: "#B32019",
    good: "#1B7A3D", bad: "#E0342C",
    display: "'Archivo Black', sans-serif", bodyFont: "'Newsreader', serif", mono: "'Space Mono', monospace",
    radius: "0px", heroGrad: "linear-gradient(135deg,#111111,#333333)",
  },
};

/* ---------- COURSE TEMPLATES (Ram Ready = Digital Literacy spine) ---------- */
const TEMPLATES = {
  ramready: { name: "Ram Ready", tag: "Digital Literacy spine",
    desc: "The structure behind Ram Ready Digital Literacy: every concept answers six questions, with sources to verify.",
    sections: ["What it is", "Why it exists", "How it may help", "What it may cost", "Who may and may not benefit", "Verify this now"],
    unit: "Episode", group: "Act" },
  story: { name: "Story", tag: "Narrative arc",
    desc: "Each lesson is a scene: a character faces a problem the concept solves.",
    sections: ["The scene", "The problem", "The turn", "The concept", "Your move"], unit: "Chapter", group: "Part" },
  lab: { name: "Lab", tag: "Do it, then explain it",
    desc: "Hands-on first. Learners run the procedure, then build the theory from what they observed.",
    sections: ["Setup", "Procedure", "What you should see", "Why it happened", "Push further"], unit: "Lab", group: "Module" },
  drill: { name: "Drill", tag: "Mastery repetition",
    desc: "Short explanation, then graduated practice until it's automatic. Good for math and language.",
    sections: ["The rule", "Worked example", "Guided practice", "Independent set", "Common errors"], unit: "Set", group: "Block" },
  seminar: { name: "Seminar", tag: "Argument & evidence",
    desc: "Learners read a source, take a position, and defend it in discussion.",
    sections: ["The source", "Context", "Competing readings", "Take a position", "Discussion prompt"], unit: "Session", group: "Unit" },
};

/* ---------- DEMO COURSE / LESSON ---------- */
const DEMO_COURSE = {
  courseTitle: "SCI 101 · What Is a Cell?", subtitle: "From membrane to mitochondria in eight episodes", templateKey: "ramready",
  acts: [
    { title: "Act I · The Boundary", episodes: [
      { id: "e1", title: "The Cell as a Decision About Inside and Outside", type: "Story", minutes: 22 },
      { id: "e2", title: "Membranes: What Gets In, What Stays Out", type: "Lab", minutes: 28 } ] },
    { title: "Act II · The Machinery", episodes: [
      { id: "e3", title: "The Nucleus and the Instruction Set", type: "Story", minutes: 25 },
      { id: "e4", title: "Mitochondria: Paying the Energy Bill", type: "Lab", minutes: 26 },
      { id: "e5", title: "Ribosomes and the Protein Assembly Line", type: "Drill", minutes: 20 } ] },
    { title: "Act III · Cells in the World", episodes: [
      { id: "e6", title: "Plant vs. Animal: Same Problem, Two Answers", type: "Seminar", minutes: 24 },
      { id: "e7", title: "When Cells Divide", type: "Story", minutes: 25 } ] },
  ],
};

const DEMO_LESSON = {
  sections: [
    { heading: "What it is", body: "A cell is the smallest unit of life that can keep itself running. It draws a boundary between an inside it controls and an outside it does not, then spends energy to hold that line." },
    { heading: "Why it exists", body: "Chemistry left alone drifts toward disorder. A membrane lets a cell concentrate the molecules it needs and dump the ones it doesn't, so useful reactions happen fast enough to matter." },
    { heading: "How it may help", body: "Once you see the cell as a boundary problem, a lot of biology stops being memorization. Why does a plant cell have a rigid wall? It solved water pressure." },
    { heading: "What it may cost", body: "Holding a boundary is expensive. A large share of the energy an animal cell produces goes to pumps that keep sodium out and potassium in." },
    { heading: "Who may and may not benefit", body: "This framing serves you well for cell structure, transport, and metabolism. It is less useful for genetics, where the interesting action is informational rather than spatial." },
    { heading: "Verify this now", body: "Open any diagram of an animal cell and find the plasma membrane. Trace it, then find one structure inside that also has its own membrane, and ask why." },
  ],
  knowledgeChecks: [
    { after: 1, q: "The primary job of the plasma membrane is to…", options: ["Produce energy for the cell", "Separate a controlled interior from the environment", "Store genetic information", "Digest waste products"], answer: 1, why: "Energy, storage, and digestion all happen inside — but only because the membrane created an 'inside' to begin with." },
    { after: 3, q: "Why does oxygen deprivation damage tissue so fast?", options: ["Cells stop dividing immediately", "The ion pumps that maintain gradients lose their energy supply", "Membranes dissolve without oxygen", "DNA breaks down within seconds"], answer: 1, why: "The boundary is actively maintained, not passive. Cut the power and the gradients equalize within minutes." },
  ],
  quiz: [
    { q: "A cell is best described as…", options: ["A container of chemicals", "The smallest unit of life that maintains its own internal conditions", "A structure made only of protein", "A synonym for a bacterium"], answer: 1, why: "The key word is 'maintains' — self-regulation is what separates a cell from a droplet." },
    { q: "Mitochondria having two membranes is best explained by…", options: ["Extra protection from toxins", "Their origin as independent cells engulfed by an ancestor", "The need to store more DNA", "Random variation"], answer: 1, why: "Endosymbiosis. The inner membrane is the original bacterium's; the outer one came from the host that swallowed it." },
  ],
};

/* ---------- SEED SOCIAL / ROSTER / STYLE DATA ---------- */
const SEED_DISCUSSIONS = [
  { id: 1, author: "A. Rivera", role: "Learner", time: "2h", text: "If the membrane costs that much energy, is there a size limit where a cell just can't afford its own surface anymore?", replies: [{ author: "Dr. Nguyen", role: "Professor", time: "1h", text: "Exactly the right question — look up surface-area-to-volume ratio before Thursday." }] },
  { id: 2, author: "M. Tran", role: "Learner", time: "5h", text: "Episode 2's lab made the osmosis part click for me.", replies: [] },
];
const SEED_GROUPS = [
  { name: "Group A · Membrane Model", members: ["A. Rivera", "J. Okafor", "S. Patel"], due: "Fri", progress: 60 },
  { name: "Group B · Organelle Poster", members: ["M. Tran", "D. Whitfield"], due: "Fri", progress: 25 },
];
const ROSTER = [
  { name: "A. Rivera", progress: 92, streak: 11, flag: false },
  { name: "J. Okafor", progress: 78, streak: 6, flag: false },
  { name: "M. Tran", progress: 64, streak: 3, flag: false },
  { name: "D. Whitfield", progress: 31, streak: 0, flag: true },
  { name: "S. Patel", progress: 88, streak: 9, flag: false },
];
const STYLE_RULES = {
  APA: { cover: ["Title (bold, centered)", "Author", "Institution", "Course", "Instructor", "Due date"],
    headings: ["Level 1 — Centered, Bold, Title Case", "Level 2 — Flush Left, Bold, Title Case", "Level 3 — Flush Left, Bold Italic"],
    notes: "Sentence case for reference titles. In-text: (Nguyen, 2026). Running head not required for student papers (7th ed.)." },
  MLA: { cover: ["No title page unless requested", "Header block: name/instructor/course/date", "Title centered, no bold", "Last name + page #, top right"],
    headings: ["Headings optional; keep consistent and parallel"],
    notes: "Works Cited, not References. In-text: (Nguyen 14) — no comma, no year." },
  Chicago: { cover: ["Title one-third down, centered", "Name, course, date lower on page", "Title page not numbered"],
    headings: ["Level 1 — Centered, Bold or Italic", "Level 2 — Centered, Regular", "Level 3 — Flush Left, Italic"],
    notes: "Notes-Bibliography uses footnotes. Author-Date uses (Nguyen 2026, 14). Never mix systems." },
};

/* ---------- PROPRIETARY SHARED MANUSCRIPT FORMAT ---------- */
/* EduSync/1.0 — one JSON document, rendered on both the student
   and professor sides, so feedback lives INSIDE the draft, not
   a separate PDF markup that drifts out of sync.               */
function makeManuscript() {
  return {
    format: "EduSync/1.0",
    style: "APA",
    title: "Why Boundaries Cost Energy",
    student: "A. Rivera", course: "SCI 101", professor: "Dr. Nguyen",
    paragraphs: [
      { id: "p1", text: "The plasma membrane is often introduced as a passive barrier. This framing understates the metabolic investment required to maintain it.", comments: [] },
      { id: "p2", text: "Cells pump ions.", comments: [
        { id: "c1", author: "Dr. Nguyen", role: "Professor", text: "This paragraph is three words. What claim is it making? Expand it, or fold it into the paragraph before it.", resolved: false },
      ] },
      { id: "p3", text: "Roughly a third of resting energy expenditure in mammalian cells goes toward ion pumping, principally the sodium-potassium ATPase. This figure reframes the membrane from a wall into a machine that must be continuously paid for, which explains why oxygen deprivation produces tissue damage on a timescale of minutes rather than hours.", comments: [
        { id: "c2", author: "Dr. Nguyen", role: "Professor", text: "Good number, but where is it from? An uncited statistic reads as unsupported — add the citation before you submit.", resolved: false },
      ] },
    ],
    versions: [{ label: "Initial draft", when: "Mon 9:14 AM", words: 96 }],
  };
}

/* ---------- SUBSCRIPTION PLANS ---------- */
const PLANS = [
  { key: "free", name: "Free", price: 0, cadence: "forever", classCap: 1,
    features: ["1 class", "Up to 50 students", "Ram Ready template", "Community support"] },
  { key: "perCourse", name: "Per-Course", price: null, cadence: "billed per course", classCap: 1,
    features: ["1 class per purchase", "All 5 templates", "AI paper grader", "8 or 16-week pricing"] },
  { key: "semester", name: "Semester", price: 179, cadence: "per semester", classCap: 5,
    features: ["Up to 5 classes", "Writing coach", "Priority support"] },
  { key: "annual", name: "Annual", price: 549, cadence: "per year", classCap: 10,
    features: ["Up to 10 classes", "Save ~35% vs. semester", "Priority support", "Early access features"] },
  { key: "enterprise", name: "University Enterprise", price: null, cadence: "seat-based, billed to institution", classCap: Infinity,
    features: ["Unlimited classes & seats", "SIS / SSO sync", "Institution-managed data controls", "Dedicated onboarding"] },
];
const SEAT_CAP_PER_CLASS = 50;

/* ---------- MASTERMIND PORTFOLIO ---------- */
const PROJECTS = [
  { name: "EdNotebook", role: "Platform · this build", status: "Prototype live", repo: "github.com/BREXAtlas/EdNotebook", repoNote: "Repo not yet created — this build is ready to push as the first commit.", metric: "Synthetic demonstration workspace", color: "primary" },
  { name: "Example University", role: "Synthetic institution workspace", status: "Demo", repo: null, metric: "Demonstration records only", color: "good" },
  { name: "Ram Ready Digital Literacy", role: "Flagship demo · Ram Ready template source", status: "Live", repo: "github.com/Brexatlas/Digital-Literacy-Course", metric: "20 episodes across 4 acts", color: "good" },
  { name: "Ram Ready Financial Futures", role: "Sequel course, same template family", status: "Live", repo: "github.com/Brexatlas/Financial-Literacy-Course", metric: "Continues the Ram Ready sequence", color: "accentDark" },
];

/* ---------- TUTORIAL TOURS ---------- */
const TOURS = {
  professor: [
    { id: "t-forge", title: "Course Forge", text: "Paste any content — a syllabus, lecture notes, a chapter. This is where every course starts." },
    { id: "t-template", title: "Lesson templates", text: "The template decides the shape of every lesson. Ram Ready uses the six-question spine from the Digital Literacy course." },
    { id: "t-counts", title: "Set the volume", text: "Tell it how many lessons, quizzes, and knowledge checks you want. It builds to the number." },
    { id: "t-prompt", title: "Prompting guide", text: "Open this to learn how to phrase a request. Better input, better course." },
    { id: "t-generate", title: "Generate", text: "One click builds the full course map. Nothing goes live — it lands in your sandbox first." },
    { id: "t-map", title: "Content map", text: "Read the whole course at a glance. Click any lesson to open it." },
    { id: "t-editor", title: "Lesson editor", text: "Edit by hand, or ask the AI editor to change just that lesson. Undo and redo cover every change." },
    { id: "t-sandbox", title: "Sandbox", text: "Play the course exactly as a student will, before anyone is enrolled." },
    { id: "t-grader", title: "Paper grader", text: "Set your grading parameters, get a suggested grade with reasoning. You confirm — it never posts on its own." },
    { id: "t-classes", title: "Classes & plan", text: "Each class holds up to 50 students. Your plan controls how many classes you can run at once." },
  ],
  learner: [
    { id: "t-xp", title: "Your progress", text: "XP, level, and streak. Finishing lessons and passing checks moves all three." },
    { id: "t-mode", title: "Story or Focus", text: "Same material, two wrappers. Story adds narrative; Focus strips it to the essentials." },
    { id: "t-map2", title: "Quest map", text: "Your syllabus, but walkable. Green is done, gold is next, locked opens when you get there." },
    { id: "t-find", title: "Find classes", text: "Search by course code, title, or professor to find and join a class." },
    { id: "t-writer", title: "Paper writer", text: "Write inside the platform. Your professor's notes live right in the margin of your own draft." },
    { id: "t-coach", title: "Writing coach", text: "It won't rewrite your paper. It tells you what's weak and why, so the next paper is better on its own." },
  ],
  admin: [
    { id: "t-stats", title: "Institution pulse", text: "Live counts across every department running on the platform." },
    { id: "t-catalog", title: "Catalog", text: "Every course, its owner, and a health indicator based on learner activity." },
    { id: "t-ai", title: "AI governance", text: "Budget, usage split, and the policy line that matters: instructors approve all grades, data stays in your tenancy." },
    { id: "t-plugins", title: "Plug-ins", text: "Toggle integrations without a ticket. SIS sync, proctoring, library reserves." },
  ],
};

/* ============================================================
   PRIMITIVES
   ============================================================ */
function Card({ t, children, style, className, tour }) {
  return (
    <div data-tour={tour} className={"p-4 " + (className || "")}
      style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: t.radius, ...style }}>
      {children}
    </div>
  );
}
function Label({ t, children }) {
  return <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.slate, marginBottom: 8 }}>{children}</div>;
}
function Btn({ t, children, onClick, variant = "solid", size = "md", disabled, style, tour, full }) {
  const pads = { sm: "5px 11px", md: "9px 16px", lg: "13px 20px" };
  const fonts = { sm: 12, md: 14, lg: 16 };
  const base = { fontFamily: t.bodyFont, fontWeight: 600, fontSize: fonts[size], padding: pads[size],
    borderRadius: t.radius === "0px" ? "0px" : "999px", cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", opacity: disabled ? 0.45 : 1, width: full ? "100%" : "auto",
    transition: "transform .12s ease" };
  const variants = {
    solid: { background: t.primary, color: "#fff" },
    accent: { background: t.accent, color: t.ink },
    ghost: { background: "transparent", color: t.primary, border: `1px solid ${t.primary}` },
    quiet: { background: "transparent", color: t.slate, border: `1px solid ${t.line}` },
    danger: { background: "transparent", color: t.bad, border: `1px solid ${t.bad}` },
  };
  return (
    <button data-tour={tour} onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
      {children}
    </button>
  );
}
function Pill({ t, children, tone }) {
  const map = { Story: t.primary, Lab: t.good, Drill: t.accentDark, Seminar: t.bad };
  const c = map[children] || tone || t.slate;
  return <span style={{ fontFamily: t.mono, fontSize: 11, padding: "2px 9px", borderRadius: 999, background: c + "1A", color: c, whiteSpace: "nowrap" }}>{children}</span>;
}

/* ============================================================
   TUTORIAL OVERLAY
   ============================================================ */
function Tutorial({ t, steps, step, setStep, onClose }) {
  const [rect, setRect] = useState(null);
  const current = steps[step];
  useEffect(() => {
    if (!current) return;
    const find = () => {
      const el = document.querySelector(`[data-tour="${current.id}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }, 320);
      } else setRect(null);
    };
    find();
    window.addEventListener("resize", find);
    return () => window.removeEventListener("resize", find);
  }, [step, current]);

  if (!current) return null;
  const below = rect ? rect.top < window.innerHeight / 2 : true;
  const popTop = rect ? (below ? rect.top + rect.height + 22 : rect.top - 20) : window.innerHeight / 2;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90 }}>
      {rect ? (
        <div style={{ position: "fixed", top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
          borderRadius: t.radius, border: `2px solid ${t.accent}`, boxShadow: "0 0 0 9999px rgba(6,10,20,.72)", pointerEvents: "none" }} />
      ) : <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,20,.72)" }} />}
      {rect && (
        <div className="cc-arrow" style={{ position: "fixed", left: Math.min(rect.left + 18, window.innerWidth - 60),
          top: below ? rect.top + rect.height + 2 : rect.top - 22, color: t.accent, fontSize: 20, pointerEvents: "none",
          transform: below ? "none" : "rotate(180deg)" }}>▲</div>
      )}
      <div className="cc-pop" style={{ position: "fixed", left: 16, right: 16, maxWidth: 380, margin: "0 auto",
        top: Math.max(16, Math.min(popTop, window.innerHeight - 200)), transform: below ? "none" : "translateY(-100%)",
        background: t.card, border: `1px solid ${t.accent}`, borderRadius: t.radius, padding: 16, zIndex: 92 }}>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, letterSpacing: ".1em" }}>TUTORIAL · {step + 1} / {steps.length}</div>
        <div style={{ fontFamily: t.display, fontSize: 19, fontWeight: 700, color: t.ink, margin: "4px 0 6px" }}>{current.title}</div>
        <div style={{ fontFamily: t.bodyFont, fontSize: 14, color: t.body, lineHeight: 1.5 }}>{current.text}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <Btn t={t} variant="quiet" size="sm" onClick={onClose}>Skip tour</Btn>
          <div style={{ flex: 1 }} />
          {step > 0 && <Btn t={t} variant="ghost" size="sm" onClick={() => setStep(step - 1)}>Back</Btn>}
          <Btn t={t} variant="accent" size="sm" onClick={() => (step === steps.length - 1 ? onClose() : setStep(step + 1))}>
            {step === steps.length - 1 ? "Done" : "Next"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EPISODE PLAYER
   ============================================================ */
function EpisodePlayer({ t, episode, lesson, onExit, preview, onXP }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("sections");
  const [qi, setQi] = useState(0);
  const [quizAns, setQuizAns] = useState({});
  const [gained, setGained] = useState(0);
  const secs = lesson.sections;
  const check = lesson.knowledgeChecks?.find((k) => k.after === idx);
  const checkAnswered = check && answers[idx] !== undefined;
  const total = secs.length;
  const pct = phase === "sections" ? ((idx + 1) / (total + 1)) * 100 : phase === "quiz" ? 92 : 100;
  const next = () => { if (idx < total - 1) setIdx(idx + 1); else setPhase("quiz"); };

  return (
    <div className="cc-rise" style={{ fontFamily: t.bodyFont }}>
      <div style={{ position: "sticky", top: 52, zIndex: 5, background: t.paper, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Btn t={t} variant="quiet" size="sm" onClick={onExit}>← {preview ? "Exit preview" : "Map"}</Btn>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{episode.title}</div>
          {preview && <Pill t={t} tone={t.accentDark}>SANDBOX</Pill>}
        </div>
        <div style={{ height: 4, background: t.line, borderRadius: 999 }}>
          <div style={{ height: 4, width: `${pct}%`, background: t.accent, borderRadius: 999, transition: "width .4s ease" }} />
        </div>
      </div>

      {phase === "sections" && (
        <div key={idx} className="cc-rise">
          <Card t={t} style={{ marginTop: 12 }}>
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, letterSpacing: ".1em" }}>SECTION {idx + 1} OF {total}</div>
            <h2 style={{ fontFamily: t.display, fontSize: 22, fontWeight: 700, color: t.ink, margin: "6px 0 10px" }}>{secs[idx].heading}</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.68, color: t.body, margin: 0 }}>{secs[idx].body}</p>
          </Card>
          {check && (
            <Card t={t} style={{ marginTop: 10, borderColor: t.accent }} className="cc-rise">
              <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, letterSpacing: ".1em", marginBottom: 6 }}>KNOWLEDGE CHECK</div>
              <div style={{ fontWeight: 600, color: t.ink, marginBottom: 10 }}>{check.q}</div>
              {check.options.map((o, i) => {
                const picked = answers[idx] === i, right = i === check.answer;
                return (
                  <button key={i} onClick={() => { if (answers[idx] !== undefined) return; setAnswers({ ...answers, [idx]: i }); if (right) { setGained((g) => g + 25); onXP && onXP(25); } }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 7,
                      borderRadius: t.radius === "0px" ? 0 : 12, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: t.bodyFont, color: t.ink,
                      border: `1px solid ${picked ? (right ? t.good : t.bad) : t.line}`, background: picked ? (right ? t.good + "18" : t.bad + "18") : "transparent" }}>
                    {o}
                  </button>
                );
              })}
              {checkAnswered && (
                <div className="cc-rise" style={{ background: t.paper, padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, marginTop: 4 }}>
                  <div style={{ fontFamily: t.mono, fontSize: 11, color: answers[idx] === check.answer ? t.good : t.bad, marginBottom: 3 }}>
                    {answers[idx] === check.answer ? "CORRECT · +25 XP" : "NOT QUITE"}
                  </div>
                  <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{check.why}</div>
                </div>
              )}
            </Card>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {idx > 0 && <Btn t={t} variant="quiet" onClick={() => setIdx(idx - 1)}>Back</Btn>}
            <Btn t={t} variant="accent" full onClick={next} disabled={check && !checkAnswered}>
              {check && !checkAnswered ? "Answer to continue" : idx === total - 1 ? "Take the quiz →" : "Continue →"}
            </Btn>
          </div>
        </div>
      )}

      {phase === "quiz" && lesson.quiz && (
        <div className="cc-rise">
          <Card t={t} style={{ marginTop: 12, borderColor: t.primary }}>
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.primary, letterSpacing: ".1em" }}>END QUIZ · {qi + 1} OF {lesson.quiz.length}</div>
            <div style={{ fontFamily: t.display, fontSize: 18, fontWeight: 700, color: t.ink, margin: "8px 0 12px" }}>{lesson.quiz[qi].q}</div>
            {lesson.quiz[qi].options.map((o, i) => {
              const picked = quizAns[qi] === i, right = i === lesson.quiz[qi].answer;
              return (
                <button key={i} onClick={() => { if (quizAns[qi] !== undefined) return; setQuizAns({ ...quizAns, [qi]: i }); if (right) { setGained((g) => g + 50); onXP && onXP(50); } }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 7,
                    borderRadius: t.radius === "0px" ? 0 : 12, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: t.bodyFont, color: t.ink,
                    border: `1px solid ${picked ? (right ? t.good : t.bad) : t.line}`, background: picked ? (right ? t.good + "18" : t.bad + "18") : "transparent" }}>
                  {o}
                </button>
              );
            })}
            {quizAns[qi] !== undefined && (
              <>
                <div className="cc-rise" style={{ background: t.paper, padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{lesson.quiz[qi].why}</div>
                <Btn t={t} variant="accent" full style={{ marginTop: 10 }} onClick={() => (qi < lesson.quiz.length - 1 ? setQi(qi + 1) : setPhase("done"))}>
                  {qi < lesson.quiz.length - 1 ? "Next question →" : "Finish lesson"}
                </Btn>
              </>
            )}
          </Card>
        </div>
      )}

      {phase === "done" && (
        <Card t={t} className="cc-pop" style={{ marginTop: 12, textAlign: "center", borderColor: t.accent }}>
          <div className="cc-badge" style={{ fontSize: 44 }}>🏅</div>
          <div style={{ fontFamily: t.display, fontSize: 24, fontWeight: 700, color: t.ink, marginTop: 6 }}>Lesson complete</div>
          <div style={{ fontFamily: t.mono, fontSize: 13, color: t.accentDark, marginTop: 4 }}>+{gained} XP earned</div>
          <div style={{ fontSize: 14, color: t.body, marginTop: 8 }}>{preview ? "This is exactly what your students will see." : "Next episode unlocked."}</div>
          <Btn t={t} variant="accent" full style={{ marginTop: 14 }} onClick={onExit}>{preview ? "Back to editor" : "Back to quest map"}</Btn>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   COURSE FORGE
   ============================================================ */
function CourseForge({ t, setCourse, pushHistory }) {
  const [pasted, setPasted] = useState("");
  const [tpl, setTpl] = useState("ramready");
  const [model, setModel] = useState("Claude Sonnet");
  const [counts, setCounts] = useState({ lessons: 8, quizzes: 2, checks: 2 });
  const [showPrompt, setShowPrompt] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [stepI, setStepI] = useState(0);
  const [demo, setDemo] = useState(false);

  const STEPS = ["Reading your content…", "Detecting concepts and dependencies…", `Applying the ${TEMPLATES[tpl].name} template…`, `Structuring ${counts.lessons} lessons…`, "Writing knowledge checks…"];

  useEffect(() => {
    if (phase !== "building") return;
    if (stepI < STEPS.length - 1) { const id = setTimeout(() => setStepI(stepI + 1), 850); return () => clearTimeout(id); }
  }, [phase, stepI]);

  const generate = async () => {
    setPhase("building"); setStepI(0); setDemo(false);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content:
`You are the course-generation engine in a university LMS. Build a course MAP (titles only) from the professor's content.
Template: "${TEMPLATES[tpl].name}" — ${TEMPLATES[tpl].desc}
Group unit "${TEMPLATES[tpl].group}", lesson unit "${TEMPLATES[tpl].unit}". Total lessons: exactly ${counts.lessons}, across 3 groups.
Return ONLY valid JSON, no fences:
{"courseTitle":string,"subtitle":string,"acts":[{"title":string,"episodes":[{"id":string,"title":string,"type":"Story"|"Lab"|"Drill"|"Seminar","minutes":number}]}]}
Titles must be vivid and specific, not generic. Vary the types.
Professor's content:
${pasted.slice(0, 3500)}` }] }),
      });
      const d = await r.json();
      const text = d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      parsed.templateKey = tpl;
      setCourse(parsed); pushHistory(parsed);
      setPhase("done");
    } catch (e) {
      setCourse(DEMO_COURSE); pushHistory(DEMO_COURSE); setDemo(true); setPhase("done");
    }
  };

  return (
    <div className="cc-rise">
      <div style={{ background: t.heroGrad, borderRadius: t.radius, padding: 20, marginBottom: 14, color: "#fff" }}>
        <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: ".14em", color: t.accent }}>COURSE FORGE</div>
        <h1 style={{ fontFamily: t.display, fontSize: 26, fontWeight: 700, margin: "6px 0 4px" }}>Paste your content. We transform it.</h1>
        <p style={{ fontSize: 14, opacity: 0.82, margin: 0, lineHeight: 1.5 }}>A syllabus, lecture notes, a chapter outline. You get an interactive course you can read, edit, test, and deploy.</p>
      </div>

      <Card t={t} tour="t-forge" style={{ marginBottom: 12 }}>
        <Label t={t}>1 · Paste your content</Label>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4}
          placeholder="e.g. SCI 101 — introduction to the cell: membrane structure, organelles, energy, and division."
          style={{ width: "100%", padding: 12, fontSize: 14, fontFamily: t.bodyFont, color: t.ink, background: t.paper,
            border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
        <div style={{ marginTop: 12 }} data-tour="t-prompt">
          <button onClick={() => setShowPrompt(!showPrompt)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: t.mono, fontSize: 12, color: t.primary }}>
            {showPrompt ? "▾" : "▸"} How to prompt this well
          </button>
          {showPrompt && (
            <div className="cc-rise" style={{ background: t.paper, padding: 12, borderRadius: t.radius === "0px" ? 0 : 12, marginTop: 8, fontSize: 13.5, color: t.body, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: t.ink, marginBottom: 6 }}>Three things make the difference:</div>
              <div style={{ marginBottom: 8 }}><strong>1. Name the level and the audience.</strong> "First-semester non-majors, no chemistry background" produces a very different course than "sophomore biology majors."</div>
              <div style={{ marginBottom: 8 }}><strong>2. State the destination.</strong> "By the end they should be able to explain why cells are small" beats "cover cell structure."</div>
              <div style={{ marginBottom: 8 }}><strong>3. Give it your constraints.</strong> Exam dates, required readings, lab weeks, department outcomes — paste them in and they get built around.</div>
              <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginBottom: 4 }}>WORKING EXAMPLE</div>
                <em>"SCI 101, non-majors, no chem prerequisite. Eight lessons on the cell. They should leave able to explain why a membrane costs energy and why cells stay small. Lab weeks are 2 and 4."</em>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card t={t} tour="t-template" style={{ marginBottom: 12 }}>
        <Label t={t}>2 · Lesson template</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(TEMPLATES).map(([k, v]) => (
            <button key={k} onClick={() => setTpl(k)} style={{ padding: "6px 13px", borderRadius: t.radius === "0px" ? 0 : 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: t.bodyFont, border: `1px solid ${tpl === k ? t.primary : t.line}`, background: tpl === k ? t.primary : "transparent", color: tpl === k ? "#fff" : t.slate }}>
              {v.name}{k === "ramready" && " ★"}
            </button>
          ))}
        </div>
        <div style={{ background: t.paper, padding: 11, borderRadius: t.radius === "0px" ? 0 : 12 }}>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, marginBottom: 4 }}>{TEMPLATES[tpl].tag.toUpperCase()}{tpl === "ramready" && " · FROM RAM READY DIGITAL LITERACY"}</div>
          <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5, marginBottom: 8 }}>{TEMPLATES[tpl].desc}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{TEMPLATES[tpl].sections.map((s) => <Pill key={s} t={t} tone={t.slate}>{s}</Pill>)}</div>
        </div>
      </Card>

      <Card t={t} tour="t-counts" style={{ marginBottom: 12 }}>
        <Label t={t}>3 · How much of everything</Label>
        {[{ k: "lessons", label: "Lessons", min: 3, max: 20 }, { k: "quizzes", label: "Quiz questions per lesson", min: 0, max: 8 }, { k: "checks", label: "Knowledge checks per lesson", min: 0, max: 6 }].map((row) => (
          <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
            <div style={{ flex: 1, fontSize: 14, color: t.ink, fontWeight: 500 }}>{row.label}</div>
            <Btn t={t} variant="quiet" size="sm" onClick={() => setCounts({ ...counts, [row.k]: Math.max(row.min, counts[row.k] - 1) })}>−</Btn>
            <div style={{ fontFamily: t.mono, fontSize: 16, color: t.ink, minWidth: 24, textAlign: "center" }}>{counts[row.k]}</div>
            <Btn t={t} variant="quiet" size="sm" onClick={() => setCounts({ ...counts, [row.k]: Math.min(row.max, counts[row.k] + 1) })}>+</Btn>
          </div>
        ))}
      </Card>

      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>4 · Model</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Claude Sonnet", "Claude Haiku", "Campus model"].map((m) => (
            <button key={m} onClick={() => setModel(m)} style={{ padding: "6px 13px", borderRadius: t.radius === "0px" ? 0 : 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: t.bodyFont, border: `1px solid ${model === m ? t.primary : t.line}`, background: model === m ? t.primary : "transparent", color: model === m ? "#fff" : t.slate }}>
              {m}
            </button>
          ))}
        </div>
      </Card>

      <Btn t={t} variant="accent" size="lg" full tour="t-generate" onClick={generate} disabled={phase === "building" || pasted.trim().length < 10} style={{ fontFamily: t.display, marginBottom: 12 }}>
        {phase === "building" ? "Forging…" : "⚡ Generate course"}
      </Btn>

      {phase === "building" && (
        <Card t={t} className="cc-rise">
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0" }}>
              <span className={i === stepI ? "cc-dot" : ""} style={{ width: 7, height: 7, borderRadius: 99, background: i <= stepI ? t.primary : t.line, display: "inline-block" }} />
              <span style={{ fontSize: 13.5, color: i <= stepI ? t.ink : t.slate }}>{s}</span>
              {i < stepI && <span style={{ color: t.good }}>✓</span>}
            </div>
          ))}
        </Card>
      )}
      {demo && phase === "done" && <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, textAlign: "center" }}>demo course loaded — connection unavailable</div>}
    </div>
  );
}

/* ============================================================
   CONTENT MAP + LESSON EDITOR
   ============================================================ */
function CourseWorkspace({ t, course, setCourse, lessons, setLessons, history, hIdx, undo, redo, pushHistory, onPreview }) {
  const [openId, setOpenId] = useState(null);
  const [askOpen, setAskOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);

  if (!course) return null;
  const tplSections = TEMPLATES[course.templateKey || "ramready"].sections;
  const allEps = course.acts.flatMap((a) => a.episodes);
  const openEp = allEps.find((e) => e.id === openId);
  const lesson = openId ? lessons[openId] : null;

  const genLesson = async (ep) => {
    setBusy(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content:
`Write ONE lesson for "${course.courseTitle}". Lesson title: "${ep.title}". Type: ${ep.type}.
Use exactly these section headings in order: ${tplSections.join(" | ")}.
Each section body: 55-90 words, concrete, undergrad level.
Return ONLY JSON, no fences:
{"sections":[{"heading":string,"body":string}],"knowledgeChecks":[{"after":number,"q":string,"options":[string,string,string,string],"answer":number,"why":string}],"quiz":[{"q":string,"options":[string,string,string,string],"answer":number,"why":string}]}
Include 2 knowledgeChecks (after = section index they follow) and 2 quiz questions. "why" explains reasoning.` }] }),
      });
      const d = await r.json();
      const text = d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const nl = { ...lessons, [ep.id]: parsed }; setLessons(nl); pushHistory(course, nl);
    } catch { const nl = { ...lessons, [ep.id]: DEMO_LESSON }; setLessons(nl); pushHistory(course, nl); }
    setBusy(false);
  };

  const askEditor = async () => {
    if (!ask.trim() || !lesson) return;
    setBusy(true);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content:
`Revise this lesson per the instructor's request. Keep the same JSON shape and section headings unless asked to change them.
Instructor request: "${ask}"
Current lesson JSON:
${JSON.stringify(lesson).slice(0, 3000)}
Return ONLY the revised JSON, no fences.` }] }),
      });
      const d = await r.json();
      const text = d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      const nl = { ...lessons, [openId]: parsed }; setLessons(nl); pushHistory(course, nl); setAsk(""); setAskOpen(false);
    } catch { setAsk(""); }
    setBusy(false);
  };

  const editSection = (si, val) => {
    const nl = { ...lessons, [openId]: { ...lesson, sections: lesson.sections.map((s, i) => i === si ? { ...s, body: val } : s) } };
    setLessons(nl);
  };
  const deleteEpisode = (epId) => {
    const nc = { ...course, acts: course.acts.map((a) => ({ ...a, episodes: a.episodes.filter((e) => e.id !== epId) })) };
    setCourse(nc); pushHistory(nc, lessons); setOpenId(null);
  };

  if (openEp) {
    return (
      <div className="cc-rise">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <Btn t={t} variant="quiet" size="sm" onClick={() => setOpenId(null)}>← Map</Btn>
          <Btn t={t} variant="quiet" size="sm" onClick={undo} disabled={hIdx <= 0}>↶ Undo</Btn>
          <Btn t={t} variant="quiet" size="sm" onClick={redo} disabled={hIdx >= history.length - 1}>↷ Redo</Btn>
          <div style={{ flex: 1 }} />
          <Btn t={t} variant="danger" size="sm" onClick={() => deleteEpisode(openEp.id)}>Delete lesson</Btn>
        </div>
        <Card t={t} tour="t-editor" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Pill t={t}>{openEp.type}</Pill><span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{openEp.minutes} min</span>
          </div>
          <div style={{ fontFamily: t.display, fontSize: 21, fontWeight: 700, color: t.ink }}>{openEp.title}</div>
        </Card>
        {!lesson && (
          <Card t={t} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: t.body, marginBottom: 12 }}>This lesson is a title so far. Generate the full body using the {TEMPLATES[course.templateKey || "ramready"].name} template.</div>
            <Btn t={t} variant="accent" full onClick={() => genLesson(openEp)} disabled={busy}>{busy ? "Writing…" : "Generate full lesson"}</Btn>
          </Card>
        )}
        {lesson && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Btn t={t} variant="accent" onClick={() => onPreview(openEp, lesson)} full>▶ Preview as student</Btn>
              <Btn t={t} variant="ghost" onClick={() => setAskOpen(!askOpen)}>✎ Ask editor</Btn>
            </div>
            {askOpen && (
              <Card t={t} className="cc-rise" style={{ marginBottom: 12, borderColor: t.primary }}>
                <Label t={t}>Lesson editor · applies to this lesson only</Label>
                <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} placeholder="e.g. Make section 3 harder and add a real-world example about kidney dialysis."
                  style={{ width: "100%", padding: 10, fontSize: 14, fontFamily: t.bodyFont, color: t.ink, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                <Btn t={t} variant="solid" full style={{ marginTop: 8 }} onClick={askEditor} disabled={busy || !ask.trim()}>{busy ? "Revising…" : "Apply change"}</Btn>
              </Card>
            )}
            {lesson.sections.map((s, si) => (
              <Card t={t} key={si} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, letterSpacing: ".1em", marginBottom: 5 }}>{s.heading.toUpperCase()}</div>
                <textarea value={s.body} onChange={(e) => editSection(si, e.target.value)} rows={4}
                  style={{ width: "100%", padding: 10, fontSize: 14.5, lineHeight: 1.6, fontFamily: t.bodyFont, color: t.body, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 10, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                {lesson.knowledgeChecks?.filter((k) => k.after === si).map((k, ki) => (
                  <div key={ki} style={{ marginTop: 8, padding: 10, background: t.accent + "12", borderRadius: t.radius === "0px" ? 0 : 10, border: `1px solid ${t.accent}44` }}>
                    <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accentDark, marginBottom: 4 }}>KNOWLEDGE CHECK HERE</div>
                    <div style={{ fontSize: 13.5, color: t.ink, fontWeight: 600 }}>{k.q}</div>
                    <div style={{ fontSize: 12.5, color: t.good, marginTop: 3 }}>✓ {k.options[k.answer]}</div>
                  </div>
                ))}
              </Card>
            ))}
            <Card t={t} style={{ marginBottom: 12, borderColor: t.primary }}>
              <Label t={t}>End quiz · {lesson.quiz?.length || 0} questions</Label>
              {lesson.quiz?.map((q, i) => (
                <div key={i} style={{ padding: "7px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{q.q}</div>
                  <div style={{ fontSize: 13, color: t.good, marginTop: 3 }}>✓ {q.options[q.answer]}</div>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="cc-rise">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Btn t={t} variant="quiet" size="sm" onClick={undo} disabled={hIdx <= 0}>↶ Undo</Btn>
        <Btn t={t} variant="quiet" size="sm" onClick={redo} disabled={hIdx >= history.length - 1}>↷ Redo</Btn>
        <div style={{ flex: 1 }} />
        <Pill t={t} tone={live ? t.good : t.accentDark}>{live ? "LIVE" : "SANDBOX"}</Pill>
      </div>
      <Card t={t} tour="t-map" style={{ marginBottom: 12 }}>
        <Label t={t}>Content map · read the whole course without clicking through</Label>
        <div style={{ fontFamily: t.display, fontSize: 22, fontWeight: 700, color: t.ink }}>{course.courseTitle}</div>
        {course.subtitle && <div style={{ fontSize: 14, color: t.slate, marginTop: 2 }}>{course.subtitle}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Pill t={t} tone={t.primary}>{TEMPLATES[course.templateKey || "ramready"].name} template</Pill>
          <Pill t={t} tone={t.slate}>{allEps.length} lessons</Pill>
          <Pill t={t} tone={t.slate}>{Object.keys(lessons).length} written</Pill>
        </div>
      </Card>
      {course.acts.map((act, ai) => (
        <div key={ai} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: t.display, fontSize: 16, fontWeight: 700, color: t.primaryDark, marginBottom: 7 }}>{act.title}</div>
          {act.episodes.map((ep) => {
            const written = !!lessons[ep.id];
            return (
              <button key={ep.id} onClick={() => setOpenId(ep.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, marginBottom: 7, cursor: "pointer" }}>
                <Card t={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: written ? t.good : t.line, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{ep.title}</div>
                    <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 2 }}>{ep.minutes} min · {written ? "written" : "title only"}</div>
                  </div>
                  <Pill t={t}>{ep.type}</Pill>
                </Card>
              </button>
            );
          })}
        </div>
      ))}
      <Card t={t} tour="t-sandbox" style={{ marginBottom: 12, borderColor: t.accent }}>
        <Label t={t}>Sandbox</Label>
        <div style={{ fontSize: 14, color: t.body, lineHeight: 1.55, marginBottom: 10 }}>Nothing here is visible to students yet. Open any written lesson and hit <strong>Preview as student</strong>, then publish when it holds up.</div>
        <Btn t={t} variant={live ? "quiet" : "solid"} full onClick={() => setLive(!live)}>{live ? "Unpublish · return to sandbox" : "Publish course to this class"}</Btn>
      </Card>
    </div>
  );
}

/* ============================================================
   PROPRIETARY MANUSCRIPT — professor review side
   ============================================================ */
function ManuscriptReview({ t, manuscript, setManuscript }) {
  const [openFor, setOpenFor] = useState(null);
  const [draft, setDraft] = useState("");

  const addComment = (pid) => {
    if (!draft.trim()) return;
    setManuscript({ ...manuscript, paragraphs: manuscript.paragraphs.map((p) => p.id === pid
      ? { ...p, comments: [...p.comments, { id: "c" + Date.now(), author: manuscript.professor, role: "Professor", text: draft, resolved: false }] } : p) });
    setDraft(""); setOpenFor(null);
  };
  const toggleResolve = (pid, cid) => {
    setManuscript({ ...manuscript, paragraphs: manuscript.paragraphs.map((p) => p.id === pid
      ? { ...p, comments: p.comments.map((c) => c.id === cid ? { ...c, resolved: !c.resolved } : c) } : p) });
  };

  return (
    <div>
      <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginBottom: 10 }}>
        EDUSYNC FORMAT · comments live inside the draft — the student sees exactly what you write, pinned to the paragraph
      </div>
      {manuscript.paragraphs.map((p) => (
        <div key={p.id} style={{ marginBottom: 10 }}>
          <div style={{ background: t.paper, padding: 11, borderRadius: t.radius === "0px" ? 0 : 10, fontFamily: "'Newsreader', serif", fontSize: 14.5, lineHeight: 1.65, color: t.ink }}>{p.text}</div>
          {p.comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 7, marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${c.resolved ? t.good : t.accent}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: t.mono, fontSize: 10, color: c.resolved ? t.good : t.accentDark }}>{c.author.toUpperCase()} {c.resolved ? "· ADDRESSED" : "· OPEN"}</div>
                <div style={{ fontSize: 13, color: t.body, lineHeight: 1.5 }}>{c.text}</div>
              </div>
              <button onClick={() => toggleResolve(p.id, c.id)} style={{ fontFamily: t.mono, fontSize: 10, color: t.slate, background: "transparent", border: `1px solid ${t.line}`, borderRadius: 999, padding: "2px 8px", cursor: "pointer", height: "fit-content" }}>
                {c.resolved ? "reopen" : "resolve"}
              </button>
            </div>
          ))}
          {openFor === p.id ? (
            <div style={{ marginTop: 6 }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Write a note pinned to this paragraph…"
                style={{ width: "100%", padding: 8, fontSize: 13, fontFamily: t.bodyFont, color: t.ink, background: t.card, border: `1px solid ${t.primary}`, borderRadius: t.radius === "0px" ? 0 : 10, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <Btn t={t} variant="solid" size="sm" onClick={() => addComment(p.id)}>Post note</Btn>
                <Btn t={t} variant="quiet" size="sm" onClick={() => { setOpenFor(null); setDraft(""); }}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <button onClick={() => setOpenFor(p.id)} style={{ marginTop: 5, background: "transparent", border: "none", cursor: "pointer", fontFamily: t.mono, fontSize: 11, color: t.primary, padding: 0 }}>+ comment on this paragraph</button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- PAPER GRADER ---------- */
function PaperGrader({ t, manuscript, setManuscript }) {
  const subs = [
    { id: 1, student: "A. Rivera", title: manuscript.title, words: 96, style: manuscript.style, status: "ungraded", live: true },
    { id: 2, student: "D. Whitfield", title: "Cells and Energy", words: 620, style: "MLA", status: "ungraded", excerpt: "Cells need energy. The mitochondria makes the energy for the cell. Without energy the cell dies. This is why mitochondria is the powerhouse of the cell..." },
    { id: 3, student: "S. Patel", title: "Endosymbiosis Reconsidered", words: 1420, style: "Chicago", status: "graded", grade: 94, excerpt: "Margulis's endosymbiotic theory was met with sustained resistance, and the reasons for that resistance are instructive about how evidence becomes consensus..." },
  ];
  const [openId, setOpenId] = useState(null);
  const [params, setParams] = useState([
    { name: "Thesis clarity", weight: 25, on: true }, { name: "Use of evidence", weight: 30, on: true },
    { name: "Organization", weight: 20, on: true }, { name: "Style compliance", weight: 15, on: true }, { name: "Mechanics", weight: 10, on: true },
  ]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [graded, setGraded] = useState({});

  const open = subs.find((s) => s.id === openId);
  const bodyText = open?.live ? manuscript.paragraphs.map((p) => p.text).join(" ") : open?.excerpt;

  const suggest = async () => {
    setBusy(true); setResult(null);
    const active = params.filter((p) => p.on);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content:
`You are a grading assistant producing a SUGGESTED grade only — a human instructor confirms it.
Rubric: ${active.map((p) => `${p.name} ${p.weight}%`).join(", ")}. Required style: ${open.style}. Length: ${open.words} words.
Paper excerpt: "${bodyText}"
Return ONLY JSON, no fences:
{"suggested":number 0-100,"criteria":[{"name":string,"score":number,"note":string}],"strength":string,"growth":string}
"growth" must teach — explain WHY something is weak and what to practice, never rewrite it.` }] }),
      });
      const d = await r.json();
      const text = d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      setResult(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      setResult({
        suggested: open.words < 800 ? 71 : 89,
        criteria: active.map((p) => ({ name: p.name, score: open.words < 800 ? 68 + Math.round(Math.random() * 8) : 85 + Math.round(Math.random() * 10), note: "Assessed against the submitted draft." })),
        strength: open.words < 800 ? "The core claim is stated plainly and never contradicts itself." : "Sources are integrated into the argument rather than dropped in as blocks.",
        growth: open.words < 800
          ? "Paragraphs are stating facts and stopping. A paragraph earns its place when it does something with the fact. Try this: after each factual sentence, write one sentence beginning 'which means…' and see which ones you keep."
          : "The counterargument section concedes too fast. Practice naming the strongest version of the opposing view before you answer it.",
      });
    }
    setBusy(false);
  };

  if (open) {
    return (
      <div className="cc-rise">
        <Btn t={t} variant="quiet" size="sm" onClick={() => { setOpenId(null); setResult(null); setFeedback(""); }} style={{ marginBottom: 12 }}>← Submissions</Btn>
        <Card t={t} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Pill t={t} tone={t.primary}>{open.style}</Pill>
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{open.words} words</span>
            {open.live && <Pill t={t} tone={t.accentDark}>EDUSYNC LIVE DOC</Pill>}
          </div>
          <div style={{ fontFamily: t.display, fontSize: 20, fontWeight: 700, color: t.ink }}>{open.title}</div>
          <div style={{ fontSize: 13, color: t.slate, marginBottom: 10 }}>{open.student}</div>
          {open.live ? <ManuscriptReview t={t} manuscript={manuscript} setManuscript={setManuscript} />
            : <div style={{ background: t.paper, padding: 12, borderRadius: t.radius === "0px" ? 0 : 12, fontSize: 14.5, lineHeight: 1.65, color: t.body }}>{open.excerpt}</div>}
        </Card>

        <Card t={t} style={{ marginBottom: 12 }}>
          <Label t={t}>Grading parameters</Label>
          {params.map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
              <button onClick={() => setParams(params.map((x, j) => j === i ? { ...x, on: !x.on } : x))}
                style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${p.on ? t.primary : t.line}`, background: p.on ? t.primary : "transparent", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>
                {p.on ? "✓" : ""}
              </button>
              <div style={{ flex: 1, fontSize: 14, color: p.on ? t.ink : t.slate }}>{p.name}</div>
              <input type="range" min="5" max="50" step="5" value={p.weight} onChange={(e) => setParams(params.map((x, j) => j === i ? { ...x, weight: +e.target.value } : x))} style={{ width: 90, accentColor: t.primary }} />
              <div style={{ fontFamily: t.mono, fontSize: 12, color: t.slate, width: 34, textAlign: "right" }}>{p.weight}%</div>
            </div>
          ))}
          <Btn t={t} variant="accent" full style={{ marginTop: 10 }} onClick={suggest} disabled={busy}>{busy ? "Reading the paper…" : "Suggest a grade"}</Btn>
        </Card>

        {result && (
          <Card t={t} className="cc-rise" style={{ marginBottom: 12, borderColor: t.accent }}>
            <Label t={t}>Suggested — you confirm</Label>
            <div style={{ textAlign: "center", padding: "6px 0 12px" }}>
              <div style={{ fontFamily: t.display, fontSize: 46, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{result.suggested}</div>
              <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>SUGGESTED · NOT POSTED</div>
            </div>
            {result.criteria.map((c, i) => (
              <div key={i} style={{ padding: "7px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: t.ink, fontWeight: 600 }}>{c.name}</span><span style={{ fontFamily: t.mono, color: t.slate }}>{c.score}</span></div>
                <div style={{ fontSize: 13, color: t.body, marginTop: 2, lineHeight: 1.45 }}>{c.note}</div>
              </div>
            ))}
            <div style={{ background: t.good + "14", padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, marginTop: 10 }}>
              <div style={{ fontFamily: t.mono, fontSize: 10, color: t.good, marginBottom: 3 }}>WORKING WELL</div>
              <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{result.strength}</div>
            </div>
            <div style={{ background: t.accent + "16", padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, marginTop: 8 }}>
              <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accentDark, marginBottom: 3 }}>TEACH, DON'T REWRITE</div>
              <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{result.growth}</div>
            </div>
            <Label t={t}><span style={{ marginTop: 14, display: "block" }}>Your feedback to the student</span></Label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Add your own note — this is what the student sees first."
              style={{ width: "100%", padding: 10, fontSize: 14, fontFamily: t.bodyFont, color: t.ink, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn t={t} variant="solid" full onClick={() => { setGraded({ ...graded, [open.id]: result.suggested }); setOpenId(null); setResult(null); }}>Confirm {result.suggested} & send</Btn>
              <Btn t={t} variant="quiet" onClick={suggest}>↻</Btn>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="cc-rise" data-tour="t-grader">
      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>Paper grader</Label>
        <div style={{ fontSize: 14, color: t.body, lineHeight: 1.55 }}>Set your rubric, get a suggested grade with reasoning, then confirm or override. Nothing posts without you.</div>
      </Card>
      {subs.map((s) => (
        <button key={s.id} onClick={() => setOpenId(s.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, marginBottom: 8, cursor: "pointer" }}>
          <Card t={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{s.title}{s.live && " ✎"}</div>
              <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 2 }}>{s.student} · {s.words} words · {s.style}</div>
            </div>
            {graded[s.id] ? <Pill t={t} tone={t.good}>{`Graded ${graded[s.id]}`}</Pill>
              : s.status === "graded" ? <Pill t={t} tone={t.good}>{`Graded ${s.grade}`}</Pill> : <Pill t={t} tone={t.accentDark}>Needs grade</Pill>}
          </Card>
        </button>
      ))}
    </div>
  );
}

/* ---------- DISCUSSION + GROUPS ---------- */
function CommunityPanel({ t, asProfessor }) {
  const [threads, setThreads] = useState(SEED_DISCUSSIONS);
  const [draft, setDraft] = useState("");
  return (
    <div className="cc-rise">
      <Label t={t}>Discussion</Label>
      <Card t={t} style={{ marginBottom: 12 }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={asProfessor ? "Post a prompt to the class…" : "Ask the class something…"}
          style={{ width: "100%", padding: 10, fontSize: 14, fontFamily: t.bodyFont, color: t.ink, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 12, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
        <Btn t={t} variant="solid" size="sm" style={{ marginTop: 8 }} disabled={!draft.trim()}
          onClick={() => { setThreads([{ id: Date.now(), author: asProfessor ? "Dr. Nguyen" : "You", role: asProfessor ? "Professor" : "Learner", time: "now", text: draft, replies: [] }, ...threads]); setDraft(""); }}>Post</Btn>
      </Card>
      {threads.map((th) => (
        <Card t={t} key={th.id} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{th.author}</span>
            <Pill t={t} tone={th.role === "Professor" ? t.primary : t.slate}>{th.role}</Pill>
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginLeft: "auto" }}>{th.time}</span>
          </div>
          <div style={{ fontSize: 14.5, color: t.body, lineHeight: 1.55 }}>{th.text}</div>
          {th.replies.map((r, i) => (
            <div key={i} style={{ marginTop: 9, paddingLeft: 11, borderLeft: `2px solid ${t.primary}` }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 3 }}><span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{r.author}</span><Pill t={t} tone={t.primary}>{r.role}</Pill></div>
              <div style={{ fontSize: 14, color: t.body, lineHeight: 1.5 }}>{r.text}</div>
            </div>
          ))}
        </Card>
      ))}
      <Label t={t}><span style={{ marginTop: 16, display: "block" }}>Group assignments</span></Label>
      {SEED_GROUPS.map((g, i) => (
        <Card t={t} key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{g.name}</div><Pill t={t} tone={t.accentDark}>Due {g.due}</Pill></div>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, margin: "4px 0 7px" }}>{g.members.join(" · ")}</div>
          <div style={{ height: 5, background: t.line, borderRadius: 999 }}><div style={{ height: 5, width: `${g.progress}%`, background: g.progress > 50 ? t.good : t.accent, borderRadius: 999 }} /></div>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   SUBSCRIPTION PLANS / UPGRADE MODAL
   ============================================================ */
function PlanCard({ t, plan, current, courseLength, setCourseLength, onChoose }) {
  const isPerCourse = plan.key === "perCourse";
  const price = isPerCourse ? (courseLength === "8" ? 59 : 99) : plan.price;
  return (
    <Card t={t} style={{ marginBottom: 10, borderColor: current === plan.key ? t.accent : t.line }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: t.display, fontSize: 17, fontWeight: 700, color: t.ink }}>{plan.name}</div>
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{plan.cadence}</div>
        </div>
        {current === plan.key && <Pill t={t} tone={t.accentDark}>CURRENT</Pill>}
      </div>
      <div style={{ margin: "8px 0" }}>
        {price === null && plan.key !== "enterprise" ? <span style={{ fontFamily: t.display, fontSize: 15, color: t.ink }}>See below</span>
          : plan.key === "enterprise" ? <span style={{ fontFamily: t.display, fontSize: 22, fontWeight: 700, color: t.ink }}>Custom</span>
          : <><span style={{ fontFamily: t.display, fontSize: 28, fontWeight: 700, color: t.ink }}>${price}</span><span style={{ fontFamily: t.mono, fontSize: 12, color: t.slate }}> {plan.cadence}</span></>}
      </div>
      {isPerCourse && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["8", "16"].map((wk) => (
            <button key={wk} onClick={() => setCourseLength(wk)} style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: t.bodyFont, border: `1px solid ${courseLength === wk ? t.primary : t.line}`, background: courseLength === wk ? t.primary : "transparent", color: courseLength === wk ? "#fff" : t.slate }}>
              {wk}-week course
            </button>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        {plan.features.map((f, i) => <div key={i} style={{ fontSize: 13, color: t.body, padding: "2px 0" }}>✓ {f}</div>)}
      </div>
      <Btn t={t} variant={current === plan.key ? "quiet" : plan.key === "enterprise" ? "ghost" : "accent"} full disabled={current === plan.key} onClick={() => onChoose(plan.key)}>
        {current === plan.key ? "Current plan" : plan.key === "enterprise" ? "Talk to sales" : "Choose plan"}
      </Btn>
    </Card>
  );
}
function UpgradeModal({ t, plan, setPlan, courseLength, setCourseLength, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,20,.72)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="cc-pop" style={{ background: t.paper, borderRadius: `${t.radius} ${t.radius} 0 0`, maxWidth: 460, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: t.display, fontSize: 20, fontWeight: 700, color: t.ink }}>Plans</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: t.slate, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginBottom: 12 }}>Every class holds up to {SEAT_CAP_PER_CLASS} students. Your plan controls how many classes run at once. UI only in this prototype — wire to Stripe or your billing provider for real charges.</div>
        {PLANS.map((p) => <PlanCard key={p.key} t={t} plan={p} current={plan} courseLength={courseLength} setCourseLength={setCourseLength} onChoose={(k) => { if (k !== "enterprise") setPlan(k); onClose(); }} />)}
      </div>
    </div>
  );
}

/* ============================================================
   STUDENT PAPER WRITER (proprietary manuscript, student side)
   ============================================================ */
function PaperWriter({ t, manuscript, setManuscript }) {
  const [cover, setCover] = useState("Standard");
  const [coach, setCoach] = useState(null);
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState(null);

  const fullText = manuscript.paragraphs.map((p) => p.text).join("\n\n");
  const words = fullText.trim().split(/\s+/).filter(Boolean).length;
  const openComments = manuscript.paragraphs.flatMap((p) => p.comments.filter((c) => !c.resolved).map((c) => ({ ...c, para: p.id })));

  const alerts = useMemo(() => {
    const a = [];
    manuscript.paragraphs.forEach((p, i) => {
      const w = p.text.trim().split(/\s+/).filter(Boolean).length;
      if (w < 40) a.push({ level: "warn", text: `Paragraph ${i + 1} is ${w} words. Academic paragraphs generally need 60–150 to develop a claim.` });
    });
    const style = manuscript.style;
    if (style === "APA" && !/\([A-Z][a-z]+,? \d{4}\)/.test(fullText)) a.push({ level: "warn", text: "No APA in-text citation detected. APA 7 requires author–date: (Nguyen, 2026)." });
    if (style === "MLA" && !/\([A-Z][a-z]+ \d+\)/.test(fullText)) a.push({ level: "warn", text: "No MLA in-text citation detected. MLA uses author–page with no comma: (Nguyen 14)." });
    if (style === "Chicago" && !/\d\./.test(fullText)) a.push({ level: "info", text: "Chicago notes-bibliography expects footnote markers. Confirm which Chicago system your instructor requires." });
    if (words < 300) a.push({ level: "info", text: `${words} words so far. Most assignments in this course expect 800+.` });
    return a;
  }, [manuscript, fullText, words]);

  const editPara = (pid, val) => setManuscript({ ...manuscript, paragraphs: manuscript.paragraphs.map((p) => p.id === pid ? { ...p, text: val } : p) });
  const addPara = () => setManuscript({ ...manuscript, paragraphs: [...manuscript.paragraphs, { id: "p" + Date.now(), text: "", comments: [] }] });
  const resolveComment = (pid, cid) => setManuscript({ ...manuscript, paragraphs: manuscript.paragraphs.map((p) => p.id === pid ? { ...p, comments: p.comments.map((c) => c.id === cid ? { ...c, resolved: true } : c) } : p) });

  const askCoach = async () => {
    setBusy(true); setCoach(null);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content:
`You are a writing coach inside a university platform. You NEVER rewrite the student's sentences for them. You diagnose and teach.
Style required: ${manuscript.style}.
Student draft:
"""${fullText.slice(0, 2500)}"""
Return ONLY JSON, no fences:
{"diagnosis":[{"where":string,"issue":string,"why":string,"practice":string}],"doingWell":string}
2-3 diagnosis items. Never include a rewritten version of their text.` }] }),
      });
      const d = await r.json();
      const txt = d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      setCoach(JSON.parse(txt.replace(/```json|```/g, "").trim()));
    } catch {
      setCoach({
        doingWell: "Your opening move — stating the common framing, then undercutting it — is a real academic gesture.",
        diagnosis: [
          { where: "Short paragraph carrying no argument", issue: "A sentence standing alone as its own paragraph.", why: "A paragraph is a unit of reasoning, not a unit of fact. Standing alone, it reads as a note you left yourself.", practice: "Finish that sentence three ways starting with 'which means…', 'which costs…', 'which is why…'. Keep the one that connects to your thesis." },
          { where: "The one-third figure", issue: "A strong statistic with no source attached.", why: "In academic writing an uncited number is treated as an unsupported claim, no matter how true it is.", practice: "Find where you got that figure and add it in the required citation form." },
        ],
      });
    }
    setBusy(false);
  };

  return (
    <div className="cc-rise" data-tour="t-writer">
      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>Paper setup · EduSync format</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {["APA", "MLA", "Chicago"].map((s) => (
            <button key={s} onClick={() => setManuscript({ ...manuscript, style: s })} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: t.bodyFont, border: `1px solid ${manuscript.style === s ? t.primary : t.line}`, background: manuscript.style === s ? t.primary : "transparent", color: manuscript.style === s ? "#fff" : t.slate }}>{s}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Standard", "Formal", "Minimal"].map((c) => (
            <button key={c} onClick={() => setCover(c)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: t.bodyFont, border: `1px solid ${cover === c ? t.accent : t.line}`, background: cover === c ? t.accent : "transparent", color: cover === c ? t.ink : t.slate }}>{c} cover page</button>
          ))}
        </div>
      </Card>

      {openComments.length > 0 && (
        <Card t={t} style={{ marginBottom: 12, borderColor: t.accent }}>
          <Label t={t}>{openComments.length} open note{openComments.length > 1 ? "s" : ""} from {manuscript.professor}</Label>
          {openComments.map((c) => (
            <div key={c.id} style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5, padding: "4px 0" }}>· {c.text}</div>
          ))}
          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 6 }}>Find the pin in your draft below to reply and resolve.</div>
        </Card>
      )}

      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>{manuscript.style} title page · {cover.toLowerCase()}</Label>
        <div style={{ background: "#fff", border: `1px solid ${t.line}`, padding: "26px 16px", textAlign: "center", minHeight: 130 }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 14 }}>{manuscript.title}</div>
          {["Your Name", "Example University", manuscript.course, manuscript.professor].map((c, i) => (
            <div key={i} style={{ fontFamily: "'Newsreader', serif", fontSize: 12.5, color: "#444", lineHeight: 1.7 }}>{c}</div>
          ))}
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 8, lineHeight: 1.5 }}>{STYLE_RULES[manuscript.style].notes}</div>
      </Card>

      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>Draft · {words} words · {manuscript.paragraphs.length} paragraphs</Label>
        <input value={manuscript.title} onChange={(e) => setManuscript({ ...manuscript, title: e.target.value })}
          style={{ width: "100%", padding: 10, fontSize: 16, fontWeight: 700, fontFamily: t.display, color: t.ink, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 10, outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
        {manuscript.paragraphs.map((p, i) => {
          const unresolved = p.comments.filter((c) => !c.resolved);
          return (
            <div key={p.id} style={{ marginBottom: 10, position: "relative" }}>
              <textarea value={p.text} onChange={(e) => editPara(p.id, e.target.value)} rows={Math.max(2, Math.ceil(p.text.length / 60))}
                style={{ width: "100%", padding: 10, fontSize: 15, lineHeight: 1.7, fontFamily: "'Newsreader', serif", color: t.ink, background: t.card,
                  border: `1px solid ${unresolved.length ? t.accent : t.line}`, borderRadius: t.radius === "0px" ? 0 : 10, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              {p.comments.length > 0 && (
                <button onClick={() => setThread(thread === p.id ? null : p.id)}
                  style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 99, border: "none", cursor: "pointer",
                    background: unresolved.length ? t.accent : t.good, color: "#fff", fontFamily: t.mono, fontSize: 11, lineHeight: 1 }}>{p.comments.length}</button>
              )}
              {thread === p.id && (
                <div className="cc-rise" style={{ marginTop: 6, background: t.paper, borderRadius: t.radius === "0px" ? 0 : 10, padding: 10 }}>
                  {p.comments.map((c) => (
                    <div key={c.id} style={{ marginBottom: 8, paddingLeft: 9, borderLeft: `2px solid ${c.resolved ? t.good : t.accent}` }}>
                      <div style={{ fontFamily: t.mono, fontSize: 10, color: c.resolved ? t.good : t.accentDark }}>{c.author.toUpperCase()} {c.resolved ? "· ADDRESSED" : "· OPEN"}</div>
                      <div style={{ fontSize: 13, color: t.body, lineHeight: 1.5, marginBottom: 4 }}>{c.text}</div>
                      {!c.resolved && <button onClick={() => resolveComment(p.id, c.id)} style={{ fontFamily: t.mono, fontSize: 10, color: t.primary, background: "transparent", border: `1px solid ${t.primary}`, borderRadius: 999, padding: "2px 8px", cursor: "pointer" }}>mark as revised</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <Btn t={t} variant="quiet" size="sm" onClick={addPara}>+ New paragraph</Btn>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {STYLE_RULES[manuscript.style].headings.slice(0, 3).map((h, i) => (
            <button key={i} onClick={() => setManuscript({ ...manuscript, paragraphs: [...manuscript.paragraphs, { id: "p" + Date.now() + i, text: ["Level 1 Heading", "Level 2 Heading", "Level 3 Heading"][i], comments: [] }] })}
              style={{ padding: "5px 11px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", fontFamily: t.mono, border: `1px solid ${t.line}`, background: "transparent", color: t.slate }}>+ H{i + 1}</button>
          ))}
        </div>
      </Card>

      {alerts.length > 0 && (
        <Card t={t} style={{ marginBottom: 12, borderColor: t.accent }}>
          <Label t={t}>Live checks against the {manuscript.style} manual</Label>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
              <span style={{ color: a.level === "warn" ? t.accentDark : t.slate, fontSize: 13 }}>{a.level === "warn" ? "▲" : "•"}</span>
              <span style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{a.text}</span>
            </div>
          ))}
        </Card>
      )}

      <Btn t={t} variant="accent" full tour="t-coach" onClick={askCoach} disabled={busy} style={{ marginBottom: 12 }}>{busy ? "Reading your draft…" : "Ask the writing coach"}</Btn>

      {coach && (
        <Card t={t} className="cc-rise" style={{ marginBottom: 12, borderColor: t.primary }}>
          <Label t={t}>Coach · teaches, never rewrites</Label>
          <div style={{ background: t.good + "14", padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, marginBottom: 10 }}>
            <div style={{ fontFamily: t.mono, fontSize: 10, color: t.good, marginBottom: 3 }}>WORKING WELL</div>
            <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{coach.doingWell}</div>
          </div>
          {coach.diagnosis.map((d, i) => (
            <div key={i} style={{ paddingTop: 10, marginTop: 10, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: t.mono, fontSize: 11, color: t.primary, marginBottom: 4 }}>{d.where.toUpperCase()}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, marginBottom: 4 }}>{d.issue}</div>
              <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.55, marginBottom: 7 }}>{d.why}</div>
              <div style={{ background: t.accent + "16", padding: 10, borderRadius: t.radius === "0px" ? 0 : 10 }}>
                <div style={{ fontFamily: t.mono, fontSize: 10, color: t.accentDark, marginBottom: 3 }}>TRY THIS</div>
                <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.5 }}>{d.practice}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Btn t={t} variant="solid" full onClick={() => setManuscript({ ...manuscript, versions: [...manuscript.versions, { label: "Submitted draft", when: "just now", words }] })}>
        Submit to {manuscript.professor}
      </Btn>

      <Label t={t}><span style={{ marginTop: 16, display: "block" }}>Version history</span></Label>
      <Card t={t}>
        {manuscript.versions.map((v, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
            <span style={{ fontSize: 13.5, color: t.ink, fontWeight: 600 }}>{v.label}</span>
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{v.when} · {v.words}w</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   LEARNER — find classes, quest map, writer, discussion
   ============================================================ */
const LEARNER_ACTS = [
  { title: "Act I · The Boundary", episodes: [
    { id: "l1", title: "The Cell as a Decision About Inside and Outside", state: "done", xp: 75 },
    { id: "l2", title: "Membranes: What Gets In, What Stays Out", state: "current", xp: 100 } ] },
  { title: "Act II · The Machinery", episodes: [
    { id: "l3", title: "The Nucleus and the Instruction Set", state: "locked", xp: 75 },
    { id: "l4", title: "Mitochondria: Paying the Energy Bill", state: "locked", xp: 100 } ] },
];
const CATALOG = [
  { code: "SCI 101", title: "What Is a Cell?", prof: "Dr. Nguyen", learners: 214, template: "Ram Ready" },
  { code: "UNIV 1101", title: "Digital Literacy Foundations", prof: "Dr. Ellis", learners: 186, template: "Ram Ready" },
  { code: "MATH 1314", title: "College Algebra · Story Mode", prof: "Prof. Aguilar", learners: 340, template: "Story" },
  { code: "HIST 1301", title: "The American Story to 1877", prof: "Dr. Ellis", learners: 98, template: "Story" },
];

function FindClasses({ t, onEnroll }) {
  const [q, setQ] = useState("");
  const results = CATALOG.filter((c) => (c.code + c.title + c.prof).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cc-rise" data-tour="t-find">
      <Card t={t} style={{ marginBottom: 12 }}>
        <Label t={t}>Find a class</Label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by course code, title, or professor…"
          style={{ width: "100%", padding: 10, fontSize: 14, fontFamily: t.bodyFont, color: t.ink, background: t.paper, border: `1px solid ${t.line}`, borderRadius: t.radius === "0px" ? 0 : 12, outline: "none", boxSizing: "border-box" }} />
      </Card>
      {results.map((c) => (
        <Card t={t} key={c.code} style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{c.code} · {c.title}</div>
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 2 }}>{c.prof} · {c.learners} learners · {c.template} template</div>
          </div>
          <Btn t={t} variant="ghost" size="sm" onClick={onEnroll}>Enroll</Btn>
        </Card>
      ))}
      {results.length === 0 && <div style={{ fontFamily: t.mono, fontSize: 12, color: t.slate, textAlign: "center", padding: 16 }}>No classes match "{q}"</div>}
    </div>
  );
}

function LearnerView({ t, xp, setXp, manuscript, setManuscript }) {
  const [tab, setTab] = useState("quest");
  const [mode, setMode] = useState("story");
  const [playing, setPlaying] = useState(null);
  const level = Math.floor(xp / 250) + 1;
  const toNext = level * 250;

  if (playing) return <EpisodePlayer t={t} episode={playing} lesson={DEMO_LESSON} onExit={() => setPlaying(null)} onXP={(n) => setXp(xp + n)} />;

  return (
    <div className="cc-rise">
      <div data-tour="t-xp" style={{ background: t.heroGrad, borderRadius: t.radius, padding: 20, marginBottom: 12, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: ".14em", color: t.accent }}>LEVEL {level} · SCHOLAR</div>
            <h1 style={{ fontFamily: t.display, fontSize: 24, fontWeight: 700, margin: "5px 0 3px" }}>Continue your story</h1>
            <div style={{ fontSize: 13.5, opacity: 0.82 }}>SCI 101 · What Is a Cell?</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="cc-flame" style={{ fontFamily: t.display, fontSize: 26, fontWeight: 700, color: t.accent }}>🔥11</div>
            <div style={{ fontFamily: t.mono, fontSize: 10, opacity: 0.8 }}>day streak</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: t.mono, fontSize: 11, opacity: 0.9, marginBottom: 5 }}><span>{xp} XP</span><span>{toNext} XP → Level {level + 1}</span></div>
          <div style={{ height: 9, background: "rgba(255,255,255,.18)", borderRadius: 999 }}><div style={{ height: 9, width: `${Math.min(100, (xp / toNext) * 100)}%`, background: t.accent, borderRadius: 999, transition: "width .6s cubic-bezier(.3,1.4,.5,1)" }} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "quest", l: "Quest map" }, { id: "find", l: "Find classes" }, { id: "write", l: "Paper writer" }, { id: "talk", l: "Discussion" }].map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
            fontFamily: t.bodyFont, border: `1px solid ${tab === x.id ? t.primary : t.line}`, background: tab === x.id ? t.primary : "transparent", color: tab === x.id ? "#fff" : t.slate }}>{x.l}</button>
        ))}
      </div>

      {tab === "quest" && (
        <>
          <div data-tour="t-mode" style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
            {[{ id: "story", l: "Story mode" }, { id: "focus", l: "Focus mode" }].map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                fontFamily: t.bodyFont, border: `1px solid ${mode === m.id ? t.accent : t.line}`, background: mode === m.id ? t.accent : "transparent", color: mode === m.id ? t.ink : t.slate }}>{m.l}</button>
            ))}
            <span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginLeft: "auto" }}>{mode === "story" ? "narrative on" : "essentials only"}</span>
          </div>
          <div data-tour="t-map2">
            {LEARNER_ACTS.map((act, ai) => (
              <div key={ai} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: t.display, fontSize: 16, fontWeight: 700, color: t.ink, marginBottom: 7 }}>{act.title}</div>
                {act.episodes.map((ep) => {
                  const done = ep.state === "done", cur = ep.state === "current";
                  return (
                    <button key={ep.id} disabled={ep.state === "locked"} onClick={() => cur && setPlaying(ep)}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, marginBottom: 7, cursor: cur ? "pointer" : "default", opacity: ep.state === "locked" ? 0.42 : 1 }}>
                      <Card t={t} style={{ display: "flex", alignItems: "center", gap: 11, ...(cur ? { borderColor: t.accent, boxShadow: `0 0 0 3px ${t.accent}2E` } : {}) }}>
                        <div className={cur ? "cc-pulse" : ""} style={{ width: 32, height: 32, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                          background: done ? t.good : cur ? t.accent : t.line, color: done ? "#fff" : cur ? t.ink : t.slate, fontSize: 14, flexShrink: 0 }}>{done ? "✓" : cur ? "▶" : "🔒"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{ep.title}</div>
                          <div style={{ fontFamily: t.mono, fontSize: 11, color: t.slate, marginTop: 2 }}>{done ? `+${ep.xp} XP earned` : cur ? `Tap to begin · +${ep.xp} XP` : `${ep.xp} XP`}</div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <Label t={t}>Badges</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["🧫 First Cell", 1], ["🔥 10-Day Streak", 1], ["📄 Paper Submitted", 1], ["🧠 Organelle Master", 0]].map(([b, on], i) => (
              <span key={i} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 999, fontWeight: 600, background: on ? t.accent + "1F" : t.line + "60", color: on ? t.accentDark : t.slate, border: `1px solid ${on ? t.accent + "55" : t.line}` }}>{b}{!on && " · locked"}</span>
            ))}
          </div>
        </>
      )}
      {tab === "find" && <FindClasses t={t} onEnroll={() => setTab("quest")} />}
      {tab === "write" && <PaperWriter t={t} manuscript={manuscript} setManuscript={setManuscript} />}
      {tab === "talk" && <CommunityPanel t={t} asProfessor={false} />}
    </div>
  );
}

/* ============================================================
   PROFESSOR — classes, plan, seat caps
   ============================================================ */
function ProfessorView({ t, plan, setPlan, courseLength, setCourseLength, manuscript, setManuscript }) {
  const [tab, setTab] = useState("forge");
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState({});
  const [history, setHistory] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const [preview, setPreview] = useState(null);
  const [myClasses, setMyClasses] = useState([{ id: "c1", code: "SCI 101", name: "What Is a Cell?", students: 38 }]);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const currentPlan = PLANS.find((p) => p.key === plan);
  const classCap = currentPlan.classCap;

  const pushHistory = (c, l) => { const snap = { course: c ?? course, lessons: l ?? lessons }; const next = [...history.slice(0, hIdx + 1), snap]; setHistory(next); setHIdx(next.length - 1); };
  const undo = () => { if (hIdx > 0) { const s = history[hIdx - 1]; setCourse(s.course); setLessons(s.lessons); setHIdx(hIdx - 1); } };
  const redo = () => { if (hIdx < history.length - 1) { const s = history[hIdx + 1]; setCourse(s.course); setLessons(s.lessons); setHIdx(hIdx + 1); } };
  useEffect(() => { if (course && tab === "forge") setTab("build"); }, [course]);

  const addClass = () => {
    if (myClasses.length >= classCap) { setShowUpgrade(true); return; }
    setMyClasses([...myClasses, { id: "c" + Date.now(), code: "NEW 000", name: "Untitled class", students: 0 }]);
  };

  if (preview) return <EpisodePlayer t={t} episode={preview.ep} lesson={preview.lesson} preview onExit={() => setPreview(null)} />;

  return (
    <div>
      {showUpgrade && <UpgradeModal t={t} plan={plan} setPlan={setPlan} courseLength={courseLength} setCourseLength={setCourseLength} onClose={() => setShowUpgrade(false)} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "forge", l: "Forge" }, { id: "build", l: "Course", off: !course }, { id: "grade", l: "Grader" }, { id: "classes", l: "Classes" }].map((x) => (
          <button key={x.id} onClick={() => !x.off && setTab(x.id)} style={{ padding: "7px 15px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: x.off ? "not-allowed" : "pointer", opacity: x.off ? 0.4 : 1,
            fontFamily: t.bodyFont, border: `1px solid ${tab === x.id ? t.primary : t.line}`, background: tab === x.id ? t.primary : "transparent", color: tab === x.id ? "#fff" : t.slate }}>{x.l}</button>
        ))}
        <button onClick={() => setShowUpgrade(true)} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
          fontFamily: t.mono, border: `1px solid ${t.accent}`, background: t.accent + "1A", color: t.accentDark }}>{currentPlan.name.toUpperCase()} ⚙</button>
      </div>

      {tab === "forge" && <CourseForge t={t} setCourse={setCourse} pushHistory={pushHistory} />}
      {tab === "build" && course && (
        <CourseWorkspace t={t} course={course} setCourse={setCourse} lessons={lessons} setLessons={setLessons} history={history} hIdx={hIdx} undo={undo} redo={redo} pushHistory={pushHistory} onPreview={(ep, lesson) => setPreview({ ep, lesson })} />
      )}
      {tab === "grade" && <PaperGrader t={t} manuscript={manuscript} setManuscript={setManuscript} />}
      {tab === "classes" && (
        <div className="cc-rise" data-tour="t-classes">
          <Card t={t} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label t={t}>Your classes · {myClasses.length} of {classCap === Infinity ? "∞" : classCap} on {currentPlan.name}</Label>
            </div>
            {myClasses.map((c) => (
              <div key={c.id} style={{ padding: "9px 0", borderTop: `1px solid ${t.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: t.ink }}>
                  <span>{c.code} · {c.name}</span><span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{c.students}/{SEAT_CAP_PER_CLASS} seats</span>
                </div>
                <div style={{ height: 5, background: t.line, borderRadius: 999, marginTop: 5 }}><div style={{ height: 5, width: `${(c.students / SEAT_CAP_PER_CLASS) * 100}%`, background: t.primary, borderRadius: 999 }} /></div>
              </div>
            ))}
            <Btn t={t} variant="ghost" full style={{ marginTop: 10 }} onClick={addClass}>+ New class</Btn>
          </Card>
          <Card t={t} style={{ marginBottom: 14 }}>
            <Label t={t}>Live status · {myClasses[0]?.code}</Label>
            {ROSTER.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: 99, background: s.flag ? t.bad : t.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.name.split(" ")[1][0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{s.name} {s.flag && <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.bad }}>· needs a nudge</span>}</div>
                  <div style={{ height: 5, background: t.line, borderRadius: 999, marginTop: 5 }}><div style={{ height: 5, width: `${s.progress}%`, background: s.flag ? t.bad : t.good, borderRadius: 999 }} /></div>
                </div>
                <span style={{ fontFamily: t.mono, fontSize: 11, color: t.slate }}>{s.streak ? `🔥${s.streak}` : "—"}</span>
              </div>
            ))}
          </Card>
          <CommunityPanel t={t} asProfessor />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ADMIN (institution)
   ============================================================ */
function AdminView({ t }) {
  const [plugins, setPlugins] = useState({ "SIS sync (Banner)": true, "Turnitin bridge": true, "Library reserves": true, "Proctoring": false, "Accessibility scanner": true });
  return (
    <div className="cc-rise">
      <div style={{ background: t.heroGrad, borderRadius: t.radius, padding: 20, marginBottom: 12, color: "#fff" }}>
        <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: ".14em", color: t.accent }}>INSTITUTION CONSOLE · POWERED BY EDNOTEBOOK</div>
        <h1 style={{ fontFamily: t.display, fontSize: 24, fontWeight: 700, margin: "5px 0 3px" }}>Example University</h1>
        <div style={{ fontSize: 13.5, opacity: 0.82 }}>Synthetic institution workspace · demonstration data only</div>
      </div>
      <div data-tour="t-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[["24", "courses"], ["1,102", "learners"], ["87%", "weekly active"]].map(([n, l], i) => (
          <Card t={t} key={i} style={{ textAlign: "center" }}><div style={{ fontFamily: t.display, fontSize: 23, fontWeight: 700, color: t.primaryDark }}>{n}</div><div style={{ fontFamily: t.mono, fontSize: 10, color: t.slate }}>{l}</div></Card>
        ))}
      </div>
      <Label t={t}>Course catalog</Label>
      <Card t={t} tour="t-catalog" style={{ marginBottom: 12 }}>
        {[["SCI 101", "What Is a Cell?", "Dr. Nguyen", 214, "green"], ["UNIV 1101", "Digital Literacy Foundations", "Dr. Ellis", 186, "green"], ["MATH 1314", "College Algebra · Story Mode", "Prof. Aguilar", 340, "amber"]].map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: c[4] === "green" ? t.good : t.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{c[0]} · {c[1]}</div><div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.slate, marginTop: 2 }}>{c[2]} · {c[3]} learners</div></div>
            <Btn t={t} variant="quiet" size="sm">Manage</Btn>
          </div>
        ))}
      </Card>
      <Label t={t}>AI governance</Label>
      <Card t={t} tour="t-ai" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: t.mono, fontSize: 11, color: t.slate, marginBottom: 5 }}><span>Monthly AI budget</span><span>$412 of $1,000</span></div>
        <div style={{ height: 9, background: t.line, borderRadius: 999, marginBottom: 12 }}><div style={{ height: 9, width: "41%", background: t.primary, borderRadius: 999 }} /></div>
        {[["Course generation", 61], ["Grading suggestions", 27], ["Writing coach", 12]].map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14, color: t.ink }}><span>{k}</span><span style={{ fontFamily: t.mono, fontSize: 12, color: t.slate }}>{v}%</span></div>
        ))}
        <div style={{ background: t.paper, padding: 11, borderRadius: t.radius === "0px" ? 0 : 12, marginTop: 10, fontFamily: t.mono, fontSize: 11, color: t.slate, lineHeight: 1.6 }}>Product controls · instructors confirm every AI-suggested grade · the writing coach diagnoses but never drafts · institution-linked records stay inside their assigned workspace</div>
      </Card>
      <Label t={t}>Plug-ins</Label>
      <Card t={t} tour="t-plugins" style={{ marginBottom: 12 }}>
        {Object.entries(plugins).map(([name, on], i, arr) => (
          <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{name}</span>
            <button onClick={() => setPlugins({ ...plugins, [name]: !on })} style={{ width: 44, height: 24, borderRadius: 999, position: "relative", cursor: "pointer", border: "none", background: on ? t.good : t.line, transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 99, background: "#fff", transition: "left .2s cubic-bezier(.3,1.4,.5,1)" }} />
            </button>
          </div>
        ))}
      </Card>
      <Label t={t}>Roles & ownership</Label>
      <Card t={t}>
        {[["Owner", "L. (you)", "Billing · policy · everything"], ["Dept. admin", "3 people", "Catalog · rosters · reports"], ["Professor", "18 people", "Own classes · grading · AI tools"], ["Learner", "1,102 people", "Enrolled classes only"]].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: i ? `1px solid ${t.line}` : "none" }}>
            <Pill t={t} tone={t.primary}>{r[0]}</Pill><span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{r[1]}</span>
            <span style={{ fontFamily: t.mono, fontSize: 10.5, color: t.slate, marginLeft: "auto", textAlign: "right" }}>{r[2]}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   MASTERMIND — owner's cross-project portfolio
   ============================================================ */
function MastermindView({ t }) {
  return (
    <div className="cc-rise">
      <div style={{ background: "linear-gradient(135deg,#0B0E14,#211A0A)", borderRadius: t.radius, padding: 20, marginBottom: 12, color: "#fff", border: `1px solid ${t.accent}55` }}>
        <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: ".14em", color: t.accent }}>MASTERMIND · OWNER ONLY</div>
        <h1 style={{ fontFamily: t.display, fontSize: 24, fontWeight: 700, margin: "5px 0 3px" }}>BrexAtlas Portfolio</h1>
        <div style={{ fontSize: 13.5, opacity: 0.82 }}>Every project, one dashboard. The synthetic institution workspace demonstrates how Ram Ready courses can feed reusable templates.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[["4", "demo projects"], ["1,102", "synthetic learners"], ["1", "example institution"]].map(([n, l], i) => (
          <Card t={t} key={i} style={{ textAlign: "center" }}><div style={{ fontFamily: t.display, fontSize: 23, fontWeight: 700, color: t.primaryDark }}>{n}</div><div style={{ fontFamily: t.mono, fontSize: 10, color: t.slate }}>{l}</div></Card>
        ))}
      </div>
      <Label t={t}>Projects</Label>
      {PROJECTS.map((p, i) => (
        <Card t={t} key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: t.display, fontSize: 16, fontWeight: 700, color: t.ink }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: t.slate }}>{p.role}</div>
            </div>
            <Pill t={t} tone={t[p.color]}>{p.status}</Pill>
          </div>
          <div style={{ fontSize: 13, color: t.body, marginTop: 6 }}>{p.metric}</div>
          {p.repo && <div style={{ fontFamily: t.mono, fontSize: 11, color: t.primary, marginTop: 4 }}>{p.repo}</div>}
          {p.repoNote && <div style={{ fontFamily: t.mono, fontSize: 10.5, color: t.accentDark, marginTop: 3 }}>{p.repoNote}</div>}
        </Card>
      ))}
      <Card t={t} style={{ marginTop: 12, borderColor: t.line }}>
        <Label t={t}>How the repos connect</Label>
        <div style={{ fontSize: 13.5, color: t.body, lineHeight: 1.6 }}>
          The Ram Ready template inside EdNotebook's Course Forge is backwards-mapped from Digital-Literacy-Course's six-question structure. Real repo sync — so an edit to one updates the other — needs a shared design-tokens file or a small build step pulling the template schema from Digital-Literacy-Course into EdNotebook at build time. This prototype hard-codes that mapping; wiring an actual GitHub Action or npm package is the next step once EdNotebook has its own repo.
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */
export default function Builder() {
  const [themeKey, setThemeKey] = useState("ramready");
  const [view, setView] = useState("professor");
  const [xp, setXp] = useState(745);
  const [tourStep, setTourStep] = useState(null);
  const [showThemes, setShowThemes] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  const [ownerMode, setOwnerMode] = useState(false);
  const [plan, setPlan] = useState("free");
  const [courseLength, setCourseLength] = useState("16");
  const [manuscript, setManuscript] = useState(makeManuscript());
  const t = THEMES[themeKey];
  const startTour = () => setTourStep(0);

  return (
    <div style={{ background: t.paper, minHeight: "100vh", fontFamily: t.bodyFont, transition: "background .3s" }}>
      <style>{FONT_LINK + `
        * { -webkit-tap-highlight-color: transparent; }
        button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
        @keyframes ccRise { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform:none } }
        .cc-rise { animation: ccRise .42s cubic-bezier(.2,.8,.3,1) both; }
        @keyframes ccPop { 0% { opacity:0; transform: scale(.94) } 60% { transform: scale(1.02) } 100% { opacity:1; transform: scale(1) } }
        .cc-pop { animation: ccPop .38s cubic-bezier(.2,.9,.3,1) both; }
        @keyframes ccDot { 0%,100% { opacity:.3 } 50% { opacity:1 } }
        .cc-dot { animation: ccDot 1s ease infinite; }
        @keyframes ccPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.09) } }
        .cc-pulse { animation: ccPulse 1.9s ease-in-out infinite; }
        @keyframes ccFlame { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .cc-flame { animation: ccFlame 2.4s ease-in-out infinite; display:inline-block; }
        @keyframes ccArrow { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .cc-arrow { animation: ccArrow 1s ease-in-out infinite; }
        @keyframes ccBadge { 0% { transform: scale(0) rotate(-30deg) } 70% { transform: scale(1.15) rotate(6deg) } 100% { transform: scale(1) rotate(0) } }
        .cc-badge { animation: ccBadge .6s cubic-bezier(.2,1.2,.4,1) both; display:inline-block; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        textarea, input { font-family: inherit; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 20, background: themeKey === "nightshift" ? t.card : t.ink, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${t.line}`, flexWrap: "wrap" }}>
        <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 17, color: themeKey === "nightshift" ? t.ink : "#fff" }}>Ed<span style={{ color: t.accent }}>Notebook</span></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, borderRadius: 999, background: themeKey === "nightshift" ? t.paper : "rgba(255,255,255,.1)" }}>
          {[["learner", "Learner"], ["professor", "Professor"], ["admin", "Admin"], ...(ownerMode ? [["mastermind", "★ Mastermind"]] : [])].map(([id, l]) => (
            <button key={id} onClick={() => { setView(id); setTourStep(null); }} style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", fontFamily: t.bodyFont,
              background: view === id ? t.accent : "transparent", color: view === id ? t.ink : (themeKey === "nightshift" ? t.slate : "#C6CCDB") }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setOwnerMode(!ownerMode)} title="Owner mode" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: ownerMode ? t.accent : (themeKey === "nightshift" ? t.slate : "#8E97AD"), padding: 0 }}>🔑</button>
        <button onClick={() => setShowThemes(!showThemes)} title="Themes" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 17, color: t.accent, padding: 0 }}>◐</button>
        <button onClick={startTour} title="Tutorial mode" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 15, color: t.accent, padding: 0 }}>?</button>
      </div>

      {showThemes && (
        <div className="cc-rise" style={{ background: t.card, borderBottom: `1px solid ${t.line}`, padding: 12 }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <Label t={t}>Theme · applies to every role</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(THEMES).map(([k, th]) => (
                <button key={k} onClick={() => { setThemeKey(k); setShowThemes(false); }} style={{ textAlign: "left", padding: 10, cursor: "pointer", borderRadius: th.radius, border: `1px solid ${themeKey === k ? t.accent : t.line}`, background: th.paper }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>{[th.primary, th.accent, th.good].map((c, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: th.radius === "0px" ? 0 : 99, background: c }} />)}</div>
                  <div style={{ fontFamily: th.display, fontSize: 14, fontWeight: 700, color: th.ink }}>{th.name}</div>
                  <div style={{ fontFamily: th.mono, fontSize: 10, color: th.slate, marginTop: 2 }}>{th.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!welcomed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,10,20,.75)", zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="cc-pop" style={{ background: t.card, borderRadius: t.radius, padding: 22, maxWidth: 380, border: `1px solid ${t.accent}` }}>
            <div style={{ fontFamily: t.mono, fontSize: 11, color: t.accentDark, letterSpacing: ".12em" }}>FIRST TIME HERE</div>
            <div style={{ fontFamily: t.display, fontSize: 23, fontWeight: 700, color: t.ink, margin: "6px 0 8px" }}>Want the two-minute tour?</div>
            <div style={{ fontSize: 14, color: t.body, lineHeight: 1.55, marginBottom: 16 }}>Every button gets an arrow and an explanation. Restart it anytime from <strong>?</strong>, switch themes with <strong>◐</strong>. The <strong>🔑</strong> unlocks the owner's Mastermind view.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn t={t} variant="quiet" full onClick={() => setWelcomed(true)}>Explore on my own</Btn>
              <Btn t={t} variant="accent" full onClick={() => { setWelcomed(true); startTour(); }}>Show me around</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "16px 14px 40px" }}>
        {view === "learner" && <LearnerView t={t} xp={xp} setXp={setXp} manuscript={manuscript} setManuscript={setManuscript} />}
        {view === "professor" && <ProfessorView t={t} plan={plan} setPlan={setPlan} courseLength={courseLength} setCourseLength={setCourseLength} manuscript={manuscript} setManuscript={setManuscript} />}
        {view === "admin" && <AdminView t={t} />}
        {view === "mastermind" && <MastermindView t={t} />}
      </div>

      <div style={{ textAlign: "center", paddingBottom: 26, fontFamily: t.mono, fontSize: 10.5, color: t.slate }}>EdNotebook prototype · demonstration data only · external AI is not production-connected</div>

      {tourStep !== null && <Tutorial t={t} steps={TOURS[view] || TOURS.professor} step={tourStep} setStep={setTourStep} onClose={() => setTourStep(null)} />}
    </div>
  );
}
