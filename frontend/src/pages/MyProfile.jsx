import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import Avatar from "../components/Avatar";
import BottomSheet from "../components/BottomSheet";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddTripSheet from "../components/AddTripSheet";
import Wordmark from "../components/Wordmark";
import { FreccosLogo } from "./Splash";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { flagForCountry } from "../lib/flags";
import {
  Settings, Share2, Copy, LogOut, Pencil, Trash2, ChevronLeft, Plus, Map, MoreHorizontal,
  Download, Instagram, Shield, Lock,
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
    const text = `Join me on Freccos! Use my code: ${user.invite_code} — freccos.com`;
    if (navigator.share) try { await navigator.share({ text }); } catch { /* user cancelled */ }
    else try { await navigator.clipboard.writeText(text); toast.success("Invite copied"); } catch { toast("Copy failed"); }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(user.invite_code); toast.success("Code copied"); }
    catch { toast("Copy failed"); }
  };

  const deleteRec = async (rec) => {
    setMenuRecId(null);
    if (!window.confirm("Delete this recommendation?")) return;
    try { await api.delete(`/recommendations/${rec.id}`); toast("Deleted"); loadRecs(openCityId, category); load(); }
    catch { toast.error("Couldn't delete"); }
  };

  const startEdit = (rec) => { setMenuRecId(null); setEditingRec(rec); setAddRecLockedCity(null); setAddRecOpen(true); };

  const deleteTrip = async (cityId) => {
    if (!window.confirm("Remove this city from your trips? Any recommendations you've added stay safe.")) return;
    try { await api.delete(`/trips/${cityId}`); toast("Removed from trips"); load(); }
    catch { toast.error("Couldn't remove"); }
  };

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

  const totalRecs = allCities.reduce((s, c) => s + (c.rec_count || 0), 0);
  const milestones = [];
  if (totalRecs >= 1) milestones.push("First rec added 🎉");
  if (totalRecs >= 10) milestones.push("10 places logged ✈️");
  if (countries.length >= 5) milestones.push("5 countries explored 🌍");
  if ((profile.follower_count || 0) >= 20) milestones.push("20 followers 👥");
  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null;

  const cityOpen = allCities.find((c) => c.id === openCityId);

  return (
    <div className="pb-32 fade-in" data-testid="my-profile">
      <ProfileHero
        profile={profile}
        cityCount={allCities.length}
        countryCount={countries.length}
        countries={countries}
        milestones={milestones}
        joined={joined}
        countryFilter={countryFilter}
        setCountryFilter={setCountryFilter}
        onSettings={() => setShowSettings(true)}
        onTapFollowers={() => nav(`/user/${user.id}/followers`)}
        onTapFollowing={() => nav(`/user/${user.id}/following`)}
      />

      {!openCityId && (
        <>
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
              <p className="t-sub muted mt-1">Add your first place and start building your travel story.</p>
              <button onClick={() => { setEditingRec(null); setAddRecLockedCity(null); setAddRecOpen(true); }}
                className="btn-pill btn-primary mt-4" data-testid="me-empty-add">
                <Plus size={16} /> Add a place
              </button>
            </div>
          )}

          {allCities.length > 0 && Object.entries(byCountry).map(([country, cities]) => (
            <div key={country}>
              <div className="section-header">
                {flagForCountry(country)} {country} <span className="tertiary">· {cities.length} {cities.length === 1 ? "city" : "cities"}</span>
              </div>
              <div className="mx-4 space-y-2">
                {cities.map((c) => (
                  <button
                    key={c.id}
                    data-testid={`me-city-${c.id}`}
                    onClick={() => setOpenCityId(c.id)}
                    className="ios-card w-full text-left"
                    style={{ background: "#fff", border: "none", padding: 12, display: "flex", gap: 12, alignItems: "center" }}
                  >
                    {(c.photos && c.photos.length > 0) ? (
                      <PhotoCollage photos={c.photos} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 10, background: "#F2F2F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {c.flag_emoji}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-title3">{c.name}</div>
                      <div className="t-cap muted">
                        {c.rec_count > 0 ? `${c.rec_count} recommendation${c.rec_count === 1 ? "" : "s"}` : "No recommendations yet"}
                      </div>
                    </div>
                    <span className="muted">›</span>
                  </button>
                ))}
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
              <button onClick={() => deleteTrip(cityOpen.id)} style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 6 }} title="Remove from trips">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <h2 className="t-title1 px-4 mt-1">{cityOpen.flag_emoji} {cityOpen.name}</h2>
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
              <div key={r.id} className="ios-card" style={{ padding: 0, overflow: "hidden", position: "relative" }} data-testid={`me-rec-${r.id}`}>
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
                    <button data-testid={`me-rec-menu-${r.id}`} onClick={() => setMenuRecId(menuRecId === r.id ? null : r.id)}
                      style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4 }} aria-label="More">
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                  {menuRecId === r.id && (
                    <>
                      <div onClick={() => setMenuRecId(null)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                      <div className="ios-card" style={{ position: "absolute", right: 12, top: 40, zIndex: 51, padding: 4, minWidth: 160 }}>
                        <button data-testid={`me-edit-${r.id}`} onClick={() => startEdit(r)} className="list-row w-full text-left" style={{ background: "transparent", border: "none" }}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button data-testid={`me-delete-${r.id}`} onClick={() => deleteRec(r)} className="list-row w-full text-left" style={{ background: "transparent", border: "none", color: "#FF453A" }}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite card */}
      <div className="section-header">Your invite code</div>
      <div className="ios-card mx-4 px-4 py-4 flex items-center gap-3" data-testid="invite-card">
        <div style={{ flex: 1 }}>
          <div className="t-cap muted">Bring friends along</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3 }} data-testid="invite-code">{user.invite_code}</div>
        </div>
        <button data-testid="invite-copy" onClick={copyCode} className="btn-pill btn-secondary" style={{ padding: "8px 12px", fontSize: 13 }}>
          <Copy size={14} /> Copy
        </button>
        <button data-testid="invite-share" onClick={shareInvite} className="btn-pill btn-primary" style={{ padding: "8px 12px", fontSize: 13 }}>
          <Share2 size={14} /> Share
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
    </div>
  );
}

