import { useEffect, useRef, useState } from "react";
import { supabase, hasBackend, isAllowedRedirect } from "./supabase";

// ── How SSO works here ───────────────────────────────────────────────────────
// An app sends the user to:   https://auth.zonicme.com.ng/?redirect=<app-callback-url>
// 1. If a session already exists at auth.zonicme.com.ng → forward immediately (silent SSO).
// 2. Otherwise show login (Google / email+password / OTP).
// 3. On success → forward to <app-callback-url> with the session tokens in the URL
//    *fragment* (#…), which never reaches servers or logs. The app calls
//    supabase.auth.setSession({access_token, refresh_token}) to adopt the session.
// Because every app points at the SAME Supabase project, that session is valid everywhere.

type Mode = "choose" | "email";

function getRedirect(): string | null {
  const r = new URLSearchParams(window.location.search).get("redirect");
  if (!r) return null;
  return isAllowedRedirect(r) ? r : null;
}

async function forwardWithSession(redirect: string) {
  if (!supabase) {
    window.location.href = redirect;
    return;
  }
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s) return;
  const frag = `zm_at=${encodeURIComponent(s.access_token)}&zm_rt=${encodeURIComponent(s.refresh_token)}`;
  const url = new URL(redirect);
  url.hash = frag;
  window.location.href = url.toString();
}

export default function App() {
  const authRequestRef = useRef(false);
  const redirect = getRedirect();
  const rawRedirect = new URLSearchParams(window.location.search).get(
    "redirect",
  );
  const [mode, setMode] = useState<Mode>("choose");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [lastSignupAttempt, setLastSignupAttempt] = useState(0);

  // Silent SSO: if already signed in here, forward straight back to the app.
  useEffect(() => {
    (async () => {
      if (hasBackend && redirect) {
        const { data } = await supabase!.auth.getSession();
        if (data.session) {
          await forwardWithSession(redirect);
          return;
        }
      }
      setChecking(false);
    })();
  }, []);

  const clearMessages = () => {
    setErr(null);
    setSuccess(null);
  };

  const done = async () => {
    if (redirect) await forwardWithSession(redirect);
    else setErr("Signed in. (No return app specified.)");
  };

  const google = async () => {
    if (authRequestRef.current || busy) return;

    clearMessages();

    authRequestRef.current = true;
    setBusy(true);
    setErr(null);

    try {
      if (!hasBackend) {
        setErr(
          "Connect the ZonicMe Supabase project to enable Google sign-in.",
        );
        return;
      }

      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href,
        },
      });

      if (error) throw error;
    } catch (e: any) {
      setErr(
        e?.message || "We couldn't sign you in with Google. Please try again.",
      );
    } finally {
      authRequestRef.current = false;
      setBusy(false);
    }
  };

  const submitEmail = async () => {
    if (authRequestRef.current || busy) return;

    clearMessages();

    authRequestRef.current = true;
    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      if (!hasBackend) {
        setErr(
          "Supabase is not connected. Configure your environment variables first.",
        );
        return;
      }

      if (isSignup) {
  const now = Date.now();

  if (now - lastSignupAttempt < 60000) {
    setErr(
      "A verification email was recently sent. Please check your inbox."
    );
    return;
  }

  setLastSignupAttempt(now);

  const { error } = await supabase!.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) throw error;

  setShowVerificationModal(true);
  return;
}

      const { error } = await supabase!.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setSuccess("✅ Login successful. Redirecting...");

      setTimeout(() => {
        setSuccess(null);
      }, 4000);

      setTimeout(async () => {
        await done();
      }, 800);
    }catch (e: any) {
  console.log("SUPABASE AUTH ERROR:", e);

  if (e?.status === 429) {
    setErr(
      e?.message ||
      "Too many requests. Please wait before trying again."
    );
  } else {
    setErr(e?.message || "Authentication failed.");
  }
    } finally {
      authRequestRef.current = false;
      setBusy(false);
    }
  };

  const getEmailProviderUrl = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();

    switch (domain) {
      case "gmail.com":
        return "https://mail.google.com";
      case "outlook.com":
      case "hotmail.com":
      case "live.com":
        return "https://outlook.live.com";
      case "yahoo.com":
        return "https://mail.yahoo.com";
      default:
        return null;
    }
  };

const openMailbox = () => {
  const providerUrl = getEmailProviderUrl(email);

  if (providerUrl) {
    window.open(providerUrl, "_blank");
    return;
  }

  setErr(
    "Please open your email application and click the verification link we sent."
  );
};

  if (checking)
    return (
      <div className="wrap">
        <div className="card">
          <div className="spin" />
        </div>
      </div>
    );

  return (
    <div className="wrap">
      <div className="card">
        <div className="logo">
          <div className="dot">Z</div>
          <div className="wm">
            Zonic<b>Me</b>
          </div>
        </div>
        <h1>
          {isSignup ? "Create your ZonicMe account" : "Sign in to ZonicMe"}
        </h1>
        <p className="sub">
          {rawRedirect ? (
            <>
              One account for every ZonicMe app
              {redirect ? "" : " — (this return link isn’t on the allow-list)"}.
            </>
          ) : (
            "One account for every ZonicMe app."
          )}
        </p>

        {mode === "choose" && (
          <>
            <button className="google" onClick={google}>
              <span className="g">G</span> Continue with Google
            </button>
            <div className="or">
              <span>or</span>
            </div>
            <button
              className="primary"
              onClick={() => {
                clearMessages();
                setMode("email");
              }}
            >
              Continue with Email
            </button>

            <p className="switch">
              {isSignup ? "Already have an account?" : "New to ZonicMe?"}{" "}
              <a
                onClick={() => {
                  clearMessages();
                  setIsSignup(!isSignup);
                }}
              >
                {isSignup ? "Sign in" : "Create one"}
              </a>
            </p>
          </>
        )}

        {mode === "email" && (
          <>
            <label>Email (your username)</label>
            <input
              type="email"
              value={email}
              placeholder="you@email.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="primary"
              disabled={busy || !email || !password}
              onClick={submitEmail}
            >
              {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            </button>
            {/* <button className="text" onClick={() => sendCode("email")}>Email me a code instead</button> */}
            <button
              className="text"
              onClick={() => {
                clearMessages();
                setMode("choose");
              }}
            >
              ‹ Back
            </button>
          </>
        )}

        {success && <div className="success">{success}</div>}
        {err && <p className="err">{err}</p>}
        {!hasBackend && (
          <p className="demo">
            Demo mode — set the ZonicMe Supabase env to enable real sign-in.
          </p>
        )}
        {redirect && (
          <p className="ret">
            After sign-in you’ll return to <b>{new URL(redirect).host}</b>.
          </p>
        )}
      </div>

      {showVerificationModal && (
        <div className="verify-overlay">
          <div className="verify-modal">
            <div className="verify-icon">🎉</div>

            <h2>Account Created</h2>

            <p>We've sent a verification email to</p>

            <div className="verify-email">{email}</div>

            <p>
              Please confirm your email address before signing in to ZonicMe.
            </p>

            {getEmailProviderUrl(email) && (
  <button className="secondary" onClick={openMailbox}>
    Open Mailbox
  </button>
)}

            <button
              className="text"
              onClick={() => {
                setShowVerificationModal(false);
                setIsSignup(false);
              }}
            >
              I've Verified My Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
