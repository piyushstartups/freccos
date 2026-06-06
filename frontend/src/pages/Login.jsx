import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { formatApiErrorDetail } from "../lib/api";
import { FreccosLogo } from "./Splash";
import Wordmark from "../components/Wordmark";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email.trim(), pw);
      nav("/explore", { replace: true });
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setLoading(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{ background: "#1C1C1E", color: "#fff", padding: "56px 24px 36px", textAlign: "center" }}
        data-testid="login-hero"
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <FreccosLogo size={72} />
        </div>
        <div style={{ marginTop: 22 }}>
          <Wordmark size={38} color="#fff" />
        </div>
        <p className="t-sub mt-2" style={{ color: "#8E8E93" }}>The places your friends actually love.</p>
      </div>
      <form onSubmit={submit} style={{ padding: "28px 16px", flex: 1 }}>
        <h2 className="t-title1 mb-4">Welcome back</h2>
        <label className="t-label muted block mb-1">Email</label>
        <input
          data-testid="login-email"
          type="email"
          autoComplete="email"
          required
          className="ios-input mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <label className="t-label muted block mb-1">Password</label>
        <input
          data-testid="login-password"
          type="password"
          autoComplete="current-password"
          required
          className="ios-input"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••"
        />
        <Link
          to="/forgot"
          data-testid="login-forgot-link"
          className="t-sub block mt-2"
          style={{ color: "#0A84FF", textDecoration: "none" }}
        >
          Forgot password?
        </Link>
        {err && (
          <div data-testid="login-error" className="t-sub mt-3" style={{ color: "#FF453A" }}>
            {err}
          </div>
        )}
        <button
          data-testid="login-submit"
          className="btn-pill btn-primary w-full mt-5"
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          Sign in
        </button>

        <div className="flex items-center gap-3 my-5">
          <div style={{ flex: 1, height: 1, background: "#E5E5EA" }} />
          <span className="t-cap muted">or</span>
          <div style={{ flex: 1, height: 1, background: "#E5E5EA" }} />
        </div>

        <button
          type="button"
          data-testid="login-google"
          onClick={googleLogin}
          className="btn-pill w-full"
          style={{ background: "#fff", color: "#1C1C1E", border: "1px solid #E5E5EA" }}
        >
          <GoogleIcon /> Continue with Google
        </button>

        <p className="t-sub muted text-center mt-6">
          New here?{" "}
          <Link to="/signup" data-testid="login-signup-link" style={{ color: "#0A84FF" }}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.8l5.6-5.6C33.7 6.2 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.4-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.8l5.6-5.6C33.7 6.2 29 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13.1-5.1l-6.1-5c-2 1.4-4.4 2.1-7 2.1-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.4 39.6 16.1 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.1 5C40.7 35.5 44 30.2 44 24c0-1.4-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
