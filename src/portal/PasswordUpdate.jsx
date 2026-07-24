import { useEffect, useState } from "react";
import BrandLogo from "../Brand.jsx";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";

export default function PasswordUpdate() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setError("EdNotebook account services are not configured.");
      setChecking(false);
      return undefined;
    }

    let active = true;

    async function checkRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
      } else if (data.session) {
        setReady(true);
      } else {
        setError("This password-reset link is invalid or has expired. Request a new reset email from the sign-in page.");
      }
      setChecking(false);
    }

    checkRecoverySession();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setChecking(false);
        setError("");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
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
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setPassword("");
      setConfirm("");
      setReady(false);
      setNotice("Your password was updated. EdNotebook is signing you out so you can sign in with the new password.");

      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;

      window.setTimeout(() => {
        window.location.hash = "#/students";
      }, 1600);
    } catch (updateError) {
      setError(updateError?.message || "EdNotebook could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="password-update-page">
      <section className="password-update-card" aria-labelledby="password-update-title">
        <BrandLogo size={48} tagline="Account security" />
        <span>RESET PASSWORD</span>
        <h1 id="password-update-title">Choose a new password.</h1>

        {checking && <p role="status">Opening your secure password-reset session…</p>}

        {!checking && error && <div role="alert">{error}</div>}
        {notice && <div role="status">{notice}</div>}

        {!checking && ready && !notice && (
          <form onSubmit={submit}>
            <label>
              New password
              <input
                type="password"
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                minLength={10}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {!checking && !ready && !notice && <a href="#/students">Return to sign in</a>}
      </section>
    </main>
  );
}
