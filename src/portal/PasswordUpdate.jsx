import { useEffect, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export default function PasswordUpdate() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice("Password updated. You can return to your dashboard.");
    setPassword("");
    setConfirm("");
  }

  return (
    <main className="password-update-page">
      <section className="password-update-card">
        <BrandLogo size={48} tagline="Account security" />
        <span>RESET PASSWORD</span>
        <h1>Choose a new password.</h1>
        {!ready ? <p>Open this page from the password reset email so EdNotebook can confirm the reset session.</p> : <form onSubmit={submit}>
          <label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirm new password<input type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
          {error && <div role="alert">{error}</div>}
          {notice && <div role="status">{notice}</div>}
          <button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>}
        <a href="#/students">Return to EdNotebook</a>
      </section>
    </main>
  );
}
