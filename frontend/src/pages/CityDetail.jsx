import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import Avatar from "../components/Avatar";
import StackedAvatars from "../components/StackedAvatars";
import PlaceSheet from "../components/PlaceSheet";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";
import AddRecommendationSheet from "../components/AddRecommendationSheet";

export default function CityDetail() {
  const { cityId } = useParams();
  const [city, setCity] = useState(null);
  const [friends, setFriends] = useState([]);
  const [recs, setRecs] = useState([]);
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [placeGroup, setPlaceGroup] = useState(null);

  const loadCity = async () => {
    const { data } = await api.get(`/cities/${cityId}`);
    setCity(data);
  };
  const loadFriends = async () => {
    const { data } = await api.get(`/explore/cities/${cityId}/friends`);
    setFriends(data);
  };
  const loadRecs = async (cat = category) => {
    const { data } = await api.get(`/cities/${cityId}/recommendations`, { params: cat === "all" ? {} : { category: cat } });
    setRecs(data);
  };

  useEffect(() => {
    loadCity(); loadFriends(); loadRecs("all"); // eslint-disable-next-line
  }, [cityId]);

  const onCatChange = (c) => { setCategory(c); loadRecs(c); };

  const onSaveToggle = async (group) => {
    setSavingKey(group.place_key);
    try {
      if (group.is_saved) {
        if (!window.confirm("Remove from trip plan?")) { setSavingKey(null); return; }
        await api.post(`/trip-plans/${cityId}/unsave`, { recommendation_id: group.primary_rec_id });
        toast("Removed from trip plan");
      } else {
        await api.post(`/trip-plans/${cityId}/save`, { recommendation_id: group.primary_rec_id });
        toast.success(`Saved to ${city?.name} trip plan`, {
          action: {
            label: "Undo",
            onClick: async () => {
              await api.post(`/trip-plans/${cityId}/unsave`, { recommendation_id: group.primary_rec_id });
              loadRecs(category);
            },
          },
        });
      }
      loadRecs(category);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't update trip plan.");
    } finally { setSavingKey(null); }
  };

  return (
    <div className="pb-32 fade-in" data-testid="city-detail">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "20px 16px 18px", position: "relative" }}>
        <Link to="/explore" style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", textDecoration: "none", fontSize: 15 }}>
          <ChevronLeft size={20} /> Explore
        </Link>
        {/* Flag pinned to top-right — minimal, decorative anchor */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 18,
            right: 16,
            fontSize: 32,
            lineHeight: 1,
            opacity: 0.95,
          }}
        >
          {city?.flag_emoji || "🌍"}
        </span>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.15, margin: "10px 0 0", paddingRight: 56 }}>
          {city?.name || "..."}
        </h1>
        <p style={{ color: "#8E8E93", fontSize: 14, margin: "6px 0 0", paddingRight: 56 }}>
          {city?.country ? `${city.country} · ` : ""}
          {friends.length} {friends.length === 1 ? "friend has" : "friends have"} been here
        </p>

        {friends.length > 0 && (
          <div
            className="flex gap-3 mt-4 pb-1"
            style={{ overflowX: "auto", scrollbarWidth: "none" }}
            data-testid="friends-strip"
          >
            {friends.map((f) => (
              <Link
                key={f.id}
                to={`/user/${f.id}?city=${cityId}`}
                style={{ textAlign: "center", textDecoration: "none", color: "#fff", minWidth: 72 }}
                data-testid={`friend-strip-${f.id}`}
              >
                <Avatar user={f} size={48} />
                <div className="t-cap mt-1" style={{ color: "#fff" }}>{f.name?.split(" ")[0]}</div>
                {typeof f.city_count === "number" ? (
                  <div className="t-cap" style={{ color: "#8E8E93", fontSize: 10 }}>
                    {f.city_count} {f.city_count === 1 ? "city" : "cities"} · {f.country_count} {f.country_count === 1 ? "country" : "countries"}
                  </div>
                ) : (
                  <div className="t-cap" style={{ color: "#8E8E93" }}>{f.rec_count} {f.rec_count === 1 ? "rec" : "recs"}</div>
                )}
              </Link>
            ))}
          </div>
        )}

      </div>

      <CategoryTabs value={category} onChange={onCatChange} />

      <div className="px-4 mt-2 space-y-3" data-testid="recs-list">
        {recs.length === 0 && (
          <div className="ios-card px-4 py-6 text-center" data-testid="recs-empty">
            <p className="t-sub muted">
              None of your friends have been here yet — you could be the first to add a recommendation!
            </p>
          </div>
        )}
        {recs.map((g) => {
          const isMulti = g.contributors.length >= 2;
          return (
            <div
              key={g.place_key}
              className="ios-card"
              data-testid={`rec-${g.place_key}`}
              onClick={() => setPlaceGroup(g)}
              style={{
                padding: "14px 16px",
                borderLeft: isMulti ? "3px solid #0A84FF" : undefined,
                background: isMulti ? "linear-gradient(180deg, rgba(10,132,255,0.05), #fff 50%)" : "#fff",
                cursor: "pointer",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div style={{ flex: 1 }}>
                  <div className="t-title3 flex items-center gap-1">{g.place_name} <ChevronRight size={14} color="#C7C7CC" /></div>
                  <div className="flex items-center gap-2 mt-1"><CategoryChip category={g.category} /></div>
                </div>
                <SaveButton saved={g.is_saved} loading={savingKey === g.place_key}
                  onClick={(e) => { e.stopPropagation(); onSaveToggle(g); }}
                  testId={`save-${g.place_key}`} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StackedAvatars users={g.contributors} size={26} />
                {isMulti ? (
                  <div className="t-sub" style={{ flex: 1 }}>
                    <strong>{g.contributors[0].name?.split(" ")[0]}</strong>{", "}
                    <strong>{g.contributors[1].name?.split(" ")[0]}</strong>
                    {g.contributors.length > 2 && ` + ${g.contributors.length - 2} more`} recommended this
                  </div>
                ) : (
                  <div className="t-sub muted" style={{ flex: 1 }}>
                    via <strong style={{ color: "#1C1C1E" }}>{g.contributors[0].name}</strong>
                    {g.contributors[0].created_at && <> · {formatMonthYear(g.contributors[0].created_at)}</>}
                  </div>
                )}
              </div>
              {g.contributors[0].note && <p className="t-body mt-2" style={{
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>{g.contributors[0].note}</p>}
            </div>
          );
        })}
      </div>

      <AddRecommendationSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        lockedCity={city}
        onCreated={() => loadRecs(category)}
      />
      <PlaceSheet
        open={!!placeGroup}
        onClose={() => setPlaceGroup(null)}
        group={placeGroup}
        cityId={cityId}
        onChange={() => loadRecs(category)}
      />
    </div>
  );
}

function SaveButton({ saved, loading, onClick, testId }) {
  const [bump, setBump] = useState(false);
  const handle = (e) => {
    if (loading) return;
    if (!saved) { setBump(true); setTimeout(() => setBump(false), 320); }
    onClick?.(e);
  };
  return (
    <button
      data-testid={testId}
      onClick={handle}
      className={`chip ${saved ? "" : "chip-inactive"} ${bump ? "save-bump" : ""}`}
      style={{
        padding: "8px 12px",
        background: saved ? "rgba(48,209,88,0.16)" : "rgba(120,120,128,0.08)",
        color: saved ? "#1B7C2D" : "#1C1C1E",
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
