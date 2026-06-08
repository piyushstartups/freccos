import React, { useEffect, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import api from "../lib/api";

/**
 * Quiet, personal "Your impact" card. Shown at the top of the Trips section
 * on My Profile when the user has ≥1 save on any of their recs.
 */
export default function ImpactSummaryCard() {
  const [data, setData] = useState(null);
  const [showAllTime, setShowAllTime] = useState(false);

  useEffect(() => {
    api.get("/me/impact").then((r) => setData(r.data)).catch(() => setData({ visible: false }));
  }, []);

  if (!data || !data.visible) return null;

  const stats = showAllTime ? data.all_time : data.current_month;
  const monthLabel = data.month_label;

  return (
    <div
      data-testid="impact-summary-card"
      className="ios-card"
      style={{
        margin: "16px 16px 12px",
        padding: "16px 18px",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="#0A84FF" />
          <span className="t-title3" style={{ fontSize: 15, fontWeight: 600 }}>Your impact</span>
        </div>
        <span className="t-cap" style={{ color: "#C7C7CC", fontSize: 12 }}>
          {showAllTime ? "All time" : monthLabel}
        </span>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <Row label="Recommendations saved by friends" value={stats.saves} testId="impact-saves" />
        <Row label="Places visited because of your recs" value={stats.visits} testId="impact-visits" />
        <Row label="Friends who added their own recs inspired by yours" value={stats.inspired} testId="impact-inspired" />
        <Row label="People following you" value={data.follower_count} testId="impact-followers" />
      </div>

      {data.most_loved && (
        <>
          <div style={{ height: 1, background: "#E5E5EA", margin: "16px 0 12px" }} />
          <div className="t-cap" style={{ textTransform: "uppercase", letterSpacing: 0.6, color: "#8E8E93", fontSize: 11 }}>
            Most loved recommendation
          </div>
          <div className="t-title3" style={{ marginTop: 4 }}>{data.most_loved.place_name}</div>
          <div className="t-sub muted" style={{ marginTop: 2 }}>
            {data.most_loved.city_name} {data.most_loved.flag_emoji}
          </div>
          <div className="t-sub muted" style={{ marginTop: 4, fontSize: 13 }}>
            Saved by {data.most_loved.save_count} friend{data.most_loved.save_count === 1 ? "" : "s"}, visited by {data.most_loved.visit_count}.
          </div>
        </>
      )}

      <button
        data-testid="impact-toggle-all-time"
        onClick={() => setShowAllTime((v) => !v)}
        style={{
          background: "transparent", border: "none", padding: 0, marginTop: 14,
          color: "#0A84FF", fontSize: 13, fontWeight: 500, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        {showAllTime ? "View this month" : "View all time"} <ChevronDown size={14} style={{ transform: showAllTime ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
      </button>
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
