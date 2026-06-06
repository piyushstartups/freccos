import React, { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setDone(true);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 22px" }}>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.15, margin: 0 }}>Reset password</h1>
      </div>
      <form onSubmit={submit} className="p-4">
        {!done ? (
          <>
            <p className="t-sub muted mb-3">Enter your email and we’ll send a reset link.</p>
            <input
              data-testid="forgot-email" className="ios-input"
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {err && <p className="t-sub" style={{ color: "#FF453A" }}>{err}</p>}
            <button data-testid="forgot-submit" className="btn-pill btn-primary w-full mt-4">Send reset link</button>
          </>
        ) : (
          <div data-testid="forgot-done" className="ios-card px-4 py-6 text-center">
            <p className="t-title3">Check your email</p>
            <p className="t-sub muted mt-1">If that email exists, we just sent a reset link.</p>
          </div>
        )}
        <Link to="/login" className="t-sub block text-center mt-4" style={{ color: "#0A84FF" }}>
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
