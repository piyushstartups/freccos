import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { shareInvite } from "../lib/invite";

/* Shown exactly once between signup and the rest of the app.
   Pre-shared state → "Invite your friends" CTA.
   After the share sheet opens (whether or not the user sent) →
   replaces with a single "Go to Freccos" CTA. Mobile-first 390px. */
export default function PostSignupInvite({ onDone }) {
  const { user } = useAuth();
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    await shareInvite({ code: user?.invite_code, surface: "post_signup" });
    // Regardless of whether the user sent or cancelled, swap the CTA.
    setShared(true);
  };

  return (
    <div
      data-testid="post-signup-invite"
      style={{
        position: "fixed", inset: 0,
        background: "#1C1C1E",
        display: "flex",
        justifyContent: "center",
        zIndex: 100,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          paddingTop: "calc(env(safe-area-inset-top) + 28px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {/* Spacer — pushes logo into upper area */}
        <div style={{ flex: "0 0 6%" }} />

        {/* Logo mark — 56x56 rounded square */}
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

        {/* Heading + subtext */}
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              fontSize: 28,
              fontWeight: 600,
              color: "#fff",
              margin: 0,
              letterSpacing: "-0.4px",
              lineHeight: 1.25,
            }}
          >
            Your people are waiting.
          </h1>
          <p
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 400,
              color: "#8E8E93",
              margin: "12px auto 0",
              maxWidth: 280,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Invite your friends to Freccos and see what they recommend.
          </p>
        </div>

        {/* Large flexible space */}
        <div style={{ flex: 1 }} />

        {/* CTA — centred pill */}
        {!shared ? (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                data-testid="post-signup-invite-share"
                onClick={handleShare}
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
                }}
              >
                Invite your friends
              </button>
            </div>
            <button
              data-testid="post-signup-invite-skip"
              onClick={onDone}
              style={{
                marginTop: 16,
                background: "transparent",
                border: "none",
                color: "#8E8E93",
                fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                fontSize: 15,
                cursor: "pointer",
                width: "100%",
                textAlign: "center",
              }}
            >
              Skip for now
            </button>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              data-testid="post-signup-invite-done"
              onClick={onDone}
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
              }}
            >
              Go to Freccos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
