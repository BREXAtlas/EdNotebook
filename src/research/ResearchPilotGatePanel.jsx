import { useEffect, useState } from "react";
import {
  DIGITAL_LITERACY_RESEARCH_FIXTURE,
  RESEARCH_ACTIVITY_LABELS,
  describeResearchBlocker,
  evaluateResearchGate,
} from "./researchGateModel.js";
import { getResearchPilotGateStatus } from "./researchGateService.js";

function StatusBadge({ active }) {
  return <span className={`research-gate-status ${active ? "is-active" : "is-blocked"}`}>{active ? "ACTIVE" : "NOT ACTIVATED"}</span>;
}

function GateCard({ project }) {
  const serverBlockers = Array.isArray(project.blockers) ? project.blockers : [];
  const evaluation = project.fixture ? evaluateResearchGate({
    ...project,
    purpose: "research",
    institution_id: project.institution_id || null,
    course_id: project.course_id || null,
    data_owner: project.data_owner || null,
    feature_enabled: project.feature_enabled === true,
  }) : { blockers: [] };
  const blockers = [...new Set([...evaluation.blockers, ...serverBlockers])];
  const active = project.status === "active" && blockers.length === 0;

  return (
    <article className="research-gate-card">
      <div className="research-gate-card__heading">
        <div>
          <span className="ac-eyebrow">{project.fixture ? "Synthetic planning fixture" : `Project version ${project.version_number || "draft"}`}</span>
          <h3>{project.title}</h3>
          <p>{project.course_title || project.course || "Course scope not selected"}</p>
        </div>
        <StatusBadge active={active} />
      </div>
      <p>{project.purpose_statement}</p>
      <dl className="research-gate-details">
        <div><dt>Institution</dt><dd>{project.institution || project.institution_id || "Not selected"}</dd></div>
        <div><dt>Data owner</dt><dd>{project.data_owner?.name || "Not recorded"}</dd></div>
        <div><dt>Written determination</dt><dd>{project.latest_determination?.decision === "approved" ? project.latest_determination.official_body : "Not recorded"}</dd></div>
        <div><dt>Research export</dt><dd>{project.export_rules?.mode === "approved_scoped" && active ? "Approved scope only" : "Off"}</dd></div>
      </dl>
      <div className="research-gate-activities" aria-label="Planned research activities">
        {(project.research_activities || []).map((activity) => <span key={activity}>{RESEARCH_ACTIVITY_LABELS[activity] || activity}</span>)}
      </div>
      {!active ? (
        <div className="research-gate-blockers">
          <strong>Collection remains blocked until all items are complete:</strong>
          <ul>{blockers.map((blocker) => <li key={blocker}>{describeResearchBlocker(blocker)}</li>)}</ul>
        </div>
      ) : null}
      <p className="research-gate-boundary"><strong>Participation boundary:</strong> Enrollment, an EdNotebook account, course work, or acceptance of account terms never counts as research participation.</p>
    </article>
  );
}

export default function ResearchPilotGatePanel({ institutionId = null, institutionName = "" }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(institutionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    async function load() {
      if (!institutionId) {
        setStatus(null);
        setError(null);
        setLoading(false);
        return;
      }
      setStatus(null);
      setLoading(true);
      setError(null);
      try {
        const next = await getResearchPilotGateStatus({ institutionId });
        if (current) setStatus({ ...next, requested_institution_id: institutionId });
      } catch (nextError) {
        if (current) setError({
          institution_id: institutionId,
          message: nextError?.message || "Research pilot status could not be loaded.",
        });
      } finally {
        if (current) setLoading(false);
      }
    }
    load();
    return () => { current = false; };
  }, [institutionId]);

  const currentStatus = status?.requested_institution_id === institutionId ? status : null;
  const currentError = error?.institution_id === institutionId ? error.message : "";
  const projects = Array.isArray(currentStatus?.projects) && currentStatus.projects.length
    ? currentStatus.projects
    : [{
        ...DIGITAL_LITERACY_RESEARCH_FIXTURE,
        institution: institutionName || DIGITAL_LITERACY_RESEARCH_FIXTURE.institution,
      }];

  return (
    <section className="ac-panel research-gate-panel">
      <div className="ac-section-heading">
        <div>
          <p className="ac-eyebrow">Optional research mode</p>
          <h2>Digital Literacy pilot research gate</h2>
          <p>Plan the pilot without collecting research data. Product feedback, usability reports, feature voting, and course-improvement feedback remain available in their ordinary modes.</p>
        </div>
        <StatusBadge active={false} />
      </div>
      <div className="ac-callout ac-callout--warning">
        <strong>Fail-closed by design.</strong> Pre/post assessments, qualitative interviews, open-ended research surveys, learning-effectiveness analysis, and research exports stay off until a written Angelo State IRB/HRPP determination is recorded for the exact version and scope.
      </div>
      {!institutionId ? <div className="ac-callout ac-callout--neutral">Choose an institution workspace to review deployed project records. The synthetic fixture below never creates or activates a study.</div> : null}
      {currentStatus?.setup_message ? <div className="ac-callout ac-callout--neutral">{currentStatus.setup_message} The planning fixture remains non-operational.</div> : null}
      {loading ? <p role="status">Checking the institution research gate…</p> : null}
      {currentError ? <div className="ac-alert ac-alert--error" role="alert">{currentError} No research controls were enabled.</div> : null}
      <div className="research-gate-list">{projects.map((project) => <GateCard key={project.project_id || project.project_key} project={project} />)}</div>
      <div className="research-gate-guidance">
        <h3>Angelo State review boundary</h3>
        <p>ASU says covered human-subjects projects must receive IRB review and approval before data collection. Its classroom-project guidance also warns that students are a captive participant group and says classroom data must be clearly disconnected from grades.</p>
        <p><a href="https://www.angelo.edu/research/compliance/protection/human-subjects.php">ASU Protection of Human Subjects</a> · <a href="https://www.angelo.edu/live/files/17315-guidelines-for-classroom-projects">ASU Guidelines for Classroom Projects</a></p>
      </div>
    </section>
  );
}
