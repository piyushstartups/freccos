import React from "react";

// The Freccos wordmark — Vogue-style serif masthead.
// Always rendered in the imported Google Font (Cormorant Garamond / Playfair Display),
// semibold 600, with generous letter-spacing for an editorial feel.
export default function Wordmark({ size = 42, color = "#fff", weight = 500, className = "", style = {} }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif",
        fontWeight: weight,
        fontSize: size,
        letterSpacing: "-1px",
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
