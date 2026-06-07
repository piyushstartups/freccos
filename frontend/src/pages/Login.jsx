import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { formatApiErrorDetail } from "../lib/api";
import { FreccosLogo } from "./Splash";
import Wordmark from "../components/Wordmark";
import { Loader2 } from "lucide-react";
import { track, Events } from "../lib/analytics";

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
      track(Events.LOGIN_COMPLETED, { method: "password" });
      nav("/explore", { replace: true });
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setLoading(false); }
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
        <p className="t-sub mt-2" style={{ color: "#8E8E93" }}>Discover the world through your people.</p>
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
