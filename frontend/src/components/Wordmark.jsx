import React from "react";

// The Freccos wordmark — Vogue-style serif masthead.
// Always rendered in the imported Google Font (Cormorant Garamond / Playfair Display),
// semibold 600, with generous letter-spacing for an editorial feel.
export default function Wordmark({ size = 38, color = "#fff", className = "", style = {} }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "2px",
        lineHeight: 1,
        color,
        display: "inline-block",
        fontFeatureSettings: '"liga" 1, "kern" 1',
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        ...style,
      }}
    >
      Freccos
    </span>
  );
}
