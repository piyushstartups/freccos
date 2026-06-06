import React from "react";

// The Freccos wordmark — premium editorial serif, NOT italic. Used on splash, login
// and the Explore header. This is the brand moment.
export default function Wordmark({ size = 36, color = "#1C1C1E", className = "", style = {} }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: 1.2,
        lineHeight: 1,
        color,
        display: "inline-block",
        ...style,
      }}
    >
      Freccos
    </span>
  );
}
