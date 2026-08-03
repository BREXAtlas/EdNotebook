import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import InstitutionPicker from "./admin-control/InstitutionPicker.jsx";
import "./admin-control/admin-control-center.css";

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

const ACCOUNT_LOAD_TIMEOUT_MS = 12000;

function withAccountLoadTimeout(request, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ACCOUNT_LOAD_TIMEOUT_MS);
  });

  return Promise.race([Promise.resolve(request), timeout])
    .finally(() => window.clearTimeout(timeoutId));
}

async function signOutWithAccountTimeout() {
  const { error } = await withAccountLoadTimeout(
    supabase.auth.signOut({ scope: "local" }),
    "The verification session sign-out took too long.",
  );
  if (error) throw error;
}

async function hashInstitutionIdentifier(institutionKey, identifier) {
  const normalized = `${institutionKey.trim().toLowerCase()}::${identifier.trim().toUpperCase().replace(/\s+/g, "")}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function AuthForm({ accountType = "student", educationTrack = "university", returnTo = "#/student/app", allowSignup = true, initialVerified = false, onVerifiedContinue }) {
  const [mode, setMode] = useState("login");
  const [signupState, setSignupState] = useState(initialVerified ? "verified" : null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institutionChoice, setInstitutionChoice] = useState(null);
  const [universityId, setUniversityId] = useState("");
  const [department, setDepartment] = useState("");
  const [educationDivision, setEducationDivision] = useState(educationTrack === "k12" ? "k12" : "university");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const earlyPrepTeacher = accountType === "professor" && educationTrack === "k12";

  const title = useMemo(() => {
    if (mode === "signup") {
      if (accountType === "professor") return earlyPrepTeacher ? "Create a high-school teacher account" : "Create a professor account";
      if (accountType === "institution") return "Create an institution account";
      return "Create a student account";
    }
    if (mode === "reset") return "Reset your password";
    if (accountType === "professor") return earlyPrepTeacher ? "High-school teacher sign in" : "Professor sign in";
    if (accountType === "institution") return "Institution administrator sign in";
    return "Student sign in";
  }, [accountType, earlyPrepTeacher, mode]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const schoolLabel = educationTrack === "k12" ? "school or district" : "college or university";
        if (!institutionChoice) throw new Error(`Choose your ${schoolLabel}, choose Other institution for review, or select Independent when available.`);
        if (accountType === "professor" && institutionChoice.choice === "independent") {
          throw new Error("Professor accounts require an institution request. Choose the exact institution or request review for an unlisted institution.");
        }
        if (institutionChoice.choice === "other" && !institutionChoice.name?.trim()) throw new Error("Add the institution's full legal name for review.");
        const institutionalStudent = accountType === "student" && institutionChoice.choice !== "independent";
        if (institutionalStudent && !universityId.trim()) throw new Error(`Add the ${educationTrack === "k12" ? "student ID" : "university ID"} your educator will use for roster matching.`);

        const institutionKey = institutionChoice.directoryKey || institutionChoice.name || "independent";
        const identifierHash = institutionalStudent
          ? await hashInstitutionIdentifier(institutionKey, universityId)
          : null;
        const { data, error: signUpError } = await withAccountLoadTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                requested_role: accountType === "professor" ? "professor" : "learner",
                education_division: accountType === "professor" ? educationDivision : educationTrack,
                affiliation_choice: institutionChoice.choice,
                institution_directory_key: institutionChoice.directoryKey || null,
                institution_name: institutionChoice.choice === "independent" ? null : institutionChoice.name?.trim() || null,
                department: accountType === "professor" ? department.trim() : null,
                institution_identifier_hash: identifierHash,
                institution_identifier_last4: institutionalStudent ? universityId.trim().slice(-4) : null,
              },
              emailRedirectTo: `${window.location.origin}${window.location.pathname}${returnTo}${returnTo.includes("?") ? "&" : "?"}confirmed=1`,
            },
          }),
          "Account creation took too long. Check the connection and try again.",
        );
        if (signUpError) throw signUpError;
        if (data.session) {
          try {
            await signOutWithAccountTimeout();
          } catch (signOutError) {
            console.error("Unable to confirm verification session sign-out", signOutError);
          }
          setSignupState("verified");
        } else {
          setSignupState("email");
        }
      } else if (mode === "reset") {
        const { error: resetError } = await withAccountLoadTimeout(
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}${window.location.pathname}${returnTo}`,
          }),
          "The password reset request took too long. Check the connection and try again.",
        );
        if (resetError) throw resetError;
        setMessage("Password reset email sent. Check your inbox.");
      } else {
        const { error: loginError } = await withAccountLoadTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          "Sign-in took too long. Check the connection and try again.",
        );
        if (loginError) throw loginError;
      }
    } catch (submitError) {
      setError(submitError?.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (signupState) {
    const verified = signupState === "verified";
    return (
      <main style={shell}>
        <section style={card} aria-labelledby="signup-confirmation-title">
          <div style={{ width: 50, height: 50, display: "grid", placeItems: "center", borderRadius: 16, color: verified ? "#226134" : "#245397", background: verified ? "#edf8ef" : "#eaf1ff", fontSize: 25, fontWeight: 900 }}>
            {verified ? "✓" : "✉"}
          </div>
          <div style={{ marginTop: 18, fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>EDNOTEBOOK · ACCOUNT SECURITY</div>
          <h1 id="signup-confirmation-title" style={{ margin: "8px 0 10px", fontSize: 30, lineHeight: 1.08 }}>
            {verified ? "Email confirmed." : "Check your email."}
          </h1>
          <p style={{ color: "#59667a", lineHeight: 1.6 }}>
            {verified
              ? "Your address is verified. For security, EdNotebook signed out the verification session. Continue to a fresh login screen and enter your password."
              : `We sent a confirmation link to ${email || "your email address"}. Open it to verify the account. The link returns to a separate confirmation screen before sign-in.`}
          </p>
          {verified ? (
            <button style={primaryButton} type="button" onClick={() => { setSignupState(null); setMode("login"); setPassword(""); onVerifiedContinue?.(); }}>
              Continue to fresh sign in
            </button>
          ) : (
            <>
              <button style={primaryButton} type="button" onClick={() => { setSignupState(null); setMode("login"); setPassword(""); }}>
                Go to sign in
              </button>
              <button type="button" onClick={() => setSignupState(null)} style={{ width: "100%", marginTop: 10, border: 0, background: "transparent", color: "#245397", cursor: "pointer", fontWeight: 750 }}>
                Use a different email
              </button>
            </>
          )}
        </section>
      </main>
    );
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
          {accountType === "institution"
            ? "Use an approved EdNotebook account. The control center will show only the platform or institution workspaces assigned to that account."
            : accountType === "professor"
            ? `Choose the exact ${earlyPrepTeacher ? "high school or district" : "institution"} you work for. ${earlyPrepTeacher ? "Teacher" : "Professor"} access stays pending until the relationship is reviewed and approved.`
            : educationTrack === "k12"
              ? "Browse schools and classes first, then sign in when you join a class or save your work."
              : "Browse colleges and classes publicly, then sign in when you join a class or save private work."}
        </p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
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
              {accountType === "professor" && (
                <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                  Teaching audience
                  <select style={field} value={educationDivision} disabled={earlyPrepTeacher} onChange={(event) => setEducationDivision(event.target.value)}>
                    {!earlyPrepTeacher && <option value="university">University / college</option>}
                    <option value="k12">Early Prep · Grades 9–12</option>
                    {!earlyPrepTeacher && <option value="both">Both</option>}
                  </select>
                </label>
              )}
              <InstitutionPicker
                value={institutionChoice}
                onChange={setInstitutionChoice}
                educationDivision={accountType === "professor"
                  ? educationDivision === "both" ? "" : educationDivision
                  : educationTrack}
                label={accountType === "professor" ? "Primary institution" : educationTrack === "k12" ? "School or district" : "College or university"}
                required
                allowIndependent={accountType === "student"}
                helpText={accountType === "professor"
                  ? `Choose the exact ${earlyPrepTeacher ? "high school or district" : "institution"} you work for. An unlisted institution can be submitted for review; selection alone does not grant ${earlyPrepTeacher ? "teacher" : "professor"} access.`
                  : "Choose the exact school you attend. Select Independent only for free public use without professor enrollment, assignment, roster, or institutional grade access."}
              />
              {accountType === "student" && institutionChoice?.choice !== "independent" ? (
                <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                  {educationTrack === "k12" ? "Student ID" : "University ID"}
                  <input style={field} value={universityId} onChange={(event) => setUniversityId(event.target.value)} required autoComplete="off" />
                  <small style={{ display: "block", marginTop: 6, color: "#68758a", fontWeight: 500 }}>Used to match your educator's approved roster. Public pages show only the last four characters.</small>
                </label>
              ) : (
                <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                  Department
                  <input style={field} value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Optional" />
                  <small style={{ display: "block", marginTop: 6, color: "#68758a", fontWeight: 500 }}>Department is descriptive only. Institution approval—not this field—controls {earlyPrepTeacher ? "teacher" : "professor"} access.</small>
                </label>
              )}
            </>
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
          {allowSignup && mode !== "signup" && (
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
    <div className="account-bubble">
      <div className="account-bubble-details">
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

export default function AuthGate({ children, accountType = "student", educationTrack = "university", returnTo = "#/student/app", allowedRoles = null, allowSignup = true }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const profileUserId = useRef(null);
  const confirmationRequested = useRef(
    typeof window !== "undefined"
      && new URLSearchParams(window.location.hash.split("?")[1] || "").get("confirmed") === "1",
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    let sessionResolved = false;

    function applySession(nextSession) {
      if (!active) return;

      sessionResolved = true;
      const nextUserId = nextSession?.user?.id || null;
      if (profileUserId.current !== nextUserId) {
        profileUserId.current = nextUserId;
        setProfile(null);
        setProfileLoading(Boolean(nextUserId));
        setLoadError("");
      }
      setSession(nextSession ?? null);
      setLoading(false);
    }

    function finishConfirmation() {
      sessionResolved = true;
      confirmationRequested.current = false;
      setVerificationConfirmed(true);
      setSession(null);
      profileUserId.current = null;
      const cleanHash = window.location.hash.split("?")[0] || returnTo;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("code");
      window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanHash}`);
    }

    async function loadSession() {
      try {
        const { data, error } = await withAccountLoadTimeout(
          supabase.auth.getSession(),
          "The account session took too long to load.",
        );
        if (error) throw error;
        if (!active) return;
        if (confirmationRequested.current) {
          if (data.session) {
            try {
              await signOutWithAccountTimeout();
            } catch (signOutError) {
              console.error("Unable to confirm verification session sign-out", signOutError);
            }
          }
          finishConfirmation();
          setLoading(false);
          return;
        }
        applySession(data.session);
      } catch (sessionError) {
        if (active && !sessionResolved) {
          console.error("Unable to load account session", sessionError);
          setLoading(false);
          setProfileLoading(false);
          setLoadError(sessionError?.message || "EdNotebook could not load the account session.");
        }
      }
    }

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (confirmationRequested.current) {
        finishConfirmation();
        if (nextSession) {
          window.setTimeout(() => {
            signOutWithAccountTimeout().catch((signOutError) => {
              console.error("Unable to finish verification session sign-out", signOutError);
            });
          }, 0);
        }
        setLoading(false);
        return;
      }
      applySession(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [returnTo, loadAttempt]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const { data, error } = await withAccountLoadTimeout(
          supabase
            .from("profiles")
            .select("id,email,full_name,role,subscription_status")
            .eq("id", session.user.id)
            .single(),
          "The account profile took too long to load.",
        );

        if (error) throw error;
        if (!active) return;
        setProfile(data);
        setProfileLoading(false);
      } catch (profileError) {
        if (!active) return;
        console.error("Unable to load profile", profileError);
        setProfile(null);
        setProfileLoading(false);
        setLoadError(profileError?.message || "EdNotebook could not load the account profile.");
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user?.id, loadAttempt]);

  function retryAccountLoad() {
    setLoadError("");
    if (session?.user) setProfileLoading(true);
    else setLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

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

  if (loading || (session?.user && profileLoading)) {
    return <main style={shell}><div style={card}>Loading your EdNotebook account…</div></main>;
  }

  if (loadError) {
    return (
      <main style={shell}>
        <section style={card} role="alert" aria-labelledby="account-load-error-title">
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>EDNOTEBOOK · ACCOUNT</div>
          <h1 id="account-load-error-title" style={{ marginBottom: 8 }}>The account did not finish loading.</h1>
          <p style={{ color: "#59667a", lineHeight: 1.55 }}>{loadError}</p>
          <button type="button" style={primaryButton} onClick={retryAccountLoad}>Try again</button>
          {session?.user && <button type="button" style={{ ...primaryButton, marginTop: 10, background: "#eef2f8", color: "#245397" }} onClick={() => supabase.auth.signOut()}>Sign out</button>}
        </section>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <AuthForm
        accountType={accountType}
        educationTrack={educationTrack}
        returnTo={returnTo}
        allowSignup={allowSignup}
        initialVerified={verificationConfirmed}
        onVerifiedContinue={() => setVerificationConfirmed(false)}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return (
      <main style={shell}>
        <section style={card} aria-labelledby="role-access-title">
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>EDNOTEBOOK · RESTRICTED WORKSPACE</div>
          <h1 id="role-access-title">This account does not have access.</h1>
          <p style={{ color: "#59667a", lineHeight: 1.55 }}>Sign in with an account assigned to this workspace.</p>
          <button type="button" style={primaryButton} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  const professorRole = ["professor", "admin", "owner"].includes(profile?.role);
  if (accountType === "professor" && !professorRole) {
    const requestedProfessor = session.user.user_metadata?.requested_role === "professor";
    return (
      <main style={shell}>
        <section style={card} aria-labelledby="professor-access-title">
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>{educationTrack === "k12" ? "EDNOTEBOOK EARLY PREP · TEACHER PORTAL" : "EDNOTEBOOK · PROFESSOR PORTAL"}</div>
          <h1 id="professor-access-title" style={{ marginBottom: 8 }}>
            {requestedProfessor ? "Finish creating your educator workspace" : "This is not an educator account"}
          </h1>
          <p style={{ color: "#59667a", lineHeight: 1.55 }}>
            {requestedProfessor
              ? `Your ${educationTrack === "k12" ? "teacher" : "professor"} request is pending institution review. You cannot open institutional teaching, roster, assignment, or grade tools until the selected institution relationship is approved.`
              : "Use the student portal for class work, or sign out and use an educator account for teaching tools."}
          </p>
          <a href={educationTrack === "k12" ? "#/early-prep" : "#/professors"} style={{ ...primaryButton, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}>Return to educator information</a>
          <button type="button" style={{ ...primaryButton, background: "#eef2f8", color: "#245397" }} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  const content = typeof children === "function"
    ? children({ session, profile, user: session.user })
    : children;

  return (
    <>
      {content}
      <AccountBar profile={profile} user={session.user} />
    </>
  );
}
