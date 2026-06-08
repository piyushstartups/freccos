import React, { useEffect, useRef, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import api from "../lib/api";

const STATE_KEY = "freccos:impact-card:expanded";

/**
 * Collapsible "Your impact" card. Lives at the top of the Trips section
 * on My Profile. Defaults to collapsed; user's choice persists for the session.
 */
export default function ImpactSummaryCard() {
  const [data, setData] = useState(null);
  const [showAllTime, setShowAllTime] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem(STATE_KEY) === "1"; }
    catch { return false; }
  });
  // Animation: measure inner height for a smooth max-height transition
  const innerRef = useRef(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    api.get("/me/impact").then((r) => setData(r.data)).catch(() => setData({ visible: false }));
  }, []);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    // ResizeObserver keeps the max-height in sync if content changes (toggle all-time)
    const ro = new ResizeObserver(() => setInnerHeight(el.scrollHeight));
    ro.observe(el);
    setInnerHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [data, showAllTime, expanded]);

  if (!data || !data.visible) return null;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try { sessionStorage.setItem(STATE_KEY, next ? "1" : "0"); } catch { /* noop */ }
  };

  const stats = showAllTime ? data.all_time : data.current_month;
  const summaryLine = `${stats.saves || 0} save${stats.saves === 1 ? "" : "s"} · ${stats.visits || 0} visit${stats.visits === 1 ? "" : "s"} · ${data.follower_count || 0} follower${data.follower_count === 1 ? "" : "s"}`;

  return (
    <div
      data-testid="impact-summary-card"
      className="ios-card"
      style={{
        margin: "16px 16px 12px",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Collapsed/header row — always present, fully tappable */}
      <button
        data-testid="impact-toggle"
        onClick={toggle}
        aria-expanded={expanded}
        style={{
          width: "100%", background: "transparent", border: "none",
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 9999,
          background: "rgba(10,132,255,0.10)", color: "#0A84FF",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Sparkles size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title3" style={{ fontSize: 15, fontWeight: 500, color: "#1C1C1E" }}>
            Your impact
          </div>
          <div
            data-testid="impact-summary-line"
            className="t-sub muted"
            style={{ fontSize: 13, color: "#8E8E93", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {summaryLine}
          </div>
        </div>
        <ChevronDown
          size={18}
          color="#8E8E93"
          style={{
            flexShrink: 0,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
          }}
        />
      </button>

      {/* Animated expand region */}
      <div
        style={{
          maxHeight: expanded ? innerHeight : 0,
          transition: "max-height 280ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
          overflow: "hidden",
        }}
        aria-hidden={!expanded}
      >
        <div ref={innerRef} style={{ padding: "4px 16px 16px" }}>
          <div style={{ height: 1, background: "#E5E5EA", margin: "8px 0 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="t-cap" style={{ textTransform: "uppercase", letterSpacing: 0.6, color: "#8E8E93", fontSize: 11 }}>
              {showAllTime ? "All time" : data.month_label}
            </span>
            <button
              data-testid="impact-toggle-all-time"
              onClick={(e) => { e.stopPropagation(); setShowAllTime((v) => !v); }}
              style={{
                background: "transparent", border: "none", padding: 0,
                color: "#0A84FF", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              {showAllTime ? "View this month" : "View all time"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="Recommendations saved by friends" value={stats.saves} testId="impact-saves" />
            <Row label="Places visited because of your recs" value={stats.visits} testId="impact-visits" />
            <Row label="Friends who added their own recs inspired by yours" value={stats.inspired} testId="impact-inspired" />
            <Row label="People following you" value={data.follower_count} testId="impact-followers" />
          </div>

          {data.most_loved && (
            <>
              <div style={{ height: 1, background: "#E5E5EA", margin: "14px 0 12px" }} />
              <div className="t-cap" style={{ textTransform: "uppercase", letterSpacing: 0.6, color: "#8E8E93", fontSize: 11 }}>
                Most loved recommendation
              </div>
              <div className="t-title3" style={{ marginTop: 4 }} data-testid="impact-most-loved">{data.most_loved.place_name}</div>
              <div className="t-sub muted" style={{ marginTop: 2 }}>
                {data.most_loved.city_name} {data.most_loved.flag_emoji}
              </div>
              <div className="t-sub muted" style={{ marginTop: 4, fontSize: 13 }}>
                Saved by {data.most_loved.save_count} friend{data.most_loved.save_count === 1 ? "" : "s"}, visited by {data.most_loved.visit_count}.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, testId }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span className="t-body" style={{ color: "#3a3a3c", fontSize: 14, flex: 1 }}>{label}</span>
      <span
        data-testid={testId}
        className="t-title3"
        style={{ fontWeight: 700, fontSize: 16, color: "#1C1C1E", minWidth: 32, textAlign: "right" }}
      >
        {value || 0}
      </span>
    </div>
  );
}
