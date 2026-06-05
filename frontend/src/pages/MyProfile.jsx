import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import Avatar from "../components/Avatar";
import BottomSheet from "../components/BottomSheet";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddTripSheet from "../components/AddTripSheet";
import { FreccosLogo } from "./Splash";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { Settings, Share2, Copy, LogOut, Pencil, Trash2, ChevronLeft, Plus, Map, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";

export default function MyProfile() {
  const { user, logout, setUser } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [trips, setTrips] = useState([]);   // [{city_id, city, rec_count}]
  const [openCityId, setOpenCityId] = useState(null);
  const [category, setCategory] = useState("all");
  const [myRecs, setMyRecs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [addRecOpen, setAddRecOpen] = useState(false);
  const [addRecLockedCity, setAddRecLockedCity] = useState(null);
  const [editingRec, setEditingRec] = useState(null);
  const [addTripOpen, setAddTripOpen] = useState(false);
  const [menuRecId, setMenuRecId] = useState(null);

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
    const code = user.invite_code;
    const text = `Join me on Freccos! Use my code: ${code} — freccos.com`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); toast.success("Invite copied to clipboard"); } catch { toast("Copy failed"); }
    }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(user.invite_code); toast.success("Code copied"); }
    catch { toast("Copy failed"); }
  };

  const deleteRec = async (rec) => {
    setMenuRecId(null);
    if (!window.confirm("Delete this recommendation?")) return;
    try {
      await api.delete(`/recommendations/${rec.id}`);
      toast("Deleted");
      loadRecs(openCityId, category);
      load();
    } catch { toast.error("Couldn't delete"); }
  };

  const startEdit = (rec) => {
    setMenuRecId(null);
    setEditingRec(rec);
    setAddRecLockedCity(null);
    setAddRecOpen(true);
  };

  const deleteTrip = async (cityId) => {
    if (!window.confirm("Remove this city from your trips? Any recommendations you've added stay safe.")) return;
    try {
      await api.delete(`/trips/${cityId}`);
      toast("Removed from trips");
      load();
    } catch { toast.error("Couldn't remove"); }
  };

  if (!user || !profile) return <div className="p-6 t-sub muted">Loading...</div>;

  // Build a city lookup, then group trips by country for display
  const cityById = {};
  for (const c of profile.cities || []) cityById[c.id] = c;
  // Also surface trips returned by /api/trips (which includes manual trip entries
  // for cities that don't yet have any recommendations).
  const tripsByCity = {};
  for (const t of trips) tripsByCity[t.city_id] = t;
  const allCityIds = Array.from(new Set([...Object.keys(cityById), ...Object.keys(tripsByCity)]));
  const allCities = allCityIds
    .map((id) => {
      const c = cityById[id] || tripsByCity[id]?.city;
      if (!c) return null;
      const rec_count = tripsByCity[id]?.rec_count ?? c.rec_count ?? 0;
      return { ...c, rec_count };
    })
    .filter(Boolean);
  const byCountry = {};
  for (const c of allCities) {
    const key = c.country || "Other";
    (byCountry[key] = byCountry[key] || []).push(c);
  }

  const cityOpen = allCities.find((c) => c.id === openCityId);

  return (
    <div className="pb-32 fade-in" data-testid="my-profile">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 22px", position: "relative" }}>
        <div style={{ marginBottom: 22 }}>
          <FreccosLogo size={44} />
        </div>
        <button
          data-testid="settings-btn"
          onClick={() => setShowSettings(true)}
          style={{ position: "absolute", top: 32, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999 }}
        >
          <Settings size={16} />
        </button>
        <div className="flex items-center gap-3 mt-2">
          <Avatar user={profile} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="t-title1" style={{ color: "#fff" }}>{profile.name}</h1>
            {profile.bio && <p className="t-sub" style={{ color: "#C7C7CC" }}>{profile.bio}</p>}
            <p className="t-cap" style={{ color: "#8E8E93", marginTop: 4 }}>
              {profile.follower_count} followers · {profile.following_count} following
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-5">
          <div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="me-stat-cities">{allCities.length}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Cities</div>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="me-stat-countries">{Object.keys(byCountry).filter((k) => k !== "Other").length || (allCities.length ? Object.keys(byCountry).length : 0)}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Countries</div>
          </div>
        </div>
      </div>

      {/* Trips header + Add CTA */}
      {!openCityId && (
        <div className="px-4 pt-4 flex items-center justify-between">
          <h2 className="t-title2">Trips</h2>
          <button
            data-testid="me-add-trip"
            onClick={() => setAddTripOpen(true)}
            className="btn-pill"
            style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF", padding: "8px 14px", fontSize: 13 }}
          >
            <Map size={14} /> Add a trip
          </button>
        </div>
      )}

      {!openCityId && (
        <div className="mt-2" data-testid="trips-list">
          {allCities.length === 0 ? (
            <div className="px-6 mt-4" data-testid="me-empty">
              <p className="t-sub muted">No trips yet. Tap "Add a trip" to log a city you've been to, then add recommendations inside.</p>
            </div>
          ) : (
            Object.entries(byCountry).map(([country, cities]) => (
              <div key={country}>
                <div className="section-header">{country}</div>
                <div className="ios-card mx-4" style={{ overflow: "hidden" }}>
                  {cities.map((c) => (
                    <button
                      key={c.id}
                      data-testid={`me-city-${c.id}`}
                      onClick={() => setOpenCityId(c.id)}
                      className="list-row w-full text-left"
                      style={{ background: "transparent", border: "none" }}
                    >
                      <span style={{ fontSize: 22 }}>{c.flag_emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div className="t-title3">{c.name}</div>
                        <div className="t-cap muted">
                          {c.rec_count > 0
                            ? `${c.rec_count} recommendation${c.rec_count === 1 ? "" : "s"}`
                            : "No recommendations yet"}
                        </div>
                      </div>
                      <span className="muted">›</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* City detail (my own trip) */}
      {openCityId && cityOpen && (
        <div data-testid="me-city-detail">
          <div className="px-4 pt-3 flex items-center justify-between gap-2">
            <button onClick={() => { setOpenCityId(null); setMyRecs([]); setCategory("all"); }}
              style={{ background: "transparent", border: "none", color: "#0A84FF" }}
              data-testid="me-back-trips"
            >
              <ChevronLeft size={16} style={{ verticalAlign: "middle" }} /> All trips
            </button>
            <div className="flex gap-2">
              <button
                data-testid="me-city-add-rec"
                onClick={() => { setEditingRec(null); setAddRecLockedCity(cityOpen); setAddRecOpen(true); }}
                className="btn-pill"
                style={{ background: "rgba(10,132,255,0.12)", color: "#0A84FF", padding: "8px 12px", fontSize: 13 }}
              >
                <Plus size={14} /> Add a recommendation
              </button>
              <button
                data-testid="me-delete-trip"
                onClick={() => deleteTrip(cityOpen.id)}
                style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 6 }}
                title="Remove from trips"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <h2 className="t-title1 px-4 mt-1">{cityOpen.flag_emoji} {cityOpen.name}</h2>
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="px-4 space-y-3">
            {myRecs.length === 0 && (
              <div className="ios-card px-4 py-6 text-center">
                <p className="t-sub muted">
                  You haven't added a recommendation for {cityOpen.name} yet. Tap "Add a recommendation" above.
                </p>
              </div>
            )}
            {myRecs.map((r) => (
              <div key={r.id} className="ios-card" style={{ padding: "14px 16px", position: "relative" }} data-testid={`me-rec-${r.id}`}>
                <div className="flex items-start gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="t-title3">{r.place_name}</div>
                    <div className="mt-1"><CategoryChip category={r.category} /></div>
                    {r.note && <p className="t-body mt-2">{r.note}</p>}
                    <div className="t-cap tertiary mt-2">{formatMonthYear(r.created_at)}</div>
                  </div>
                  <button
                    data-testid={`me-rec-menu-${r.id}`}
                    onClick={() => setMenuRecId(menuRecId === r.id ? null : r.id)}
                    style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4 }}
                    aria-label="More"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                {menuRecId === r.id && (
                  <>
                    <div
                      onClick={() => setMenuRecId(null)}
                      style={{ position: "fixed", inset: 0, zIndex: 50 }}
                    />
                    <div
                      className="ios-card"
                      style={{
                        position: "absolute", right: 12, top: 40, zIndex: 51,
                        padding: 4, minWidth: 160, overflow: "hidden",
                      }}
                      data-testid={`me-rec-menu-panel-${r.id}`}
                    >
                      <button
                        data-testid={`me-edit-${r.id}`}
                        onClick={() => startEdit(r)}
                        className="list-row w-full text-left"
                        style={{ background: "transparent", border: "none", borderRadius: 8 }}
                      >
                        <Pencil size={14} /> <span style={{ flex: 1 }}>Edit</span>
                      </button>
                      <button
                        data-testid={`me-delete-${r.id}`}
                        onClick={() => deleteRec(r)}
                        className="list-row w-full text-left"
                        style={{ background: "transparent", border: "none", color: "#FF453A", borderRadius: 8 }}
                      >
                        <Trash2 size={14} /> <span style={{ flex: 1 }}>Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite code card */}
      <div className="section-header">Your invite code</div>
      <div className="ios-card mx-4 px-4 py-4 flex items-center gap-3" data-testid="invite-card">
        <div style={{ flex: 1 }}>
          <div className="t-cap muted">Bring friends along</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3 }} data-testid="invite-code">
            {user.invite_code}
          </div>
        </div>
        <button
          data-testid="invite-copy"
          onClick={copyCode}
          className="btn-pill btn-secondary"
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          <Copy size={14} /> Copy
        </button>
        <button
          data-testid="invite-share"
          onClick={shareInvite}
          className="btn-pill btn-primary"
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      <SettingsSheet
        open={showSettings} onClose={() => setShowSettings(false)}
        user={user}
        onUpdated={(updated) => { setUser(updated); load(); }}
        onLogout={async () => { await logout(); nav("/login", { replace: true }); }}
      />

      <AddRecommendationSheet
        open={addRecOpen}
        onClose={() => { setAddRecOpen(false); setEditingRec(null); }}
        lockedCity={addRecLockedCity}
        editingRec={editingRec}
        onCreated={() => { load(); if (openCityId) loadRecs(openCityId, category); }}
      />

      <AddTripSheet
        open={addTripOpen}
        onClose={() => setAddTripOpen(false)}
        onAdded={() => load()}
      />
    </div>
  );
}

function SettingsSheet({ open, onClose, user, onUpdated, onLogout }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [photoPath, setPhotoPath] = useState(user?.profile_photo_url || null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch("/users/me", { name, bio, profile_photo_url: photoPath });
      onUpdated(data);
      setEditing(false);
      toast.success("Profile updated");
    } catch { toast.error("Couldn't save"); }
    finally { setBusy(false); }
  };

  const handlePhoto = async (f) => {
    if (!f) return;
    try {
      const fd = new FormData(); fd.append("file", f);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoPath(data.url);
      setPhotoPreview(URL.createObjectURL(f));
    } catch { toast.error("Couldn't upload."); }
  };

  if (!open) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Settings" testId="settings-sheet">
      <div className="px-4 pb-8" style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}>
        {!editing ? (
          <div className="space-y-2">
            <button data-testid="settings-edit" className="list-row w-full text-left ios-card" onClick={() => setEditing(true)} style={{ border: "none" }}>
              <Pencil size={16} /> <span style={{ flex: 1 }}>Edit profile</span> <span className="muted">›</span>
            </button>
            <button data-testid="settings-logout" className="list-row w-full text-left ios-card" onClick={onLogout} style={{ border: "none", color: "#FF453A" }}>
              <LogOut size={16} /> <span style={{ flex: 1 }}>Log out</span>
            </button>
          </div>
        ) : (
          <div>
            <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }}
              onChange={(e) => handlePhoto(e.target.files?.[0])} />
            <div className="flex items-center gap-3 mb-4">
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: photoPreview
                    ? `url('${photoPreview}') center/cover`
                    : photoPath ? `url('${(process.env.REACT_APP_BACKEND_URL || "") + photoPath}') center/cover` : "rgba(120,120,128,0.16)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              />
              <button onClick={() => fileRef.current?.click()} className="btn-pill btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }}>
                Change photo
              </button>
            </div>
            <label className="t-label muted block mb-1">Name</label>
            <input data-testid="settings-name" className="ios-input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="t-label muted block mb-1">Bio</label>
            <textarea data-testid="settings-bio" rows={3} className="ios-input" value={bio} onChange={(e) => setBio(e.target.value)} style={{ resize: "vertical" }} />
            <div className="flex gap-2 mt-4">
              <button className="btn-pill btn-secondary flex-1" onClick={() => setEditing(false)}>Cancel</button>
              <button data-testid="settings-save" className="btn-pill btn-primary flex-1" onClick={save} disabled={busy}>Save</button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
