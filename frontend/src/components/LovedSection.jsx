import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Avatar from "./Avatar";
import { CategoryChip } from "./CategoryChip";
import PlaceSheet from "./PlaceSheet";
import { Bookmark, BookmarkCheck, Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { track, Events } from "../lib/analytics";

function placeKeyOf(item) {
  return item.place_id || `name::${(item.place_name || "").toLowerCase().trim()}`;
}

/**
 * "Loved by your people" — top-saved recs across the user's network this week.
 * Renders horizontally for a snappy 'top picks' feel; the user-requested layout
 * lives inside an iOS-style card with a clear blue Save CTA.
 */
export default function LovedSection() {
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [savedKeys, setSavedKeys] = useState(new Set());
  const [placeOpen, setPlaceOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/feed/loved", { params: { limit: 5, days: 7 } });
      setItems(data || []);
      setSavedKeys(new Set((data || []).filter((d) => d.is_saved).map(placeKeyOf)));
    } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (items === null) return null;
  if (items.length < 2) return null; // hide section unless at least 2 saved recs

  const openPlace = (item) => {
    if (!item.city?.id) return;
    const key = placeKeyOf(item);
    track(Events.PLACE_CARD_OPENED, { place_name: item.place_name, city_id: item.city.id, source: "feed_loved" });
    setPlaceOpen({
      cityId: item.city.id,
      group: {
        place_key: key,
        place_name: item.place_name,
        place_id: item.place_id,
        category: item.category,
        photo_url: item.photo_url,
        is_saved: savedKeys.has(key),
        primary_rec_id: item.rec_id,
        contributors: [{
          id: item.rec_id, place_name: item.place_name, category: item.category,
          note: item.note, photo_url: item.photo_url, created_at: item.created_at,
          user: item.user,
        }],
      },
    });
  };

  const inlineSave = async (item, e) => {
    e.stopPropagation();
    const key = placeKeyOf(item);
    if (savedKeys.has(key)) { openPlace(item); return; }
    try {
      await api.post(`/trip-plans/${item.city.id}/save`, { recommendation_id: item.rec_id });
      setSavedKeys((s) => new Set([...s, key]));
      toast.success(`Saved to ${item.city.name}`);
      track(Events.RECOMMENDATION_SAVED, { place_name: item.place_name, city_id: item.city.id, source: "feed_loved" });
    } catch (err) { toast.error(err?.response?.data?.detail || "Couldn't save"); }
  };

  return (
    <div data-testid="feed-loved" style={{ marginTop: 12 }}>
      <SectionHeader
        icon={<Heart size={15} color="#FF6B6B" fill="rgba(255,107,107,0.15)" />}
        title="Loved by your people"
      />
      <div className="px-4" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {items.map((item) => {
          const key = placeKeyOf(item);
          const saved = savedKeys.has(key);
          const handleOpen = () => openPlace(item);
          return (
            <div
              key={item.rec_id}
              role="button"
              tabIndex={0}
              onClick={handleOpen}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(); } }}
              data-testid={`loved-card-${item.rec_id}`}
              className="ios-card"
              style={{ padding: 14, cursor: "pointer", borderRadius: 12, background: "#fff", WebkitTapHighlightColor: "transparent" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {item.user && <Avatar user={item.user} size={28} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-cap" style={{ color: "#8E8E93", fontSize: 12 }}>
                    {item.user?.name} · {item.city?.name} {item.city?.flag_emoji}
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FF6B6B", fontSize: 12, fontWeight: 600 }}>
                  <Sparkles size={11} /> {item.save_count}
                </span>
              </div>
              <div className="t-title3" style={{ marginTop: 8, fontWeight: 600, wordBreak: "break-word" }}>{item.place_name}</div>
              <div style={{ marginTop: 4 }}><CategoryChip category={item.category} /></div>
              {item.note && (
                <p className="t-body" style={{
                  color: "#3a3a3c", fontSize: 14, lineHeight: 1.4, marginTop: 6,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {item.note}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                <span className="t-cap" style={{ color: "#8E8E93", fontSize: 12 }}>
                  Saved by {item.save_count} {item.save_count === 1 ? "person" : "people"}
                </span>
                <button
                  onClick={(e) => inlineSave(item, e)}
                  data-testid={`loved-save-${item.rec_id}`}
                  className="btn-pill"
                  style={{
                    background: saved ? "rgba(48,209,88,0.15)" : "#0A84FF",
                    color: saved ? "#1B7C2D" : "#fff",
                    border: saved ? "1px solid #30D158" : "none",
                    padding: "6px 14px", fontSize: 13,
                    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  }}
                >
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          );
        })}
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

export function SectionHeader({ icon, title, seeAllLabel, onSeeAll, marginTop = 24 }) {
  return (
    <div className="px-4" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>{title}</h2>
      </div>
      {seeAllLabel && (
        <button
          onClick={onSeeAll}
          className="t-sub"
          style={{ background: "transparent", border: "none", color: "#0A84FF", fontSize: 14, fontWeight: 500, padding: 4, cursor: "pointer" }}
        >
          {seeAllLabel}
        </button>
      )}
    </div>
  );
}
