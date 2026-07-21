import { useEffect, useId, useState } from "react";
import * as adminService from "./adminControlService.js";
import InstitutionPicker from "./InstitutionPicker.jsx";
import "./admin-control-center.css";

const EMPTY_APPLICATION = Object.freeze({
  directory_key: "",
  legal_name: "",
  display_name: "",
  parent_system_name: "",
  institution_type: "university",
  website_url: "",
  academic_domain: "",
  country_code: "US",
  region_code: "TX",
  city: "",
  primary_lms: "Blackboard Learn",
  student_information_system: "",
  expected_accounts: "",
  requested_pathways: ["student", "professor", "publisher"],
  administrator_name: "",
  administrator_title: "",
  administrator_email: "",
  administrator_phone: "",
  security_contact_email: "",
  privacy_contact_email: "",
  accessibility_contact_email: "",
  intended_use: "",
  attested_authority: false,
  attested_terms: false,
});

function friendlyError(error, fallback) {
  const message = String(error?.message || fallback || "The request could not be completed.");
  if (/invalid login credentials/iu.test(message)) return "The email or password did not match an account. Check both fields and try again.";
  if (/email not confirmed/iu.test(message)) return "Confirm the email address for this account before signing in.";
  return message;
}

async function getSession() {
  if (typeof adminService.getAdminSession === "function") return adminService.getAdminSession();
  if (typeof adminService.getCurrentSession === "function") return adminService.getCurrentSession();
  return null;
}

