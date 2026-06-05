import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { ChevronLeft, UserCheck, UserPlus, MessageCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";

export default function FriendProfile() {
  const { userId } = useParams();
  const [search] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [openCity, setOpenCity] = useState(search.get("city"));
  const [recs, setRecs] = useState([]);
  const [category, setCategory] = useState("all");

  const load = async () => {
    const { data } = await api.get(`/users/${userId}`);
    setProfile(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const loadCityRecs = async (cityId, cat = category) => {
    const { data } = await api.get(`/users/${userId}/cities/${cityId}/recommendations`, {
      params: cat === "all" ? {} : { category: cat },
    });
    setRecs(data);
  };

  useEffect(() => {
    if (openCity) loadCityRecs(openCity, category);
    // eslint-disable-next-line
  }, [openCity, category]);

  const toggleFollow = async () => {
    try {
      if (profile.is_following) await api.post(`/users/${userId}/unfollow`);
      else await api.post(`/users/${userId}/follow`);
      load();
    } catch { toast.error("Couldn't update follow"); }
  };

  const cityOpen = profile?.cities?.find((c) => c.id === openCity);

  const askOnWhatsApp = () => {
    if (!cityOpen) return;
    const text = `Hey! I was checking out your Freccos recommendations for ${cityOpen.name} — had a quick question!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const saveRec = async (rec) => {
    try {
      await api.post(`/trip-plans/${rec.city_id}/save`, { recommendation_id: rec.id });
      toast.success("Saved to trip plan");
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't save"); }
  };

  if (!profile) return <div className="p-6 t-sub muted">Loading...</div>;

  // group cities by country
  const byCountry = {};
  for (const c of profile.cities || []) {
    const key = c.country || "Other";
    (byCountry[key] = byCountry[key] || []).push(c);
  }

  return (
    <div className="pb-32 fade-in" data-testid="friend-profile">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 22px" }}>
        <Link to="/friends" style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          <ChevronLeft size={18} /> Back
        </Link>
        <div className="flex items-center gap-3 mt-3">
          <Avatar user={profile} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-title1" style={{ color: "#fff" }}>{profile.name}</h1>
            {profile.bio && <p className="t-sub" style={{ color: "#C7C7CC" }}>{profile.bio}</p>}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-5">
          <div>
            <div className="t-large" style={{ color: "#fff", fontSize: 24 }} data-testid="stat-cities">{profile.city_count}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Cities</div>
          </div>
          <div>
            <div className="t-large" style={{ color: "#fff", fontSize: 24 }} data-testid="stat-countries">{profile.country_count}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Countries</div>
          </div>
        </div>

        <button
          data-testid="follow-btn"
          onClick={toggleFollow}
          className="btn-pill mt-4"
          style={{
            background: profile.is_following ? "rgba(255,255,255,0.16)" : "#0A84FF",
            color: "#fff",
          }}
        >
          {profile.is_following ? <UserCheck size={16} /> : <UserPlus size={16} />}
          {profile.is_following ? "Following" : "Follow"}
        </button>
      </div>

      {/* Cities list */}
      {!openCity && (
        <>
          {Object.keys(byCountry).length === 0 ? (
            <div className="px-6 mt-8" data-testid="friend-empty">
              <p className="t-sub muted">{profile.name} hasn’t added any places yet — maybe nudge them!</p>
            </div>
          ) : (
            Object.entries(byCountry).map(([country, cities]) => (
              <div key={country}>
                <div className="section-header">{country}</div>
                <div className="ios-card mx-4" style={{ overflow: "hidden" }}>
                  {cities.map((c) => (
                    <button
                      key={c.id}
                      data-testid={`friend-city-${c.id}`}
                      className="list-row w-full text-left"
                      onClick={() => setOpenCity(c.id)}
                      style={{ background: "transparent", border: "none" }}
                    >
                      <span style={{ fontSize: 22 }}>{c.flag_emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div className="t-title3">{c.name}</div>
                        <div className="t-cap muted">{c.rec_count} recommendation{c.rec_count === 1 ? "" : "s"}</div>
                      </div>
                      <span className="muted">›</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {openCity && cityOpen && (
        <div data-testid="friend-city-detail">
          <div className="px-4 pt-4 flex items-center gap-2">
            <button onClick={() => { setOpenCity(null); setRecs([]); setCategory("all"); }}
              style={{ background: "transparent", border: "none", color: "#0A84FF" }}
              data-testid="friend-back-cities"
            >
              <ChevronLeft size={16} style={{ verticalAlign: "middle" }} /> All cities
            </button>
          </div>
          <div className="px-4 mt-2">
            <h2 className="t-title1">{cityOpen.flag_emoji} {cityOpen.name}</h2>
            <button
              onClick={askOnWhatsApp}
              data-testid="ask-whatsapp"
              className="btn-pill btn-secondary mt-3"
              style={{ padding: "8px 14px", fontSize: 13 }}
            >
              <MessageCircle size={14} /> Ask {profile.name.split(" ")[0]} about {cityOpen.name}
            </button>
          </div>
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="px-4 space-y-3" data-testid="friend-recs">
            {recs.length === 0 && (
              <div className="ios-card px-4 py-6 text-center t-sub muted">
                No recommendations in this category yet.
              </div>
            )}
            {recs.map((r) => (
              <div key={r.id} className="ios-card" style={{ padding: "14px 16px" }} data-testid={`friend-rec-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="t-title3">{r.place_name}</div>
                    <div className="mt-1"><CategoryChip category={r.category} /></div>
                    {r.note && <p className="t-body mt-2">{r.note}</p>}
                    <div className="t-cap tertiary mt-2">{formatMonthYear(r.created_at)}</div>
                  </div>
                  <button
                    data-testid={`friend-save-${r.id}`}
                    onClick={() => saveRec(r)}
                    className="chip"
                    style={{ background: "rgba(120,120,128,0.08)", color: "#0A84FF", fontWeight: 600, padding: "8px 12px" }}
                  >
                    <Bookmark size={14} /> Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
