import { useEffect, useMemo, useRef, useState } from "react";
import LayoutViewToggle from "./LayoutViewToggle.jsx";

const FEATURES = [
  { id: "university-scanner", audience: "university", group: "Start quickly", label: "Scan a university syllabus", description: "Upload PDF, DOCX, text, or paper and review dates before saving.", href: "#/students/university?tool=syllabus", tab: "scanner", keywords: "planner calendar due dates" },
  { id: "k12-scanner", audience: "k12", group: "Start quickly", label: "Scan a class handout", description: "Turn a school handout into an editable plan.", href: "#/students/k12?tool=syllabus", tab: "scanner", keywords: "school planner calendar due dates" },
  { id: "professor-scanner", audience: "professor", group: "Start quickly", label: "Extract a syllabus", description: "Review the source and dates before adding them to a course.", href: "#/professors?tool=syllabus", tab: "scanner", keywords: "pdf docx scanner calendar" },
  { id: "lesson-creator", audience: "professor", group: "Start quickly", label: "Create a course map and lesson", description: "Paste source material, build an editable starter on this device, and review every section before saving.", href: "#/professors?tool=lesson", tab: "lesson", keywords: "builder course teaching" },
  { id: "university-search", audience: "university", group: "Find learning", label: "Find a university or class", description: "Search Texas universities, professors, subjects, and class codes.", href: "#/students/university?section=class-search", keywords: "college course teacher professor" },
  { id: "k12-search", audience: "k12", group: "Find learning", label: "Find a school class", description: "Search schools, teachers, subjects, and class codes.", href: "#/students/k12?section=class-search", keywords: "teacher course" },
  { id: "student-overview", audience: "university", group: "Student workspace", label: "Student dashboard", description: "See classes, dates, grades, points, and what needs attention.", href: "#/student/university/app?tab=overview", tab: "overview", keywords: "home" },
  { id: "student-live", audience: "university", group: "Student workspace", label: "Live class updates", description: "See assignments, announcements, and class messages as they change.", href: "#/student/university/app?tab=live", tab: "live", keywords: "realtime course messages announcements" },
  { id: "student-engagement", audience: "university", group: "Student workspace", label: "Activity points, rewards, and groups", description: "See where points came from, unlock class rewards, join groups, and answer live activities.", href: "#/student/university/app?tab=engagement", tab: "engagement", keywords: "quiz poll game reward store" },
  { id: "student-assignments", audience: "university", group: "Student workspace", label: "Assignments and structured paper writing", description: "Write by section, follow an outline, use word limits, and export one organized paper.", href: "#/student/university/app?tab=assignments", tab: "assignments", keywords: "editor homework submit cover references appendix" },
  { id: "student-grades", audience: "university", group: "Student workspace", label: "Grades and calculator", description: "View published grades, weights, status, and target calculations.", href: "#/student/university/app?tab=grades", tab: "grades", keywords: "report card scale" },
  { id: "student-rooms", audience: "university", group: "Student workspace", label: "Study rooms", description: "Join class study rooms and live learning sessions.", href: "#/student/university/app?tab=rooms", tab: "rooms", keywords: "livekit office hours audio" },
  { id: "student-life", audience: "university", group: "Student workspace", label: "Student life and feed", description: "Open class, campus, and learning communities.", href: "#/student/university/app?tab=life", tab: "life", keywords: "social groups posts" },
  { id: "student-page", audience: "university", group: "Student workspace", label: "My student page", description: "Control your bio, projects, links, visibility, and discovery.", href: "#/student/university/app?tab=page", tab: "page", keywords: "profile website portfolio" },
  { id: "student-settings", audience: "university", group: "Student workspace", label: "Student settings", description: "Manage profile, email, visibility, connectors, and account controls.", href: "#/student/university/app?tab=settings", tab: "settings", keywords: "password delete account api billing" },
  { id: "k12-dashboard", audience: "k12", group: "Student workspace", label: "K–12 dashboard", description: "See classes, assignments, grades, attendance, and school updates.", href: "#/student/k12/app?tab=overview", tab: "overview", keywords: "school home" },
  { id: "k12-live", audience: "k12", group: "Student workspace", label: "Live class updates", description: "See school assignments, teacher announcements, and class messages as they change.", href: "#/student/k12/app?tab=live", tab: "live", keywords: "realtime course messages announcements" },
  { id: "k12-engagement", audience: "k12", group: "Student workspace", label: "Activity points, rewards, and groups", description: "See earned points, class rewards, groups, quizzes, and polls.", href: "#/student/k12/app?tab=engagement", tab: "engagement", keywords: "game quiz poll reward store" },
  { id: "k12-assignments", audience: "k12", group: "Student workspace", label: "School assignments and writing", description: "Write by section, follow the teacher’s outline, and export one organized paper.", href: "#/student/k12/app?tab=assignments", tab: "assignments", keywords: "homework editor cover references appendix" },
  { id: "k12-rooms", audience: "k12", group: "Student workspace", label: "School study rooms", description: "Join class study rooms kept separate from university spaces.", href: "#/student/k12/app?tab=rooms", tab: "rooms", keywords: "live audio" },
  { id: "professor-overview", audience: "professor", group: "Educator workspace", label: "Teaching dashboard", description: "See classes, roster requests, grades, and upcoming work.", href: "#/professor/dashboard?tab=overview", tab: "overview", keywords: "home" },
  { id: "professor-courses", audience: "professor", group: "Educator workspace", label: "Courses and publishing", description: "Build, preview, broadcast, export, and invite students.", href: "#/professor/dashboard?tab=classes", tab: "classes", keywords: "html course class link" },
  { id: "professor-live", audience: "professor", group: "Educator workspace", label: "Live class updates", description: "Review the student-facing class stream and publish announcements that appear without refresh.", href: "#/professor/dashboard?tab=live", tab: "live", keywords: "realtime assignments messages announcements" },
  { id: "professor-engagement", audience: "professor", group: "Educator workspace", label: "Assign points, rewards, groups, and games", description: "Set activity points, class goals, student groups, live quizzes, polls, and challenges.", href: "#/professor/dashboard?tab=engagement", tab: "engagement", keywords: "quiz poll competition reward store" },
  { id: "professor-templates", audience: "professor", group: "Educator workspace", label: "Assignment and paper templates", description: "Create guided sections, drag-and-drop paper outlines, required elements, and word limits.", href: "#/professor/dashboard?tab=templates", tab: "templates", keywords: "forms homework editor cover references appendix" },
  { id: "professor-rosters", audience: "professor", group: "Educator workspace", label: "Students and rosters", description: "Import student IDs, review matches, and approve class access.", href: "#/professor/dashboard?tab=students", tab: "students", keywords: "csv enroll approve" },
  { id: "professor-grades", audience: "professor", group: "Educator workspace", label: "Gradebook", description: "Review pending, missing, and finalized grades behind the extra lock.", href: "#/professor/dashboard?tab=grades", tab: "grades", keywords: "publish scale weights" },
  { id: "professor-attendance", audience: "professor", group: "Educator workspace", label: "Attendance and SIS", description: "Track attendance now and preview the future PowerSchool sync.", href: "#/professor/dashboard?tab=attendance", tab: "attendance", keywords: "powerschool" },
  { id: "professor-office", audience: "professor", group: "Educator workspace", label: "Live office hours", description: "Create audio-first rooms and share a screen through LiveKit Cloud.", href: "#/professor/dashboard?tab=office", tab: "office", keywords: "livekit study room" },
  { id: "professor-feed", audience: "professor", group: "Educator workspace", label: "Faculty and school feed", description: "Post updates to faculty and school audiences.", href: "#/professor/dashboard?tab=announcements", tab: "announcements", keywords: "social announcements" },
  { id: "professor-verification", audience: "professor", group: "Educator workspace", label: "School verification", description: "Request a manually reviewed school-affiliation badge.", href: "#/professor/dashboard?tab=verification", tab: "verification", keywords: "teacher id verified" },
  { id: "professor-settings", audience: "professor", group: "Educator workspace", label: "Educator settings", description: "Manage profile, email, connectors, visibility, and account controls.", href: "#/professor/dashboard?tab=settings", tab: "settings", keywords: "password api billing delete" },
  { id: "publishing", audience: "all", group: "Create and publish", label: "Publishing portal", description: "Prepare readings, books, and course-ready materials.", href: "#/publishers", keywords: "reader book catalog" },
  { id: "student-tour", audience: "university", group: "Guided tours", label: "Student tour with Brooke", description: "Walk through the university student experience.", href: "#/tour/student", keywords: "demo presentation" },
  { id: "k12-tour", audience: "k12", group: "Guided tours", label: "K–12 tour with Jaylen", description: "Walk through the school student experience.", href: "#/tour/k12", keywords: "demo presentation" },
  { id: "professor-tour", audience: "professor", group: "Guided tours", label: "Professor tour with Atlas", description: "Walk through the educator experience.", href: "#/tour/professor", keywords: "demo presentation" },
];

