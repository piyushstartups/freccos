import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Splash() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user) nav("/explore", { replace: true });
      else nav("/login", { replace: true });
    }, 1400);
    return () => clearTimeout(t);
  }, [loading, user, nav]);

  return (
    <div
      style={{
        minHeight: "100vh", background: "#1C1C1E", color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
      data-testid="splash"
    >
      <FreccosLogo />
      <h1 className="t-large mt-5" style={{ color: "#fff" }}>Freccos</h1>
      <p className="t-sub mt-1" style={{ color: "#8E8E93" }}>The places your friends actually love.</p>
    </div>
  );
}

export function FreccosLogo({ size = 64, color = "#6C5CE7" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="22" cy="26" r="13" fill={color} opacity="0.45" />
      <circle cx="40" cy="26" r="13" fill={color} opacity="0.55" />
      <circle cx="31" cy="38" r="14" fill={color} />
      <circle cx="31" cy="36" r="4" fill="#fff" />
    </svg>
  );
}
