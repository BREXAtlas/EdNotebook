import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const shell = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "linear-gradient(135deg, #f5f1e8 0%, #e9f0ff 100%)",
  color: "#18233a",
  fontFamily: "Inter, system-ui, sans-serif",
};

const card = {
  width: "min(100%, 460px)",
  background: "rgba(255,255,255,.96)",
  border: "1px solid rgba(24,35,58,.12)",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 24px 70px rgba(24,35,58,.14)",
};

const field = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #ccd5e3",
  fontSize: "15px",
  marginTop: "7px",
};

const primaryButton = {
  width: "100%",
  border: 0,
  borderRadius: "12px",
  padding: "13px 16px",
  background: "#245397",
  color: "white",
  fontWeight: 800,
  fontSize: "15px",
  cursor: "pointer",
};

function AuthForm() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (mode === "signup") return "Create your EdNotebook account";
    if (mode === "reset") return "Reset your password";
    return "Sign in to EdNotebook";
  }, [mode]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}#/app`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage(
          data.session
            ? "Account created. You are signed in."
            : "Account created. Check your email to confirm your address."
        );
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}#/app`,
        });
        if (resetError) throw resetError;
        setMessage("Password reset email sent. Check your inbox.");
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
      }
    } catch (submitError) {
      setError(submitError?.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={shell}>
      <section style={card} aria-labelledby="auth-title">
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>
          EDNOTEBOOK
        </div>
        <h1 id="auth-title" style={{ margin: "8px 0 6px", fontSize: 30, lineHeight: 1.08 }}>
          {title}
        </h1>
        <p style={{ margin: "0 0 22px", color: "#59667a", lineHeight: 1.5 }}>
          Your courses, progress, grading, and account settings stay connected to your login.
        </p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
              Full name
              <input
                style={field}
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
          )}

          <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
            Email
            <input
              style={field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          {mode !== "reset" && (
            <label style={{ display: "block", marginBottom: 18, fontWeight: 700 }}>
              Password
              <input
                style={field}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          )}

          {error && (
            <div role="alert" style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: "#fff0f0", color: "#9e2525" }}>
              {error}
            </div>
          )}
          {message && (
            <div role="status" style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: "#edf8ef", color: "#226134" }}>
              {message}
            </div>
          )}

          <button style={primaryButton} type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in"}
          </button>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 18 }}>
          {mode !== "login" && (
            <button type="button" onClick={() => setMode("login")} style={{ border: 0, background: "none", color: "#245397", cursor: "pointer", fontWeight: 700 }}>
              Sign in
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" onClick={() => setMode("signup")} style={{ border: 0, background: "none", color: "#245397", cursor: "pointer", fontWeight: 700 }}>
              Create account
            </button>
          )}
          {mode !== "reset" && (
            <button type="button" onClick={() => setMode("reset")} style={{ border: 0, background: "none", color: "#245397", cursor: "pointer", fontWeight: 700 }}>
              Forgot password?
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function AccountBar({ profile, user }) {
  return (
    <div style={{ position: "fixed", zIndex: 10000, right: 14, bottom: 14, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "rgba(22,31,49,.94)", color: "white", boxShadow: "0 12px 35px rgba(0,0,0,.22)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 220 }}>
        <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {profile?.full_name || user.email}
        </div>
        <div style={{ fontSize: 11, opacity: .72, textTransform: "capitalize" }}>
          {profile?.role || "learner"} · {profile?.subscription_status || "free"}
        </div>
      </div>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        style={{ border: "1px solid rgba(255,255,255,.35)", borderRadius: 10, background: "transparent", color: "white", padding: "8px 10px", cursor: "pointer", fontWeight: 700 }}
      >
        Sign out
      </button>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    }

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,subscription_status")
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      if (error) {
        console.error("Unable to load profile", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (!isSupabaseConfigured) {
    return (
      <main style={shell}>
        <section style={card}>
          <h1 style={{ marginTop: 0 }}>Supabase configuration missing</h1>
          <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to the GitHub Pages build environment.</p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main style={shell}><div style={card}>Loading your EdNotebook account…</div></main>;
  }

  if (!session?.user) return <AuthForm />;

  return (
    <>
      {children}
      <AccountBar profile={profile} user={session.user} />
    </>
  );
}
