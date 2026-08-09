import { useState } from "react";
import { runEarlyPrepLearningSystemsAcceptance } from "./learningSystemsAcceptance.js";
import "./early-prep-learning-systems.css";

function StatusMark({ passed }) {
  return <span className={passed ? "is-pass" : "is-blocked"}>{passed ? "Passed" : "Blocked"}</span>;
}

export default function EarlyPrepLearningSystemsAcceptance() {
  const [evidence, setEvidence] = useState(null);

  function runAcceptance() {
    setEvidence(runEarlyPrepLearningSystemsAcceptance());
  }

  return (
    <div className="early-prep-learning-systems">
      <section className="dashboard-card early-prep-learning-systems-hero">
        <div>
          <span className="portal-kicker">SYNTHETIC ACCEPTANCE · EARLY PREP 9–12</span>
          <h1>Rehearse OneRoster and Schoology without connecting a district.</h1>
          <p>This counts-only rehearsal uses fictional records and the existing canonical learning-record contract. It does not contact PowerSchool, Schoology, Supabase Edge Functions, or any production service.</p>
        </div>
        <button className="primary" type="button" onClick={runAcceptance}>Run synthetic acceptance</button>
      </section>

      <section className="early-prep-learning-systems-grid" aria-label="Synthetic learning-system contracts">
        <article className="dashboard-card">
          <span className="portal-kicker">ONEROSTER 1.2 · CSV PREVIEW</span>
          <h2>Roster and grade package</h2>
          <p>Checks the complete eight-file surface: organizations, terms, courses, classes, users, enrollments, line items, and results.</p>
          <ul>
            <li>Stable sourced IDs required</li>
            <li>Preview hash is deterministic</li>
            <li>No import or export write is authorized</li>
          </ul>
        </article>
        <article className="dashboard-card">
          <span className="portal-kicker">SCHOOLOGY · LTI 1.3</span>
          <h2>Launch and service rehearsal</h2>
          <p>Exercises fictional instructor and learner launches, an existing-class mapping, Deep Linking, NRPS reconciliation, and a reviewed AGS no-op.</p>
          <ul>
            <li>Only <code>.invalid</code> platform addresses</li>
            <li>No client secret, token, or private key</li>
            <li>Provider write count remains zero</li>
          </ul>
        </article>
      </section>

      {!evidence && <section className="dashboard-card early-prep-learning-systems-waiting">
        <h2>Nothing runs automatically.</h2>
        <p>Select “Run synthetic acceptance” to generate local, counts-only evidence. A real district connection still requires institution approval, credentials, privacy review, and separate live acceptance.</p>
      </section>}

      {evidence && <section className="dashboard-card early-prep-learning-systems-results" aria-live="polite">
        <header>
          <div>
            <span className="portal-kicker">ACCEPTANCE RESULT</span>
            <h2>{evidence.passed ? "Synthetic contracts passed." : "Synthetic contracts are blocked."}</h2>
          </div>
          <StatusMark passed={evidence.passed} />
        </header>
        <p className="early-prep-learning-systems-warning">Synthetic pass is not a live PowerSchool or Schoology approval. Production remains closed and no roster, grade, credential, or student record was sent.</p>

        <div className="early-prep-learning-systems-evidence">
          <div>
            <h3>OneRoster 1.2 package</h3>
            <dl>
              <div><dt>Files</dt><dd>{evidence.oneRoster.files.length}</dd></div>
              <div><dt>Synthetic rows</dt><dd>{evidence.oneRoster.totalRows}</dd></div>
              <div><dt>Writes</dt><dd>0</dd></div>
            </dl>
            <ul>{evidence.oneRoster.files.map((file) => <li key={file.resource}><code>{file.fileName}</code><span>{file.rowCount} row{file.rowCount === 1 ? "" : "s"}</span></li>)}</ul>
          </div>
          <div>
            <h3>Schoology LTI rehearsal</h3>
            <ul>{evidence.schoology.checks.map((check) => <li key={check.id}><span>{check.label}</span><StatusMark passed={check.passed} /></li>)}</ul>
          </div>
        </div>
      </section>}

      <section className="dashboard-card early-prep-learning-systems-boundary">
        <span className="portal-kicker">BOUNDARY</span>
        <h2>What still needs institution approval</h2>
        <p>Live issuer and deployment registration, district credentials, real roster intake, identity matching, grade release, reconciliation, retention, and incident-response evidence remain separate reviewed work. Teachers cannot activate those operations from this page.</p>
      </section>
    </div>
  );
}
