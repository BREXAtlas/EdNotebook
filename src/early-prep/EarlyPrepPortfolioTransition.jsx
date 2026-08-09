import { useState } from "react";
import {
  EARLY_PREP_TRANSITION_ITEMS,
  confirmSyntheticTransitionManifest,
  previewEducationPathTransition,
} from "./portfolioTransition.js";
import "./early-prep-transition.css";

const SELECTABLE_ITEMS = EARLY_PREP_TRANSITION_ITEMS.filter(({ disposition }) => disposition !== "archive_only");
const ARCHIVED_ITEMS = EARLY_PREP_TRANSITION_ITEMS.filter(({ disposition }) => disposition === "archive_only");

function SelectionItem({ item, checked, onChange }) {
  return (
    <label className="transition-selection-item">
      <input type="checkbox" checked={checked} onChange={() => onChange(item.id)} />
      <span>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
        <i>{item.disposition === "review_required" ? "Institution or rights review required" : "Student choice"}</i>
      </span>
    </label>
  );
}

function ArchivedItem({ item }) {
  return (
    <article>
      <strong>{item.label}</strong>
      <p>{item.description}</p>
      <span>Remains in Early Prep or its official records process</span>
    </article>
  );
}

export default function EarlyPrepPortfolioTransition({ onClose }) {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [confirmations, setConfirmations] = useState({ itemSelection: false, archiveBoundary: false, reviewBoundary: false });
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const preview = previewEducationPathTransition({ selectedItemIds });
  const allConfirmed = confirmations.itemSelection && confirmations.archiveBoundary && confirmations.reviewBoundary;

  function toggleItem(itemId) {
    setSelectedItemIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
    setResult(null);
    setNotice("");
  }

  function toggleConfirmation(field) {
    setConfirmations((current) => ({ ...current, [field]: !current[field] }));
    setResult(null);
    setNotice("");
  }

  function buildManifest() {
    try {
      setResult(confirmSyntheticTransitionManifest(preview, confirmations));
      setNotice("Synthetic manifest ready. No request was submitted and no record moved.");
    } catch (error) {
      setResult(null);
      setNotice(error.message || "The synthetic manifest could not be prepared.");
    }
  }

  return (
    <div className="early-prep-transition">
      <section className="dashboard-card transition-hero">
        <div>
          <span className="portal-kicker">EARLY PREP 9–12 · SYNTHETIC TRANSITION PREVIEW</span>
          <h1>Choose what you may want to carry into University.</h1>
          <p>This practice view prepares a versioned request manifest. It does not create a University account, change your education path, copy a record, or submit a request.</p>
        </div>
        <button type="button" onClick={onClose}>Back to My Page</button>
      </section>

      <section className="dashboard-card transition-selection">
        <header><div><span className="portal-kicker">1 · SELECT EACH ITEM</span><h2>Nothing is selected automatically.</h2></div><strong>{preview.counts.selected} selected</strong></header>
        <p>Select only student-created or completion evidence you would want reviewed later. This fixture uses synthetic categories, not your real files or school records.</p>
        <div>{SELECTABLE_ITEMS.map((item) => <SelectionItem key={item.id} item={item} checked={selectedItemIds.includes(item.id)} onChange={toggleItem} />)}</div>
      </section>

      <section className="dashboard-card transition-archive">
        <header><div><span className="portal-kicker">2 · REMAINS BEHIND</span><h2>Protected school context stays protected.</h2></div><strong>{preview.counts.archived} categories</strong></header>
        <p>These records cannot be selected in this portfolio preview. A separate lawful school-record process may apply to official records.</p>
        <div>{ARCHIVED_ITEMS.map((item) => <ArchivedItem key={item.id} item={item} />)}</div>
      </section>

      <section className="dashboard-card transition-confirmations">
        <span className="portal-kicker">3 · CONFIRM THE BOUNDARIES</span>
        <h2>A real transition would still need review.</h2>
        <label><input type="checkbox" checked={confirmations.itemSelection} onChange={() => toggleConfirmation("itemSelection")} /><span>I selected each proposed item myself and understand that nothing else will be included automatically.</span></label>
        <label><input type="checkbox" checked={confirmations.archiveBoundary} onChange={() => toggleConfirmation("archiveBoundary")} /><span>I understand that grades, disciplinary and safety records, private messages, school social records, district identifiers, and research data remain outside this preview.</span></label>
        <label><input type="checkbox" checked={confirmations.reviewBoundary} onChange={() => toggleConfirmation("reviewBoundary")} /><span>I understand that a future real request still requires institutional review, student reconfirmation, and any required school, guardian, rights, or records approval.</span></label>
        <button className="primary" type="button" disabled={!selectedItemIds.length || !allConfirmed} onClick={buildManifest}>Build synthetic manifest</button>
        {notice ? <div className="portal-form-notice" role="status">{notice}</div> : null}
      </section>

      {result ? (
        <section className="dashboard-card transition-result" aria-live="polite">
          <header><div><span className="portal-kicker">SYNTHETIC MANIFEST READY</span><h2>Your choices are review evidence—not a transfer.</h2></div><span>Preview only</span></header>
          <dl>
            <div><dt>Selected items</dt><dd>{result.manifest.selectedItems.length}</dd></div>
            <div><dt>Records copied</dt><dd>{result.recordsCopied}</dd></div>
            <div><dt>Request submitted</dt><dd>No</dd></div>
            <div><dt>Current division changed</dt><dd>No</dd></div>
          </dl>
          <div className="transition-hash"><strong>Manifest hash</strong><code>{result.manifestHash}</code></div>
          <ul>
            <li>University records modified: no</li>
            <li>University account created: no</li>
            <li>School and University social audiences merged: no</li>
            <li>Institution review and student reconfirmation required before any future apply step</li>
          </ul>
        </section>
      ) : null}

      <section className="dashboard-card transition-boundary">
        <span className="portal-kicker">BOUNDARY</span>
        <h2>Early Prep remains your current education division.</h2>
        <p>This unit never calls Supabase, changes `student_education_paths`, inserts `education_path_transition_requests`, or modifies the existing University, professor, publisher, marketplace, or payment systems.</p>
      </section>
    </div>
  );
}
