import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import {
  ChevronLeft, UserCheck, UserPlus, MessageCircle, Bookmark,
  Instagram, MoreHorizontal, ShieldOff, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";
import { flagForCountry } from "../lib/flags";

const INSTAGRAM_GRADIENT = "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)";

function Stat({ n, label, onClick, testId, disabled }) {
  const inner = (
    <>
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.4px" }}>{n}</div>
      <div style={{ color: "#8E8E93", fontSize: 11, fontWeight: 500, letterSpacing: 0.3, marginTop: 4, textTransform: "uppercase" }}>{label}</div>
    </>
  );
  if (onClick && !disabled) {
    return (
      <button data-testid={testId} onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
        {inner}
      </button>
    );
  }
  return <div data-testid={testId}>{inner}</div>;
}

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

  const countries = Object.keys(byCountry).filter((c) => c !== "Other");
  const joined = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const followers = profile.follower_count || 0;
  const following = profile.following_count || 0;

  return (
    <div className="pb-32 fade-in" data-testid="friend-profile">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "20px 16px 18px", position: "relative" }}>
        <button onClick={() => nav(-1)} style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", background: "transparent", border: "none", padding: 0, fontSize: 15 }}>
          <ChevronLeft size={20} /> Back
        </button>

        {/* Three-dot menu — top right, same position as settings gear on personal profile */}
        <button
          data-testid="friend-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="More"
          style={{
            position: "absolute", top: 22, right: 8,
            background: "transparent", border: "none", color: "#fff",
            width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
            borderRadius: 9999,
          }}
        >
          <MoreHorizontal size={22} strokeWidth={1.8} />
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

        {/* Identity row: avatar left, name + bio + handle right (all left-aligned) */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingRight: 44, marginTop: 8 }}>
          <Avatar user={profile} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.3px", lineHeight: 1.1 }}>
              {profile.name}
            </h1>
            {profile.bio && (
              <p style={{ color: "#C7C7CC", fontSize: 14, margin: "4px 0 0", lineHeight: 1.3 }}>{profile.bio}</p>
            )}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle}`}
                target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, textDecoration: "none", color: "#fff" }}
              >
                <span style={{ background: INSTAGRAM_GRADIENT, padding: 2, borderRadius: 5, display: "inline-flex" }}>
                  <Instagram size={11} color="#fff" />
                </span>
                <span style={{ color: "#C7C7CC", fontSize: 12 }}>@{profile.instagram_handle}</span>
              </a>
            )}
          </div>
        </div>

        {/* Stats — bold prominent numbers, identical treatment to personal profile */}
        <div
          style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 14, flexWrap: "wrap" }}
          data-testid="profile-stats-row"
        >
          <Stat n={profile.city_count} label={profile.city_count === 1 ? "Place" : "Places"} testId="stat-cities" />
          <Stat n={profile.country_count} label={profile.country_count === 1 ? "Country" : "Countries"} testId="stat-countries" />
          <Stat n={followers} label={followers === 1 ? "Follower" : "Followers"}
                onClick={() => profile.can_view && nav(`/user/${userId}/followers`)}
                disabled={!profile.can_view} testId="stat-followers" />
          <Stat n={following} label="Following"
                onClick={() => profile.can_view && nav(`/user/${userId}/following`)}
                disabled={!profile.can_view} testId="stat-following" />
        </div>

        {/* Country flag grid — compact, same as personal profile */}
        {countries.length > 0 ? (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }} data-testid="friend-flag-grid">
            {countries.map((country) => (
              <span
                key={country}
                title={country}
                style={{
                  padding: "4px 8px", fontSize: 18, lineHeight: 1,
                  background: "rgba(255,255,255,0.08)", color: "#fff",
                  borderRadius: 8,
                }}
              >
                {flagForCountry(country)}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", gap: 6 }} data-testid="friend-flag-grid-empty">
            {[1,2,3,4].map((i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(229,229,234,0.08)", border: "1px dashed #3a3a3c" }} />
            ))}
          </div>
        )}

        {joined && (
          <p style={{ color: "#5A5A5F", fontSize: 11, marginTop: 10, marginBottom: 0 }}>On Freccos since {joined}</p>
        )}

        {/* Follow / Following / Requested — full-width pill, own row, breathing room */}
        <button
          data-testid="follow-btn"
          onClick={toggleFollow}
          className="btn-pill"
          style={{
            width: "100%",
            marginTop: 16,
            padding: "12px 18px",
            background: (profile.is_following || profile.request_status === "requested") ? "rgba(255,255,255,0.16)" : "#0A84FF",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {followBtnIcon}{followBtnLabel}
        </button>
      </div>

      {/* Private + not following: limited view */}
      {!profile.can_view && (
        <div className="px-6 mt-8" data-testid="private-locked">
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
