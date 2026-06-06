import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import Wordmark from "../components/Wordmark";

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
      <FreccosLogo size={80} />
      <div style={{ marginTop: 18 }}>
        <Wordmark size={42} color="#fff" />
      </div>
      <p className="t-sub mt-2" style={{ color: "#8E8E93" }}>The places your friends actually love.</p>
    </div>
  );
}

export function FreccosLogo({ size = 64 }) {
  return (
    <img
      src="/freccos-logo.png"
      width={size}
      height={size}
      alt="Freccos"
      style={{ display: "block", borderRadius: size * 0.22, objectFit: "contain" }}
    />
  );
}
