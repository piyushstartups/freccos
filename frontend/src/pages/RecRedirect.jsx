import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";

// Resolves /r/:recId → /city/:cityId?rec=:recId so push notification taps
// land directly on the rich place card. If the rec can't be resolved, fall
// back to Explore.
export default function RecRedirect() {
  const { recId } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/r/${recId}`);
        if (cancelled) return;
        if (data?.city_id) nav(`/city/${data.city_id}?rec=${recId}`, { replace: true });
        else nav("/explore", { replace: true });
      } catch {
        if (!cancelled) nav("/explore", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [recId, nav]);
  return (
    <div className="frec-shell flex items-center justify-center" style={{ minHeight: "100vh" }}>
      <p className="muted">Opening…</p>
    </div>
  );
}
