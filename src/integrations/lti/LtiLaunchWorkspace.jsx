import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../../Brand.jsx";
import { launchTokenFromHash } from "./ltiContract.js";
import {
  createDeepLinkResponse,
  linkLtiCurrentUser,
  loadLtiCourseWorkspace,
  readLtiSession,
  runLtiAgs,
  submitDeepLinkForm,
  syncLtiRoster,
} from "./ltiService.js";
import "./lti.css";

function DeepLinkPanel({ course, selection, setSelection, busy, onSubmit }) {
  return <section className="lti-card">
    <h2>Deep Linking content selection</h2>
    <div className="lti-form-grid">
      <label>Content type
        <select value={selection.targetType} onChange={(event) => setSelection({ ...selection, targetType: event.target.value, targetId: event.target.value === "course" ? course.course.id : "" })}>
          <option value="course">Whole course</option><option value="publication">Published course package</option><option value="assignment">Assignment</option>
        </select>
      </label>
      {selection.targetType === "publication" && <label>Published package
        <select value={selection.targetId} onChange={(event) => setSelection({ ...selection, targetId: event.target.value })}>
          <option value="">Select package</option>
          {course.publications.map((item) => <option key={item.id} value={item.id}>{course.course.title} · version {item.current_version}</option>)}
        </select>
      </label>}
      {selection.targetType === "assignment" && <label>Assignment
        <select value={selection.targetId} onChange={(event) => {
          const item = course.assignments.find((entry) => entry.id === event.target.value);
          setSelection({ ...selection, targetId: event.target.value, title: item?.title || selection.title });
        }}>
          <option value="">Select assignment</option>
          {course.assignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>}
      <label>Blackboard link title<input value={selection.title} onChange={(event) => setSelection({ ...selection, title: event.target.value })} /></label>
      <label>Optional grade column
        <select value={selection.gradeItemId} onChange={(event) => setSelection({ ...selection, gradeItemId: event.target.value })}>
          <option value="">No grade column</option>
          {course.gradeItems.filter((item) => item.publish_state === "published").map((item) => <option key={item.id} value={item.id}>{item.title} · {item.max_points} points</option>)}
        </select>
      </label>
    </div>
    <button className="lti-primary" type="button" disabled={busy || !selection.title || (selection.targetType !== "course" && !selection.targetId)} onClick={onSubmit}>Add selected content to Blackboard</button>
  </section>;
}

function AgsPanel({ course, ags, token, busy, act, onReload }) {
  const [lineItemId, setLineItemId] = useState("");
  const [mappingId, setMappingId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const finalizedGrades = course.grades.filter((grade) => grade.status === "finalized" && grade.score !== null);
  async function perform(action, message) {
    await act(action, message);
    await onReload();
  }
  return <section className="lti-card">
    <h2>Assignment and Grade Services</h2>
    <div className="lti-two-column">
      <div>
        <h3>Create or map a Blackboard grade column</h3>
        <select aria-label="EdNotebook grade item" value={lineItemId} onChange={(event) => setLineItemId(event.target.value)}>
          <option value="">Select published grade item</option>
          {course.gradeItems.filter((item) => item.publish_state === "published").map((item) => <option key={item.id} value={item.id}>{item.title} · {item.max_points}</option>)}
        </select>
        <button type="button" disabled={busy || !lineItemId} onClick={() => perform(() => runLtiAgs(token, { action: "create-line-item", gradeItemId: lineItemId, releaseMode: "manual" }), () => "Blackboard grade column created or reconciled.")}>Create Blackboard grade column</button>
      </div>
      <div>
        <h3>Release one finalized grade</h3>
        <select aria-label="Grade mapping" value={mappingId} onChange={(event) => setMappingId(event.target.value)}>
          <option value="">Select Blackboard grade column</option>
          {ags.mappings.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select aria-label="Finalized learner grade" value={gradeId} onChange={(event) => setGradeId(event.target.value)}>
          <option value="">Select finalized grade</option>
          {finalizedGrades.map((grade) => {
            const learner = course.learners.find((item) => item.id === grade.student_id);
            const item = course.gradeItems.find((entry) => entry.id === grade.grade_item_id);
            return <option key={grade.id} value={grade.id}>{learner?.full_name || "Learner"} · {item?.title || "Grade"} · {grade.score}</option>;
          })}
        </select>
        <button className="lti-primary" type="button" disabled={busy || !mappingId || !gradeId} onClick={() => perform(() => runLtiAgs(token, { action: "send-score", mappingId, studentGradeId: gradeId, confirmRelease: true }), () => "Finalized grade released to Blackboard.")}>Confirm and release grade</button>
      </div>
    </div>
    {ags.events.some((item) => item.status === "failed") && <div className="lti-retry-list">
      <h3>Failed releases</h3>
      {ags.events.filter((item) => item.status === "failed").map((item) => <button type="button" key={item.id} disabled={busy} onClick={() => perform(() => runLtiAgs(token, { action: "retry-score", eventId: item.id, confirmRelease: true }), () => "Grade release retried successfully.")}>Retry {new Date(item.requested_at).toLocaleString()} · {item.error_summary}</button>)}
    </div>}
  </section>;
}

export default function LtiLaunchWorkspace({ audience = "student" }) {
  const token = useMemo(() => launchTokenFromHash(), []);
  const [launch, setLaunch] = useState(null);
  const [course, setCourse] = useState(null);
  const [ags, setAgs] = useState({ mappings: [], events: [] });
  const [selection, setSelection] = useState({ targetType: "course", targetId: "", title: "", gradeItemId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const next = await readLtiSession(token);
      setLaunch(next);
      if (next.context?.courseId && next.person?.mappingStatus === "mapped" && audience === "instructor") {
        const workspace = await loadLtiCourseWorkspace(next.context.courseId);
        setCourse(workspace);
        setSelection((value) => ({ ...value, title: value.title || workspace.course?.title || "EdNotebook course", targetId: value.targetId || workspace.course?.id || "" }));
        if (next.services.ags) setAgs(await runLtiAgs(token, { action: "list" }));
      }
    } catch (loadError) { setError(loadError.message); }
  }

  useEffect(() => { if (token) load(); else setError("The Blackboard launch handle is missing."); }, [token]);

  async function act(action, success) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await action(); setNotice(success(result)); }
    catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  }

  async function linkAccount() {
    await act(() => linkLtiCurrentUser(token), () => "Your EdNotebook account is linked to this Blackboard identity.");
    await load();
  }

  async function deepLink() {
    setBusy(true); setError("");
    try {
      const response = await createDeepLinkResponse(token, [{ ...selection, targetId: selection.targetId || course.course.id, gradeItemId: selection.gradeItemId || null }]);
      submitDeepLinkForm(response);
    } catch (deepLinkError) { setError(deepLinkError.message); setBusy(false); }
  }

  if (!launch && !error) return <main className="lti-launch-loading">Opening the Blackboard course in EdNotebook…</main>;
  return <div className="lti-page">
    <header className="lti-topbar"><BrandLogo size={38} tagline={audience === "instructor" ? "Blackboard instructor launch" : "Blackboard learner launch"} /><span className="lti-status is-testing">Secure LTI session</span></header>
    <main className="lti-main lti-launch-main">
      {error && <div className="lti-alert is-error" role="alert">{error}</div>}
      {notice && <div className="lti-alert" role="status">{notice}</div>}
      {launch && <>
        <section className="lti-hero"><span>{audience === "instructor" ? "INSTRUCTOR WORKSPACE" : "LEARNER WORKSPACE"}</span><h1>{launch.context?.title || launch.resource?.title || "Blackboard course link"}</h1><p>{launch.institution.deploymentLabel} · role: {launch.launch.role.replaceAll("_", " ")}</p></section>
        {launch.context?.mappingStatus !== "mapped" && <section className="lti-card"><h2>This Blackboard course needs one owner mapping.</h2><p>An EdNotebook owner must connect Blackboard context <code>{launch.context?.label || launch.context?.id}</code> to the existing EdNotebook course. No duplicate course has been created.</p></section>}
        {launch.person.mappingStatus !== "mapped" && <section className="lti-card"><h2>Link your existing EdNotebook account</h2><p>EdNotebook does not merge people by name or email. Sign in to the correct EdNotebook account in this browser, return to this Blackboard launch, then confirm the signed identity.</p><button type="button" onClick={() => window.open(audience === "instructor" ? "#/professors" : "#/students", "_blank", "noopener,noreferrer")}>Open EdNotebook sign-in</button><button className="lti-primary" type="button" disabled={busy} onClick={linkAccount}>Link signed-in account</button></section>}
        {launch.context?.mappingStatus === "mapped" && launch.person.mappingStatus === "mapped" && audience === "student" && <section className="lti-card"><h2>Course link is ready.</h2>{launch.resource?.status === "active" && launch.resource.publicationId ? <button className="lti-primary" type="button" onClick={() => { window.location.hash = `#/student/course/${launch.resource.publicationId}`; }}>Continue to EdNotebook course</button> : launch.resource?.status === "active" && launch.resource.assignmentId ? <button className="lti-primary" type="button" onClick={() => { window.location.hash = "#/student/app"; }}>Open assigned course workspace</button> : launch.resource?.status === "active" && launch.context?.courseId ? <button className="lti-primary" type="button" onClick={() => { window.location.hash = "#/student/app"; }}>Open course workspace</button> : <p>The instructor has not published the linked EdNotebook course item yet.</p>}</section>}
        {launch.context?.mappingStatus === "mapped" && launch.person.mappingStatus === "mapped" && audience === "instructor" && course && <>
          {launch.services.deepLinking ? <DeepLinkPanel course={course} selection={selection} setSelection={setSelection} busy={busy} onSubmit={deepLink} /> : <section className="lti-card"><h2>Instructor course launch</h2><p>This resource link is connected. Use the EdNotebook educator dashboard to manage the course, or launch Blackboard Deep Linking to add another course item.</p><button type="button" onClick={() => { window.location.hash = "#/professor/dashboard"; }}>Open educator dashboard</button></section>}
          {launch.services.nrps && <section className="lti-card"><h2>Names and Roles roster sync</h2><p>Roster identities are reconciled by LTI subject and remain pending until explicitly linked; EdNotebook does not merge on names.</p><button type="button" disabled={busy} onClick={() => act(() => syncLtiRoster(token), (result) => `Roster synchronized: ${result.received} received, ${result.mapped} mapped, ${result.pending} pending.`)}>Sync Blackboard roster</button></section>}
          {launch.services.ags && <AgsPanel course={course} ags={ags} token={token} busy={busy} act={act} onReload={load} />}
        </>}
      </>}
    </main>
  </div>;
}
