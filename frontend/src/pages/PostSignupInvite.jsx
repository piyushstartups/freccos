import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { shareInvite } from "../lib/invite";
import { FreccosLogo } from "./Splash";

/* Shown exactly once between signup and the rest of the app.
   Pre-shared state → "Invite your friends" CTA.
   After the share sheet opens (whether or not the user sent) →
   replaces with single "Go to Freccos" CTA. */
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
        minHeight: "100vh", background: "#1C1C1E", color: "#fff",
        display: "flex", flexDirection: "column",
        padding: "calc(env(safe-area-inset-top) + 36px) 24px calc(env(safe-area-inset-bottom) + 28px)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <FreccosLogo size={56} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 360, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
            fontSize: 36, lineHeight: 1.2, fontWeight: 500, color: "#fff",
            margin: 0,
          }}
        >
          Bring your friends to Freccos.
        </h1>
        <p style={{ color: "#8E8E93", fontSize: 15, lineHeight: 1.5, marginTop: 14 }}>
          Their recommendations will appear here when they join.
        </p>
      </div>

      <div style={{ paddingBottom: 6 }}>
        {!shared ? (
          <>
            <button
              data-testid="post-signup-invite-share"
              onClick={handleShare}
              className="btn-pill btn-primary"
              style={{ width: "100%", padding: "14px 24px", fontSize: 16, fontWeight: 600 }}
            >
              Invite your friends
            </button>
            <button
              data-testid="post-signup-invite-skip"
              onClick={onDone}
              style={{
                marginTop: 14, background: "transparent", border: "none",
                color: "#8E8E93", fontSize: 14, cursor: "pointer", width: "100%",
              }}
            >
              Skip for now
            </button>
          </>
        ) : (
          <button
            data-testid="post-signup-invite-done"
            onClick={onDone}
            className="btn-pill btn-primary"
            style={{ width: "100%", padding: "14px 24px", fontSize: 16, fontWeight: 600 }}
          >
            Go to Freccos
          </button>
        )}
      </div>
    </div>
  );
}
