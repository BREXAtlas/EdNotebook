import { earlyPrepWorkspaceConfig } from "./subjectCatalog.js";

export default function SubjectWorkspaceGuide({ subjectId, mode = "student" }) {
  const workspace = earlyPrepWorkspaceConfig(subjectId);
  if (!workspace) return null;
  const headingId = `subject-workspace-${mode}-${workspace.subjectId}`;

  return (
    <section className="dashboard-card early-prep-subject-workspace" aria-labelledby={headingId}>
      <div className="early-prep-subject-workspace-heading">
        <div>
          <span className="portal-kicker">EARLY PREP SUBJECT WORKSPACE</span>
          <h2 id={headingId}>{workspace.subjectLabel} · {workspace.title}</h2>
          <p>{workspace.summary}</p>
        </div>
        <span className="early-prep-subject-standard">{workspace.standardsLabel}</span>
      </div>
      <div className="early-prep-subject-workspace-grid">
        <div>
          <strong>{mode === "professor" ? "Built into new assignment templates" : "Evidence tools for this class"}</strong>
          <ul>{workspace.tools.map((tool) => <li key={tool}>{tool}</li>)}</ul>
        </div>
        <div>
          <strong>{mode === "professor" ? "Student workflow" : "A clear way through the work"}</strong>
          <ol>{workspace.workflow.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </div>
      <p className="early-prep-subject-workspace-note">
        {mode === "professor"
          ? "The starter is editable before publishing. Existing templates and completed student work are never rewritten when the adapter changes."
          : "Your teacher can adapt the prompts. Save drafts as you work and submit only when every required section is complete."}
      </p>
    </section>
  );
}
