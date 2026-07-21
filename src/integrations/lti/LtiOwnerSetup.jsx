import { useEffect, useState } from "react";
import BrandLogo from "../../Brand.jsx";
import { LTI_ADVANTAGE_SCOPES, LTI_STATUS_LABELS, ltiRegistrationReadiness, splitList } from "./ltiContract.js";
import {
  activateTestedLtiDeployment,
  ltiFunctionUrl,
  loadLtiOwnerSetup,
  mapLtiContext,
  saveLtiDeployment,
  saveLtiRegistration,
} from "./ltiService.js";
import "./lti.css";

const newRegistration = () => ({ institution_id: "", display_name: "Angelo State Blackboard", platform_product: "Blackboard Learn", issuer: "", client_id: "", oidc_authorization_url: "", jwks_url: "", oauth_token_url: "", oauth_audience: "", allowed_service_hosts: "", enabled_scopes: LTI_ADVANTAGE_SCOPES.map(([scope]) => scope), status: "setup", settings: { retain_roster_profile: true } });
const newDeployment = () => ({ registration_id: "", deployment_id: "", display_name: "Production deployment", status: "setup", auto_provision_users: false, allowed_target_link_urls: "" });

function RegistrationFields({ value, onChange, institutions }) {
  const field = (key) => ({ value: value[key] || "", onChange: (event) => onChange({ ...value, [key]: event.target.value }) });
  return <div className="lti-form-grid">
    <label>Institution<select required {...field("institution_id")}><option value="">Select institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Connection label<input required {...field("display_name")} /></label>
    <label>LMS product<input {...field("platform_product")} /></label>
    <label>Issuer URL<input required type="url" placeholder="https://blackboard.example.edu" {...field("issuer")} /></label>
    <label>Client ID<input required autoComplete="off" {...field("client_id")} /></label>
    <label>OIDC authorization URL<input required type="url" {...field("oidc_authorization_url")} /></label>
    <label>Platform JWKS URL<input required type="url" {...field("jwks_url")} /></label>
    <label>OAuth token URL<input required type="url" {...field("oauth_token_url")} /></label>
    <label>OAuth audience, if different<input type="url" {...field("oauth_audience")} /></label>
    <label className="lti-wide">Allowed LMS service hosts<textarea rows="3" placeholder="blackboard.example.edu" {...field("allowed_service_hosts")} /><small>Hostnames only, one per line. OAuth, NRPS, AGS, JWKS, and Deep Linking calls are restricted to this list.</small></label>
    <fieldset className="lti-wide"><legend>LTI Advantage scopes requested</legend>{LTI_ADVANTAGE_SCOPES.map(([scope, label]) => <label className="lti-check" key={scope}><input type="checkbox" checked={value.enabled_scopes.includes(scope)} onChange={(event) => onChange({ ...value, enabled_scopes: event.target.checked ? [...value.enabled_scopes, scope] : value.enabled_scopes.filter((item) => item !== scope) })} />{label}</label>)}</fieldset>
    <label>Status<select {...field("status")}><option value="setup">Setup</option><option value="testing">Testing</option><option value="active" disabled>Active · verified</option><option value="suspended">Suspended</option></select><small>Active is assigned only after real launch and passback tests. Choose testing or suspended before editing active configuration.</small></label>
    <label className="lti-check lti-retain"><input type="checkbox" checked={value.settings.retain_roster_profile !== false} onChange={(event) => onChange({ ...value, settings: { ...value.settings, retain_roster_profile: event.target.checked } })} />Store protected roster names and email for reconciliation</label>
  </div>;
}

