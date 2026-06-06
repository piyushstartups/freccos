import React, { useEffect } from "react";

// Reliable in-app confirmation dialog. Replaces window.confirm which is
// suppressed in some standalone/PWA contexts. Uses fixed positioning + a
// raw overlay so it works regardless of router/portal state.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
  testId = "confirm-dialog",
}) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 12000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 320, background: "#fff", borderRadius: 14,
          padding: "20px 20px 12px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          textAlign: "center",
        }}
      >
        {title && (
          <div style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1E", marginBottom: 6 }}>
            {title}
          </div>
        )}
        {message && (
          <div style={{ fontSize: 13, color: "#3a3a3c", lineHeight: 1.4, marginBottom: 18 }}>
            {message}
          </div>
        )}
        <div style={{ display: "flex", borderTop: "1px solid #E5E5EA", margin: "0 -20px -12px" }}>
          <button
            data-testid={`${testId}-cancel`}
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px 0", background: "transparent", border: "none",
              color: "#0A84FF", fontSize: 16, fontWeight: 500, cursor: "pointer",
              borderRight: "1px solid #E5E5EA",
            }}
          >
            {cancelLabel}
          </button>
          <button
            data-testid={`${testId}-confirm`}
            onClick={onConfirm}
            style={{
              flex: 1, padding: "12px 0", background: "transparent", border: "none",
              color: destructive ? "#FF453A" : "#0A84FF", fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
