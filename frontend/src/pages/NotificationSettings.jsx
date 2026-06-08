import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import EnableNotificationsCard from "../components/EnableNotificationsCard";
import { getPushState } from "../lib/onesignal";
import { toast } from "sonner";

const GROUP_LABELS = {
  social: "Social",
  activity: "Activity",
  impact: "Impact",
};

export default function NotificationSettings() {
  const nav = useNavigate();
  const [prefs, setPrefs] = useState(null);
  const [meta, setMeta] = useState(null);  // { groups: {social:[{key,label}], ...} }
  const [pushState, setPushState] = useState(null);

  const load = async () => {
    const [{ data }, push] = await Promise.all([
      api.get("/users/me/notification-prefs"),
      getPushState(),
    ]);
    setPrefs(data.preferences);
    setMeta({ groups: data.groups });
    setPushState(push);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await api.patch("/users/me/notification-prefs", { preferences: { [key]: value } });
    } catch {
      toast.error("Couldn't save");
      load();
    }
  };

  if (!prefs || !meta) return <div className="p-6 t-sub muted">Loading...</div>;

  const groups = meta.groups || {};
  const allOn = pushState?.permission === "granted";

  return (
    <div data-testid="notification-settings" style={{ minHeight: "100vh", background: "#F2F2F7", paddingBottom: 60 }}>
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "calc(var(--safe-area-top) + 16px) 16px 18px" }}>
        <button onClick={() => nav(-1)} style={{ background: "transparent", border: "none", color: "#0A84FF", display: "inline-flex", alignItems: "center", gap: 4, padding: 0, fontSize: 15, cursor: "pointer" }}>
          <ChevronLeft size={18} /> Settings
        </button>
        <h1 className="t-large mt-3" style={{ color: "#fff", fontSize: 26 }}>Notifications</h1>
      </div>

      {!allOn && (
        <div style={{ padding: 16 }}>
          <EnableNotificationsCard variant="card" onEnabled={load} />
        </div>
      )}
      {allOn && (
        <div style={{ padding: "16px 16px 8px" }}>
          <div className="ios-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#30D158" }} />
            <span className="t-title3" style={{ fontSize: 14 }}>Notifications are on</span>
          </div>
        </div>
      )}

      {["social", "activity", "impact"].map((groupKey) => {
        const items = groups[groupKey] || [];
        if (!items.length) return null;
        return (
          <div key={groupKey} style={{ padding: "16px 16px 0" }}>
            <div className="t-cap muted" style={{ textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, fontSize: 11 }}>
              {GROUP_LABELS[groupKey]}
            </div>
            <div className="ios-card" style={{ padding: 0, background: "#fff", borderRadius: 12, overflow: "hidden" }}>
              {items.map((it, idx) => (
                <Row
                  key={it.key}
                  last={idx === items.length - 1}
                  testId={`notif-toggle-${it.key}`}
                  label={it.label}
                  value={!!prefs[it.key]}
                  onChange={(v) => toggle(it.key, v)}
                  disabled={!allOn}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, onChange, last, testId, disabled }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid #E5E5EA",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span className="t-body" style={{ fontSize: 15, color: "#1C1C1E", flex: 1, paddingRight: 12 }}>{label}</span>
      <button
        data-testid={testId}
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          width: 50, height: 30, borderRadius: 9999, border: "none",
          background: value ? "#30D158" : "#E5E5EA",
          position: "relative", cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 200ms",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: value ? 22 : 2,
          width: 26, height: 26, borderRadius: 9999,
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 200ms",
        }} />
      </button>
    </div>
  );
}
