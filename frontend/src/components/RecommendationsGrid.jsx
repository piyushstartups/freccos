import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import PlaceSheet from "./PlaceSheet";
import { Bookmark, MapPin, Plus } from "lucide-react";
import { formatMonthYear, photoUrl } from "../lib/utils-frec";

// iOS-Photos-style 3-column square grid of a user's recommendations.
// Reused for My Profile + Friend Profile. The PlaceSheet handles the
// Save action so there's no per-cell Save button.
const CATEGORY_TINTS = {
  food: { bg: "rgba(255,159,10,0.10)", color: "#A86406" },
  experience: { bg: "rgba(191,90,242,0.10)", color: "#7E33B5" },
  stay: { bg: "rgba(90,200,250,0.10)", color: "#1F8AB2" },
  getting_around: { bg: "rgba(255,107,107,0.10)", color: "#B53A3A" },
  default: { bg: "#F2F2F7", color: "#3a3a3c" },
};

export default function RecommendationsGrid({ userId, isSelf, onAddRec }) {
  const [recs, setRecs] = useState(null);
  const [placeOpen, setPlaceOpen] = useState(null);
  const nav = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get(`/users/${userId}/recommendations`, { params: { limit: 200 } });
      setRecs(data || []);
    } catch { setRecs([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  if (recs === null) return <div className="p-6 t-sub muted">Loading...</div>;

  if (recs.length === 0) {
    return (
      <div data-testid="recs-grid-empty"
        style={{ background: "#F2F2F7", padding: "48px 24px", textAlign: "center", borderRadius: 12, margin: "16px" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 9999, background: "rgba(10,132,255,0.10)",
          color: "#0A84FF", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <MapPin size={26} />
        </div>
        <h3 className="t-title2" style={{ marginTop: 14, color: "#1C1C1E" }}>
          {isSelf ? "Your first recommendation is waiting." : "No recommendations yet."}
        </h3>
        <p className="t-sub" style={{ color: "#8E8E93", marginTop: 6, lineHeight: 1.45 }}>
          {isSelf
            ? "Where have you loved? Your people want to know."
            : "Nothing here for now."}
        </p>
        {isSelf && (
          <button
            onClick={onAddRec}
            data-testid="recs-grid-add"
            className="btn-pill btn-primary"
            style={{ marginTop: 18, padding: "10px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} /> Add a recommendation
          </button>
        )}
      </div>
    );
  }

  const openPlace = (rec) => {
    setPlaceOpen({
      cityId: rec.city_id,
      group: {
        place_key: rec.place_id || `name::${(rec.place_name || "").toLowerCase().trim()}`,
        place_name: rec.place_name,
        place_id: rec.place_id,
        place_address: rec.place_address,
        category: rec.category,
        photo_url: rec.photo_url,
        is_saved: false,
        primary_rec_id: rec.id,
        contributors: [{ ...rec, user: { id: userId } }],
      },
    });
  };

  return (
    <div data-testid="recs-grid">
      <div className="px-4 pt-4 pb-2">
        <h2 className="t-title2" data-testid="recs-grid-header">
          {recs.length} {recs.length === 1 ? "recommendation" : "recommendations"}
        </h2>
      </div>
      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
          padding: "0 8px",
        }}
      >
        {recs.map((r) => (
          <GridCell key={r.id} rec={r} onOpen={() => openPlace(r)} />
        ))}
      </div>

      <PlaceSheet
        open={!!placeOpen}
        onClose={() => setPlaceOpen(null)}
        cityId={placeOpen?.cityId}
        group={placeOpen?.group}
        onChange={load}
      />
    </div>
  );
}

function GridCell({ rec, onOpen }) {
  const tint = CATEGORY_TINTS[rec.category] || CATEGORY_TINTS.default;
  const hasPhoto = !!rec.photo_url;
  const saveCount = rec.save_count || 0;
  const visitCount = rec.visit_count || 0;
  return (
    <button
      onClick={onOpen}
      data-testid={`recs-grid-cell-${rec.id}`}
      style={{
        position: "relative", aspectRatio: "1 / 1", overflow: "hidden",
        borderRadius: 8, border: "none", padding: 0, cursor: "pointer",
        background: hasPhoto ? "#000" : tint.bg,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {hasPhoto && (
        <img
          src={photoUrl(rec.photo_url)}
          alt={rec.place_name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {!hasPhoto && (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 10,
        }}>
          <span style={{
            color: tint.color, fontSize: 13, fontWeight: 600, lineHeight: 1.25,
            textAlign: "center", wordBreak: "break-word",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {rec.place_name}
          </span>
        </div>
      )}

      {/* Save count — bottom right */}
      {saveCount > 0 && (
        <span style={{
          position: "absolute", right: 4, bottom: 18,
          background: "rgba(10,132,255,0.92)", color: "#fff",
          fontSize: 10, fontWeight: 700,
          padding: "2px 6px", borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          <Bookmark size={9} /> {saveCount}
        </span>
      )}
      {/* Visit count — bottom left */}
      {visitCount > 0 && (
        <span style={{
          position: "absolute", left: 4, bottom: 18,
          background: "rgba(48,209,88,0.92)", color: "#fff",
          fontSize: 10, fontWeight: 700,
          padding: "2px 6px", borderRadius: 9999,
        }}>
          ✓ {visitCount}
        </span>
      )}
      {/* Date — bottom centre */}
      <span style={{
        position: "absolute", left: 0, right: 0, bottom: 3,
        textAlign: "center",
        color: hasPhoto ? "rgba(255,255,255,0.85)" : "#8E8E93",
        textShadow: hasPhoto ? "0 1px 2px rgba(0,0,0,0.45)" : "none",
        fontSize: 9, fontWeight: 500,
      }}>
        {formatMonthYear(rec.created_at)}
      </span>
    </button>
  );
}
