import React from "react";
import { FreccosLogo } from "../pages/Splash";

export default function HeaderBrand({ title, subtitle, children }) {
  return (
    <div style={{ background: "#1C1C1E", color: "#fff", padding: "36px 16px 18px" }}>
      <div style={{ marginBottom: 8 }}>
        <FreccosLogo size={32} />
      </div>
      {title && <h1 className="t-large" style={{ color: "#fff" }}>{title}</h1>}
      {subtitle && <p className="t-sub" style={{ color: "#8E8E93" }}>{subtitle}</p>}
      {children}
    </div>
  );
}
