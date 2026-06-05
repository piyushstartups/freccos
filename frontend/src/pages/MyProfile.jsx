import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import Avatar from "../components/Avatar";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { Settings, Share2, Copy, LogOut, Pencil, Trash2, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";

export default function MyProfile() {
  const { user, logout, setUser } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("trips");
  const [bucket, setBucket] = useState([]);
  const [openCityId, setOpenCityId] = useState(null);
  const [category, setCategory] = useState("all");
  const [myRecs, setMyRecs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [{ data: p }, { data: plans }] = await Promise.all([
      api.get(`/users/${user.id}`),
      api.get("/trip-plans"),
    ]);
    setProfile(p);
    setBucket(plans.filter((pl) => pl.saved_count === 0));
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
    if (!window.confirm("Delete this recommendation?")) return;
    try {
      await api.delete(`/recommendations/${rec.id}`);
      toast("Deleted");
      loadRecs(openCityId, category);
      load();
    } catch { toast.error("Couldn't delete"); }
  };

  if (!user || !profile) return <div className="p-6 t-sub muted">Loading...</div>;

  const cityOpen = profile.cities.find((c) => c.id === openCityId);

  // group by country for Trips tab
  const byCountry = {};
  for (const c of profile.cities || []) {
    const key = c.country || "Other";
    (byCountry[key] = byCountry[key] || []).push(c);
  }

  return (
    <div className="pb-32 fade-in" data-testid="my-profile">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 22px", position: "relative" }}>
        <button
          data-testid="settings-btn"
          onClick={() => setShowSettings(true)}
          style={{ position: "absolute", top: 44, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999 }}
        >
          <Settings size={16} />
        </button>
        <div className="flex items-center gap-3">
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
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="me-stat-cities">{profile.city_count}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Cities</div>
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 700 }} data-testid="me-stat-countries">{profile.country_count}</div>
            <div className="t-cap" style={{ color: "#8E8E93" }}>Countries</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 4 }}>
        <div style={{ background: "rgba(120,120,128,0.12)", borderRadius: 9999, padding: 4, display: "flex" }}>
          <TabBtn id="trips" active={tab === "trips"} onClick={() => { setTab("trips"); setOpenCityId(null); }} label="Trips" />
          <TabBtn id="bucket" active={tab === "bucket"} onClick={() => { setTab("bucket"); setOpenCityId(null); }} label="Bucket list" />
        </div>
      </div>

      {/* TRIPS TAB */}
      {tab === "trips" && !openCityId && (
        <div className="mt-2" data-testid="trips-list">
          {Object.keys(byCountry).length === 0 ? (
            <div className="px-6 mt-6" data-testid="me-empty">
              <p className="t-sub muted">You haven't added any places yet. Tap + to add your first recommendation.</p>
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
                        <div className="t-cap muted">{c.rec_count} recommendation{c.rec_count === 1 ? "" : "s"}</div>
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

      {/* TRIPS — city detail (my own) */}
      {tab === "trips" && openCityId && cityOpen && (
        <div data-testid="me-city-detail">
          <div className="px-4 pt-3">
            <button onClick={() => { setOpenCityId(null); setMyRecs([]); setCategory("all"); }}
              style={{ background: "transparent", border: "none", color: "#0A84FF" }}>
              <ChevronLeft size={16} style={{ verticalAlign: "middle" }} /> All cities
            </button>
            <h2 className="t-title1 mt-1">{cityOpen.flag_emoji} {cityOpen.name}</h2>
          </div>
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="px-4 space-y-3">
            {myRecs.map((r) => (
              <div key={r.id} className="ios-card" style={{ padding: "14px 16px" }} data-testid={`me-rec-${r.id}`}>
                <div className="flex items-start gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="t-title3">{r.place_name}</div>
                    <div className="mt-1"><CategoryChip category={r.category} /></div>
                    {r.note && <p className="t-body mt-2">{r.note}</p>}
                    <div className="t-cap tertiary mt-2">{formatMonthYear(r.created_at)}</div>
                  </div>
                  <button
                    data-testid={`me-delete-${r.id}`}
                    onClick={() => deleteRec(r)}
                    style={{ background: "transparent", border: "none", color: "#8E8E93" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {myRecs.length === 0 && (
              <div className="ios-card px-4 py-6 text-center t-sub muted">
                No recommendations in this category yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* BUCKET LIST TAB */}
      {tab === "bucket" && (
        <div className="mt-2" data-testid="bucket-tab">
          {bucket.length === 0 ? (
            <div className="px-6 mt-6">
              <p className="t-sub muted">Nothing on your bucket list yet. Tap + and pick a city you're dreaming of.</p>
            </div>
          ) : (
            <div className="ios-card mx-4" style={{ overflow: "hidden" }}>
              {bucket.map((p) => (
                <button
                  key={p.id}
                  onClick={() => nav(`/city/${p.city_id}`)}
                  className="list-row w-full text-left"
                  data-testid={`me-bucket-${p.city_id}`}
                  style={{ background: "transparent", border: "none" }}
                >
                  <span style={{ fontSize: 22 }}>{p.city?.flag_emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div className="t-title3">{p.city?.name}</div>
                    <div className="t-cap muted">Bucket list</div>
                  </div>
                  <span className="muted">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite code card */}
      <div className="section-header">Your invite code</div>
      <div className="ios-card mx-4 px-4 py-4 flex items-center gap-3" data-testid="invite-card">
        <div style={{ flex: 1 }}>
          <div className="t-cap muted">Share with friends</div>
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
    </div>
  );
}

function TabBtn({ active, onClick, label, id }) {
  return (
    <button
      data-testid={`profile-tab-${id}`}
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 14px",
        border: "none",
        background: active ? "#fff" : "transparent",
        color: "#1C1C1E", fontWeight: 600, fontSize: 14,
        borderRadius: 9999,
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 200ms ease-out",
      }}
    >
      {label}
    </button>
  );
}

import BottomSheet from "../components/BottomSheet";
import { useRef } from "react";

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
