import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import InstitutionPicker from "./admin-control/InstitutionPicker.jsx";
import { requestInstitutionTransfer } from "./admin-control/adminControlService.js";
import { useFeatureManifest } from "./admin-control/FeatureBoundary.jsx";
import "./account-settings.css";

const PROVIDER_MODELS = {
  builtin: ["EdNotebook workspace"],
  openai: ["GPT-5", "GPT-4.1"],
  anthropic: ["Claude Sonnet", "Claude Opus"],
};

const SETTING_SECTIONS = [
  ["profile", "Profile"],
  ["assistant", "Assistant & plugins"],
  ["controls", "Visibility & controls"],
  ["institution", "Institution"],
  ["account", "Account"],
];

function accountSettingsKey(scope) {
  return `ednotebook-account-settings-${scope}`;
}

function connectorTokenKey(scope) {
  return `ednotebook-connector-token-${scope}`;
}

function defaultAccountSettings({ accountType = "student", name = "", email = "", bio = "" } = {}) {
  return {
    displayName: name,
    email,
    bio,
    links: "",
    profileVisibility: "private",
    discoverable: false,
    showDescriptions: true,
    showPresence: true,
    allowComments: true,
    allowFollowerPosts: false,
    allowWelcomePosts: true,
    productUpdates: false,
    assistantProvider: "builtin",
    assistantModel: "EdNotebook workspace",
    gatewayUrl: "",
    plugins: { calendar: true, documents: true, sources: true, conversations: true },
    plan: "free",
    mediaUploadsPerWeek: 2,
    accountType,
    accountStatus: "active",
    deletionStatus: "none",
    versions: [],
  };
}

function readAccountSettings(scope, seed = {}) {
  const defaults = defaultAccountSettings(seed);
  try {
    const stored = JSON.parse(window.localStorage.getItem(accountSettingsKey(scope)) || "null");
    if (!stored) return defaults;
    const merged = {
      ...defaults,
      ...stored,
      plugins: { ...defaults.plugins, ...(stored.plugins || {}) },
      versions: Array.isArray(stored.versions) ? stored.versions : [],
    };
    if (["connections", "school"].includes(merged.profileVisibility)) merged.profileVisibility = "class";
    return merged;
  } catch {
    return defaults;
  }
}

function saveAccountSettings(scope, settings, label = "Settings saved") {
  const savedAt = new Date().toISOString();
  const version = { id: `${Date.now()}`, savedAt, label };
  const next = { ...settings, savedAt, versions: [version, ...(settings.versions || [])].slice(0, 20) };
  window.localStorage.setItem(accountSettingsKey(scope), JSON.stringify(next));
  return next;
}

function readConnectorToken(scope) {
  try { return window.sessionStorage.getItem(connectorTokenKey(scope)) || ""; } catch { return ""; }
}

function storeConnectorToken(scope, token) {
  try {
    if (!token) window.sessionStorage.removeItem(connectorTokenKey(scope));
    else window.sessionStorage.setItem(connectorTokenKey(scope), token);
  } catch {
    // The built-in assistant remains available when session storage is blocked.
  }
}

function clearScopedDeviceData(scope) {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && scope && key.includes(scope)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  }
}

