import React from "react";
import { FreccosLogo } from "../pages/Splash";

export default function HeaderBrand({ title, subtitle, children }) {
  return (
    <div style={{ background: "#1C1C1E", color: "#fff", padding: "40px 16px 18px" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <FreccosLogo size={22} />
        <span className="t-label" style={{ color: "#8E8E93", letterSpacing: 1.2 }}>FRECCOS</span>
      </div>
      {title && <h1 className="t-large" style={{ color: "#fff" }}>{title}</h1>}
      {subtitle && <p className="t-sub" style={{ color: "#8E8E93" }}>{subtitle}</p>}
      {children}
    </div>
  );
}
