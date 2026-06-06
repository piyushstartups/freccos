import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { useAuth } from "../lib/auth";
import { Search, UserPlus, UserCheck, Clock, Share2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "all", label: "All" },
  { id: "friends_of_friends", label: "Friends of friends" },
  { id: "recently_joined", label: "New" },
];

export default function People() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [all, setAll] = useState([]);
  const [discover, setDiscover] = useState({});

  const loadAll = useCallback(async () => {
    try {
      const { data } = await api.get("/users/search", { params: q ? { q } : {} });
      setAll(data);
    } catch { setAll([]); }
  }, [q]);

  const loadDiscover = useCallback(async () => {
    try { const { data } = await api.get("/users/me/discover"); setDiscover(data || {}); }
    catch { setDiscover({}); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadDiscover(); }, [loadDiscover]);

  const toggleFollow = async (u) => {
    try {
      if (u.is_following) {
        if (!window.confirm(`Unfollow ${u.name}?`)) return;
        await api.post(`/users/${u.id}/unfollow`);
        toast(`Unfollowed ${u.name}`);
      } else if (u.request_pending) {
        if (!window.confirm(`Cancel follow request to ${u.name}?`)) return;
        await api.post(`/users/${u.id}/unfollow`);
        toast("Request cancelled");
      } else {
        const { data } = await api.post(`/users/${u.id}/follow`);
        if (data.status === "requested") toast.success(`Follow request sent to ${u.name}`);
        else toast.success(`Now following ${u.name}`);
      }
      // Refresh both views so state is consistent everywhere
      await Promise.all([loadAll(), loadDiscover()]);
    } catch { toast.error("Couldn't update follow"); }
  };

  const shareInvite = async () => {
    const text = `Join me on Freccos! Use my invite code: ${user?.invite_code} https://freccos.com`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(text); toast.success("Invite copied"); } catch { toast("Copy failed"); } }
  };

  // Filter the active tab's list. Search bar applies to all tabs.
  // Discovery never shows yourself or people you already follow (or have a pending request to).
  const baseList = tab === "all" ? all : (discover[tab] || []);
  const lowerQ = q.toLowerCase();
  const list = (q ? baseList.filter((u) => u.name?.toLowerCase().includes(lowerQ)) : baseList)
    .filter((u) => u.id !== user?.id && !u.is_following);

  return (
    <div className="pb-32 fade-in" data-testid="people-page">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 18px" }}>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.15, margin: 0 }}>People</h1>
        <p style={{ color: "#8E8E93", fontSize: 14, lineHeight: 1.3, margin: "6px 0 0" }}>Discover travellers worth following.</p>
      </div>

      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
          <input data-testid="people-search" className="ios-input" placeholder="Search people..."
            value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36, background: "#fff" }} />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }} data-testid="people-tabs">
          {TABS.map((t) => (
            <button key={t.id} data-testid={`people-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`chip ${tab === t.id ? "chip-active" : "chip-inactive"} whitespace-nowrap`}
              style={{ padding: "8px 14px" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "all" && (
        <div className="ios-card mx-4 px-4 py-3 flex items-center gap-3 mt-2" data-testid="people-invite-card">
          <Share2 size={18} color="#0A84FF" />
          <div style={{ flex: 1 }}>
            <div className="t-title3">Invite a friend to Freccos</div>
            <div className="t-cap muted">Share your invite code · {user?.invite_code}</div>
          </div>
          <button onClick={shareInvite} className="btn-pill btn-primary" style={{ padding: "8px 14px", fontSize: 13 }} data-testid="people-share-invite">
            Share
          </button>
        </div>
      )}

      <div className="mt-3">
        {list.length === 0 ? (
          <div className="px-6 mt-4" data-testid="people-empty">
            <p className="t-sub muted">
              {q ? `No one matches "${q}" yet.` :
                tab === "friends_of_friends" ? "No friends-of-friends to suggest yet. Follow a few people first." :
                tab === "recently_joined" ? "No new joiners in the last 30 days." :
                "No one to suggest just yet."}
            </p>
          </div>
        ) : (
          <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="people-list">
            {list.map((u) => <PersonRow key={u.id} u={u} onToggle={() => toggleFollow(u)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonRow({ u, onToggle }) {
  const stats = typeof u.city_count === "number"
    ? `${u.city_count} ${u.city_count === 1 ? "city" : "cities"} · ${u.country_count} ${u.country_count === 1 ? "country" : "countries"}`
    : null;
  const subText = u.followed_by ? `Followed by ${u.followed_by.slice(0, 2).join(", ")}`
    : u.matched_city ? `Been to ${u.matched_city} — on your bucket list`
    : u.latest_rec ? `Latest: '${u.latest_rec.place_name}'${u.latest_rec.city_name ? `, ${u.latest_rec.city_name}` : ""}`
    : null;
  const btnLabel = u.is_following ? "Following" : u.request_pending ? "Requested" : "Follow";
  const btnIcon = u.is_following ? <UserCheck size={14} /> : u.request_pending ? <Clock size={14} /> : <UserPlus size={14} />;
  const btnStyle = u.is_following || u.request_pending
    ? { background: "rgba(120,120,128,0.14)", color: "#1C1C1E" }
    : { background: "#0A84FF", color: "#fff" };
  return (
    <div className="list-row">
      <Link to={`/user/${u.id}`} className="flex items-center gap-3" style={{ textDecoration: "none", color: "inherit", flex: 1 }} data-testid={`user-link-${u.id}`}>
        <Avatar user={u} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
          {stats && <div className="t-cap muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stats}</div>}
          {subText && <div className="t-cap" style={{ color: "#0A84FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subText}</div>}
        </div>
      </Link>
      <button data-testid={`follow-toggle-${u.id}`} onClick={onToggle} className="btn-pill"
        style={{ padding: "6px 14px", fontSize: 13, ...btnStyle }}>
        {btnIcon}{btnLabel}
      </button>
    </div>
  );
}
