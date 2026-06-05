import React, { useEffect, useState } from "react";
import { Share, Plus, X, Smartphone, ArrowDown } from "lucide-react";
import { FreccosLogo } from "../pages/Splash";

const DISMISS_KEY = "freccos.installPromptDismissedAt";
// Re-show after 7 days if dismissed (not "never" remind, just stop pestering)
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function PWAInstallBanner() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("other"); // 'ios' | 'android' | 'other'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / running standalone?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Recently dismissed?
    const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    if (dismissedAt && Date.now() - dismissedAt < REPROMPT_AFTER_MS) return;

    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "other");

    // Capture native install prompt (Chrome / Edge / Android)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari doesn't fire beforeinstallprompt — open the sheet on a delay
    // so the user sees the app first, then gets the soft pitch.
    let timer;
    if (isIOS) {
      timer = setTimeout(() => setOpen(true), 1600);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Also expose a global so the Profile page (or anywhere else) could re-trigger this
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.freccosShowInstall = () => setOpen(true);
    return () => { delete window.freccosShowInstall; };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + REPROMPT_AFTER_MS * 10));
      }
      setDeferredPrompt(null);
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={dismiss}
        data-testid="pwa-install-backdrop"
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 10010,
          animation: "fadeIn 200ms ease-out",
        }}
      />
      <div
        className="ios-card"
        data-testid="pwa-install-sheet"
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 20,
          width: "calc(100% - 24px)",
          maxWidth: 406,
          padding: "20px 18px 22px",
          zIndex: 10011,
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
          animation: "sheetUp 280ms cubic-bezier(0.2,0.9,0.3,1.1)",
        }}
      >
        <button
          onClick={dismiss}
          data-testid="pwa-install-close"
          style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(120,120,128,0.12)", border: "none",
            borderRadius: 9999, padding: 6, color: "#3a3a3c",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <FreccosLogo size={44} />
          <div>
            <div className="t-title2">Add Freccos to your home screen</div>
            <div className="t-cap muted">Open it like a real app — no browser bar.</div>
          </div>
        </div>

        {platform === "ios" && (
          <IosInstructions />
        )}

        {platform === "android" && deferredPrompt && (
          <AndroidNativePrompt onInstall={handleNativeInstall} installing={installing} />
        )}

        {platform === "android" && !deferredPrompt && (
          <AndroidFallbackInstructions />
        )}

        {platform === "other" && deferredPrompt && (
          <AndroidNativePrompt onInstall={handleNativeInstall} installing={installing} />
        )}

        {platform === "other" && !deferredPrompt && (
          <DesktopFallbackInstructions />
        )}

        <button
          data-testid="pwa-install-later"
          onClick={dismiss}
          className="btn-pill w-full mt-4"
          style={{ background: "rgba(120,120,128,0.12)", color: "#1C1C1E" }}
        >
          Maybe later
        </button>
      </div>
    </>
  );
}

function StepRow({ icon, label }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "10px 12px", background: "rgba(120,120,128,0.08)", borderRadius: 12 }}>
      <div style={{ flexShrink: 0, color: "#0A84FF" }}>{icon}</div>
      <div className="t-sub" style={{ flex: 1 }}>{label}</div>
    </div>
  );
}

function IosInstructions() {
  return (
    <div className="space-y-2 mt-1">
      <StepRow
        icon={<Share size={18} />}
        label={<>Tap the <strong>Share</strong> icon in Safari's toolbar</>}
      />
      <StepRow
        icon={<Plus size={18} />}
        label={<>Choose <strong>Add to Home Screen</strong></>}
      />
      <StepRow
        icon={<Smartphone size={18} />}
        label={<>Tap <strong>Add</strong> — Freccos lives on your home screen.</>}
      />
    </div>
  );
}

function AndroidNativePrompt({ onInstall, installing }) {
  return (
    <>
      <p className="t-sub muted mt-1">One tap and you're done.</p>
      <button
        data-testid="pwa-install-now"
        onClick={onInstall}
        disabled={installing}
        className="btn-pill btn-primary w-full mt-3"
      >
        <ArrowDown size={16} />
        {installing ? "Installing..." : "Install Freccos"}
      </button>
    </>
  );
}

function AndroidFallbackInstructions() {
  return (
    <div className="space-y-2 mt-1">
      <StepRow
        icon={<MoreIcon />}
        label={<>Tap the <strong>⋮</strong> menu in Chrome (top right)</>}
      />
      <StepRow
        icon={<Plus size={18} />}
        label={<>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong></>}
      />
    </div>
  );
}

function DesktopFallbackInstructions() {
  return (
    <div className="space-y-2 mt-1">
      <StepRow
        icon={<Plus size={18} />}
        label="Click the install icon in your browser's address bar"
      />
      <StepRow
        icon={<Smartphone size={18} />}
        label="Or open Freccos on your phone for the full experience"
      />
    </div>
  );
}

function MoreIcon() {
  // Vertical dots ⋮
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
