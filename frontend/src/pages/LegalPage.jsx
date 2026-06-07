import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Wordmark from "../components/Wordmark";

// Lightweight placeholder for /privacy and /terms. Public route, no auth required.
export default function LegalPage({ title, testId }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F2F2F7" }} data-testid={testId || "legal-page"}>
      <div
        style={{
          background: "#1C1C1E",
          color: "#fff",
          padding: "calc(var(--safe-area-top) + 16px) 16px 18px",
        }}
      >
        <Link
          to="/login"
          style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 15 }}
          data-testid="legal-back"
        >
          <ChevronLeft size={18} /> Back
        </Link>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <Wordmark size={26} color="#fff" />
        </div>
      </div>
      <div style={{ padding: "32px 24px", maxWidth: 560, margin: "0 auto" }}>
        <h1 className="t-title1" style={{ marginTop: 12 }}>{title}</h1>
        <p className="t-body muted" style={{ marginTop: 16, lineHeight: 1.5 }}>
          Coming soon, please check back shortly.
        </p>
        <p className="t-sub muted" style={{ marginTop: 24, lineHeight: 1.5 }}>
          We're putting the finishing touches on our {title.toLowerCase()}. In the meantime, if you have questions, drop us a note at <a href="mailto:hello@freccos.com" style={{ color: "#0A84FF", textDecoration: "none" }}>hello@freccos.com</a>.
        </p>
      </div>
    </div>
  );
}