function audienceMatches(item, audience) {
  if (!audience || audience === "all") return true;
  if (audience === "student") return ["university", "k12", "all"].includes(item.audience);
  return item.audience === audience || item.audience === "all";
}

export default function FeatureFinder({ audience = "all", onSelectTab, triggerLabel = "Find a feature", className = "" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return FEATURES.filter((item) => audienceMatches(item, audience)).filter((item) => !search || `${item.label} ${item.description} ${item.group} ${item.keywords}`.toLowerCase().includes(search));
  }, [audience, query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === "Escape") setOpen(false); };
    document.body.classList.add("feature-finder-open");
    window.addEventListener("keydown", close);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.classList.remove("feature-finder-open");
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  function openItem(item) {
    setOpen(false);
    setQuery("");
    if (item.tab && onSelectTab) {
      onSelectTab(item.tab);
      return;
    }
    window.location.hash = item.href.slice(1);
  }

  return <>
    <button className={`feature-finder-trigger ${className}`.trim()} type="button" onClick={() => setOpen(true)}>{triggerLabel}</button>
    {open && <div className="feature-finder-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="feature-finder-panel" role="dialog" aria-modal="true" aria-labelledby="feature-finder-title">
        <header><div><span>QUICK ACCESS</span><h2 id="feature-finder-title">Find a feature</h2><p>Search, choose, and open it. Every result goes directly to the feature or its sign-in screen.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close feature finder">×</button></header>
        <label className="feature-finder-search"><span>Search features</span><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try syllabus, grades, office hours, or settings" /></label>
        <div className="feature-finder-results" aria-live="polite">
          {results.length ? results.map((item) => <button type="button" key={item.id} onClick={() => openItem(item)}><span>{item.group}</span><strong>{item.label}</strong><small>{item.description}</small><b aria-hidden="true">→</b></button>) : <p>No feature matched that search. Try a shorter word.</p>}
        </div>
        <footer><LayoutViewToggle compact /><span>Tip: Full keeps desktop columns on a phone and allows side-to-side panning.</span></footer>
      </section>
    </div>}
  </>;
}

export { FEATURES };