export default function InstitutionAccessPage({ onAuthorized, onBack, initialMode = "sign-in" }) {
  const headingId = useId();
  const [mode, setMode] = useState(initialMode);
  const [session, setSession] = useState(null);
  const [institutionChoice, setInstitutionChoice] = useState(null);
  const [credentials, setCredentials] = useState({ email: "", password: "", fullName: "" });
  const [application, setApplication] = useState({ ...EMPTY_APPLICATION });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    getSession()
      .then((nextSession) => {
        if (!current) return;
        const normalized = nextSession?.session || nextSession || null;
        setSession(normalized);
        if (normalized?.user?.email) {
          setApplication((previous) => ({ ...previous, administrator_email: previous.administrator_email || normalized.user.email }));
        }
      })
      .catch(() => {});
    return () => { current = false; };
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  function updateCredential(event) {
    const { name, value } = event.target;
    setCredentials((previous) => ({ ...previous, [name]: value }));
  }

  function updateApplication(event) {
    const { name, type, checked, value } = event.target;
    setApplication((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  }

  function togglePathway(pathway) {
    setApplication((previous) => ({
      ...previous,
      requested_pathways: previous.requested_pathways.includes(pathway)
        ? previous.requested_pathways.filter((item) => item !== pathway)
        : [...previous.requested_pathways, pathway],
    }));
  }

  function selectInstitution(choice) {
    setInstitutionChoice(choice);
    if (choice?.choice === "institution") {
      const entry = choice.entry || {};
      setApplication((previous) => ({
        ...previous,
        directory_key: choice.directoryKey || "",
        legal_name: previous.legal_name || choice.name || "",
        display_name: previous.display_name || choice.name || "",
        parent_system_name: previous.parent_system_name || choice.systemName || "",
        website_url: previous.website_url || entry.website_url || "",
        academic_domain: previous.academic_domain || entry.academic_domain || "",
        country_code: entry.country_code || previous.country_code,
        region_code: entry.region_code || previous.region_code,
        city: entry.city || previous.city,
      }));
    } else if (choice?.choice === "other") {
      setApplication((previous) => ({
        ...previous,
        directory_key: "",
        legal_name: choice.name || previous.legal_name,
        display_name: choice.name || previous.display_name,
      }));
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminService.signInInstitutionAdmin(credentials.email, credentials.password);
      const nextSession = result?.session || result || await getSession();
      setSession(nextSession);
      setMessage("Signed in. Opening the approved administration workspace…");
      onAuthorized?.(nextSession);
    } catch (nextError) {
      setError(friendlyError(nextError, "Sign-in could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminService.signUpInstitutionApplicant({
        email: credentials.email,
        password: credentials.password,
        fullName: credentials.fullName,
      });
      const nextSession = result?.session || null;
      setSession(nextSession);
      setApplication((previous) => ({ ...previous, administrator_email: previous.administrator_email || credentials.email }));
      setMessage(nextSession
        ? "Account created. Complete the institution access application below."
        : "Account created. Check your email to confirm it, then sign in and complete the institution access application.");
      setMode(nextSession ? "apply" : "sign-in");
    } catch (nextError) {
      setError(friendlyError(nextError, "The account could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function handleApplication(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!session?.user) {
      setError("Sign in with the account that will manage this request before submitting the application.");
      setMode("sign-in");
      return;
    }
    if (!application.requested_pathways.length) {
      setError("Choose at least one requested pathway.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...application,
        directory_key: institutionChoice?.choice === "institution" ? institutionChoice.directoryKey : null,
        legal_name: application.legal_name || institutionChoice?.name || "",
        display_name: application.display_name || institutionChoice?.name || application.legal_name,
        expected_accounts: application.expected_accounts === "" ? null : Number(application.expected_accounts),
      };
      const result = await adminService.submitInstitutionApplication(payload);
      setMessage(`Application submitted${result?.application_number ? ` as ${result.application_number}` : ""}. Access remains pending until a platform owner reviews and approves the institution and its administrator.`);
    } catch (nextError) {
      setError(friendlyError(nextError, "The application could not be submitted."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await adminService.signOutAdmin();
      setSession(null);
      setMessage("Signed out.");
      setMode("sign-in");
    } catch (nextError) {
      setError(friendlyError(nextError, "Sign-out could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ac-access-page" aria-labelledby={headingId}>
      <section className="ac-access-shell">
        <header className="ac-access-header">
          <div>
            <p className="ac-eyebrow">EdNotebook institution access</p>
            <h1 id={headingId}>Institution administration</h1>
            <p>Sign in to an approved school workspace, or request a reviewed institutional environment.</p>
          </div>
          {onBack ? <button type="button" className="ac-button ac-button--quiet" onClick={onBack}>Back</button> : null}
        </header>

        <div className="ac-callout ac-callout--privacy">
          <strong>Institution boundaries protect records.</strong>
          <span> Administrators see only institutions they are authorized to manage. Selecting a school, creating an account, or submitting an application never grants access by itself.</span>
        </div>

        <nav className="ac-segmented" aria-label="Institution access options">
          <button type="button" aria-current={mode === "sign-in" ? "page" : undefined} onClick={() => switchMode("sign-in")}>Sign in</button>
          <button type="button" aria-current={mode === "create" ? "page" : undefined} onClick={() => switchMode("create")}>Create account</button>
          <button type="button" aria-current={mode === "apply" ? "page" : undefined} onClick={() => switchMode("apply")}>Institution application</button>
        </nav>

        {error ? <div className="ac-alert ac-alert--error" role="alert">{error}</div> : null}
        {message ? <div className="ac-alert ac-alert--success" role="status">{message}</div> : null}

        {mode === "sign-in" ? (
          <form className="ac-form-card" onSubmit={handleSignIn}>
            <div className="ac-form-heading">
              <h2>Institution administrator sign in</h2>
              <p>Use an approved EdNotebook account. You will choose from only the workspaces assigned to you after sign-in.</p>
            </div>
            <label className="ac-field">Work email
              <input type="email" name="email" value={credentials.email} onChange={updateCredential} autoComplete="username" required />
            </label>
            <label className="ac-field">Password
              <input type="password" name="password" value={credentials.password} onChange={updateCredential} autoComplete="current-password" minLength={8} required />
            </label>
            <div className="ac-form-actions">
              <button className="ac-button ac-button--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
              <button type="button" className="ac-button ac-button--quiet" onClick={() => switchMode("create")}>Create an administrator account</button>
            </div>
          </form>
        ) : null}

        {mode === "create" ? (
          <form className="ac-form-card" onSubmit={handleCreateAccount}>
            <div className="ac-form-heading">
              <h2>Create an institution applicant account</h2>
              <p>This creates a sign-in only. It does not create a school environment or grant access to student, course, grade, or integration records.</p>
            </div>
            <label className="ac-field">Full name
              <input name="fullName" value={credentials.fullName} onChange={updateCredential} autoComplete="name" required />
            </label>
            <label className="ac-field">Institution work email
              <input type="email" name="email" value={credentials.email} onChange={updateCredential} autoComplete="email" required />
            </label>
            <label className="ac-field">Password
              <input type="password" name="password" value={credentials.password} onChange={updateCredential} autoComplete="new-password" minLength={8} required />
            </label>
            <div className="ac-callout ac-callout--warning">After email confirmation, submit the institution application. A platform owner must approve it before institutional controls become available.</div>
            <button className="ac-button ac-button--primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
          </form>
        ) : null}

        {mode === "apply" ? (
          <form className="ac-form-card ac-application-form" onSubmit={handleApplication}>
            <div className="ac-form-heading">
              <h2>Institution access application</h2>
              <p>Provide information the platform owner can verify. Do not enter passwords, private keys, student records, or integration secrets.</p>
              {session?.user?.email ? (
                <p className="ac-signed-in">Signed in as <strong>{session.user.email}</strong>. <button type="button" className="ac-text-button" onClick={handleSignOut} disabled={busy}>Sign out</button></p>
              ) : <p className="ac-callout ac-callout--warning">You must sign in before this application can be submitted.</p>}
            </div>

            <fieldset>
              <legend>Institution identity</legend>
              <InstitutionPicker value={institutionChoice} onChange={selectInstitution} allowIndependent={false} required />
              <div className="ac-form-grid">
                <label className="ac-field">Legal institution name *
                  <input name="legal_name" value={application.legal_name} onChange={updateApplication} autoComplete="organization" required />
                </label>
                <label className="ac-field">Display name *
                  <input name="display_name" value={application.display_name} onChange={updateApplication} required />
                </label>
                <label className="ac-field">Parent system, if any
                  <input name="parent_system_name" value={application.parent_system_name} onChange={updateApplication} placeholder="Example: Texas Tech University System" />
                </label>
                <label className="ac-field">Institution type
                  <select name="institution_type" value={application.institution_type} onChange={updateApplication}>
                    <option value="university">University (public or private)</option>
                    <option value="college">College</option>
                    <option value="community_college">Community college</option>
                    <option value="school_district">School district</option>
                    <option value="school">School</option>
                    <option value="system">Institution system</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="ac-field">Official website *
                  <input type="url" name="website_url" value={application.website_url} onChange={updateApplication} placeholder="https://www.example.edu" required />
                </label>
                <label className="ac-field">Academic email domain *
                  <input name="academic_domain" value={application.academic_domain} onChange={updateApplication} placeholder="example.edu" required />
                </label>
                <label className="ac-field">City
                  <input name="city" value={application.city} onChange={updateApplication} autoComplete="address-level2" />
                </label>
                <label className="ac-field">State or region
                  <input name="region_code" value={application.region_code} onChange={updateApplication} autoComplete="address-level1" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Technology and expected use</legend>
              <div className="ac-form-grid">
                <label className="ac-field">Primary learning management system
                  <select name="primary_lms" value={application.primary_lms} onChange={updateApplication}>
                    <option>Blackboard Learn</option>
                    <option>Canvas</option>
                    <option>D2L Brightspace</option>
                    <option>Moodle</option>
                    <option>Schoology</option>
                    <option>None / not selected</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="ac-field">Student information system
                  <input name="student_information_system" value={application.student_information_system} onChange={updateApplication} placeholder="Optional; do not enter credentials" />
                </label>
                <label className="ac-field">Expected number of accounts
                  <input type="number" min="0" step="1" name="expected_accounts" value={application.expected_accounts} onChange={updateApplication} />
                </label>
              </div>
              <div className="ac-field">
                <span>Requested pathways *</span>
                <div className="ac-check-grid">
                  {["student", "professor", "publisher"].map((pathway) => (
                    <label key={pathway} className="ac-check">
                      <input type="checkbox" checked={application.requested_pathways.includes(pathway)} onChange={() => togglePathway(pathway)} />
                      <span>{pathway[0].toUpperCase() + pathway.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="ac-field">Intended pilot or production use *
                <textarea name="intended_use" value={application.intended_use} onChange={updateApplication} rows="4" required placeholder="Describe the planned courses, users, testing, records, and desired integration." />
              </label>
            </fieldset>

            <fieldset>
              <legend>Authorized contacts</legend>
              <div className="ac-form-grid">
                <label className="ac-field">Administrator name *
                  <input name="administrator_name" value={application.administrator_name} onChange={updateApplication} autoComplete="name" required />
                </label>
                <label className="ac-field">Administrator title *
                  <input name="administrator_title" value={application.administrator_title} onChange={updateApplication} autoComplete="organization-title" required />
                </label>
                <label className="ac-field">Administrator work email *
                  <input type="email" name="administrator_email" value={application.administrator_email} onChange={updateApplication} required />
                </label>
                <label className="ac-field">Administrator phone
                  <input type="tel" name="administrator_phone" value={application.administrator_phone} onChange={updateApplication} autoComplete="tel" />
                </label>
                <label className="ac-field">Security contact email *
                  <input type="email" name="security_contact_email" value={application.security_contact_email} onChange={updateApplication} required />
                </label>
                <label className="ac-field">Privacy contact email *
                  <input type="email" name="privacy_contact_email" value={application.privacy_contact_email} onChange={updateApplication} required />
                </label>
                <label className="ac-field">Accessibility contact email *
                  <input type="email" name="accessibility_contact_email" value={application.accessibility_contact_email} onChange={updateApplication} required />
                </label>
              </div>
            </fieldset>

            <div className="ac-attestations">
              <label className="ac-check">
                <input type="checkbox" name="attested_authority" checked={application.attested_authority} onChange={updateApplication} required />
                <span>I am authorized to request an EdNotebook institutional review for this organization.</span>
              </label>
              <label className="ac-check">
                <input type="checkbox" name="attested_terms" checked={application.attested_terms} onChange={updateApplication} required />
                <span>I understand that approval, team invitation, connection setup, testing, and activation are separate reviewed steps.</span>
              </label>
            </div>

            <div className="ac-callout ac-callout--privacy"><strong>Approval result:</strong> an approved institution receives its own bounded workspace. Its administrators cannot see another institution's accounts, courses, grades, connections, or change history.</div>
            <button className="ac-button ac-button--primary" disabled={busy || !session?.user}>{busy ? "Submitting…" : "Submit for platform-owner review"}</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
