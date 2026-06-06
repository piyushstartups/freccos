import React from "react";

// Standard iOS-style page header used across every page EXCEPT Explore.
// - Dark #1C1C1E background
// - Left-aligned large bold title (28px) in white
// - Optional left-aligned secondary subtitle in #8E8E93
// - No logos, no decorative elements
// - Optional `right` slot for a single trailing icon (e.g. bell, settings gear)
// - Optional `left` slot for a back button
export default function PageHeader({ title, subtitle, left, right, children, padTop = 28 }) {
  return (
    <div
      style={{
        background: "#1C1C1E",
        color: "#fff",
        padding: `${padTop}px 16px 18px`,
        position: "relative",
      }}
    >
      {left && (
        <div style={{ marginBottom: 6 }}>{left}</div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <h1
              style={{
                color: "#fff",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.4px",
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              style={{
                color: "#8E8E93",
                fontSize: 14,
                lineHeight: 1.3,
                margin: "6px 0 0",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {right && (
          <div style={{ flexShrink: 0, marginTop: 2 }}>{right}</div>
        )}
      </div>
      {children}
    </div>
  );
}