function ProfileHero({ profile, cityCount, countryCount, countries, milestones, joined, countryFilter, setCountryFilter, onSettings, onTapFollowers, onTapFollowing }) {
  return (
    <div style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 24px", position: "relative", overflow: "hidden" }} data-testid="profile-hero">
      {/* Decorative dim world background */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25, pointerEvents: "none",
        background: "radial-gradient(circle at 20% 30%, #2c2c2e 0 35%, transparent 35%), radial-gradient(circle at 80% 60%, #2c2c2e 0 30%, transparent 30%), radial-gradient(circle at 50% 80%, #2c2c2e 0 25%, transparent 25%)",
      }} />
      <div style={{ position: "relative" }}>
        <div className="flex items-center justify-between">
          <FreccosLogo size={36} />
          <button data-testid="settings-btn" onClick={onSettings}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999 }}
            aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Avatar user={profile} size={80} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-title1" style={{ color: "#fff" }}>
              {profile.name}
              {profile.is_private && <Lock size={14} style={{ marginLeft: 6, color: "#8E8E93", verticalAlign: "middle" }} />}
            </h1>
            {profile.bio && <p className="t-sub" style={{ color: "#C7C7CC" }}>{profile.bio}</p>}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle}`}
                target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, textDecoration: "none", color: "#fff" }}
                data-testid="profile-ig"
              >
                <span style={{ background: INSTAGRAM_GRADIENT, padding: 3, borderRadius: 6, display: "inline-flex" }}>
                  <Instagram size={12} color="#fff" />
                </span>
                <span className="t-cap" style={{ color: "#C7C7CC" }}>@{profile.instagram_handle}</span>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-8 mt-6">
          <div data-testid="hero-places">
            <div style={{ color: "#fff", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{cityCount}</div>
            <div className="t-cap" style={{ color: "#8E8E93", marginTop: 4 }}>Places</div>
          </div>
          <div data-testid="hero-countries">
            <div style={{ color: "#fff", fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{countryCount}</div>
            <div className="t-cap" style={{ color: "#8E8E93", marginTop: 4 }}>Countries</div>
          </div>
        </div>

        <div className="flex gap-4 mt-3 t-cap" style={{ color: "#8E8E93" }}>
          <button data-testid="hero-followers" onClick={onTapFollowers} style={{ background: "transparent", border: "none", color: "#C7C7CC", padding: 0 }}>
            <strong style={{ color: "#fff" }}>{profile.follower_count}</strong> followers
          </button>
          <span>·</span>
          <button data-testid="hero-following" onClick={onTapFollowing} style={{ background: "transparent", border: "none", color: "#C7C7CC", padding: 0 }}>
            <strong style={{ color: "#fff" }}>{profile.following_count}</strong> following
          </button>
        </div>

        {/* Country flag grid */}
        {countries.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" data-testid="flag-grid">
            {countries.map((country) => {
              const active = countryFilter === country;
              return (
                <button
                  key={country}
                  onClick={() => setCountryFilter(active ? null : country)}
                  className="chip"
                  style={{
                    padding: "6px 10px", fontSize: 18, lineHeight: 1,
                    background: active ? "rgba(10,132,255,0.25)" : "rgba(255,255,255,0.08)",
                    border: active ? "1px solid #0A84FF" : "1px solid transparent",
                    color: "#fff",
                  }}
                  title={country}
                >
                  {flagForCountry(country)}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 flex gap-2" data-testid="flag-grid-empty">
            {[1,2,3,4].map((i) => (
              <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(229,229,234,0.12)", border: "1px dashed #3a3a3c" }} />
            ))}
          </div>
        )}

        {joined && (
          <p className="t-cap" style={{ color: "#3a3a3c", marginTop: 12 }}>On Freccos since {joined}</p>
        )}

        {milestones.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="milestones">
            {milestones.map((m) => (
              <span key={m} className="chip" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 11 }}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
