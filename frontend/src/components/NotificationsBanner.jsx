import React, { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPushState, requestPushPermission, isWebPushSupported, isIosWebPushBlocked } from "../lib/onesignal";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { track, Events } from "../lib/analytics";

/**
 * Slim banner shown above the Explore feed for existing users who haven't
 * been prompted yet about notifications. Dismissed permanently per-user
 * via `notifications_seen` flag on the User record.
 */
export default function NotificationsBanner() {
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [state, setState] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => { getPushState().then(setState); }, []);

  if (hidden) return null;
  if (!user || user === false) return null;
  if (user.notifications_seen) return null;
  if (!isWebPushSupported()) return null;
  if (!state) return null;
  if (state.permission === "granted" || state.permission === "denied") return null;
  // iOS Safari (non-PWA) can't subscribe at all — never show the banner there
  if (isIosWebPushBlocked()) return null;

  const onTurnOn = async () => {
    const p = await requestPushPermission();
    setState((s) => ({ ...s, permission: p }));
    track(Events.NOTIFICATIONS_PERMISSION_REQUESTED, { result: p, source: "banner" });
    if (p === "granted") {
      await api.patch("/users/me/notification-prefs", { notifications_seen: true }).catch(() => {});
      await refresh?.();
      toast.success("Notifications are on");
    }
  };
  const onDismiss = async () => {
    setHidden(true);
    track(Events.NOTIFICATIONS_BANNER_DISMISSED);
    await api.patch("/users/me/notification-prefs", { notifications_seen: true }).catch(() => {});
    await refresh?.();
  };

  return (
    <div
      data-testid="notifications-banner"
      className="ios-card"
      style={{
        margin: "8px 16px 12px",
        padding: "12px 14px",
        background: "rgba(10,132,255,0.07)",
        border: "1px solid rgba(10,132,255,0.18)",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9999,
        background: "rgba(10,132,255,0.16)", color: "#0A84FF",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Bell size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title3" style={{ fontSize: 13, color: "#0A84FF" }}>New</div>
        <div className="t-sub" style={{ fontSize: 13, color: "#1C1C1E", lineHeight: 1.35 }}>
          Get notified when your friends add places.
        </div>
      </div>
      <button
        data-testid="notifications-banner-cta"
        onClick={onTurnOn}
        className="btn-pill"
        style={{ background: "#0A84FF", color: "#fff", padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
      >
        Turn on
      </button>
      <button
        data-testid="notifications-banner-dismiss"
        onClick={onDismiss}
        style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4, flexShrink: 0 }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