function FieldSwitch({ checked, label, detail, onChange }) {
  return (
    <label className="account-setting-switch">
      <span><strong>{label}</strong>{detail && <small>{detail}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function LiveDateTime({ className = "" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <time className={`live-date-time ${className}`} dateTime={now.toISOString()}><strong>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now)}</strong><span>{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now)}</span></time>;
}

export default function AccountSettings({
  scope,
  accountType = "student",
  settings,
  onSettingsChange,
  authenticated = false,
  accountEmail = "",
  compact = false,
}) {
  const [section, setSection] = useState("profile");
  const [draft, setDraft] = useState(settings);
  const [connectorToken, setConnectorToken] = useState(() => readConnectorToken(scope));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [institutionState, setInstitutionState] = useState({ loading: false, affiliation: null, transfer: null, name: "" });
  const [transferChoice, setTransferChoice] = useState(null);
  const [transferReason, setTransferReason] = useState("");
  const [transferEffectiveOn, setTransferEffectiveOn] = useState("");
  const featureControls = useFeatureManifest();
  const models = useMemo(() => PROVIDER_MODELS[draft.assistantProvider] || PROVIDER_MODELS.builtin, [draft.assistantProvider]);
  const pathway = accountType === "professor" ? "professor" : "student";
  const transferFeatureKey = accountType === "professor" ? "shared.institution_affiliation" : "student.institution_transfer";
  const transferEnabled = featureControls ? featureControls.isEnabled(transferFeatureKey) : true;

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => { setConnectorToken(readConnectorToken(scope)); }, [scope]);
  useEffect(() => {
    if (models.includes(draft.assistantModel)) return;
    setDraft((current) => ({ ...current, assistantModel: models[0] }));
  }, [draft.assistantModel, models]);

  async function loadInstitutionState() {
    if (!authenticated || !isSupabaseConfigured || !supabase) {
      setInstitutionState({ loading: false, affiliation: null, transfer: null, name: "" });
      return;
    }
    setInstitutionState((current) => ({ ...current, loading: true }));
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error("Sign in again to review institution access.");
      const [{ data: affiliation, error: affiliationError }, { data: transfer, error: transferError }] = await Promise.all([
        supabase
          .from("institution_affiliations")
          .select("id,pathway,institution_id,directory_key,relationship,status,started_at,updated_at")
          .eq("user_id", userId)
          .eq("pathway", pathway)
          .eq("is_primary", true)
          .in("status", ["active", "independent", "transfer_pending", "pending"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("institution_transfer_requests")
          .select("id,pathway,to_directory_key,to_institution_id,requested_institution_name,reason,effective_on,status,created_at,reviewed_at,review_notes")
          .eq("user_id", userId)
          .eq("pathway", pathway)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (affiliationError) throw affiliationError;
      if (transferError) throw transferError;

      let name = affiliation?.status === "independent" ? "Independent / no institution" : "";
      if (affiliation?.directory_key) {
        const { data: directory } = await supabase
          .from("institution_directory_entries")
          .select("canonical_name")
          .eq("directory_key", affiliation.directory_key)
          .maybeSingle();
        name = directory?.canonical_name || affiliation.directory_key;
      } else if (affiliation?.institution_id) {
        const { data: institution } = await supabase
          .from("institutions")
          .select("name")
          .eq("id", affiliation.institution_id)
          .maybeSingle();
        name = institution?.name || "Approved institution";
      }
      setInstitutionState({ loading: false, affiliation: affiliation || null, transfer: transfer || null, name });
    } catch (institutionError) {
      setInstitutionState({ loading: false, affiliation: null, transfer: null, name: "" });
      setNotice(institutionError?.message || "Institution access could not be loaded.");
    }
  }

  useEffect(() => {
    if (section === "institution") loadInstitutionState();
  }, [section, authenticated, pathway]);

  function patchValue(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function patchPlugin(field, value) {
    setDraft((current) => ({ ...current, plugins: { ...current.plugins, [field]: value } }));
  }

  function persist(label = "Settings saved") {
    storeConnectorToken(scope, connectorToken.trim());
    const next = saveAccountSettings(scope, draft, label);
    setDraft(next);
    onSettingsChange?.(next);
    setNotice(`${label}. Version ${next.versions.length} is in the save history.`);
  }

  async function sendPasswordReset() {
    if (!authenticated || !isSupabaseConfigured || !supabase) {
      setNotice("Sign in to a connected account before sending a password reset email.");
      return;
    }
    const resetEmail = authenticated ? accountEmail.trim() : draft.email.trim();
    if (!resetEmail) {
      setNotice("The signed-in account email is not available yet.");
      return;
    }
    setBusy(true);
    const redirectTo = `${window.location.origin}${window.location.pathname}#/account/update-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo });
    setBusy(false);
    setNotice(error ? error.message : "Password reset email sent. Open it to choose a new password.");
  }

  function requestDeletion() {
    const nextDraft = { ...draft, deletionStatus: draft.deletionStatus === "requested" ? "none" : "requested" };
    const next = saveAccountSettings(scope, nextDraft, nextDraft.deletionStatus === "requested" ? "Account deletion requested" : "Account deletion request canceled");
    setDraft(next);
    onSettingsChange?.(next);
    setNotice(next.deletionStatus === "requested" ? "Deletion request marked pending. A production account service must complete the request." : "Deletion request canceled.");
  }

  function resetDeviceCopy() {
    const seed = defaultAccountSettings({ accountType, name: settings.displayName, email: settings.email, bio: settings.bio });
    clearScopedDeviceData(scope);
    const next = saveAccountSettings(scope, seed, "Device workspace reset");
    setConnectorToken("");
    setDraft(next);
    onSettingsChange?.(next);
    setNotice("This device copy was reset. Signed-in cloud records were not changed.");
  }

  async function submitTransferRequest(event) {
    event.preventDefault();
    if (!transferChoice) {
      setNotice("Choose the institution you want reviewed as the transfer destination.");
      return;
    }
    if (transferReason.trim().length < 5) {
      setNotice("Explain the transfer request in at least 5 characters.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await requestInstitutionTransfer({
        pathway,
        institutionChoice: transferChoice,
        reason: transferReason,
        effectiveOn: transferEffectiveOn || null,
      });
      setTransferChoice(null);
      setTransferReason("");
      setTransferEffectiveOn("");
      setNotice("Institution transfer request submitted. Your current environment is preserved while an authorized administrator reviews the destination and access effect.");
      await loadInstitutionState();
    } catch (transferError) {
      setNotice(transferError?.message || "The institution transfer request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`account-settings-shell ${compact ? "is-compact" : ""}`} aria-labelledby={`account-settings-${scope}`}>
      <header className="account-settings-heading">
        <div><span>ACCOUNT SETTINGS</span><h1 id={`account-settings-${scope}`}>{accountType === "professor" ? "Educator settings" : "Student settings"}</h1><p>Profile, assistant connections, visibility, and account controls live together.</p></div>
        <div className="account-settings-heading-tools"><LiveDateTime /><div className="account-plan-chip"><strong>Free</strong><span>Paid services coming soon</span></div></div>
      </header>
      <nav className="account-settings-tabs" aria-label="Settings sections">
        {SETTING_SECTIONS.map(([id, label]) => <button key={id} type="button" className={section === id ? "is-active" : ""} onClick={() => setSection(id)}>{label}</button>)}
      </nav>

      {section === "profile" && <div className="account-settings-grid">
        <article className="account-settings-card">
          <h2>Profile details</h2>
          <label>Display name<input value={draft.displayName} onChange={(event) => patchValue("displayName", event.target.value)} /></label>
          <label>Account email<input type="email" value={authenticated ? accountEmail || draft.email : draft.email} readOnly={authenticated} onChange={(event) => patchValue("email", event.target.value)} />{authenticated && <small>Email changes need a verified account update and are not made by editing this field.</small>}</label>
          <label>Bio or description<textarea rows={5} value={draft.bio} onChange={(event) => patchValue("bio", event.target.value)} /></label>
          <label>Links<textarea rows={3} value={draft.links} onChange={(event) => patchValue("links", event.target.value)} placeholder="One website, portfolio, YouTube, or social link per line" /></label>
        </article>
        <article className="account-settings-card">
          <h2>Profile appearance</h2>
          <label>Who can open the full page<select value={draft.profileVisibility} onChange={(event) => patchValue("profileVisibility", event.target.value)}><option value="private">Only me</option><option value="class">Connections or classmates</option><option value="public">Public</option></select></label>
          <FieldSwitch checked={draft.discoverable} onChange={(value) => patchValue("discoverable", value)} label="Appear in people search" detail="Turn this off to keep the profile hidden from search." />
          <FieldSwitch checked={draft.showDescriptions} onChange={(value) => patchValue("showDescriptions", value)} label="Show card descriptions" detail="This changes the amount of helper text in your dashboard." />
          <button type="button" className="account-settings-save" onClick={() => persist("Profile settings saved")}>Save profile settings</button>
        </article>
      </div>}

      {section === "assistant" && <div className="account-settings-grid">
        <article className="account-settings-card">
          <h2>Assistant model</h2>
          <label>Provider<select value={draft.assistantProvider} onChange={(event) => patchValue("assistantProvider", event.target.value)}><option value="builtin">EdNotebook built-in demo</option><option value="openai">OpenAI / ChatGPT API</option><option value="anthropic">Anthropic / Claude API</option></select></label>
          <label>Model<select value={draft.assistantModel} onChange={(event) => patchValue("assistantModel", event.target.value)}>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
          {draft.assistantProvider !== "builtin" && <>
            <label>Secure gateway URL<input type="url" value={draft.gatewayUrl} onChange={(event) => patchValue("gatewayUrl", event.target.value)} placeholder="https://your-server.example/api/assistant" /></label>
            <label>Gateway access token<input type="password" value={connectorToken} onChange={(event) => setConnectorToken(event.target.value)} autoComplete="off" placeholder="Kept only in this browser tab" /><small>Keep provider keys on your server. This temporary gateway token is never written to saved settings or the public site bundle.</small></label>
          </>}
          <div className={`connector-status ${draft.assistantProvider === "builtin" || (draft.gatewayUrl && connectorToken) ? "is-ready" : ""}`}><strong>{draft.assistantProvider === "builtin" ? "Built-in workspace search is ready" : draft.gatewayUrl && connectorToken ? "Connection details are ready for this tab" : "Add a gateway URL and temporary token"}</strong><span>{draft.assistantProvider === "builtin" ? "No external key is needed." : "External requests go only to the gateway you provide."}</span></div>
        </article>
        <article className="account-settings-card">
          <h2>Workspace plugins</h2>
          <FieldSwitch checked={draft.plugins.calendar} onChange={(value) => patchPlugin("calendar", value)} label="Assignments and calendar" />
          <FieldSwitch checked={draft.plugins.documents} onChange={(value) => patchPlugin("documents", value)} label="Documents and syllabi" />
          <FieldSwitch checked={draft.plugins.sources} onChange={(value) => patchPlugin("sources", value)} label="Saved sources" />
          <FieldSwitch checked={draft.plugins.conversations} onChange={(value) => patchPlugin("conversations", value)} label="Past conversations" />
          <button type="button" className="account-settings-save" onClick={() => persist("Assistant and plugin settings saved")}>Save assistant settings</button>
        </article>
      </div>}

      {section === "controls" && <div className="account-settings-grid">
        <article className="account-settings-card">
          <h2>Social controls</h2>
          <FieldSwitch checked={draft.showPresence} onChange={(value) => patchValue("showPresence", value)} label="Show online status" />
          <FieldSwitch checked={draft.allowComments} onChange={(value) => patchValue("allowComments", value)} label="Allow comments on my posts" />
          <FieldSwitch checked={draft.allowFollowerPosts} onChange={(value) => patchValue("allowFollowerPosts", value)} label="Allow connections to post on my page" />
          <FieldSwitch checked={draft.allowWelcomePosts} onChange={(value) => patchValue("allowWelcomePosts", value)} label="Allow a welcome post from my guide" />
        </article>
        <article className="account-settings-card">
          <h2>Updates and uploads</h2>
          <FieldSwitch checked={draft.productUpdates} onChange={(value) => patchValue("productUpdates", value)} label="Product update emails" detail="Optional feature news and testing invitations." />
          <div className="storage-plan-card"><span>Free media allowance</span><strong>{draft.mediaUploadsPerWeek} picture or video uploads each week</strong><p>Text posts stay available. Unlimited media storage is a future paid option.</p></div>
          <button type="button" className="account-settings-save" onClick={() => persist("Visibility and social controls saved")}>Save controls</button>
        </article>
      </div>}

      {section === "institution" && <div className="account-settings-grid">
        <article className="account-settings-card account-action-stack">
          <h2>Current institution relationship</h2>
          {institutionState.loading ? <p>Loading institution access…</p> : institutionState.affiliation ? <>
            <div><span>Institution</span><strong>{institutionState.name || "Pending institution match"}</strong></div>
            <div><span>Relationship status</span><strong>{institutionState.affiliation.status.replaceAll("_", " ")}</strong></div>
            <div><span>Pathway</span><strong>{pathway}</strong></div>
          </> : <p>No primary institution relationship is available yet. New institutional course access requires a reviewed school match.</p>}
          <small>Institution choice is an access boundary. It cannot be changed by editing a profile label, and selecting a school never grants access by itself.</small>
        </article>
        <article className="account-settings-card">
          <h2>Request an institution transfer</h2>
          {!authenticated ? <p>Sign in before requesting an institution change.</p> : !transferEnabled ? <p>An administrator has paused institution transfer requests for this pathway. Your existing institution history and access records are preserved.</p> : ["pending", "reviewing", "approved"].includes(institutionState.transfer?.status) ? <div className="storage-plan-card"><span>Transfer request</span><strong>{institutionState.transfer.requested_institution_name || institutionState.transfer.to_directory_key || "Destination under review"}</strong><p>Status: {institutionState.transfer.status}. Submitted {new Date(institutionState.transfer.created_at).toLocaleString()}.</p></div> : <form onSubmit={submitTransferRequest}>
            <InstitutionPicker
              value={transferChoice}
              onChange={setTransferChoice}
              educationDivision=""
              label="Destination institution"
              required
              allowIndependent={false}
              helpText="Choose the exact destination. If it is not listed, request a reviewed match. Your current institution does not change when this form is submitted."
            />
            <label>Reason for transfer<textarea rows={4} value={transferReason} onChange={(event) => setTransferReason(event.target.value)} required minLength={5} maxLength={2000} placeholder="Explain why the institution relationship should change." /></label>
            <label>Requested effective date<input type="date" value={transferEffectiveOn} onChange={(event) => setTransferEffectiveOn(event.target.value)} /></label>
            <div className="storage-plan-card"><span>Before you submit</span><strong>This is a reviewed request, not an immediate switch.</strong><p>Approval ends inappropriate prior access while preserving records required for grades, audit, retention, legal hold, and reconciliation.</p></div>
            <button type="submit" className="account-settings-save" disabled={busy || !["active", "independent"].includes(institutionState.affiliation?.status)}>{busy ? "Submitting…" : "Submit transfer request"}</button>
          </form>}
        </article>
      </div>}

      {section === "account" && <div className="account-settings-grid">
        <article className="account-settings-card account-action-stack">
          <h2>Security and status</h2>
          <div><span>Account status</span><strong>{draft.accountStatus === "active" ? "Active" : draft.accountStatus}</strong></div>
          <div><span>Billing profile</span><strong>Free account · no payment method</strong></div>
          <button type="button" onClick={sendPasswordReset} disabled={busy}>{busy ? "Sending…" : "Send password reset email"}</button>
          <button type="button" onClick={resetDeviceCopy}>Reset this device workspace</button>
          <button type="button" className={draft.deletionStatus === "requested" ? "is-warning" : ""} onClick={requestDeletion}>{draft.deletionStatus === "requested" ? "Cancel deletion request" : "Request account deletion"}</button>
          <small>Device reset removes settings and sample activity on this browser. Account deletion needs the signed-in account service to finish.</small>
        </article>
        <article className="account-settings-card">
          <h2>Save history</h2>
          <div className="settings-version-list">{draft.versions?.length ? draft.versions.map((version, index) => <div key={version.id}><strong>v{draft.versions.length - index}</strong><span>{version.label}</span><time>{new Date(version.savedAt).toLocaleString()}</time></div>) : <p>No saved versions yet. Each settings save creates one.</p>}</div>
        </article>
      </div>}

      {notice && <p className="account-settings-notice" role="status">{notice}</p>}
    </section>
  );
}

export {
  PROVIDER_MODELS,
  accountSettingsKey,
  connectorTokenKey,
  defaultAccountSettings,
  readAccountSettings,
  saveAccountSettings,
  readConnectorToken,
  storeConnectorToken,
  LiveDateTime,
};
