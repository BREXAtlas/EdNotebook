import { useState } from "react";

function savePreviewSubmission(payload) {
  const key = "ednotebook-portal-interest-preview";
  let prior = [];
  try {
    prior = JSON.parse(window.sessionStorage.getItem(key)) || [];
  } catch {
    prior = [];
  }
  window.sessionStorage.setItem(key, JSON.stringify([...prior.slice(-9), payload]));
}

export default function InterestForm({ kind, title, description, submitLabel, emailRequired = false }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  function submit(event) {
    event.preventDefault();
    savePreviewSubmission({
      id: crypto.randomUUID(),
      kind,
      purpose: "product_feedback",
      name: name.trim(),
      email: email.trim(),
      school: school.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      delivery: "preview-device-only",
    });
    setNotice("Saved for this preview. Connect the public form endpoint before collecting live submissions.");
    setMessage("");
  }

  return (
    <form className="portal-interest-form" onSubmit={submit}>
      <span className="portal-kicker">{kind.replaceAll("_", " ")}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="interest-field-grid">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        <label>Email<input type="email" required={emailRequired} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      </div>
      <label>College or university<input value={school} onChange={(event) => setSchool(event.target.value)} placeholder="School name" /></label>
      <label>{kind === "feature_feedback" ? "What would make student life easier?" : "What would you like to work on?"}<textarea rows={4} required value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      {notice && <div className="portal-form-notice" role="status">{notice}</div>}
      <button type="submit">{submitLabel}</button>
    </form>
  );
}
