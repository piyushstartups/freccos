import React from "react";

export default function Wordmark({ size = 30, color = "#1C1C1E", className = "", style = {} }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -0.5,
        lineHeight: 1,
        color,
        fontStyle: "italic",
        display: "inline-block",
        ...style,
      }}
    >
      Freccos
    </span>
  );
}
