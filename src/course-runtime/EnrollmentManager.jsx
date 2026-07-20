import { useEffect, useState } from "react";
import { approveEnrollmentRequest, listEnrollmentRequests, rejectEnrollmentRequest } from "./courseService.js";

function learnerName(request) {
  const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
  return profile?.full_name || profile?.email?.split("@")[0] || "Student";
}

function learnerEmail(request) {
  const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
  return profile?.email || "Account email unavailable";
}

export default function EnrollmentManager({ courseId }) {
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  async function refresh() {
    const result = await listEnrollmentRequests(courseId);
    if (result.error) setNotice(result.error.message);
    else { setRequests(result.data || []); setNotice(""); }
  }

  useEffect(() => { if (courseId) refresh(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(request, action) {
    setBusyId(request.id);
    const result = action === "approve" ? await approveEnrollmentRequest(request.id) : await rejectEnrollmentRequest(request.id);
    setBusyId("");
    if (result.error) { setNotice(result.error.message); return; }
    setNotice(action === "approve" ? `${learnerName(request)} is enrolled and can open the published course.` : `${learnerName(request)}'s request was rejected.`);
    refresh();
  }

  const pending = requests.filter((request) => request.status === "pending");
  const decided = requests.filter((request) => request.status !== "pending");

  return <section className="course-progress-manager enrollment-manager">
    <div className="studio-section-heading"><div><span>ENROLLMENT REQUESTS</span><h2>Approve the student-to-course connection.</h2><p>A student can find the public listing and request access. Approval creates the protected course membership used by lessons, assignments, progress, messages, and grades.</p></div><button type="button" onClick={refresh}>Refresh</button></div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    {pending.length === 0 ? <div className="studio-empty"><strong>No requests waiting.</strong><p>New student requests will appear here.</p></div> : <div className="enrollment-request-list">{pending.map((request) => <article key={request.id}><div><strong>{learnerName(request)}</strong><span>{learnerEmail(request)}</span><small>Requested {new Date(request.requested_at).toLocaleString()}</small></div><div><button type="button" disabled={busyId === request.id} onClick={() => decide(request, "reject")}>Reject</button><button className="primary" type="button" disabled={busyId === request.id} onClick={() => decide(request, "approve")}>{busyId === request.id ? "Saving…" : "Approve & enroll"}</button></div></article>)}</div>}
    {decided.length > 0 && <details><summary>{decided.length} decided request{decided.length === 1 ? "" : "s"}</summary><div className="enrollment-history">{decided.map((request) => <div key={request.id}><strong>{learnerName(request)}</strong><span>{request.status}</span></div>)}</div></details>}
  </section>;
}
