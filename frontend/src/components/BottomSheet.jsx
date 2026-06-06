import React, { useEffect, useRef, useState } from "react";

// iOS-style bottom sheet with native drag-to-dismiss. Pure CSS + touch math —
// no animation library. Pointer events cover touch + mouse + pen uniformly.
//
// Behaviour:
// - Tap backdrop dismisses
// - Drag handle / sheet body downwards: panel follows finger 1:1
// - On release: if dragged > 80px OR flick velocity > 0.7px/ms → dismiss
//               otherwise spring back to fully open
// - Upward drag is clamped (no rubber-band over the top)
export default function BottomSheet({ open, onClose, title, children, testId = "bottom-sheet", dragToDismiss = true }) {
  const panelRef = useRef(null);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0); // px the sheet is shifted down

  // Esc key + body scroll lock
  useEffect(() => {
    if (!open) { setOffset(0); return; }
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Only start dragging if the touch begins at the top of the sheet (drag handle
  // or near it). If the user is scrolling inside the sheet body, we don't hijack.
  const shouldStartDrag = (target) => {
    const panel = panelRef.current;
    if (!panel) return false;
    // Always allow drag from the grabber/header strip
    if (target.closest?.('[data-drag-handle="true"]')) return true;
    // Otherwise only when the inner scroller is at the top
    return panel.scrollTop <= 0;
  };

  const onPointerDown = (e) => {
    if (!dragToDismiss) return;
    if (!shouldStartDrag(e.target)) return;
    dragging.current = true;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = performance.now();
    velocity.current = 0;
  };

  const onPointerMove = (e) => {
    if (!dragToDismiss) return;
    if (!dragging.current) return;
    const now = performance.now();
    const dy = e.clientY - lastY.current;
    const dt = Math.max(1, now - lastT.current);
    velocity.current = dy / dt;
    lastY.current = e.clientY;
    lastT.current = now;
    const total = Math.max(0, e.clientY - startY.current);
    setOffset(total);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldDismiss = offset > 80 || velocity.current > 0.7;
    if (shouldDismiss) {
      // Animate offscreen then close
      setOffset(window.innerHeight);
      setTimeout(() => { onClose?.(); setOffset(0); }, 200);
    } else {
      setOffset(0);
    }
  };

  if (!open) return null;

  const panelStyle = {
    transform: `translate(-50%, ${offset}px)`,
    transition: dragging.current ? "none" : "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    touchAction: "pan-y",
  };

  // Backdrop fades as the user drags down
  const backdropOpacity = Math.max(0.05, 0.4 - offset / 800);

  return (
    <>
      <div
        className="sheet-backdrop"
        onClick={onClose}
        data-testid={`${testId}-backdrop`}
        style={{ background: `rgba(0,0,0,${backdropOpacity})` }}
      />
      <div
        ref={panelRef}
        className="sheet-panel"
        data-testid={testId}
        role="dialog"
        aria-modal
        style={panelStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {/* Drag handle — only shown when drag-to-dismiss is enabled */}
        {dragToDismiss && (
          <div data-drag-handle="true" style={{ padding: "2px 0 4px", cursor: "grab" }}>
            <div className="sheet-grabber" />
          </div>
        )}
        {title && (
          <div className="px-4 pt-1 pb-2 flex items-center justify-between" data-drag-handle="true">
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
