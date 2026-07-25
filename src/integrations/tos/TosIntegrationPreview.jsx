import { useEffect, useRef, useState } from "react";

import {
  TOS_CONTROL_CENTER_URL,
  createSafeTosContextPreview,
  createSyntheticCloseoutManifest,
  validateSyntheticCloseoutManifest,
} from "./tosControlPlane.js";
import "./tos-integration.css";

function downloadJson(value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ednotebook-stage10-synthetic-closeout.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function TosIntegrationPreview({ onBack }) {
  const [manifest, setManifest] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const statusRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (confirmOpen) cancelRef.current?.focus();
  }, [confirmOpen]);

  function record(action, outcome, summary) {
    const event = Object.freeze({
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      action,
      outcome,
      summary,
      actor: "authenticated institution administrator",
      synthetic: true,
      persisted: false,
    });
    setEvents((current) => [event, ...current]);
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  function generate() {
    const next = createSyntheticCloseoutManifest();
    const validation = validateSyntheticCloseoutManifest(next);
    setManifest(next);
    setResult(validation);
    record(
      "generate_manifest",
      validation.allowed ? "allowed" : "denied",
      validation.allowed
        ? "Synthetic closeout manifest validated. Nothing was sent."
        : "Synthetic closeout manifest was denied.",
    );
  }

  function confirm() {
    setConfirmOpen(false);
    record(
      "confirm_rehearsal",
      "allowed",
      "Synthetic handoff rehearsal confirmed. No trusted exchange or official transfer occurred.",
    );
  }

  function closeDialog() {
    setConfirmOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const context = createSafeTosContextPreview();

  return (
    <main className="tos-preview" aria-labelledby="tos-preview-heading">
      <header className="tos-preview__header">
        <div>
          <p>Stage 10 · authenticated integration preview</p>
          <h1 id="tos-preview-heading">TOS control-plane handoff</h1>
          <span>Production: not activated</span>
        </div>
        <div className="tos-preview__actions">
          <button type="button" onClick={onBack}>Back to EdNotebook admin</button>
          <a href="#/admin/synthetic-pilot">Run complete synthetic pilot</a>
        </div>
      </header>

      <section className="tos-preview__warning" role="status">
        <strong>Synthetic metadata only.</strong> Supabase remains the current
        EdNotebook product data plane. This screen does not send student names,
        IDs, grades, records, credentials, session tokens, or provider keys to
        TOS.
      </section>

      <section className="tos-preview__grid" aria-label="Boundary status">
        <article><strong>EdNotebook</strong><span>Product experience and protected records</span></article>
        <article><strong>TOS</strong><span>Policy, readiness, evidence, and audit metadata</span></article>
        <article><strong>Blackboard / SIS</strong><span>Roster and grade authority</span></article>
        <article><strong>Trusted adapter</strong><span>Not deployed</span></article>
      </section>

      <section className="tos-preview__panel" aria-labelledby="context-heading">
        <h2 id="context-heading">Safe context preview</h2>
        <dl>
          <div><dt>Authentication token included</dt><dd>No</dd></div>
          <div><dt>Personal data included</dt><dd>No</dd></div>
          <div><dt>Education records included</dt><dd>No</dd></div>
          <div><dt>Exchange mode</dt><dd>{context.exchangeMode.replaceAll("_", " ")}</dd></div>
        </dl>
        <a href={TOS_CONTROL_CENTER_URL} rel="noreferrer" target="_blank">
          Open TOS EdNotebook Operations
        </a>
      </section>

      <section className="tos-preview__panel" aria-labelledby="closeout-heading">
        <h2 id="closeout-heading">Synthetic course-closeout rehearsal</h2>
        <p>
          Generate a counts-only fixture, review the validation, then confirm
          the rehearsal. No network request or persistence occurs.
        </p>
        <div className="tos-preview__actions">
          <button type="button" onClick={generate}>Generate and validate fixture</button>
          <button
            disabled={!result?.allowed}
            onClick={() => setConfirmOpen(true)}
            ref={triggerRef}
            type="button"
          >
            Review confirmation
          </button>
          <button disabled={!manifest} onClick={() => downloadJson(manifest)} type="button">
            Export synthetic JSON
          </button>
        </div>
        {manifest ? (
          <dl>
            <div><dt>Course</dt><dd>{manifest.courseLabel}</dd></div>
            <div><dt>Enrollment balance</dt><dd>{manifest.recordCounts.enrollments} − {manifest.recordCounts.drops} = {manifest.recordCounts.finalizedGrades}</dd></div>
            <div><dt>Raw grades</dt><dd>Excluded</dd></div>
            <div><dt>Official record transfer</dt><dd>No</dd></div>
          </dl>
        ) : null}
      </section>

      <section
        className="tos-preview__status"
        ref={statusRef}
        role="status"
        tabIndex="-1"
      >
        <strong>Latest result</strong>
        <p>{events[0]?.summary || "No session action yet."}</p>
        {events[0] ? <time dateTime={events[0].occurredAt}>{new Date(events[0].occurredAt).toLocaleString()}</time> : null}
      </section>

      <section className="tos-preview__panel" aria-labelledby="history-heading">
        <h2 id="history-heading">Change and audit history · newest first</h2>
        {events.length ? events.map((event) => (
          <article className="tos-preview__event" key={event.id}>
            <strong>{event.outcome} · {event.action.replaceAll("_", " ")}</strong>
            <p>{event.summary}</p>
            <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
          </article>
        )) : <p>No session events yet.</p>}
      </section>

      {confirmOpen ? (
        <div className="tos-preview__backdrop" role="presentation">
          <div
            aria-describedby="tos-confirm-description"
            aria-labelledby="tos-confirm-heading"
            aria-modal="true"
            className="tos-preview__dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeDialog();
            }}
            role="dialog"
          >
            <h2 id="tos-confirm-heading">Confirm synthetic rehearsal?</h2>
            <p id="tos-confirm-description">
              This records a session-only confirmation. It does not send or
              accept official education records.
            </p>
            <div className="tos-preview__actions">
              <button type="button" onClick={confirm}>Confirm rehearsal</button>
              <button type="button" onClick={closeDialog} ref={cancelRef}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
