import React from "react";
import Avatar from "./Avatar";

export default function StackedAvatars({ users = [], size = 28, max = 3 }) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <span className="stack-avatars" style={{ verticalAlign: "middle" }}>
      {visible.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className="avatar"
          style={{
            width: size, height: size,
            background: "#E5E5EA", color: "#3a3a3c",
            fontSize: Math.max(10, Math.round(size * 0.34)),
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
