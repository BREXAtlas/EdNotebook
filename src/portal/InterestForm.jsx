import { useState } from "react";
import { submitPortalInterest } from "./portalService.js";

export default function InterestForm({ kind, title, description, submitLabel, emailRequired = false, educationDivision = "university", onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    const result = await submitPortalInterest({ kind, name, email, school, message, educationDivision });
    if (result.error) {
      setError("We could not submit this form yet. Please try again in a moment.");
    } else {
      setNotice(kind === "pricing_waitlist" ? "You’re on the paid-services waitlist." : "Thanks—your response was submitted.");
      setName("");
      setEmail("");
      setSchool("");
      setMessage("");
      onSuccess?.();
    }
    setBusy(false);
  }

  return (
    <form className="portal-interest-form" onSubmit={submit}>
      <span className="portal-kicker">{kind.replaceAll("_", " ")}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="interest-field-grid">
        <label>Name<input spellCheck value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        <label>Email<input type="email" required={emailRequired || kind === "pricing_waitlist"} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      </div>
      <label>{educationDivision === "k12" ? "School or district" : "College or university"}<input spellCheck value={school} onChange={(event) => setSchool(event.target.value)} placeholder="School name" /></label>
      <label>{kind === "feature_feedback" ? "What would make student life easier?" : kind === "pricing_waitlist" ? "Which future service interests you?" : "What would you like to work on?"}<textarea spellCheck rows={4} required={kind !== "pricing_waitlist"} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      {error && <div className="portal-form-error" role="alert">{error}</div>}
      {notice && <div className="portal-form-notice" role="status">{notice}</div>}
      <button type="submit" disabled={busy}>{busy ? "Submitting…" : submitLabel}</button>
    </form>
  );
}
