import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
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
    profileAccent: "#3151a6",
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
  accountNumber = "",
  educationTrack = "university",
  compact = false,
}) {
  const [section, setSection] = useState("profile");
  const [draft, setDraft] = useState(settings);
  const [connectorToken, setConnectorToken] = useState(() => readConnectorToken(scope));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [referralProgress, setReferralProgress] = useState({ account_number: accountNumber, referral_count: 0 });
  const models = useMemo(() => PROVIDER_MODELS[draft.assistantProvider] || PROVIDER_MODELS.builtin, [draft.assistantProvider]);

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => { setConnectorToken(readConnectorToken(scope)); }, [scope]);
  useEffect(() => {
    setReferralProgress((current) => ({ ...current, account_number: accountNumber || current.account_number }));
    if (!authenticated || !isSupabaseConfigured || !supabase) return;
    supabase.rpc("get_my_referral_progress").then(({ data, error }) => {
      if (!error && data) setReferralProgress(data);
    });
  }, [authenticated, accountNumber]);
  useEffect(() => {
    if (models.includes(draft.assistantModel)) return;
    setDraft((current) => ({ ...current, assistantModel: models[0] }));
  }, [draft.assistantModel, models]);

  function patchValue(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function patchPlugin(field, value) {
    setDraft((current) => ({ ...current, plugins: { ...current.plugins, [field]: value } }));
  }

  function persist(label = "Settings") {
    storeConnectorToken(scope, connectorToken.trim());
    const versionLabel = `${label} saved on this device`;
    const next = saveAccountSettings(scope, draft, versionLabel);
    setDraft(next);
    onSettingsChange?.(next);
    setNotice(`${versionLabel}. Version ${next.versions.length} is in the save history.`);
    if (authenticated && isSupabaseConfigured && supabase) {
      supabase.rpc("record_account_activity", { p_event: "settings_saved" }).then(() => {});
    }
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

  async function changeAccountEmail(event) {
    event.preventDefault();
    const requested = newEmail.trim().toLowerCase();
    if (!authenticated || !requested) return setNotice("Enter a new email while signed in.");
    if (requested === accountEmail.trim().toLowerCase()) return setNotice("That is already the account email.");
    setBusy(true);
    const returnHash = window.location.hash.split("?")[0] || (accountType === "professor" ? "#/professor/dashboard" : `#/student/${educationTrack}/app`);
    const { error } = await supabase.auth.updateUser(
      { email: requested },
      { emailRedirectTo: `${window.location.origin}${window.location.pathname}${returnHash}` },
    );
    setBusy(false);
    if (error) return setNotice(error.message);
    setNewEmail("");
    setNotice("Email change started. Confirm the messages sent to the current and new addresses. Your account number, work, and referral link stay with this account.");
  }

  async function copyInviteLink() {
    const code = referralProgress.account_number || accountNumber;
    if (!code) return setNotice("Your invitation number is still being prepared. Refresh after signing in again.");
    const audiencePath = accountType === "professor" ? "#/professors" : `#/students/${educationTrack}`;
    const inviteLink = `${window.location.origin}${window.location.pathname}${audiencePath}?ref=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(inviteLink);
    setNotice("Invitation link copied.");
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

  return (
    <section className={`account-settings-shell ${compact ? "is-compact" : ""}`} aria-labelledby={`account-settings-${scope}`}>
      <header className="account-settings-heading">
        <div><span>ACCOUNT SETTINGS</span><h1 id={`account-settings-${scope}`}>{accountType === "professor" ? "Educator settings" : "Student settings"}</h1><p>Profile, assistant connections, visibility, and device preferences live together.</p></div>
        <div className="account-settings-heading-tools"><LiveDateTime /><div className="account-plan-chip"><strong>Free</strong><span>Paid services coming soon</span></div></div>
      </header>
      <nav className="account-settings-tabs" aria-label="Settings sections">
        {SETTING_SECTIONS.map(([id, label]) => <button key={id} type="button" className={section === id ? "is-active" : ""} onClick={() => setSection(id)}>{label}</button>)}
      </nav>

      {section === "profile" && <div className="account-settings-grid">
        <article className="account-settings-card">
          <h2>Profile details</h2>
          <label>Display name<input value={draft.displayName} onChange={(event) => patchValue("displayName", event.target.value)} /></label>
          <label>Account email<input type="email" value={authenticated ? accountEmail || draft.email : draft.email} readOnly={authenticated} onChange={(event) => patchValue("email", event.target.value)} />{authenticated && <small>This verified address is attached to your existing account.</small>}</label>
          {authenticated && <form className="account-email-change" onSubmit={changeAccountEmail}><label>Change account email<input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new-address@example.com" required /></label><button type="submit" disabled={busy}>{busy ? "Sending…" : "Verify and change email"}</button><small>The new address cannot already belong to another account. Confirmation keeps this same account and account number.</small></form>}
          <label>Bio or description<textarea rows={5} value={draft.bio} onChange={(event) => patchValue("bio", event.target.value)} /></label>
          <label>Links<textarea rows={3} value={draft.links} onChange={(event) => patchValue("links", event.target.value)} placeholder="One website, portfolio, YouTube, or social link per line" /></label>
        </article>
        <article className="account-settings-card">
          <h2>Profile appearance</h2>
          <label>Who can open the full page<select value={draft.profileVisibility} onChange={(event) => patchValue("profileVisibility", event.target.value)}><option value="private">Only me</option><option value="class">Connections or classmates</option><option value="public">Public</option></select></label>
          <FieldSwitch checked={draft.discoverable} onChange={(value) => patchValue("discoverable", value)} label="Appear in people search" detail="Turn this off to keep the profile hidden from search." />
          <FieldSwitch checked={draft.showDescriptions} onChange={(value) => patchValue("showDescriptions", value)} label="Show card descriptions" detail="This changes the amount of helper text in your dashboard." />
          <label>Profile color<select value={draft.profileAccent} disabled={referralProgress.referral_count < 3} onChange={(event) => patchValue("profileAccent", event.target.value)}><option value="#3151a6">Notebook blue</option><option value="#7660b5">Campus violet</option><option value="#287b63">Library green</option><option value="#b15d3a">Study amber</option></select><small>{referralProgress.referral_count >= 3 ? "Unlocked by inviting three friends." : "Invite three friends to unlock profile color controls."}</small></label>
          <button type="button" className="account-settings-save" onClick={() => persist("Profile settings")}>Save profile on this device</button>
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
          <button type="button" className="account-settings-save" onClick={() => persist("Assistant and plugin settings")}>Save assistant settings on this device</button>
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
          <FieldSwitch checked={draft.productUpdates} onChange={(value) => patchValue("productUpdates", value)} label="Product update emails" detail="This device remembers the preference; email delivery is not connected yet." />
          <div className="storage-plan-card"><span>Free media allowance</span><strong>{referralProgress.referral_count >= 5 ? 10 : referralProgress.referral_count >= 1 ? 4 : draft.mediaUploadsPerWeek} picture or video uploads each week</strong><p>Text posts stay available. Inviting friends raises the free weekly media allowance.</p></div>
          <button type="button" className="account-settings-save" onClick={() => persist("Visibility and social controls")}>Save controls on this device</button>
        </article>
      </div>}

      {section === "account" && <div className="account-settings-grid">
        <article className="account-settings-card account-action-stack">
          <h2>Security and status</h2>
          <div><span>Account status</span><strong>{draft.accountStatus === "active" ? "Active" : draft.accountStatus}</strong></div>
          <div><span>Billing profile</span><strong>Free account · no payment method</strong></div>
          <div><span>Unique account number</span><strong>{referralProgress.account_number || accountNumber || "Preparing…"}</strong></div>
          <button type="button" onClick={copyInviteLink}>Copy my invitation link</button>
          <div className="referral-progress-card"><span>Friends who created an account</span><strong>{referralProgress.referral_count || 0}</strong><small>1 unlocks more weekly media · 3 unlocks profile colors · 5 expands the creator allowance.</small></div>
          <button type="button" onClick={sendPasswordReset} disabled={busy}>{busy ? "Sending…" : "Send password reset email"}</button>
          <button type="button" onClick={resetDeviceCopy}>Reset this device workspace</button>
          <button type="button" disabled title="Account deletion will be available after the account service is connected.">Account deletion coming soon</button>
          <small>Device reset removes settings and sample activity from this browser. Account deletion is not available yet.</small>
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
