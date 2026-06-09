import React, { useEffect, useState } from "react";
import api from "../lib/api";
import PlaceSheet from "./PlaceSheet";
import { Bookmark, BookmarkCheck, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatMonthYear } from "../lib/utils-frec";
import { toast } from "sonner";
import { track, Events } from "../lib/analytics";

const CATEGORY_LABEL = {
  food: "Food",
  experience: "Experience",
  stay: "Stay",
  getting_around: "Getting around",
};

/**
 * Apple-style flat list of a user's recommendations. Sorted by save_count DESC,
 * then created_at DESC. Used on My Profile (Reccos tab) and Friend Profiles
 * (read-only with Save button per row).
 *
 * Props:
 *   userId      — whose recs to show
 *   isSelf      — viewer is the owner (edit/delete menu vs Save button)
 *   profileUser — { id, name, profile_photo_url } for PlaceSheet contributor
 *   onAddRec    — opens AddRecommendationSheet (empty state + edit)
 *   onEdit      — (rec) => open AddRecommendationSheet pre-filled
 *   onDelete    — (rec) => show confirm dialog (parent handles)
 *   onCount     — fires with total recs count for the parent tab header
 */
export default function RecommendationsList({
  userId, isSelf, profileUser, onAddRec, onEdit, onDelete, onCount,
}) {
  const [recs, setRecs] = useState(null);
  const [placeOpen, setPlaceOpen] = useState(null);
  const [menuRecId, setMenuRecId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/users/${userId}/recommendations`, { params: { limit: 200 } });
      const list = (data || []).slice();
      list.sort((a, b) => {
        const ds = (b.save_count || 0) - (a.save_count || 0);
        if (ds !== 0) return ds;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
      setRecs(list);
      onCount?.(list.length);
    } catch { setRecs([]); onCount?.(0); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [userId]);

  if (recs === null) return <div className="p-6 t-sub muted">Loading...</div>;

  if (recs.length === 0) {
    return (
      <div data-testid="recs-list-empty"
        style={{ background: "#F2F2F7", padding: "44px 24px", textAlign: "center", margin: "16px", borderRadius: 12 }}>
        {isSelf ? (
          <>
            <h3 className="t-title2" style={{ color: "#1C1C1E" }}>You have not added any recommendations yet.</h3>
            <p className="t-sub muted" style={{ marginTop: 6 }}>Start sharing the places you love with your people.</p>
            <button
              onClick={onAddRec}
              data-testid="recs-list-add"
              className="btn-pill btn-primary"
              style={{ marginTop: 18, padding: "10px 18px" }}
            >
              + Add a recommendation
            </button>
          </>
        ) : (
          <p className="t-sub muted">{profileUser?.name || "They"} has not added any recommendations yet.</p>
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
        is_saved: !!rec.is_saved_by_me,
        primary_rec_id: rec.id,
        contributors: [{ ...rec, user: profileUser || { id: userId } }],
      },
    });
  };

  const handleSave = async (e, rec) => {
    e.stopPropagation();
    if (rec.is_saved_by_me) {
      openPlace(rec); // already saved → show unsave confirmation in the sheet
      return;
    }
    try {
      await api.post(`/trip-plans/${rec.city_id}/save`, { recommendation_id: rec.id });
      toast.success(`Saved ${rec.place_name}`);
      track(Events.RECOMMENDATION_SAVED, { place_name: rec.place_name, city_id: rec.city_id, saved_from_user_id: userId });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't save");
    }
  };

  return (
    <div data-testid="recs-list" style={{ background: "#fff" }}>
      {recs.map((r, idx) => (
        <Row
          key={r.id}
          rec={r}
          isLast={idx === recs.length - 1}
          isSelf={isSelf}
          onOpen={() => openPlace(r)}
          onSave={(e) => handleSave(e, r)}
          menuOpen={menuRecId === r.id}
          onToggleMenu={(e) => { e.stopPropagation(); setMenuRecId((m) => m === r.id ? null : r.id); }}
          onEdit={() => { setMenuRecId(null); onEdit?.(r); }}
          onDelete={() => { setMenuRecId(null); onDelete?.(r); }}
        />
      ))}

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

function Row({ rec, isLast, isSelf, onOpen, onSave, menuOpen, onToggleMenu, onEdit, onDelete }) {
  const cityFlag = rec.city?.flag_emoji ? `${rec.city.flag_emoji} ${rec.city.name}` : (rec.city?.name || "");
  const cat = CATEGORY_LABEL[rec.category] || "";
  const date = formatMonthYear(rec.created_at);
  const meta = [cityFlag, cat, date].filter(Boolean).join(" · ");
  const saveCount = rec.save_count || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      data-testid={`rec-list-row-${rec.id}`}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "0.5px solid #F2F2F7",
        cursor: "pointer",
        background: "#fff",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16, fontWeight: 600, color: "#1C1C1E",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {rec.place_name}
        </div>
        <div
          style={{
            fontSize: 13, color: "#8E8E93", marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {meta}
        </div>
        {saveCount > 0 && (
          <div
            data-testid={`rec-list-saves-${rec.id}`}
            style={{ marginTop: 3, fontSize: 12, color: "#0A84FF", fontWeight: 500 }}
          >
            Saved by {saveCount} {saveCount === 1 ? "person" : "people"}
          </div>
        )}
      </div>

      {isSelf ? (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            data-testid={`rec-list-menu-${rec.id}`}
            onClick={onToggleMenu}
            style={{
              background: "transparent", border: "none", padding: 6,
              borderRadius: 9999, color: "#8E8E93", cursor: "pointer",
            }}
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              data-testid={`rec-list-menu-popover-${rec.id}`}
              style={{
                position: "absolute", right: 0, top: 32, zIndex: 10,
                background: "#fff", borderRadius: 10,
                boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
                padding: 4, minWidth: 140,
              }}
            >
              <MenuItem icon={<Pencil size={15} />} label="Edit" onClick={onEdit} testId={`rec-list-edit-${rec.id}`} />
              <MenuItem icon={<Trash2 size={15} />} label="Delete" onClick={onDelete} testId={`rec-list-delete-${rec.id}`} danger />
            </div>
          )}
        </div>
      ) : (
        <button
          data-testid={`rec-list-save-${rec.id}`}
          onClick={onSave}
          className="btn-pill"
          style={{
            flexShrink: 0,
            padding: "6px 12px", fontSize: 12, fontWeight: 600,
            background: rec.is_saved_by_me ? "rgba(48,209,88,0.15)" : "#0A84FF",
            color: rec.is_saved_by_me ? "#1B7C2D" : "#fff",
            border: rec.is_saved_by_me ? "1px solid #30D158" : "none",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          {rec.is_saved_by_me ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          {rec.is_saved_by_me ? "Saved" : "Save"}
        </button>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, testId, danger }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      style={{
        width: "100%", textAlign: "left",
        padding: "9px 12px", border: "none", background: "transparent",
        display: "flex", alignItems: "center", gap: 10,
        color: danger ? "#FF453A" : "#1C1C1E", fontSize: 14,
        cursor: "pointer", borderRadius: 6,
      }}
    >
      {icon} {label}
    </button>
  );
}
