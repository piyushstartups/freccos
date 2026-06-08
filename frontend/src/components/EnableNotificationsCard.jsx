import React, { useEffect, useState } from "react";
import { Bell, ShieldCheck, Share, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  requestPushPermission, getPushState, isIos, isIosWebPushBlocked,
  isWebPushSupported,
} from "../lib/onesignal";
import { track, Events } from "../lib/analytics";
import api from "../lib/api";

/**
 * Reusable card used in two places:
 *  - Onboarding step 4: full-screen, large layout
 *  - Settings: prominent "you're missing out" card when notifications are off
 *
 * Handles iOS Safari (non-PWA) gracefully by showing Add-to-Home-Screen
 * instructions instead of an unusable "Turn on" button.
 */
export default function EnableNotificationsCard({
  variant = "card",      // "card" | "onboarding"
  onEnabled,             // called after permission grant
  onSkip,                // called when user taps "Maybe later"
}) {
  const [state, setState] = useState(null);
  const [working, setWorking] = useState(false);

  const refresh = async () => { setState(await getPushState()); };
  useEffect(() => { refresh(); }, []);

  const supported = isWebPushSupported();
  const iosBlocked = isIosWebPushBlocked();

  const onEnable = async () => {
    setWorking(true);
    try {
      const permission = await requestPushPermission();
      await refresh();
      track(Events.NOTIFICATIONS_PERMISSION_REQUESTED, { result: permission });
      if (permission === "granted") {
        // Persist a flag server-side so the existing-user banner stops nagging
        try { await api.patch("/users/me/notification-prefs", { notifications_seen: true }); } catch { /* noop */ }
        toast.success("Notifications are on");
        onEnabled?.();
      } else if (permission === "denied") {
        toast("Notifications blocked. Change it in your browser settings.");
      }
    } finally { setWorking(false); }
  };

  // Pad on standalone full-screen layouts
  const wrapStyle = variant === "onboarding"
    ? { padding: "calc(var(--safe-area-top) + 56px) 28px 32px", minHeight: "100vh", background: "#F2F2F7" }
    : { padding: 20, background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };

  return (
    <div style={wrapStyle} data-testid={`enable-notifs-${variant}`}>
      <div style={{ display: "flex", justifyContent: variant === "onboarding" ? "center" : "flex-start", marginBottom: 16 }}>
        <div style={{
          width: variant === "onboarding" ? 72 : 44,
          height: variant === "onboarding" ? 72 : 44,
          borderRadius: 9999, background: "rgba(10,132,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#0A84FF",
        }}>
          <Bell size={variant === "onboarding" ? 32 : 22} />
        </div>
      </div>
      <h2 className="t-title1" style={{
        textAlign: variant === "onboarding" ? "center" : "left",
        marginTop: variant === "onboarding" ? 20 : 0,
        fontSize: variant === "onboarding" ? 26 : 18,
      }}>
        {variant === "onboarding" ? "Stay in the loop" : "You're missing out"}
      </h2>
      <p className="t-body muted" style={{
        textAlign: variant === "onboarding" ? "center" : "left",
        marginTop: 8, lineHeight: 1.5,
        maxWidth: variant === "onboarding" ? 320 : "auto",
        marginLeft: variant === "onboarding" ? "auto" : 0,
        marginRight: variant === "onboarding" ? "auto" : 0,
      }}>
        {variant === "onboarding"
          ? "Get notified when your friends add new recommendations, follow you, or plan trips."
          : "Turn on notifications to know when your friends add new recs."}
      </p>

      {/* iOS Safari + non-standalone: show Add-to-Home-Screen instructions */}
      {supported && iosBlocked && (
        <div style={{
          marginTop: 20, padding: 16, background: "rgba(10,132,255,0.06)",
          borderRadius: 12, border: "1px solid rgba(10,132,255,0.18)",
        }}>
          <div className="t-title3" style={{ fontSize: 14 }}>
            <ShieldCheck size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
            Add Freccos to your home screen first
          </div>
          <ol className="t-sub" style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Tap the <Share size={14} style={{ verticalAlign: -2 }} /> share icon in Safari.</li>
            <li>Choose &ldquo;Add to Home Screen&rdquo; <Plus size={14} style={{ verticalAlign: -2 }} />.</li>
            <li>Open Freccos from the home screen and come back here.</li>
          </ol>
        </div>
      )}

      {!supported && (
        <p className="t-sub muted" style={{ marginTop: 16 }}>
          This browser doesn&apos;t support push notifications. Open Freccos in Chrome, Edge, Firefox, or Safari 16.4+ (PWA).
        </p>
      )}

      {state?.permission === "granted" && (
        <p className="t-sub" style={{ color: "#30D158", marginTop: 16 }}>
          ✓ Notifications are on
        </p>
      )}

      {/* Action buttons */}
      {supported && !iosBlocked && state?.permission !== "granted" && (
        <button
          data-testid="enable-notifs-cta"
          onClick={onEnable}
          disabled={working || state?.permission === "denied"}
          className="btn-pill btn-primary"
          style={{ width: "100%", marginTop: 20, padding: "12px 18px" }}
        >
          {state?.permission === "denied" ? "Blocked in browser" : "Turn on notifications"}
        </button>
      )}

      {variant === "onboarding" && (
        <button
          data-testid="enable-notifs-skip"
          onClick={onSkip}
          className="t-sub muted"
          style={{ background: "transparent", border: "none", padding: 12, marginTop: 14, width: "100%", cursor: "pointer", color: "#8E8E93" }}
        >
          Maybe later
        </button>
      )}

      {variant === "onboarding" && isIos() && !iosBlocked && (
        <p className="t-cap muted" style={{ textAlign: "center", marginTop: 12, color: "#C7C7CC" }}>
          Looks like Freccos is on your home screen. Tap above to enable.
        </p>
      )}
    </div>
  );
}
