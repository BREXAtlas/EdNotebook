import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { claimCourseJoinLink } from "./coursePublishingService.js";

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

async function hashInstitutionIdentifier(institution, identifier) {
  const normalized = `${institution.trim().toLowerCase()}::${identifier.trim().toUpperCase().replace(/\s+/g, "")}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function currentAuthParams() {
  return new URLSearchParams(window.location.hash.split("?")[1] || "");
}

function AuthForm({ accountType = "student", educationTrack = "university", returnTo = "#/student/app", allowSignup = true, initialVerified = false, onVerifiedContinue }) {
  const initialInvite = currentAuthParams().get("ref") || window.sessionStorage.getItem("ednotebook-invite-code") || "";
  const [mode, setMode] = useState(currentAuthParams().get("signup") === "1" ? "signup" : "login");
  const [signupState, setSignupState] = useState(initialVerified ? "verified" : null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [department, setDepartment] = useState("");
  const [educationDivision, setEducationDivision] = useState(educationTrack === "k12" ? "k12" : "university");
  const [wasInvited, setWasInvited] = useState(Boolean(initialInvite));
  const [inviteCode, setInviteCode] = useState(initialInvite.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (mode === "signup") return accountType === "professor" ? "Create a professor account" : "Create a student account";
    if (mode === "reset") return "Reset your password";
    return accountType === "professor" ? "Professor sign in" : "Student sign in";
  }, [accountType, mode]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const schoolLabel = educationTrack === "k12" ? "school or district" : "college or university";
        if (!university.trim()) throw new Error(`Add your ${schoolLabel}.`);
        if (accountType === "student" && !universityId.trim()) throw new Error(`Add the ${educationTrack === "k12" ? "student ID" : "university ID"} your educator will use for roster matching.`);
        if (wasInvited && !inviteCode.trim()) throw new Error("Add the invitation number from your friend.");

        const identifierHash = accountType === "student"
          ? await hashInstitutionIdentifier(university, universityId)
          : null;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              requested_role: accountType === "professor" ? "professor" : "learner",
              education_division: accountType === "professor" ? educationDivision : educationTrack,
              institution_name: university.trim(),
              department: accountType === "professor" ? department.trim() : null,
              institution_identifier_hash: identifierHash,
              institution_identifier_last4: accountType === "student" ? universityId.trim().slice(-4) : null,
              invite_code: wasInvited ? inviteCode.trim().toUpperCase() : null,
            },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}${returnTo}${returnTo.includes("?") ? "&" : "?"}confirmed=1`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          await supabase.auth.signOut();
          setSignupState("verified");
        } else {
          setSignupState("email");
        }
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}${returnTo}`,
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
          {!verified && <p style={{ color: "#68758a", fontSize: 13, lineHeight: 1.5 }}>If that address already has an account, EdNotebook will not create a second one. Return to sign in or use password reset instead.</p>}
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
          {accountType === "professor"
            ? "Use any email to begin teaching, publish classes, and choose a plan. School affiliation is a separate optional verification step."
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
                  <select style={field} value={educationDivision} onChange={(event) => setEducationDivision(event.target.value)}>
                    <option value="university">University / college</option>
                    <option value="k12">K–12 school</option>
                    <option value="both">Both</option>
                  </select>
                </label>
              )}
              <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                {accountType === "professor" ? "Primary school or university" : educationTrack === "k12" ? "School or district" : "College or university"}
                <input style={field} value={university} onChange={(event) => setUniversity(event.target.value)} required />
              </label>
              {accountType === "student" ? (
                <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                  {educationTrack === "k12" ? "Student ID" : "University ID"}
                  <input style={field} value={universityId} onChange={(event) => setUniversityId(event.target.value)} required autoComplete="off" />
                  <small style={{ display: "block", marginTop: 6, color: "#68758a", fontWeight: 500 }}>Used to match your educator's approved roster. Public pages show only the last four characters.</small>
                </label>
              ) : (
                <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                  Department
                  <input style={field} value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Optional" />
                  <small style={{ display: "block", marginTop: 6, color: "#68758a", fontWeight: 500 }}>You can use educator tools immediately. Upload a teacher ID later only if you want a verified school-affiliation badge.</small>
                </label>
              )}
              <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                Were you invited by someone?
                <select style={field} value={wasInvited ? "yes" : "no"} onChange={(event) => setWasInvited(event.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes, I have their invitation number</option>
                </select>
              </label>
              {wasInvited && <label style={{ display: "block", marginBottom: 14, fontWeight: 700 }}>
                Invitation number
                <input style={field} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="EN-..." required />
                <small style={{ display: "block", marginTop: 6, color: "#68758a", fontWeight: 500 }}>Your friend receives referral progress after this account is created.</small>
              </label>}
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
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const profileUserId = useRef(null);
  const activityUserId = useRef(null);
  const claimedJoinUserId = useRef(null);
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

    function finishConfirmation() {
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
      const { data } = await supabase.auth.getSession();
      if (active) {
        if (confirmationRequested.current) {
          if (data.session) await supabase.auth.signOut();
          finishConfirmation();
          setLoading(false);
          return;
        }
        profileUserId.current = data.session?.user?.id || null;
        setSession(data.session ?? null);
        setProfileLoading(Boolean(data.session?.user));
        setLoading(false);
      }
    }

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (confirmationRequested.current) {
        finishConfirmation();
        if (nextSession) window.setTimeout(() => supabase.auth.signOut(), 0);
        setLoading(false);
        return;
      }
      const nextUserId = nextSession?.user?.id || null;
      if (profileUserId.current !== nextUserId) {
        profileUserId.current = nextUserId;
        setProfileLoading(Boolean(nextSession?.user));
      }
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [returnTo]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,subscription_status,account_number")
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      if (error) {
        console.error("Unable to load profile", error);
        setProfile(null);
      } else {
        setProfile(data);
      }
      setProfileLoading(false);
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || activityUserId.current === session.user.id) return;
    activityUserId.current = session.user.id;
    supabase.rpc("record_account_activity", { p_event: "session_open" }).then(({ error }) => {
      if (error) console.warn("Unable to record account activity", error.message);
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || claimedJoinUserId.current === session.user.id) return;
    const token = window.sessionStorage.getItem("ednotebook-course-join-token");
    if (!token) return;
    claimedJoinUserId.current = session.user.id;
    claimCourseJoinLink(token).then(() => {
      window.sessionStorage.removeItem("ednotebook-course-join-token");
    }).catch((error) => {
      claimedJoinUserId.current = null;
      console.warn("Unable to join the invited class", error.message);
    });
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

  if (loading || (session?.user && profileLoading)) {
    return <main style={shell}><div style={card}>Loading your EdNotebook account…</div></main>;
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
           <a href="#/" style={{ ...primaryButton, display: "block", marginBottom: 10, textAlign: "center", textDecoration: "none" }}>Return to portal home</a>
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
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>EDNOTEBOOK · PROFESSOR PORTAL</div>
          <h1 id="professor-access-title" style={{ marginBottom: 8 }}>
            {requestedProfessor ? "Finish creating your educator workspace" : "This is not an educator account"}
          </h1>
          <p style={{ color: "#59667a", lineHeight: 1.55 }}>
            {requestedProfessor
              ? "Your account was created before instant educator access was enabled. Sign out and back in after the account update finishes. School-affiliation verification is optional and does not lock teaching tools."
              : "Use the student portal for class work, or sign out and use an educator account for teaching tools."}
          </p>
          <a href="#/professors" style={{ ...primaryButton, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}>Return to professor information</a>
          <button type="button" style={{ ...primaryButton, background: "#eef2f8", color: "#245397" }} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  const studentRole = ["learner", "student"].includes(profile?.role);
  if (accountType === "student" && !studentRole) {
    return (
      <main style={shell}>
        <section style={card} aria-labelledby="student-access-title">
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.4, color: "#245397" }}>EDNOTEBOOK · STUDENT WORKSPACE</div>
          <h1 id="student-access-title">This is not a student account.</h1>
          <p style={{ color: "#59667a", lineHeight: 1.55 }}>Use the public student tour to preview the student side. Sign in with a student account to open private class work and student profile tools.</p>
          <a href={educationTrack === "k12" ? "#/tour/k12" : "#/tour/student"} style={{ ...primaryButton, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}>Open the student tour</a>
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
