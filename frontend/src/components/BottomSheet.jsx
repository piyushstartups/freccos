import React, { useEffect } from "react";

export default function BottomSheet({ open, onClose, title, children, testId = "bottom-sheet" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} data-testid={`${testId}-backdrop`} />
      <div className="sheet-panel" data-testid={testId} role="dialog" aria-modal>
        <div className="sheet-grabber" />
        {title && (
          <div className="px-4 pt-1 pb-2 flex items-center justify-between">
            <h2 className="t-title2">{title}</h2>
            <button
              onClick={onClose}
              data-testid={`${testId}-close`}
              className="text-[15px]"
              style={{ color: "#0A84FF", background: "transparent", border: "none", padding: 6 }}
            >
              Close
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </>
  );
}
