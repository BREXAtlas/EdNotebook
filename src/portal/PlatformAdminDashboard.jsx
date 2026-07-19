import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { getSecureDownload } from "../studio/resumableUpload.js";
import { listEducatorVerificationRequests, reviewEducatorVerification } from "./portalService.js";

function RequestCard({ request, onReview, onOpenDocument, busy }) {
  const educator = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
  return <article className="admin-verification-card"><header><div><span>{request.education_division === "k12" ? "K–12" : request.education_division === "both" ? "Both divisions" : "University"}</span><h3>{educator?.full_name || "Educator account"}</h3><small>{educator?.email || request.user_id}</small></div><strong className={`roster-status is-${request.status}`}>{request.status}</strong></header><dl><div><dt>School</dt><dd>{request.institution_name}</dd></div><div><dt>Department</dt><dd>{request.department || "Not provided"}</dd></div><div><dt>Teacher ID</dt><dd>{request.teacher_identifier_last4 ? `ending ${request.teacher_identifier_last4}` : "Document only"}</dd></div><div><dt>Submitted</dt><dd>{new Date(request.submitted_at).toLocaleString()}</dd></div></dl><footer>{request.secure_file_id && <button type="button" disabled={busy} onClick={() => onOpenDocument(request.secure_file_id)}>Open secure document</button>}{request.status === "pending" && <><button type="button" disabled={busy} onClick={() => onReview(request.user_id, "rejected")}>Reject affiliation</button><button className="primary" type="button" disabled={busy} onClick={() => onReview(request.user_id, "approved")}>Approve affiliation</button></>}</footer></article>;
}

export default function PlatformAdminDashboard({ onHome, onEducatorPortal }) {
  const [division, setDivision] = useState("university");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data, error: loadError } = await listEducatorVerificationRequests();
    if (loadError) setError(loadError.message || "Verification requests could not be loaded.");
    setRequests(data || []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function review(userId, decision) {
    setBusyUser(userId); setError("");
    const { error: reviewError } = await reviewEducatorVerification(userId, decision);
    if (reviewError) setError(reviewError.message || "The request could not be reviewed.");
    else await load();
    setBusyUser(null);
  }

  async function openDocument(secureFileId) {
    setError("");
    try {
      const signed = await getSecureDownload(secureFileId, { disposition: "inline" });
      window.open(signed.url, "_blank", "noopener,noreferrer");
    } catch (documentError) {
      setError(documentError.message || "The secure document is not available yet.");
    }
  }

  const filtered = useMemo(() => requests.filter((request) => request.education_division === division || request.education_division === "both"), [division, requests]);
  const stats = useMemo(() => ({ pending: requests.filter((item) => item.status === "pending").length, university: requests.filter((item) => ["university", "both"].includes(item.education_division)).length, k12: requests.filter((item) => ["k12", "both"].includes(item.education_division)).length }), [requests]);

  return <div className="platform-admin-page"><header className="dashboard-topbar"><button className="dashboard-brand" type="button" onClick={onHome}><BrandLogo size={38} tagline="Master admin" /></button><div className="dashboard-top-actions"><button type="button" onClick={onEducatorPortal}>Educator workspace</button><button className="primary" type="button" onClick={load}>Refresh queue</button></div></header><main className="platform-admin-main"><section className="admin-hero"><span className="portal-kicker">MASTER ADMIN</span><h1>University and K–12, clearly divided.</h1><p>Review school-affiliation requests here. Approval adds a verified badge; rejection never removes an educator's classes, tools, or subscription access.</p></section><section className="student-stat-grid admin-stat-grid"><article><span>Pending review</span><strong>{stats.pending}</strong><small>Manual decision needed</small></article><article><span>University requests</span><strong>{stats.university}</strong><small>College and university affiliations</small></article><article><span>K–12 requests</span><strong>{stats.k12}</strong><small>School and district affiliations</small></article><article><span>Review target</span><strong>Few days</strong><small>Set expectations in the educator portal</small></article></section><section className="dashboard-card"><div className="admin-division-tabs" role="tablist" aria-label="Education division"><button className={division === "university" ? "is-active" : ""} type="button" onClick={() => setDivision("university")}>University division</button><button className={division === "k12" ? "is-active" : ""} type="button" onClick={() => setDivision("k12")}>K–12 division</button></div>{error && <div className="portal-form-error" role="alert">{error}</div>}{loading ? <p>Loading verification queue…</p> : filtered.length === 0 ? <div className="admin-empty-state"><h2>No requests in this division.</h2><p>New teacher ID submissions will appear here for manual review.</p></div> : <div className="admin-verification-grid">{filtered.map((request) => <RequestCard key={request.user_id} request={request} onReview={review} onOpenDocument={openDocument} busy={busyUser === request.user_id} />)}</div>}</section></main></div>;
}
