import { useEffect, useRef, useState } from "react";

import {
  EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP,
  LIVE_ACTIVATION_GATES,
  SYNTHETIC_PILOT_STEPS,
  applySyntheticPilotStep,
  createSyntheticPilotEvidencePacket,
  createSyntheticPilotState,
  evaluateLiveActivation,
} from "./syntheticInstitutionPilot.js";
import "./synthetic-institution-pilot.css";

function downloadPacket(packet) {
  const blob = new Blob([`${JSON.stringify(packet, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ednotebook-synthetic-institution-pilot-evidence.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusLabel(value) {
  return value.replaceAll("_", " ");
}

export default function SyntheticInstitutionPilot({ onBack, onOpenTos }) {
  const [pilot, setPilot] = useState(createSyntheticPilotState);
  const [pendingStep, setPendingStep] = useState(null);
  const [announcement, setAnnouncement] = useState(
    "Start with the synthetic institution application.",
  );
  const [exporting, setExporting] = useState(false);
  const statusRef = useRef(null);
  const cancelRef = useRef(null);
  const stepButtonRefs = useRef(new Map());

  const nextStep = SYNTHETIC_PILOT_STEPS[pilot.nextStepIndex] || null;
  const complete = pilot.nextStepIndex === SYNTHETIC_PILOT_STEPS.length;
  const liveGate = evaluateLiveActivation("approved_pilot", {});

  useEffect(() => {
    if (pendingStep) cancelRef.current?.focus();
  }, [pendingStep]);

  function focusStatus(message) {
    setAnnouncement(message);
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  function closeDialog() {
    const stepId = pendingStep?.id;
    setPendingStep(null);
    requestAnimationFrame(() => stepButtonRefs.current.get(stepId)?.focus());
  }

  function confirmStep() {
    if (!pendingStep) return;
    const next = applySyntheticPilotStep(
      pilot,
      pendingStep.id,
      pendingStep.actor,
      new Date().toISOString(),
    );
    setPilot(next);
    setPendingStep(null);
    focusStatus(next.audit[0]?.summary || "No synthetic change occurred.");
  }

  async function exportEvidence() {
    setExporting(true);
    try {
      const packet = await createSyntheticPilotEvidencePacket(pilot);
      downloadPacket(packet);
      focusStatus(
        "Counts-only evidence exported. Import this JSON in the TOS Pilot Management page.",
      );
    } catch (error) {
      focusStatus(error.message || "Synthetic evidence could not be exported.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="synthetic-pilot" aria-labelledby="synthetic-pilot-title">
      <header className="synthetic-pilot__header">
        <div>
          <p>Stage 10 · owner-approved synthetic institution bounded pilot</p>
          <h1 id="synthetic-pilot-title">Complete EdNotebook journey</h1>
          <p>
            Institution → professor → class → student → discussion → assignment
            → points → grade → closeout → TOS evidence
          </p>
        </div>
        <div className="synthetic-pilot__header-actions">
          <button type="button" onClick={onBack}>
            Back to institution admin
          </button>
          <button type="button" onClick={onOpenTos}>
            Open TOS Pilot Management
          </button>
        </div>
      </header>

      <div className="synthetic-pilot__boundary" role="status">
        <strong>Production: not activated.</strong> Data is synthetic,
        session-only, and not persisted. This rehearsal creates no Supabase
        users, grades, institutional records, billing, or adoption claims.
      </div>

      <section
        className="synthetic-pilot__status"
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        <strong>Latest result</strong>
        <p>{announcement}</p>
      </section>

      <section aria-labelledby="journey-heading">
        <div className="synthetic-pilot__section-heading">
          <div>
            <p>Session progress</p>
            <h2 id="journey-heading">
              {pilot.nextStepIndex} of {SYNTHETIC_PILOT_STEPS.length} actions
              completed
            </h2>
          </div>
          <progress
            aria-label="Synthetic pilot completion"
            max={SYNTHETIC_PILOT_STEPS.length}
            value={pilot.nextStepIndex}
          />
        </div>

        <ol className="synthetic-pilot__steps">
          {SYNTHETIC_PILOT_STEPS.map((step, index) => {
            const finished = index < pilot.nextStepIndex;
            const current = index === pilot.nextStepIndex;
            return (
              <li
                className={finished ? "is-complete" : current ? "is-current" : ""}
                key={step.id}
              >
                <div>
                  <span>
                    {finished ? "Complete" : current ? "Next" : "Locked"} ·{" "}
                    {statusLabel(step.actor)}
                  </span>
                  <strong>{step.label}</strong>
                  {finished ? <p>{step.result}</p> : null}
                </div>
                <button
                  disabled={!current}
                  onClick={() => setPendingStep(step)}
                  ref={(node) => {
                    if (node) stepButtonRefs.current.set(step.id, node);
                  }}
                  type="button"
                >
                  Review and run
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="role-views-heading">
        <h2 id="role-views-heading">What each synthetic role can now see</h2>
        <div className="synthetic-pilot__cards">
          <article>
            <strong>Institution administrator</strong>
            <p>Institution: {statusLabel(pilot.institution.status)}</p>
            <p>Professor: {statusLabel(pilot.professor.status)}</p>
          </article>
          <article>
            <strong>Professor</strong>
            <p>Assigned classes: {pilot.professor.classIds.length}</p>
            <p>Students: {pilot.course.studentCount}</p>
            <p>Progress points visible: {pilot.assignment.progressPoints}</p>
          </article>
          <article>
            <strong>Student</strong>
            <p>Enrolled: {pilot.student.enrolled ? "Yes" : "No"}</p>
            <p>Assignment: {statusLabel(pilot.assignment.status)}</p>
            <p>Published grade visible: {pilot.student.gradeVisible ? "Yes" : "No"}</p>
          </article>
          <article>
            <strong>Course and closeout</strong>
            <p>Course: {statusLabel(pilot.course.status)}</p>
            <p>Discussion posts: {pilot.course.discussionCount}</p>
            <p>TOS evidence: {statusLabel(pilot.closeout.status)}</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="handoff-heading">
        <h2 id="handoff-heading">Counts-only TOS handoff</h2>
        <p>
          Complete all actions, export the evidence packet, then import it in
          TOS. Names, emails, identifiers, raw grades, and credentials are
          excluded.
        </p>
        <button
          disabled={!complete || exporting}
          onClick={exportEvidence}
          type="button"
        >
          {exporting ? "Preparing evidence…" : "Export TOS evidence JSON"}
        </button>
      </section>

      <section aria-labelledby="infrastructure-map-heading">
        <h2 id="infrastructure-map-heading">
          Existing EdNotebook infrastructure → TOS evidence
        </h2>
        <p>
          This rehearsal follows the same protected record boundaries as the
          deployed EdNotebook design. TOS receives evidence references and
          counts, not student records or raw grades.
        </p>
        <div className="synthetic-pilot__mapping">
          {EDNOTEBOOK_TOS_INFRASTRUCTURE_MAP.map((mapping) => (
            <article key={mapping.action}>
              <strong>{statusLabel(mapping.action)}</strong>
              <code>{mapping.route}</code>
              <p>{mapping.authoritativeRecords}</p>
              <small>TOS: {mapping.tosEvidence}</small>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="activation-heading">
        <h2 id="activation-heading">Live pilot and production activation</h2>
        <p>
          Synthetic rehearsal is allowed now. Approved-pilot and production
          modes remain denied until every gate below is independently evidenced
          after Stages 1–12 are verified.
        </p>
        <ul className="synthetic-pilot__gates">
          {LIVE_ACTIVATION_GATES.map((gate) => (
            <li key={gate}>
              <strong>Blocked</strong> · {statusLabel(gate)}
            </li>
          ))}
        </ul>
        <p>{liveGate.missing.length} activation gates remain.</p>
      </section>

      <section aria-labelledby="pilot-audit-heading">
        <h2 id="pilot-audit-heading">Change and audit history · newest first</h2>
        {pilot.audit.length ? (
          <div className="synthetic-pilot__audit">
            {pilot.audit.map((event) => (
              <article key={event.id}>
                <strong>
                  {event.outcome} · {statusLabel(event.action)}
                </strong>
                <p>{event.summary}</p>
                <p>Acting as {statusLabel(event.actor)}</p>
                <time dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <p>No synthetic pilot actions yet.</p>
        )}
      </section>

      {pendingStep ? (
        <div className="synthetic-pilot__backdrop" role="presentation">
          <div
            aria-describedby="pilot-confirm-description"
            aria-labelledby="pilot-confirm-heading"
            aria-modal="true"
            className="synthetic-pilot__dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeDialog();
            }}
            role="dialog"
          >
            <p>Human confirmation required</p>
            <h2 id="pilot-confirm-heading">{pendingStep.label}?</h2>
            <p id="pilot-confirm-description">
              Acting as {statusLabel(pendingStep.actor)}. This changes only the
              current synthetic browser session and creates a timestamped audit
              event.
            </p>
            <div>
              <button type="button" onClick={confirmStep}>
                Confirm synthetic action
              </button>
              <button type="button" onClick={closeDialog} ref={cancelRef}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
