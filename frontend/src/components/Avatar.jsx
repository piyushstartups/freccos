import React from "react";
import { initials, tintForId, photoUrl } from "../lib/utils-frec";

export default function Avatar({ user, size = 36, className = "", style = {} }) {
  const id = user?.id || user?.name || "0";
  const tint = tintForId(id);
  const pic = photoUrl(user?.profile_photo_url);
  const sz = typeof size === "number" ? `${size}px` : size;
  const styleObj = {
    width: sz,
    height: sz,
    fontSize: typeof size === "number" ? Math.max(11, Math.round(size * 0.38)) + "px" : "13px",
    background: pic ? `url('${pic}')` : tint.bg,
    color: tint.color,
    backgroundSize: "cover",
    backgroundPosition: "center",
    ...style,
  };
  return (
    <span className={`avatar ${className}`} style={styleObj}>
      {!pic && initials(user?.name || "?")}
    </span>
  );
}
