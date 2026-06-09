import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkCheck } from "lucide-react";

const STORAGE_KEY = "freccos:onboarded";

/* Premium 3-screen onboarding shown once per device. Pure CSS mockups —
   they look like real Freccos surfaces but render fast and don't need
   asset hosting. Dark #1C1C1E background, Cormorant Garamond captions. */
export default function Onboarding() {
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    nav("/login", { replace: true });
  };

  // Swipe gestures (lightweight)
  const [touchStart, setTouchStart] = useState(null);
  const onTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (dx < -50 && idx < 2) setIdx(idx + 1);
    if (dx > 50 && idx > 0) setIdx(idx - 1);
    setTouchStart(null);
  };

  const screens = [
    { Mockup: ScreenOneMock, caption: "Know which friends have been to the places on your bucket list." },
    { Mockup: ScreenTwoMock, caption: "Discover what they genuinely loved and recommend." },
    { Mockup: ScreenThreeMock, caption: "Recommend the places you love so your friends can experience them too." },
  ];
  const current = screens[idx];

  return (
    <div
      data-testid="onboarding"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", inset: 0, background: "#1C1C1E", color: "#fff",
        display: "flex", flexDirection: "column",
        padding: "calc(env(safe-area-inset-top) + 18px) 20px calc(env(safe-area-inset-bottom) + 24px)",
        zIndex: 100,
        fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, letterSpacing: 0.4 }}>Freccos</span>
        <button
          onClick={finish}
          data-testid="onboarding-skip"
          style={{ flex: 1, textAlign: "right", background: "transparent", border: "none", color: "#8E8E93", fontSize: 14, cursor: "pointer", fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          {idx < 2 ? "Skip" : ""}
        </button>
      </div>

      {/* Mockup area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16 }}>
        <div
          key={idx}
          className="ob-mock-in"
          style={{
            width: "100%", maxWidth: 320, aspectRatio: "9 / 14",
            boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
            borderRadius: 28,
            overflow: "hidden",
          }}
        >
          <current.Mockup />
        </div>
      </div>

      {/* Caption */}
      <p style={{
        fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
        textAlign: "center", color: "#fff",
        fontSize: 28, lineHeight: 1.35, fontWeight: 500,
        margin: "26px auto 0", maxWidth: 360,
        letterSpacing: 0.1,
      }}>
        {current.caption}
      </p>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-testid={`onboarding-dot-${i}`}
            style={{
              width: i === idx ? 8 : 6, height: i === idx ? 8 : 6,
              borderRadius: 9999,
              background: i === idx ? "#fff" : "rgba(255,255,255,0.3)",
              transition: "all 200ms ease-out",
            }}
          />
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{ marginTop: 22, display: "flex", justifyContent: idx < 2 ? "flex-end" : "stretch" }}>
        {idx < 2 ? (
          <button
            data-testid="onboarding-next"
            onClick={() => setIdx(idx + 1)}
            className="btn-pill btn-primary"
            style={{ padding: "12px 28px", fontSize: 15, fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Next
          </button>
        ) : (
          <button
            data-testid="onboarding-get-started"
            onClick={finish}
            className="btn-pill btn-primary"
            style={{ width: "100%", padding: "14px 24px", fontSize: 16, fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Get started
          </button>
        )}
      </div>

      <style>{`
        @keyframes obMockIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes obCardFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes obSavePulse { 0% { transform: scale(0.9); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes obCursor { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        .ob-mock-in { animation: obMockIn 300ms ease-out both; }
        .ob-card-1 { animation: obCardFadeIn 350ms ease-out 0ms both; }
        .ob-card-2 { animation: obCardFadeIn 350ms ease-out 150ms both; }
        .ob-card-3 { animation: obCardFadeIn 350ms ease-out 300ms both; }
        .ob-save-pulse { animation: obSavePulse 450ms ease-out 350ms both; }
        .ob-cursor { animation: obCursor 1s steps(1) infinite; }
      `}</style>
    </div>
  );
}

// ---------- Mockup 1: City screen with 3 friend recommendation cards ----------
function ScreenOneMock() {
  const friends = [
    { name: "Priya", initial: "P", place: "Sundowner Cafe", note: "Sunset is unreal here.", color: "#FF9F0A" },
    { name: "Arjun", initial: "A", place: "Mango Reef", note: "Best fresh fish in town.", color: "#BF5AF2" },
    { name: "Sara", initial: "S", place: "Saffronart Studio", note: "Tucked away, totally magical.", color: "#5AC8FA" },
  ];
  return (
    <div style={{ width: "100%", height: "100%", background: "#F2F2F7", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "18px 14px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>🇮🇳 Alibag</div>
        <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>3 friends have been here</div>
      </div>
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        {friends.map((f, i) => (
          <div key={f.name} className={`ob-card-${i + 1}`}
            style={{ background: "#fff", borderRadius: 10, padding: 10, display: "flex", gap: 9, alignItems: "flex-start", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 24, height: 24, borderRadius: 9999, background: f.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: "system-ui" }}>
              {f.initial}
            </div>
            <div style={{ minWidth: 0, flex: 1, fontFamily: "system-ui" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1C1C1E" }}>{f.place}</div>
              <div style={{ fontSize: 9.5, color: "#8E8E93", marginTop: 1 }}>by {f.name}</div>
              <div style={{ fontSize: 10, color: "#3a3a3c", marginTop: 4, lineHeight: 1.35 }}>{f.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Mockup 2: Single beautiful rec card with bookmark animation ----------
function ScreenTwoMock() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div className="ob-card-1" style={{
        width: "100%", background: "#fff", borderRadius: 12, padding: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontFamily: "system-ui",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: 9999, background: "#FF9F0A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>P</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1E" }}>Priya</div>
            <div style={{ fontSize: 9, color: "#8E8E93" }}>2d ago</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: "#1C1C1E" }}>Sundowner Cafe</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F2F2F7", color: "#1C1C1E", fontSize: 9, padding: "2px 7px", borderRadius: 9999, marginTop: 5 }}>
          🇮🇳 <span>Alibag</span>
        </div>
        <p style={{ fontSize: 11, color: "#3a3a3c", lineHeight: 1.4, marginTop: 8 }}>
          The samosas, the chai, that sea view. We came back three days in a row. It is that good.
        </p>
        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: "#0A84FF" }}>Saved by 6 people</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <span className="ob-save-pulse" style={{
            background: "rgba(48,209,88,0.15)", color: "#1B7C2D", border: "1px solid #30D158",
            padding: "5px 11px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <BookmarkCheck size={11} /> Saved
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Mockup 3: Add a Recommendation sheet ----------
function ScreenThreeMock() {
  return (
    <div style={{ width: "100%", height: "100%", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end" }}>
      <div className="ob-card-1" style={{
        width: "100%", background: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: "12px 14px 18px", fontFamily: "system-ui",
      }}>
        <div style={{ width: 32, height: 4, background: "#E5E5EA", borderRadius: 4, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E" }}>Add a recommendation</div>
        <label style={{ display: "block", fontSize: 9, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 10 }}>Place</label>
        <div style={{ background: "#F2F2F7", borderRadius: 8, padding: "8px 10px", marginTop: 4, fontSize: 12, fontWeight: 600, color: "#1C1C1E" }}>
          Sundowner Cafe
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F2F2F7", color: "#1C1C1E", fontSize: 9, padding: "2px 7px", borderRadius: 9999, marginTop: 6 }}>
          🇮🇳 <span>Alibag</span>
        </div>
        <label style={{ display: "block", fontSize: 9, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 12 }}>Note</label>
        <div style={{ background: "#F2F2F7", borderRadius: 8, padding: "8px 10px", marginTop: 4, fontSize: 11, color: "#1C1C1E", lineHeight: 1.45 }}>
          Lovely vibes. 10/10 if you are around<span className="ob-cursor" style={{ color: "#0A84FF", marginLeft: 1 }}>|</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <span style={{ background: "#0A84FF", color: "#fff", padding: "6px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600 }}>
            Post
          </span>
        </div>
      </div>
    </div>
  );
}

export const hasSeenOnboarding = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; }
  catch { return false; }
};
