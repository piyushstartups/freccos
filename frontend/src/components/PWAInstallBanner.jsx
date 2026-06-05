import React, { useEffect, useState } from "react";

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("freccos.installPromptDismissed") === "1") return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // Show on iOS Safari or modern mobile
    if (isIOS || /Android/.test(navigator.userAgent)) {
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);
  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem("freccos.installPromptDismissed", "1");
    setShow(false);
  };
  return (
    <div className="install-banner" data-testid="pwa-install-banner">
      <div style={{ flex: 1 }}>
        Add Freccos to your home screen for the best experience.
      </div>
      <button
        onClick={dismiss}
        data-testid="pwa-dismiss"
        style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 8, fontSize: 12 }}
      >
        Got it
      </button>
    </div>
  );
}
