import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import {
  ChevronLeft, UserCheck, UserPlus, MessageCircle, Bookmark, Lock,
  Instagram, MoreHorizontal, ShieldOff, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";
import { flagForCountry } from "../lib/flags";

const INSTAGRAM_GRADIENT = "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)";

export default function FriendProfile() {
  const { userId } = useParams();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [openCity, setOpenCity] = useState(search.get("city"));
  const [recs, setRecs] = useState([]);
  const [category, setCategory] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/users/${userId}`);
      setProfile(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load");
      nav(-1);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const loadCityRecs = async (cityId, cat = category) => {
    const { data } = await api.get(`/users/${userId}/cities/${cityId}/recommendations`,
      { params: cat === "all" ? {} : { category: cat } });
    setRecs(data);
  };

  useEffect(() => {
    if (openCity && profile?.can_view) loadCityRecs(openCity, category);
    // eslint-disable-next-line
  }, [openCity, category, profile?.can_view]);

  const toggleFollow = async () => {
    try {
      if (profile.is_following) {
        if (!window.confirm(`Unfollow ${profile.name}?`)) return;
        await api.post(`/users/${userId}/unfollow`);
      } else {
        const { data } = await api.post(`/users/${userId}/follow`);
        if (data.status === "requested") toast.success("Follow request sent");
        else toast.success(`Now following ${profile.name}`);
      }
      load();
    } catch { toast.error("Couldn't update follow"); }
  };

  const blockUser = async () => {
    setMenuOpen(false);
    if (!window.confirm(`Block ${profile.name}? You won't see each other on Freccos.`)) return;
    try {
      await api.post(`/users/${userId}/block`);
      toast("Blocked");
      nav(-1);
    } catch { toast.error("Couldn't block"); }
  };

  const cityOpen = profile?.cities?.find((c) => c.id === openCity);

  const askOnWhatsApp = () => {
    if (!cityOpen) return;
    const text = `Hey! I was checking out your Freccos recommendations for ${cityOpen.name} — had a quick question!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const saveRec = async (rec) => {
    try { await api.post(`/trip-plans/${rec.city_id}/save`, { recommendation_id: rec.id }); toast.success("Saved to trip plan"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Couldn't save"); }
  };

  if (!profile) return <div className="p-6 t-sub muted">Loading...</div>;

  const followBtnLabel = profile.is_following ? "Following"
    : profile.request_status === "requested" ? "Requested" : "Follow";
  const followBtnIcon = profile.is_following ? <UserCheck size={16} /> :
    profile.request_status === "requested" ? <Clock size={16} /> : <UserPlus size={16} />;

  // group cities by country
  const byCountry = {};
  for (const c of profile.cities || []) (byCountry[c.country || "Other"] = byCountry[c.country || "Other"] || []).push(c);

  return (
    <div className="pb-32 fade-in" data-testid="friend-profile">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 22px", position: "relative" }}>
        <div className="flex items-center justify-between">
          <button onClick={() => nav(-1)} style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", background: "transparent", border: "none" }}>
            <ChevronLeft size={18} /> Back
          </button>
          <button
            data-testid="friend-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999 }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
              <div className="ios-card" style={{ position: "absolute", right: 16, top: 64, zIndex: 51, padding: 4, minWidth: 180 }}>
                <button data-testid="friend-block" onClick={blockUser} className="list-row w-full text-left" style={{ background: "transparent", border: "none", color: "#FF453A" }}>
                  <ShieldOff size={14} /> Block {profile.name?.split(" ")[0]}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Avatar user={profile} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-title1" style={{ color: "#fff" }}>
              {profile.name}
              {profile.is_private && <Lock size={14} style={{ marginLeft: 6, color: "#8E8E93", verticalAlign: "middle" }} />}
            </h1>
            {profile.bio && <p className="t-sub" style={{ color: "#C7C7CC" }}>{profile.bio}</p>}
            {profile.instagram_handle && (
              <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, textDecoration: "none", color: "#fff" }}>
                <span style={{ background: INSTAGRAM_GRADIENT, padding: 3, borderRadius: 6, display: "inline-flex" }}>
                  <Instagram size={12} color="#fff" />
                </span>
                <span className="t-cap" style={{ color: "#C7C7CC" }}>@{profile.instagram_handle}</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4">
          <div><div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="stat-cities">{profile.city_count}</div><div className="t-cap" style={{ color: "#8E8E93" }}>Places</div></div>
          <div><div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="stat-countries">{profile.country_count}</div><div className="t-cap" style={{ color: "#8E8E93" }}>Countries</div></div>
        </div>
        <div className="flex gap-4 mt-2 t-cap" style={{ color: "#8E8E93" }}>
          <button onClick={() => profile.can_view && nav(`/user/${userId}/followers`)} style={{ background: "transparent", border: "none", color: "#C7C7CC", padding: 0 }}>
            <strong style={{ color: "#fff" }}>{profile.follower_count}</strong> followers
          </button>
          <span>·</span>
          <button onClick={() => profile.can_view && nav(`/user/${userId}/following`)} style={{ background: "transparent", border: "none", color: "#C7C7CC", padding: 0 }}>
            <strong style={{ color: "#fff" }}>{profile.following_count}</strong> following
          </button>
        </div>

        <button
          data-testid="follow-btn"
          onClick={toggleFollow}
          className="btn-pill mt-4"
          style={{
            background: (profile.is_following || profile.request_status === "requested") ? "rgba(255,255,255,0.16)" : "#0A84FF",
            color: "#fff",
          }}
        >
          {followBtnIcon}{followBtnLabel}
        </button>
      </div>

      {/* Private + not following: limited view */}
      {!profile.can_view && (
        <div className="px-6 mt-8" data-testid="private-locked">
          <Lock size={28} color="#C7C7CC" />
          <h3 className="t-title2 mt-2">This account is private</h3>
          <p className="t-sub muted mt-1">
            Follow {profile.name?.split(" ")[0]} to see their recommendations, cities, and travel stats.
          </p>
        </div>
      )}

      {profile.can_view && !openCity && (
        Object.keys(byCountry).length === 0 ? (
          <div className="px-6 mt-8"><p className="t-sub muted">{profile.name} hasn&apos;t added any places yet — maybe nudge them!</p></div>
        ) : Object.entries(byCountry).map(([country, cities]) => (
          <div key={country}>
            <div className="section-header">{flagForCountry(country)} {country}</div>
            <div className="ios-card mx-4" style={{ overflow: "hidden" }}>
              {cities.map((c) => (
                <button key={c.id} data-testid={`friend-city-${c.id}`} className="list-row w-full text-left"
                  onClick={() => setOpenCity(c.id)} style={{ background: "transparent", border: "none" }}>
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

      {profile.can_view && openCity && cityOpen && (
        <div>
          <div className="px-4 pt-4 flex items-center gap-2">
            <button onClick={() => { setOpenCity(null); setRecs([]); setCategory("all"); }} style={{ background: "transparent", border: "none", color: "#0A84FF" }}>
              <ChevronLeft size={16} style={{ verticalAlign: "middle" }} /> All cities
            </button>
          </div>
          <div className="px-4 mt-2">
            <h2 className="t-title1">{cityOpen.flag_emoji} {cityOpen.name}</h2>
            <button onClick={askOnWhatsApp} className="btn-pill btn-secondary mt-3" style={{ padding: "8px 14px", fontSize: 13 }}>
              <MessageCircle size={14} /> Ask {profile.name.split(" ")[0]} about {cityOpen.name}
            </button>
          </div>
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="px-4 space-y-3">
            {recs.length === 0 && <div className="ios-card px-4 py-6 text-center t-sub muted">No recommendations here yet.</div>}
            {recs.map((r) => (
              <div key={r.id} className="ios-card" style={{ padding: "14px 16px" }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="t-title3">{r.place_name}</div>
                    <div className="mt-1"><CategoryChip category={r.category} /></div>
                    {r.note && <p className="t-body mt-2">{r.note}</p>}
                    <div className="t-cap tertiary mt-2">{formatMonthYear(r.created_at)}</div>
                  </div>
                  <button onClick={() => saveRec(r)} className="chip" style={{ background: "rgba(120,120,128,0.08)", color: "#0A84FF", fontWeight: 600, padding: "8px 12px" }}>
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
