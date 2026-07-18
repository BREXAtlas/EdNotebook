import { useState } from "react";
import ScientificCalculator from "./ScientificCalculator.jsx";
import TableBuilder from "./TableBuilder.jsx";
import ConceptMap from "./ConceptMap.jsx";
import SubjectGenerator from "./SubjectGenerator.jsx";

const TABS = [
  ["calculator", "Scientific calculator", "∑"],
  ["table", "Table builder", "▦"],
  ["map", "Concept map", "⌘"],
  ["generator", "Subject generator", "✦"],
];

export default function SubjectTools() {
  const [tab, setTab] = useState("calculator");

  return (
    <section className="studio-workspace" aria-labelledby="subject-tools-title">
      <div className="studio-section-heading">
        <div>
          <span className="studio-kicker">SUBJECT TOOLKIT</span>
          <h2 id="subject-tools-title">The tool should match the thinking the subject requires.</h2>
          <p>
            Start with working math, table, and mapping tools, then generate discipline-specific scaffolds that can be attached to a lesson.
          </p>
        </div>
      </div>

      <div className="studio-subtabs" role="tablist" aria-label="Subject tools">
        {TABS.map(([value, label, icon]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "is-active" : ""}
            onClick={() => setTab(value)}
            key={value}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {tab === "calculator" && <ScientificCalculator />}
      {tab === "table" && <TableBuilder />}
      {tab === "map" && <ConceptMap />}
      {tab === "generator" && <SubjectGenerator />}
    </section>
  );
}
