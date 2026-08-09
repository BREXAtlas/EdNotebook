import { useState } from "react";
import {
  EARLY_PREP_HUMAN_APPROVAL_GATES,
  EARLY_PREP_PILOT_ACKNOWLEDGEMENTS,
  EARLY_PREP_STAGING_WALKTHROUGH_CHECKS,
  prepareEarlyPrepInstitutionReviewPacket,
  previewEarlyPrepPilotReadiness,
} from "./pilotReadiness.js";
import "./early-prep-pilot-readiness.css";

const PREVIEW = previewEarlyPrepPilotReadiness();

function EvidenceCard({ evidence }) {
  return (
    <article>
      <span>Repository evidence ready</span>
      <h3>{evidence.label}</h3>
      <p>{evidence.detail}</p>
      <code>{evidence.evidenceReference}</code>
    </article>
  );
}

function ApprovalGate({ gate, index }) {
  return (
    <li>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div><strong>{gate.label}</strong><p>{gate.detail}</p><code>{gate.evidenceReference}</code></div>
      <em>Authorized human decision required</em>
    </li>
  );
}

export default function EarlyPrepPilotReadiness({ onBack }) {
  const [acknowledgements, setAcknowledgements] = useState({});
  const [packet, setPacket] = useState(null);
  const [notice, setNotice] = useState("");
  const allAcknowledged = EARLY_PREP_PILOT_ACKNOWLEDGEMENTS.every(({ id }) => acknowledgements[id] === true);

  function toggleAcknowledgement(id) {
    setAcknowledgements((current) => ({ ...current, [id]: !current[id] }));
    setPacket(null);
    setNotice("");
  }

  function preparePacket() {
    try {
      setPacket(prepareEarlyPrepInstitutionReviewPacket(PREVIEW, acknowledgements));
      setNotice("Synthetic review packet ready. No approval was recorded and no pilot was activated.");
    } catch (error) {
      setPacket(null);
      setNotice(error.message || "The review packet could not be prepared.");
    }
  }

  return (
    <main className="early-prep-pilot-readiness" aria-labelledby="early-prep-pilot-title">
      <header className="early-prep-pilot-hero">
        <div><span>EARLY PREP · GRADES 9–12 · BETA READINESS CLOSEOUT</span><h1 id="early-prep-pilot-title">High-school Beta readiness and institution review</h1><p>The synthetic staging walkthrough is complete. Review the protected Beta-promotion boundary and the decisions a school or district must still make before any real-minor-data pilot.</p></div>
        <button type="button" onClick={onBack}>Back to Control Center</button>
      </header>

      <section className="early-prep-pilot-stop" role="status">
        <strong>TECHNICAL CLOSEOUT COMPLETE · BETA PROMOTION NOT AUTHORIZED</strong>
        <p>This page confirms synthetic technical readiness. It cannot approve a staging-to-main promotion or a real pilot, record an institution decision, assign a live data lane, or authorize real minor data.</p>
      </section>

      <section className="early-prep-pilot-summary" aria-label="Readiness summary">
        <article><span>Technical evidence</span><strong>{PREVIEW.counts.technicalEvidenceReady}</strong><small>repository items ready for review</small></article>
        <article><span>Staging walkthrough</span><strong>{PREVIEW.counts.stagingWalkthroughChecksCompleted}/16</strong><small>synthetic teacher/student checks passed</small></article>
        <article><span>Human decisions</span><strong>{PREVIEW.counts.humanDecisionsRequired}</strong><small>still required</small></article>
        <article><span>Approvals recorded</span><strong>0</strong><small>this surface cannot record them</small></article>
        <article><span>Real student records</span><strong>0</strong><small>synthetic categories only</small></article>
      </section>

      <section className="early-prep-pilot-section" aria-labelledby="technical-evidence-heading">
        <div className="early-prep-pilot-heading"><div><span>1 · TECHNICAL EVIDENCE</span><h2 id="technical-evidence-heading">Built and verified does not mean institution-approved.</h2></div><strong>{PREVIEW.counts.technicalEvidenceReady} of {PREVIEW.counts.technicalEvidenceReady}</strong></div>
        <div className="early-prep-pilot-evidence-grid">{PREVIEW.technicalEvidence.map((evidence) => <EvidenceCard key={evidence.id} evidence={evidence} />)}</div>
      </section>

      <section className="early-prep-pilot-section" aria-labelledby="staging-walkthrough-heading">
        <div className="early-prep-pilot-heading"><div><span>2 · STAGING WALKTHROUGH</span><h2 id="staging-walkthrough-heading">Full synthetic teacher-and-student verification is complete.</h2></div><strong>{PREVIEW.counts.stagingWalkthroughChecksCompleted} passed</strong></div>
        <p>All 16 checks passed against the deployed PR #137 staging candidate. This closes the technical walkthrough gate without authorizing main promotion or real-minor-data use.</p>
        <ol className="early-prep-pilot-walkthrough">{EARLY_PREP_STAGING_WALKTHROUGH_CHECKS.map((check, index) => <li key={check.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{check.label}</strong><small>Synthetic {check.persona} check</small></div><em>Passed in deployed staging</em></li>)}</ol>
      </section>

      <section className="early-prep-pilot-section" aria-labelledby="human-gates-heading">
        <div className="early-prep-pilot-heading"><div><span>3 · HUMAN AUTHORIZATION</span><h2 id="human-gates-heading">Every real-student pilot gate remains undecided here.</h2></div><strong>{PREVIEW.counts.humanDecisionsRequired} pending</strong></div>
        <ol className="early-prep-pilot-gates">{EARLY_PREP_HUMAN_APPROVAL_GATES.map((gate, index) => <ApprovalGate key={gate.id} gate={gate} index={index} />)}</ol>
      </section>

      <section className="early-prep-pilot-section early-prep-pilot-confirm" aria-labelledby="boundary-heading">
        <span>4 · PREPARE THE REVIEW PACKET</span>
        <h2 id="boundary-heading">Confirm the boundaries—not an approval.</h2>
        <p>These acknowledgements create only a synthetic, session-local summary for authorized reviewers.</p>
        <div>{EARLY_PREP_PILOT_ACKNOWLEDGEMENTS.map((item) => <label key={item.id}><input type="checkbox" checked={acknowledgements[item.id] === true} onChange={() => toggleAcknowledgement(item.id)} /><span>{item.label}</span></label>)}</div>
        <button type="button" disabled={!allAcknowledged} onClick={preparePacket}>Prepare synthetic review packet</button>
        {notice ? <p className="early-prep-pilot-notice" role="status">{notice}</p> : null}
      </section>

      {packet ? (
        <section className="early-prep-pilot-section early-prep-pilot-result" aria-live="polite">
          <span>PACKET READY FOR AUTHORIZED HUMAN REVIEW</span>
          <h2>Technical handoff complete. Beta-promotion and institution decisions: not recorded.</h2>
          <dl><div><dt>Staging walkthrough complete</dt><dd>Yes</dd></div><div><dt>Beta promotion authorized</dt><dd>No</dd></div><div><dt>Pilot approved</dt><dd>No</dd></div><div><dt>Main promotion authorized</dt><dd>No</dd></div><div><dt>Live data lane assigned</dt><dd>No</dd></div><div><dt>Real minor data authorized</dt><dd>No</dd></div><div><dt>Live SIS/LMS authorized</dt><dd>No</dd></div><div><dt>Production or research activated</dt><dd>No</dd></div></dl>
          <p><strong>Packet hash:</strong> <code>{packet.packetHash}</code></p>
          <p>{packet.nextRequiredAction}</p>
        </section>
      ) : null}

      <section className="early-prep-pilot-section early-prep-pilot-boundary">
        <span>FIXED EXCLUSIONS</span>
        <h2>No live minor data, integrations, research, production, payments, or University-side changes.</h2>
        <p>This unit adds no Supabase write, migration, Edge Function, SIS/LMS credential, roster exchange, grade passback, payment operation, marketplace action, professor workflow, publisher workflow, or University record change.</p>
      </section>
    </main>
  );
}
