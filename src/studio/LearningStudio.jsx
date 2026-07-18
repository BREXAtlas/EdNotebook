import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../Brand.jsx";
import MaterialsWorkspace from "./MaterialsWorkspace.jsx";
import AssignmentWorkspace from "./AssignmentWorkspace.jsx";
import AssignmentFilesPanel from "./AssignmentFilesPanel.jsx";
import SubjectTools from "./SubjectTools.jsx";
import ReaderPublisher from "./ReaderPublisher.jsx";
import SlidesIntegrations from "./SlidesIntegrations.jsx";
import CommunicationRoom from "./CommunicationRoom.jsx";
import { readCourseDraft } from "./storageService.js";
import "./studio.css";

const TABS = [
  ["materials", "Materials", "📎", "Files, links, videos, quotes"],
  ["assignments", "Assignments", "✓", "Sandbox, rubric, files, syllabus"],
  ["tools", "Subject tools", "∑", "Calculators, tables, maps"],
  ["reader", "Reader & publisher", "📖", "EduBook and partner catalog"],
  ["slides", "Slides & plug-ins", "▤", "Presentations and connectors"],
  ["room", "Private room", "◌", "Course chat or device notes"],
];

function tabFromHash() {
  const query = window.location.hash.split("?")[1] || "";
  const requested = new URLSearchParams(query).get("tab");
  return TABS.some(([value]) => value === requested) ? requested : "materials";
}

export default function LearningStudio({ onBack, onCourseSetup }) {
  const course = useMemo(readCourseDraft, []);
  const [tab, setTab] = useState(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function chooseTab(value) {
    setTab(value);
    const next = `#/app/studio?tab=${value}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }

  return (
    <div className="learning-studio-page">
      <header className="studio-topbar">
        <button className="studio-brand-button" type="button" onClick={onBack} aria-label="Return to course builder">
          <BrandLogo size={40} tagline="Learning materials studio" />
        </button>
        <div className="studio-course-context">
          <small>ACTIVE COURSE</small>
          <strong>{course.name || "Untitled course"}</strong>
          <span>{course.code || "No course code"}</span>
        </div>
        <div className="studio-topbar-actions">
          <button type="button" onClick={onCourseSetup}>Course setup</button>
          <button className="is-primary" type="button" onClick={onBack}>Back to Course Forge</button>
        </div>
      </header>

      <div className="studio-shell">
        <aside className="studio-navigation" aria-label="Learning studio navigation">
          <div className="studio-nav-heading">
            <span className="studio-kicker">LEARNING STUDIO</span>
            <h1>Build the material around the lesson.</h1>
            <p>Every file, link, tool, assignment, reading, and message has a named location and access rule.</p>
          </div>
          <nav>
            {TABS.map(([value, label, icon, description]) => (
              <button
                type="button"
                className={tab === value ? "is-active" : ""}
                aria-current={tab === value ? "page" : undefined}
                onClick={() => chooseTab(value)}
                key={value}
              >
                <span aria-hidden="true">{icon}</span>
                <div><strong>{label}</strong><small>{description}</small></div>
                <i aria-hidden="true">→</i>
              </button>
            ))}
          </nav>
          <div className="studio-storage-summary">
            <div><span aria-hidden="true">☁</span><div><strong>Cloud</strong><small>Supabase private buckets</small></div></div>
            <div><span aria-hidden="true">▣</span><div><strong>Device only</strong><small>IndexedDB / browser local</small></div></div>
            <p>GitHub Pages hosts the app code. Student and education materials do not belong in the repository.</p>
          </div>
        </aside>

        <main className="studio-main" key={tab}>
          {tab === "materials" && <MaterialsWorkspace />}
          {tab === "assignments" && (
            <>
              <AssignmentWorkspace />
              <AssignmentFilesPanel />
            </>
          )}
          {tab === "tools" && <SubjectTools />}
          {tab === "reader" && <ReaderPublisher />}
          {tab === "slides" && <SlidesIntegrations />}
          {tab === "room" && <CommunicationRoom />}
        </main>
      </div>
    </div>
  );
}
