import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "freccos:onboarded";

/* Mobile-first onboarding shown once per device.
   Screen order: Landing → Insight 1 → Insight 2 → Insight 3 → /login.
   Pure dark layout. Cormorant Garamond is ONLY used for the "Freccos"
   wordmark on the landing screen. Everything else uses -apple-system. */
export default function Onboarding() {
  const nav = useNavigate();
  const [idx, setIdx] = useState(0); // 0 = landing, 1..3 = insight screens

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    nav("/login", { replace: true });
  };

  // Swipe between insight screens (1..3) only.
  const [touchStart, setTouchStart] = useState(null);
  const onTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStart == null || idx === 0) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (dx < -50 && idx < 3) setIdx(idx + 1);
    if (dx > 50 && idx > 1) setIdx(idx - 1);
    setTouchStart(null);
  };

  const insights = [
    "Know which friends have been to the places on your bucket list.",
    "Discover what they genuinely loved and recommend.",
    "Recommend the places you love so your friends can experience them too.",
  ];

  return (
    <div
      data-testid="onboarding"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", inset: 0,
        background: "#1C1C1E",
        display: "flex",
        justifyContent: "center",
        zIndex: 100,
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Mobile-first container — caps at 390px even on desktop */}
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: "100%",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          paddingTop: "calc(env(safe-area-inset-top) + 18px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
          paddingLeft: 24,
          paddingRight: 24,
          position: "relative",
        }}
      >
        {idx === 0 ? (
          <LandingScreen onStart={() => setIdx(1)} />
        ) : (
          <InsightScreen
            key={idx}
            screen={idx}
            text={insights[idx - 1]}
            onNext={() => (idx < 3 ? setIdx(idx + 1) : finish())}
            onSkip={finish}
          />
        )}
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .ob-fade { animation: fadeSlide 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both; }
        .ob-cta:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

/* ───────────────────────── Landing ───────────────────────── */
function LandingScreen({ onStart }) {
  return (
    <div className="ob-fade" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Spacer — pushes the brand block into upper third */}
      <div style={{ flex: "0 0 18%" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img
          src="/freccos-logo.png"
          alt="Freccos"
          width={80}
          height={80}
          style={{ display: "block", borderRadius: 18 }}
        />
        <h1
          data-testid="onboarding-wordmark"
          style={{
            fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
            fontSize: 32,
            fontWeight: 600,
            color: "#fff",
            margin: "20px 0 0",
            letterSpacing: 0.4,
            lineHeight: 1,
          }}
        >
          Freccos
        </h1>
        <p
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontSize: 16,
            color: "#8E8E93",
            margin: "12px 0 0",
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          Discover the world through your people.
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <button
        data-testid="onboarding-get-started"
        onClick={onStart}
        className="ob-cta"
        style={{
          width: "100%",
          height: 48,
          borderRadius: 9999,
          background: "#0A84FF",
          color: "#fff",
          border: "none",
          fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          transition: "transform 150ms ease-out",
        }}
      >
        Get started
      </button>
    </div>
  );
}

/* ───────────────────── Insight screens (1..3) ───────────────────── */
function InsightScreen({ screen, text, onNext, onSkip }) {
  const isLast = screen === 3;
  const ctaLabel = isLast ? "Get started" : "Next";
  return (
    <div className="ob-fade" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Top row: Skip aligned right */}
      <div style={{ display: "flex", justifyContent: "flex-end", height: 22 }}>
        <button
          data-testid="onboarding-skip"
          onClick={onSkip}
          style={{
            background: "transparent",
            border: "none",
            color: "#8E8E93",
            fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontSize: 15,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Skip
        </button>
      </div>

      {/* Spacer to push logo into upper quarter */}
      <div style={{ flex: "0 0 8%" }} />

      {/* Logo mark — 56x56 with rounded-square container */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 14,
            background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <img src="/freccos-logo.png" alt="" width={56} height={56} style={{ display: "block", borderRadius: 14 }} />
        </div>
      </div>

      {/* Insight text — vertically centred in remaining space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          data-testid={`onboarding-insight-${screen}`}
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 400,
            color: "#FFFFFF",
            lineHeight: 1.45,
            letterSpacing: "-0.3px",
            textAlign: "center",
            margin: 0,
            maxWidth: 280,
          }}
        >
          {text}
        </p>
      </div>

      {/* Dots — 6px, 8px gap */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map((i) => {
          const active = i === screen;
          return (
            <span
              key={i}
              data-testid={`onboarding-dot-${i}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                background: active ? "#FFFFFF" : "#8E8E93",
                opacity: active ? 1 : 0.4,
                transition: "all 200ms ease-out",
                display: "inline-block",
              }}
            />
          );
        })}
      </div>

      {/* CTA — centred pill, auto width, NOT full width */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          data-testid={isLast ? "onboarding-finish" : "onboarding-next"}
          onClick={onNext}
          className="ob-cta"
          style={{
            height: 50,
            padding: "0 32px",
            borderRadius: 9999,
            background: "#0A84FF",
            color: "#fff",
            border: "none",
            fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            transition: "transform 280ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

export const hasSeenOnboarding = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; }
  catch { return false; }
};
