import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api from "./api";
import {
  initOneSignal, loginOneSignal, logoutOneSignal, setOneSignalTags, syncSubscriptionWithBackend,
} from "./onesignal";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null while loading, false if not authed
  const [loading, setLoading] = useState(true);
  const initedRef = useRef(false);
  const lastTaggedRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip /me check if we're returning from OAuth (AuthCallback handles it)
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  // Initialize OneSignal exactly once (queues if SDK script hasn't loaded yet).
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    initOneSignal();
  }, []);

  // Identify + tag the user on every successful /me load (and clear on logout).
  useEffect(() => {
    if (user && user.id) {
      loginOneSignal(user.id).catch(() => {});
      // After identifying, push the current subscription id (if we have permission)
      // and wire a listener so future subscription changes auto-sync to the backend.
      syncSubscriptionWithBackend(user.id).catch(() => {});
      // Auto-detect the user's IANA timezone client-side; backend uses it for quiet hours.
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== user.timezone) {
          api.patch("/users/me", { timezone: tz }).catch(() => {});
        }
      } catch { /* noop */ }
      // Send basic tags (debounced via lastTaggedRef so we don't spam on every refresh)
      const sig = `${user.id}:${user.recommendations_count || 0}:${user.followers_count || 0}`;
      if (lastTaggedRef.current !== sig) {
        lastTaggedRef.current = sig;
        setOneSignalTags({
          userId: user.id,
          joinDate: user.created_at,
          recCount: user.recommendations_count || 0,
          cityCount: user.cities_count || 0,
          followerCount: user.followers_count || 0,
          lastActive: new Date().toISOString(),
          impactScore: user.impact_score || 0,
        }).catch(() => {});
      }
    } else if (user === false) {
      logoutOneSignal().catch(() => {});
      lastTaggedRef.current = null;
    }
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, login, register, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