export default function LtiOwnerSetup({ onBack }) {
  const [data, setData] = useState(null);
  const [registrationId, setRegistrationId] = useState(null);
  const [deploymentId, setDeploymentId] = useState(null);
  const [registration, setRegistration] = useState(newRegistration);
  const [deployment, setDeployment] = useState(newDeployment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const launchUrl = ltiFunctionUrl("lti-launch");

  async function load() {
    setError("");
    try { setData(await loadLtiOwnerSetup()); }
    catch (loadError) { setError(loadError.message); }
  }
  useEffect(() => { load(); }, []);

  async function run(action, message) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); await load(); return true; }
    catch (actionError) { setError(actionError.message); return false; }
    finally { setBusy(false); }
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const saved = await run(() => saveLtiRegistration(registrationId, { ...registration, allowed_service_hosts: splitList(registration.allowed_service_hosts), issuer: registration.issuer.trim() }), registrationId ? "Platform registration updated." : "Platform registration saved in setup mode.");
    if (saved) { setRegistrationId(null); setRegistration(newRegistration()); }
  }

  async function submitDeployment(event) {
    event.preventDefault();
    const saved = await run(() => saveLtiDeployment(deploymentId, { ...deployment, allowed_target_link_urls: splitList(deployment.allowed_target_link_urls || launchUrl) }), deploymentId ? "Deployment updated." : "Deployment saved. It remains non-active until testing is complete.");
    if (saved) { setDeploymentId(null); setDeployment(newDeployment()); }
  }

  function editRegistration(item) {
    setRegistrationId(item.id);
    setRegistration({ ...item, allowed_service_hosts: (item.allowed_service_hosts || []).join("\n"), enabled_scopes: item.enabled_scopes || [], settings: item.settings || { retain_roster_profile: true } });
    window.scrollTo({ top: 200, behavior: "smooth" });
  }

  function editDeployment(item) {
    setDeploymentId(item.id);
    setDeployment({ ...item, allowed_target_link_urls: (item.allowed_target_link_urls || []).join("\n") });
    window.scrollTo({ top: 200, behavior: "smooth" });
  }

  return <div className="lti-page">
    <header className="lti-topbar"><button type="button" className="lti-brand" onClick={onBack}><BrandLogo size={38} tagline="LTI administration" /></button><button type="button" onClick={load}>Refresh status</button></header>
    <main className="lti-main">
      <section className="lti-hero"><span>OWNER SETUP · LTI 1.3</span><h1>Blackboard and EdNotebook use one course, roster, and grade model.</h1><p>Register Blackboard once, bind each deployment to an institution, then map Blackboard course contexts to existing EdNotebook courses. Private keys and OAuth tokens never enter this screen.</p></section>
      {error && <div className="lti-alert is-error" role="alert">{error}</div>}
      {notice && <div className="lti-alert" role="status">{notice}</div>}
      <section className="lti-card"><h2>Tool addresses for Blackboard</h2><dl className="lti-addresses">
        <div><dt>Configuration JSON</dt><dd><code>{ltiFunctionUrl("lti-configuration") || "Deploy the Supabase Edge Functions first"}</code></dd></div>
        <div><dt>Login initiation URL</dt><dd><code>{ltiFunctionUrl("lti-oidc-login")}</code></dd></div>
        <div><dt>Launch / redirect URL</dt><dd><code>{launchUrl}</code></dd></div>
        <div><dt>Public JWKS URL</dt><dd><code>{ltiFunctionUrl("lti-jwks")}</code></dd></div>
      </dl></section>
      <section className="lti-two-column">
        <form className="lti-card" onSubmit={submitRegistration}><h2>1. {registrationId ? "Edit" : "Add"} platform registration</h2><RegistrationFields value={registration} onChange={setRegistration} institutions={data?.institutions || []} /><button className="lti-primary" disabled={busy}>{registrationId ? "Update" : "Save"} registration</button>{registrationId && <button type="button" onClick={() => { setRegistrationId(null); setRegistration(newRegistration()); }}>Cancel edit</button>}</form>
        <form className="lti-card" onSubmit={submitDeployment}><h2>2. {deploymentId ? "Edit" : "Add"} deployment</h2><div className="lti-form-grid">
          <label>Platform registration<select required value={deployment.registration_id} onChange={(event) => setDeployment({ ...deployment, registration_id: event.target.value })}><option value="">Select registration</option>{(data?.registrations || []).map((item) => <option value={item.id} key={item.id}>{item.display_name}</option>)}</select></label>
          <label>Blackboard deployment ID<input required value={deployment.deployment_id} onChange={(event) => setDeployment({ ...deployment, deployment_id: event.target.value })} /></label>
          <label>Deployment label<input required value={deployment.display_name} onChange={(event) => setDeployment({ ...deployment, display_name: event.target.value })} /></label>
          <label>Status<select value={deployment.status} onChange={(event) => setDeployment({ ...deployment, status: event.target.value })}><option value="setup">Setup</option><option value="testing">Testing</option><option value="active" disabled>Active · verified</option><option value="suspended">Suspended</option></select></label>
          <label className="lti-wide">Allowed target-link URLs<textarea rows="3" value={deployment.allowed_target_link_urls || launchUrl} onChange={(event) => setDeployment({ ...deployment, allowed_target_link_urls: event.target.value })} /></label>
          <label className="lti-check lti-wide"><input type="checkbox" checked={deployment.auto_provision_users} onChange={(event) => setDeployment({ ...deployment, auto_provision_users: event.target.checked })} />Allow institution-managed account provisioning (off by default)</label>
        </div><button className="lti-primary" disabled={busy}>{deploymentId ? "Update" : "Save"} deployment</button>{deploymentId && <button type="button" onClick={() => { setDeploymentId(null); setDeployment(newDeployment()); }}>Cancel edit</button>}</form>
      </section>
      <section className="lti-card"><h2>3. Connection readiness</h2>{!data?.registrations?.length ? <p>No platform registrations yet.</p> : <div className="lti-readiness-grid">{data.registrations.map((item) => {
        const readiness = ltiRegistrationReadiness(item, data.deployments, data.contexts, data.grade_sync);
        const linked = data.deployments.filter((entry) => entry.registration_id === item.id);
        return <article key={item.id}><header><div><strong>{item.display_name}</strong><small>{item.platform_product} · {item.client_id}</small></div><span className={`lti-status is-${item.status}`}>{LTI_STATUS_LABELS[item.status]}</span></header><ul>{readiness.checks.map(([label, passed]) => <li className={passed ? "is-pass" : ""} key={label}>{passed ? "Passed" : "Needed"}: {label}</li>)}</ul>{!readiness.ready && <p>EdNotebook will not call this connection active yet.</p>}<button type="button" onClick={() => editRegistration(item)}>Edit registration</button>{linked.map((entry) => <div className="lti-deployment-row" key={entry.id}><span><strong>{entry.display_name}</strong><small>{entry.deployment_id} · {entry.status}</small></span><button type="button" onClick={() => editDeployment(entry)}>Edit</button>{entry.status === "testing" && <button type="button" disabled={busy} onClick={() => run(() => activateTestedLtiDeployment(entry.id), "Live test evidence passed; deployment activated.")}>Verify evidence and activate</button>}</div>)}</article>;
      })}</div>}</section>
      <section className="lti-card"><h2>4. Blackboard course contexts</h2><p>A context discovered by a signed Blackboard launch must be deliberately mapped to an existing course in the same institution.</p>{!data?.contexts?.length ? <p>No Blackboard course launches have been received.</p> : <div className="lti-context-list">{data.contexts.map((context) => <article key={context.id}><div><strong>{context.lti_context_title || context.lti_context_label || "Blackboard course"}</strong><small>Context ID: {context.lti_context_id}</small></div><select aria-label={`Map ${context.lti_context_title || "context"} to EdNotebook course`} value={context.ednotebook_course_id || ""} disabled={busy} onChange={(event) => run(() => mapLtiContext(context.id, event.target.value), "Blackboard context mapped to the existing EdNotebook course.")}><option value="">Not mapped</option>{(data.courses || []).filter((course) => course.institution_id === context.institution_id).map((course) => <option value={course.id} key={course.id}>{course.course_code || "COURSE"} · {course.title}</option>)}</select><span className={`lti-status is-${context.mapping_status}`}>{context.mapping_status}</span></article>)}</div>}</section>
      <section className="lti-card"><h2>Data alignment</h2><div className="lti-data-grid"><article><strong>Institution</strong><span>Institution code, SIS sourced ID, LMS provider, academic domain, timezone</span></article><article><strong>Course and section</strong><span>Course code, section code, term, academic-session ID, LTI context ID, OneRoster sourced ID</span></article><article><strong>People and enrollment</strong><span>LTI subject, LMS/SIS IDs, canonical role, enrollment status, explicit EdNotebook match</span></article><article><strong>Grades</strong><span>Grade-item ID, LTI line-item URL, maximum points, activity/grading progress, release and retry evidence</span></article></div></section>
    </main>
  </div>;
}
