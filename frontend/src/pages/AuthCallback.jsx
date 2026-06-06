import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import Wordmark from "../components/Wordmark";

export default function AuthCallback() {
  const nav = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      nav("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(match[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        setUser(data);
        // Strip hash and go to explore
        window.history.replaceState({}, "", window.location.pathname);
        nav("/explore", { replace: true });
      } catch (e) {
        nav("/login?google_error=1", { replace: true });
      }
    })();
  }, [location, nav, setUser]);

  return (
    <div style={{
      minHeight: "100vh", background: "#1C1C1E", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <Wordmark size={36} color="#fff" />
      <p className="t-sub mt-4" style={{ color: "#8E8E93" }}>Signing you in...</p>
    </div>
  );
}
