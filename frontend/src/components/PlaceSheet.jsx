import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import BottomSheet from "./BottomSheet";
import Avatar from "./Avatar";
import { CategoryChip } from "./CategoryChip";
import { MapPin, ExternalLink, Share2, Bookmark, BookmarkCheck, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear, photoUrl } from "../lib/utils-frec";
import { track, Events } from "../lib/analytics";

export default function PlaceSheet({ open, onClose, group, cityId, onChange, onEdit }) {
  const { user: me } = useAuth();
  const [details, setDetails] = useState(null);
  const [allContribs, setAllContribs] = useState(null);
  const [saveCount, setSaveCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (!open || !group) { setDetails(null); setAllContribs(null); return; }
    track(Events.PLACE_CARD_OPENED, {
      place_name: group.place_name,
      city_id: cityId,
      category: group.category,
    });
    setSaved(!!group.is_saved);
    setSaveCount(0);
    api.get("/places/recommendations", {
      params: { place_id: group.place_id, place_name: group.place_name, city_id: cityId },
    }).then(({ data }) => {
      setAllContribs(data.contributors || group.contributors);
      setSaveCount(data.save_count || 0);
    }).catch(() => setAllContribs(group.contributors));
    if (group.place_id) {
      api.get(`/places/details/${group.place_id}`)
        .then(({ data }) => setDetails(data))
        .catch(() => setDetails(null));
    }
  }, [open, group, cityId]);

  if (!group) return null;
  const contribs = allContribs || group.contributors || [];
  const coverPhoto = contribs.map((c) => c.photo_url).find(Boolean);
  const googlePhotoUrl = details?.photo_name
    ? `${process.env.REACT_APP_BACKEND_URL}/api/places/photo?name=${encodeURIComponent(details.photo_name)}&max_width=1024`
    : null;

  // Does this place belong to the current user (i.e. their own rec)?
  const isOwn = !!(me?.id && contribs.some((c) => (c.user?.id || c.id) === me.id));
  const myContrib = contribs.find((c) => (c.user?.id || c.id) === me?.id);

  const toggleSave = async () => {
    try {
      if (saved) {
        if (!window.confirm("Remove from trip plan?")) return;
        await api.post(`/trip-plans/${cityId}/unsave`, { recommendation_id: group.primary_rec_id });
        setSaved(false);
        toast("Removed from trip plan");
      } else {
        await api.post(`/trip-plans/${cityId}/save`, { recommendation_id: group.primary_rec_id });
        setSaved(true);
        setBump(true); setTimeout(() => setBump(false), 320);
        toast.success("Saved to trip plan");
        track(Events.RECOMMENDATION_SAVED, {
          place_name: group.place_name,
          city_id: cityId,
          saved_from_user_id: contribs[0]?.user?.id || contribs[0]?.id,
        });
      }
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't update"); }
  };

  const handleEdit = () => {
    if (!onEdit || !myContrib) return;
    onEdit(myContrib);
    onClose?.();
  };

  const share = async () => {
    const text = `Check out ${group.place_name} on Freccos — recommended by ${contribs[0]?.user?.name || contribs[0]?.name || "a friend"} · freccos.com`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    } catch { /* user cancelled */ }
  };

  const mapsUrl = details?.google_maps_uri
    || (group.place_id ? `https://www.google.com/maps/place/?q=place_id:${group.place_id}`
    : `https://www.google.com/maps/search/${encodeURIComponent(group.place_name)}`);

  const cover = coverPhoto ? photoUrl(coverPhoto) : googlePhotoUrl;

  return (
    <BottomSheet open={open} onClose={onClose} testId="place-sheet" dragToDismiss={false}>
      {/* Scrollable content (everything except the sticky bottom action) */}
      <div data-testid="place-content">
        {/* Cover with floating close button */}
        <div style={{ position: "relative" }}>
          {cover ? (
            <div
              style={{
                width: "100%", aspectRatio: "16 / 9",
                background: `#1C1C1E url('${cover}') center/cover`,
                borderBottom: "1px solid #E5E5EA",
              }}
              data-testid="place-cover"
            />
          ) : (
            <div
              style={{
                width: "100%", aspectRatio: "16 / 9", background: "#1C1C1E",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3a3a3c",
              }}
            >
              <MapPin size={48} />
            </div>
          )}
          <button
            data-testid="place-close"
            aria-label="Close"
            onClick={onClose}
            style={{
              position: "absolute", top: 12, right: 12,
              width: 32, height: 32, borderRadius: 9999,
              background: "rgba(0,0,0,0.4)", border: "none",
              color: "#fff", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="px-4 pt-4" style={{ paddingBottom: "calc(96px + var(--safe-area-bottom))" }}>
          <div className="flex items-start justify-between gap-3">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="t-title1">{group.place_name}</h2>
            </div>
            <button onClick={share} aria-label="Share" data-testid="place-share"
              style={{ background: "rgba(120,120,128,0.12)", border: "none", borderRadius: 9999, padding: 8, color: "#1C1C1E", flexShrink: 0 }}>
              <Share2 size={16} />
            </button>
          </div>

          {/* Recommended by — avatars + names directly under the title for instant social context */}
          {contribs.length > 0 && (
            <div className="mt-3" data-testid="place-recommended-by">
              <div className="t-cap muted" style={{ marginBottom: 6 }}>
                {isOwn && contribs.length === 1
                  ? "Recommended by you"
                  : `Recommended by ${contribs.length} ${contribs.length === 1 ? "friend" : "friends"}`}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                {contribs.slice(0, 5).map((c) => {
                  const user = c.user || c;
                  return (
                    <div key={user.id || c.rec_id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Avatar user={user} size={28} />
                      <span className="t-sub" style={{ fontWeight: 500 }}>{user.name?.split(" ")[0]}</span>
                    </div>
                  );
                })}
                {contribs.length > 5 && (
                  <span className="t-cap muted">+{contribs.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          <div className="divider mt-4" />

          {/* Friend notes */}
          <div className="mt-4">
            <h3 className="t-title3 mb-2">{isOwn && contribs.length === 1 ? "Your note" : "What your friends say"}</h3>
            <div className="space-y-3">
              {contribs.map((c) => (
                <div key={c.id || c.rec_id || c.user?.id} className="ios-card" style={{ padding: "12px 14px" }} data-testid="place-contributor">
                  <div className="flex items-center gap-2">
                    <Avatar user={c.user || c} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-sub"><strong>{c.user?.name || c.name}</strong></div>
                      {c.created_at && <div className="t-cap muted">{formatMonthYear(c.created_at)}</div>}
                    </div>
                    <CategoryChip category={c.category} />
                  </div>
                  {c.note && <p className="t-body mt-2">{c.note}</p>}
                  {c.photo_url && (
                    <div
                      style={{ marginTop: 10, aspectRatio: "4/3",
                        background: `#eee url('${photoUrl(c.photo_url)}') center/cover`,
                        borderRadius: 10 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Open in Google Maps — subtle text link below contributors */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="place-maps"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 16, fontSize: 13, color: "#0A84FF",
              textDecoration: "none",
            }}
          >
            Open in Google Maps <ExternalLink size={13} />
          </a>

          <div className="mt-3 t-cap muted">
            Saved by {saveCount} {saveCount === 1 ? "person" : "people"} on Freccos
          </div>
        </div>
      </div>

      {/* Fixed bottom action — Save (others' recs) or Edit (own rec). Anchored
          via position:fixed so it stays put as the sheet content scrolls. */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 0,
          width: "100%",
          maxWidth: 430,
          background: "#fff",
          padding: "12px 16px calc(12px + var(--safe-area-bottom))",
          borderTop: "1px solid #E5E5EA",
          zIndex: 10010,
        }}
      >
        {isOwn ? (
          <button
            data-testid="place-edit"
            onClick={handleEdit}
            className="btn-pill w-full btn-primary"
          >
            <Pencil size={16} /> Edit recommendation
          </button>
        ) : (
          <button
            data-testid="place-save"
            onClick={toggleSave}
            className={`btn-pill w-full ${bump ? "save-bump" : ""}`}
            style={{
              background: saved ? "rgba(48,209,88,0.15)" : "#0A84FF",
              color: saved ? "#1B7C2D" : "#fff",
              border: saved ? "1px solid #30D158" : "none",
            }}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {saved ? "Saved" : "Save to trip plan"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
