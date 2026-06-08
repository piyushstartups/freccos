import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import Avatar from "../components/Avatar";
import BottomSheet from "../components/BottomSheet";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddTripSheet from "../components/AddTripSheet";
import ConfirmDialog from "../components/ConfirmDialog";
import PlaceSheet from "../components/PlaceSheet";
import Wordmark from "../components/Wordmark";
import ImpactSummaryCard from "../components/ImpactSummaryCard";
import { track, Events } from "../lib/analytics";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { flagForCountry } from "../lib/flags";
import {
  Settings, Share2, LogOut, Pencil, Trash2, ChevronLeft, ChevronRight, Plus, Map, MoreHorizontal,
  Download, Instagram, Shield, Lock, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear, photoUrl } from "../lib/utils-frec";

const INSTAGRAM_GRADIENT = "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)";

export default function MyProfile() {
  const { user, logout, setUser } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [trips, setTrips] = useState([]);
  const [openCityId, setOpenCityId] = useState(null);
  const [category, setCategory] = useState("all");
  const [myRecs, setMyRecs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [addRecOpen, setAddRecOpen] = useState(false);
  const [addRecLockedCity, setAddRecLockedCity] = useState(null);
  const [editingRec, setEditingRec] = useState(null);
  const [addTripOpen, setAddTripOpen] = useState(false);
  const [menuRecId, setMenuRecId] = useState(null);
  const [countryFilter, setCountryFilter] = useState(null);
  const [placeOpen, setPlaceOpen] = useState(null); // { group, cityId }
  // Confirm-dialog state: { type: 'trip'|'rec', payload: {...}, title, message }
  const [confirm, setConfirm] = useState(null);

  // Build a PlaceSheet-compatible "group" object from a single rec.
  const openPlaceFromRec = (r, cityId) => {
    setPlaceOpen({
      cityId,
      group: {
        place_key: r.id,
        place_name: r.place_name,
        place_id: r.place_id,
        place_address: r.place_address,
        category: r.category,
        photo_url: r.photo_url,
        is_saved: false,
        primary_rec_id: r.id,
        contributors: [{
          ...r,
          user: { id: user.id, name: user.name, profile_photo_url: user.profile_photo_url },
        }],
      },
    });
  };

  const load = async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      api.get(`/users/${user.id}`),
      api.get("/trips"),
    ]);
    setProfile(p);
    setTrips(t);
  };
  useEffect(() => { if (user?.id) load(); /* eslint-disable-next-line */ }, [user?.id]);

  const loadRecs = async (cityId, cat = category) => {
    const { data } = await api.get(`/users/${user.id}/cities/${cityId}/recommendations`, {
      params: cat === "all" ? {} : { category: cat },
    });
    setMyRecs(data);
  };

  useEffect(() => { if (openCityId) loadRecs(openCityId, category); /* eslint-disable-next-line */ }, [openCityId, category]);

  const shareInvite = async () => {
    const text = `Join me on Freccos! Use my invite code: ${user.invite_code} https://freccos.com`;
    track(Events.INVITE_CODE_SHARED, { surface: "profile" });
    if (navigator.share) try { await navigator.share({ text }); } catch { /* user cancelled */ }
    else try { await navigator.clipboard.writeText(text); toast.success("Invite copied"); } catch { toast("Copy failed"); }
  };

  const requestDeleteRec = (rec) => {
    setMenuRecId(null);
    setConfirm({
      type: "rec",
      payload: rec,
      title: "Delete this recommendation?",
      message: `'${rec.place_name}' will be permanently removed from your profile.`,
      confirmLabel: "Delete",
    });
  };

  const requestDeleteTrip = (city) => {
    setConfirm({
      type: "trip",
      payload: city,
      title: `Remove ${city.name}?`,
      message: `${city.name} will be removed from your profile, along with every recommendation you added there. This cannot be undone.`,
      confirmLabel: "Remove",
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { type, payload } = confirm;
    setConfirm(null);
    try {
      if (type === "rec") {
        await api.delete(`/recommendations/${payload.id}`);
        toast("Deleted");
        // Re-fetch from server so UI matches DB
        if (openCityId) await loadRecs(openCityId, category);
        await load();
      } else if (type === "trip") {
        const { data } = await api.delete(`/trips/${payload.id}`);
        toast.success(
          data?.deleted_recommendations
            ? `${payload.name} removed (${data.deleted_recommendations} recommendation${data.deleted_recommendations === 1 ? "" : "s"} deleted)`
            : `${payload.name} removed`
        );
        setOpenCityId(null);
        setMyRecs([]);
        setCategory("all");
        await load();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't delete. Please try again.");
    }
  };

  const startEdit = (rec) => { setMenuRecId(null); setEditingRec(rec); setAddRecLockedCity(null); setAddRecOpen(true); };

  if (!user || !profile) return <div className="p-6 t-sub muted">Loading...</div>;

  // Merge backend cities + manual trips
  const cityById = {};
  for (const c of profile.cities || []) cityById[c.id] = c;
  for (const t of trips) if (!cityById[t.city_id] && t.city) cityById[t.city_id] = { ...t.city, rec_count: t.rec_count, photos: [] };
  const allCities = Object.values(cityById);
  const countries = Array.from(new Set(allCities.map((c) => c.country).filter(Boolean))).sort();

  const visibleCities = countryFilter ? allCities.filter((c) => c.country === countryFilter) : allCities;
  const byCountry = {};
  for (const c of visibleCities) (byCountry[c.country || "Other"] = byCountry[c.country || "Other"] || []).push(c);

  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  const cityOpen = allCities.find((c) => c.id === openCityId);

  return (
    <div className="pb-32 fade-in" data-testid="my-profile">
      <ProfileHero
        profile={profile}
        cityCount={allCities.length}
        countryCount={countries.length}
        countries={countries}
        joined={joined}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        onSettings={() => setShowSettings(true)}
        onTapFollowers={() => nav(`/user/${user.id}/followers`)}
        onTapFollowing={() => nav(`/user/${user.id}/following`)}
      />

      {!openCityId && (
        <>
          <ImpactSummaryCard />

          <div className="px-4 pt-4 flex items-center justify-between">
            <h2 className="t-title2">Trips</h2>
            <button data-testid="me-add-trip" onClick={() => setAddTripOpen(true)} className="btn-pill"
              style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF", padding: "8px 14px", fontSize: 13 }}>
              <Map size={14} /> Add a trip
            </button>
          </div>

          {allCities.length === 0 && (
            <div className="px-6 mt-6" data-testid="me-empty">
              <h3 className="t-title2 mt-4">Your travels start here.</h3>
              <p className="t-sub muted mt-1">Add your first trip to start building your travel story.</p>
              <button onClick={() => setAddTripOpen(true)}
                className="btn-pill btn-primary mt-4" data-testid="me-empty-add">
                <Map size={16} /> Add a trip
              </button>
            </div>
          )}

          {allCities.length > 0 && Object.entries(byCountry).map(([country, cities]) => (
            <div key={country} style={{ marginTop: 28 }}>
              <div className="px-4" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: "#1C1C1E", letterSpacing: "-0.2px", margin: 0 }}>
                  <span style={{ fontSize: 22, marginRight: 6 }}>{flagForCountry(country)}</span>
                  {country}
                </h3>
                <span className="t-cap muted" style={{ fontSize: 12 }}>
                  {cities.length} {cities.length === 1 ? "city" : "cities"}
                </span>
              </div>
              <div className="mx-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cities.map((c) => {
                  const hasPhotos = c.photos && c.photos.length > 0;
                  const totalSaves = c.total_save_count || 0;
                  return (
                    <button
                      key={c.id}
                      data-testid={`me-city-${c.id}`}
                      onClick={() => setOpenCityId(c.id)}
                      className="ios-card w-full text-left"
                      style={{
                        background: "#fff", border: "none",
                        padding: "14px 16px",
                        display: "flex", gap: 14, alignItems: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="t-title3" style={{ fontSize: 16 }}>{c.name}</div>
                        {c.rec_count > 0 ? (
                          <div className="t-cap muted" style={{ marginTop: 2 }}>
                            {c.rec_count} recommendation{c.rec_count === 1 ? "" : "s"}
                          </div>
                        ) : (
                          <div className="t-cap" style={{ marginTop: 2, color: "#0A84FF", fontWeight: 500 }}>
                            + Add recs
                          </div>
                        )}
                        {totalSaves > 0 && (
                          <div
                            data-testid={`me-city-saves-${c.id}`}
                            style={{ marginTop: 2, fontSize: 12, color: "#0A84FF", fontWeight: 500 }}
                          >
                            Saved by {totalSaves} {totalSaves === 1 ? "person" : "people"}
                          </div>
                        )}
                      </div>
                      {/* Photo peek stack (if available) */}
                      {hasPhotos && (
                        <div style={{ display: "flex", marginRight: 8, flexShrink: 0 }}>
                          {c.photos.slice(0, 3).map((p, i) => (
                            <div
                              key={i}
                              style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: `#eee url('${photoUrl(p)}') center/cover`,
                                border: "2px solid #fff",
                                marginLeft: i === 0 ? 0 : -10,
                                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <ChevronRight size={18} color="#C7C7CC" style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* City detail */}
      {openCityId && cityOpen && (
        <div data-testid="me-city-detail">
          <div className="px-4 pt-3 flex items-center justify-between gap-2">
            <button onClick={() => { setOpenCityId(null); setMyRecs([]); setCategory("all"); }} style={{ background: "transparent", border: "none", color: "#0A84FF" }}>
              <ChevronLeft size={16} style={{ verticalAlign: "middle" }} /> All trips
            </button>
            <div className="flex gap-2">
              <button data-testid="me-city-add-rec" onClick={() => { setEditingRec(null); setAddRecLockedCity(cityOpen); setAddRecOpen(true); }} className="btn-pill" style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF", padding: "8px 12px", fontSize: 13 }}>
                <Plus size={14} /> Add a rec
              </button>
              <button data-testid={`me-delete-trip-${cityOpen.id}`} onClick={() => requestDeleteTrip(cityOpen)} style={{ background: "transparent", border: "none", color: "#FF453A", padding: 6 }} title="Delete this city">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="px-4 pt-3 mt-1" style={{ position: "relative" }}>
            <span aria-hidden style={{ position: "absolute", top: 32, right: 16, fontSize: 30, lineHeight: 1, opacity: 0.95 }}>
              {cityOpen.flag_emoji}
            </span>
            <h2 className="t-title1" style={{ paddingRight: 56, margin: 0 }}>{cityOpen.name}</h2>
            {cityOpen.country && (
              <p className="t-cap muted" style={{ marginTop: 2 }}>{cityOpen.country}</p>
            )}
          </div>
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="px-4 space-y-3">
            {myRecs.length === 0 && (
              <div className="ios-card px-4 py-6 text-center">
                <p className="t-sub muted">You haven&apos;t added any places in {cityOpen.name} yet.</p>
                <button onClick={() => { setEditingRec(null); setAddRecLockedCity(cityOpen); setAddRecOpen(true); }} className="btn-pill btn-secondary mt-3" style={{ padding: "8px 14px", fontSize: 13 }}>
                  <Plus size={14} /> Add a rec here
                </button>
              </div>
            )}
            {myRecs.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openPlaceFromRec(r, cityOpen.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPlaceFromRec(r, cityOpen.id); } }}
                className="ios-card"
                style={{ padding: 0, overflow: "hidden", position: "relative", cursor: "pointer" }}
                data-testid={`me-rec-${r.id}`}
              >
                {r.photo_url && (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: `#eee url('${photoUrl(r.photo_url)}') center/cover` }} />
                )}
                <div style={{ padding: "12px 14px" }}>
                  <div className="flex items-start gap-3">
                    <div style={{ flex: 1 }}>
                      <div className="t-title3">{r.place_name}</div>
                      <div className="mt-1"><CategoryChip category={r.category} /></div>
                      {r.note && <p className="t-body mt-2">{r.note}</p>}
                      <div className="t-cap tertiary mt-2">{formatMonthYear(r.created_at)}</div>
                    </div>
                    <button
                      data-testid={`me-rec-menu-${r.id}`}
                      onClick={(e) => { e.stopPropagation(); setMenuRecId(menuRecId === r.id ? null : r.id); }}
                      style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4 }}
                      aria-label="More"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact invite-code footer — same style as People tab invite card */}
      <div className="ios-card mx-4 px-4 py-3 flex items-center gap-3 mt-6 mb-2" data-testid="invite-card">
        <Share2 size={18} color="#0A84FF" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title3">Invite a friend to Freccos</div>
          <div className="t-cap muted">Share your invite code · <span data-testid="invite-code">{user.invite_code}</span></div>
        </div>
        <button data-testid="invite-share" onClick={shareInvite} className="btn-pill btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
          Share
        </button>
      </div>

      <SettingsSheet
        open={showSettings} onClose={() => setShowSettings(false)}
        user={user}
        onUpdated={(updated) => { setUser(updated); load(); }}
        onLogout={async () => { await logout(); nav("/login", { replace: true }); }}
        onBlocked={() => { setShowSettings(false); nav("/me/blocked"); }}
      />

      <AddRecommendationSheet
        open={addRecOpen}
        onClose={() => { setAddRecOpen(false); setEditingRec(null); }}
        lockedCity={addRecLockedCity}
        editingRec={editingRec}
        onCreated={() => { load(); if (openCityId) loadRecs(openCityId, category); }}
      />

      <AddTripSheet open={addTripOpen} onClose={() => setAddTripOpen(false)} onAdded={() => load()} />

      {/* Rec action sheet — rendered at root level so the rec card's overflow:hidden
          stacking context can't trap it. iOS-style centered modal. */}
      {(() => {
        const targetRec = menuRecId ? myRecs.find((x) => x.id === menuRecId) : null;
        if (!targetRec) return null;
        return (
          <div
            data-testid="rec-action-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) setMenuRecId(null); }}
            style={{
              position: "fixed", inset: 0, zIndex: 11000,
              background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%", maxWidth: 420, background: "#fff",
                borderRadius: 14, overflow: "hidden",
                marginBottom: "max(16px, env(safe-area-inset-bottom))",
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #E5E5EA" }}>
                <div style={{ fontSize: 13, color: "#8E8E93", fontWeight: 500 }}>{targetRec.place_name}</div>
              </div>
              <button
                data-testid={`me-edit-${targetRec.id}`}
                onClick={() => startEdit(targetRec)}
                style={{
                  width: "100%", background: "transparent", border: "none",
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
                  fontSize: 16, color: "#1C1C1E", cursor: "pointer",
                  borderBottom: "1px solid #E5E5EA",
                }}
              >
                <Pencil size={16} /> Edit recommendation
              </button>
              <button
                data-testid={`me-delete-${targetRec.id}`}
                onClick={() => requestDeleteRec(targetRec)}
                style={{
                  width: "100%", background: "transparent", border: "none",
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
                  fontSize: 16, color: "#FF453A", cursor: "pointer",
                }}
              >
                <Trash2 size={16} /> Delete recommendation
              </button>
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || "Delete"}
        destructive
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
        testId="me-confirm"
      />

      <PlaceSheet
        open={!!placeOpen}
        onClose={() => setPlaceOpen(null)}
        group={placeOpen?.group}
        cityId={placeOpen?.cityId}
        onEdit={(rec) => startEdit(rec)}
        onChange={() => { if (openCityId) loadRecs(openCityId, category); }}
      />
    </div>
  );
}

function ProfileHero({ profile, cityCount, countryCount, countries, joined, countryFilter, setCountryFilter, onSettings, onTapFollowers, onTapFollowing }) {
  const followers = profile.follower_count || 0;
  const following = profile.following_count || 0;
  return (
    <div className="app-header profile-hero" style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 22px", position: "relative" }} data-testid="profile-hero">
      {/* Subtle Freccos watermark — bottom-right corner of the dark hero */}
      <div style={{ position: "absolute", bottom: 6, right: 12, pointerEvents: "none" }}>
        <Wordmark size={11} color="rgba(255,255,255,0.2)" weight={500} />
      </div>
      {/* Settings gear, top-right */}
      <button
        data-testid="settings-btn"
        onClick={onSettings}
        aria-label="Settings"
        style={{
          position: "absolute", top: "calc(var(--safe-area-top) - 6px)", right: 8,
          background: "transparent", border: "none", color: "#fff",
          width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: 9999,
        }}
      >
        <Settings size={24} strokeWidth={1.8} />
      </button>

      {/* Identity row: avatar left, name + bio + handle right (all left-aligned) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingRight: 44 }}>
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
              data-testid="profile-ig"
            >
              <span style={{ background: INSTAGRAM_GRADIENT, padding: 2, borderRadius: 5, display: "inline-flex" }}>
                <Instagram size={11} color="#fff" />
              </span>
              <span style={{ color: "#C7C7CC", fontSize: 12 }}>@{profile.instagram_handle}</span>
            </a>
          )}
        </div>
      </div>

      {/* Stats — bold, prominent numbers with small labels (Apple Music-style metrics) */}
      <div
        style={{
          display: "flex", alignItems: "baseline", gap: 18, marginTop: 14, flexWrap: "wrap",
        }}
        data-testid="profile-stats-row"
      >
        <Stat n={cityCount} label={cityCount === 1 ? "Recco" : "Reccos"} testId="hero-places" />
        <Stat n={countryCount} label={countryCount === 1 ? "Country" : "Countries"} testId="hero-countries" />
        <Stat n={followers} label={followers === 1 ? "Follower" : "Followers"} onClick={onTapFollowers} testId="hero-followers" />
        <Stat n={following} label="Following" onClick={onTapFollowing} testId="hero-following" />
      </div>

      {/* Flag grid — compact */}
      {countries.length > 0 ? (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }} data-testid="flag-grid">
          {countries.map((country) => {
            const active = countryFilter === country;
            return (
              <button
                key={country}
                onClick={() => setCountryFilter(active ? null : country)}
                title={country}
                style={{
                  padding: "4px 8px", fontSize: 18, lineHeight: 1,
                  background: active ? "rgba(10,132,255,0.25)" : "rgba(255,255,255,0.08)",
                  border: active ? "1px solid #0A84FF" : "1px solid transparent",
                  color: "#fff", borderRadius: 8, cursor: "pointer",
                }}
              >
                {flagForCountry(country)}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", gap: 6 }} data-testid="flag-grid-empty">
          {[1,2,3,4].map((i) => (
            <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(229,229,234,0.08)", border: "1px dashed #3a3a3c" }} />
          ))}
        </div>
      )}

      {/* Milestones removed per design spec */}

      {joined && (
        <p style={{ color: "#5A5A5F", fontSize: 11, marginTop: 10, marginBottom: 0 }}>On Freccos since {joined}</p>
      )}
    </div>
  );
}

function Stat({ n, label, onClick, testId }) {
  const inner = (
    <>
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.4px" }}>{n}</div>
      <div style={{ color: "#8E8E93", fontSize: 11, fontWeight: 500, letterSpacing: 0.3, marginTop: 4, textTransform: "uppercase" }}>{label}</div>
    </>
  );
  if (onClick) {
    return (
      <button data-testid={testId} onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
        {inner}
      </button>
    );
  }
  return <div data-testid={testId}>{inner}</div>;
}

function Dot() {
  return <span style={{ color: "#3a3a3c" }}>·</span>;
}

function PhotoCollage({ photos }) {
  if (photos.length === 1) {
    return <div style={{ width: 64, height: 64, borderRadius: 10, background: `#eee url('${photoUrl(photos[0])}') center/cover` }} />;
  }
  return (
    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 }}>
      {photos.slice(0, 4).map((p, i) => (
        <div key={i} style={{ background: `#eee url('${photoUrl(p)}') center/cover` }} />
      ))}
    </div>
  );
}

function SettingsSheet({ open, onClose, user, onUpdated, onLogout, onBlocked }) {
  const nav = useNavigate();
  const [view, setView] = useState("main"); // main | edit
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [igHandle, setIgHandle] = useState(user?.instagram_handle || "");
  const [isPrivate, setIsPrivate] = useState(!!user?.is_private);
  const [photoPath, setPhotoPath] = useState(user?.profile_photo_url || null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setView("main"); setName(user?.name || ""); setBio(user?.bio || ""); setIgHandle(user?.instagram_handle || ""); setIsPrivate(!!user?.is_private); setPhotoPath(user?.profile_photo_url || null); setPhotoPreview(null); } }, [open, user]);

  const togglePrivate = async (next) => {
    setIsPrivate(next);
    try {
      const { data } = await api.patch("/users/me", { is_private: next });
      onUpdated(data);
      toast.success(next ? "Account is now private" : "Account is now public");
    } catch { toast.error("Couldn't update"); setIsPrivate(!next); }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const payload = { name, bio, profile_photo_url: photoPath, instagram_handle: igHandle.replace(/^@/, "").trim() || null };
      const { data } = await api.patch("/users/me", payload);
      onUpdated(data); setView("main"); toast.success("Profile updated");
    } catch { toast.error("Couldn't save"); } finally { setBusy(false); }
  };

  const handlePhoto = async (f) => {
    if (!f) return;
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoPath(data.url); setPhotoPreview(URL.createObjectURL(f));
    } catch { toast.error("Couldn't upload."); }
  };

  if (!open) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Settings" testId="settings-sheet">
      <div className="px-4 pb-8" style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}>
        {view === "main" && (
          <div className="space-y-2">
            <button data-testid="settings-edit" className="list-row w-full text-left ios-card" onClick={() => setView("edit")} style={{ border: "none" }}>
              <Pencil size={16} /> <span style={{ flex: 1 }}>Edit profile</span> <span className="muted">›</span>
            </button>
            <div className="list-row ios-card" style={{ border: "none" }} data-testid="settings-private-row">
              <Lock size={16} />
              <div style={{ flex: 1 }}>
                <div className="t-title3">Private account</div>
                <div className="t-cap muted">When private, only people you approve can see your recommendations.</div>
              </div>
              <Toggle on={isPrivate} onChange={togglePrivate} testid="settings-private-toggle" />
            </div>
            <button data-testid="settings-blocked" className="list-row w-full text-left ios-card" onClick={onBlocked} style={{ border: "none" }}>
              <Shield size={16} /> <span style={{ flex: 1 }}>Blocked accounts</span> <span className="muted">›</span>
            </button>
            <button
              data-testid="settings-notifications"
              className="list-row w-full text-left ios-card"
              onClick={() => { onClose?.(); nav("/me/notifications"); }}
              style={{ border: "none" }}
            >
              <Bell size={16} /> <span style={{ flex: 1 }}>Notifications</span> <span className="muted">›</span>
            </button>
            <button
              data-testid="settings-install"
              className="list-row w-full text-left ios-card"
              onClick={() => { if (typeof window !== "undefined" && window.freccosShowInstall) { window.freccosShowInstall(); onClose?.(); } }}
              style={{ border: "none" }}
            >
              <Download size={16} /> <span style={{ flex: 1 }}>Install Freccos as an app</span> <span className="muted">›</span>
            </button>
            <button data-testid="settings-logout" className="list-row w-full text-left ios-card" onClick={onLogout} style={{ border: "none", color: "#FF453A" }}>
              <LogOut size={16} /> <span style={{ flex: 1 }}>Log out</span>
            </button>
            <div
              style={{
                display: "flex", justifyContent: "center", gap: 16,
                margin: "20px 0 4px",
              }}
              data-testid="settings-legal"
            >
              <Link
                to="/privacy"
                onClick={onClose}
                className="t-cap muted"
                style={{ color: "#8E8E93", textDecoration: "none" }}
                data-testid="settings-privacy-link"
              >
                Privacy policy
              </Link>
              <span className="t-cap muted" style={{ color: "#C7C7CC" }}>·</span>
              <Link
                to="/terms"
                onClick={onClose}
                className="t-cap muted"
                style={{ color: "#8E8E93", textDecoration: "none" }}
                data-testid="settings-terms-link"
              >
                Terms of service
              </Link>
            </div>
            <button
              data-testid="settings-delete"
              className="list-row w-full text-left ios-card"
              style={{ border: "none", color: "#FF453A", marginTop: 24 }}
              onClick={async () => {
                if (!window.confirm("Delete your account? This will permanently delete all your recommendations, trips, and profile. This cannot be undone.")) return;
                try {
                  await api.delete("/users/me");
                  toast.success("Account deleted");
                  window.location.href = "/login";
                } catch { toast.error("Couldn't delete account"); }
              }}
            >
              <Trash2 size={16} /> <span style={{ flex: 1 }}>Delete account</span>
            </button>
          </div>
        )}
        {view === "edit" && (
          <div>
            <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }}
              onChange={(e) => handlePhoto(e.target.files?.[0])} />
            <div className="flex items-center gap-3 mb-4">
              <div onClick={() => fileRef.current?.click()}
                style={{ width: 64, height: 64, borderRadius: "50%",
                  background: photoPreview ? `url('${photoPreview}') center/cover` : photoPath ? `url('${photoUrl(photoPath)}') center/cover` : "rgba(120,120,128,0.16)",
                  cursor: "pointer" }} />
              <button onClick={() => fileRef.current?.click()} className="btn-pill btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }}>
                Change photo
              </button>
            </div>
            <label className="t-label muted block mb-1">Name</label>
            <input data-testid="settings-name" className="ios-input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="t-label muted block mb-1">Bio</label>
            <textarea data-testid="settings-bio" rows={3} className="ios-input" value={bio} onChange={(e) => setBio(e.target.value)} style={{ resize: "vertical" }} />
            <label className="t-label muted block mb-1 mt-3">Instagram</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }}>@</span>
              <input
                data-testid="settings-instagram"
                className="ios-input" style={{ paddingLeft: 28 }}
                placeholder="yourhandle"
                value={igHandle}
                onChange={(e) => setIgHandle(e.target.value.replace(/^@/, ""))}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-pill btn-secondary flex-1" onClick={() => setView("main")}>Cancel</button>
              <button data-testid="settings-save" className="btn-pill btn-primary flex-1" onClick={saveProfile} disabled={busy}>Save</button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Toggle({ on, onChange, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 26, borderRadius: 14,
        background: on ? "#30D158" : "#E5E5EA",
        position: "relative", border: "none", cursor: "pointer",
        transition: "background 200ms",
      }}
      aria-pressed={on}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 20 : 2, width: 22, height: 22,
        background: "#fff", borderRadius: "50%",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        transition: "left 200ms",
      }} />
    </button>
  );
}
