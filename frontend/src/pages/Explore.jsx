import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import StackedAvatars from "../components/StackedAvatars";
import Wordmark from "../components/Wordmark";
import Avatar from "../components/Avatar";
import { useAuth } from "../lib/auth";
import { Search, Bell } from "lucide-react";

export default function Explore() {
  const [cities, setCities] = useState(null);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/explore/cities"); setCities(data); }
      catch { setCities([]); }
    })();
    api.get("/users/me/notifications/unread-count").then(({ data }) => setUnread(data.count || 0)).catch(() => {});
  }, []);

  const filtered = cities?.filter((c) =>
    !q ? true : c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.country || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="pb-32 fade-in" data-testid="explore-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 22px", position: "relative", textAlign: "center" }}>
        {/* Centered wordmark with corner actions */}
        <button
          data-testid="explore-bell"
          onClick={() => nav("/notifications")}
          style={{ position: "absolute", left: 16, top: 30, background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", padding: 8, borderRadius: 9999, position: "absolute" }}
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unread > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, background: "#FF453A", borderRadius: 5, border: "2px solid #1C1C1E" }} />}
        </button>
        <Wordmark size={34} color="#fff" />
        <button
          data-testid="explore-me"
          onClick={() => nav("/me")}
          style={{ position: "absolute", right: 16, top: 26, background: "transparent", border: "none", padding: 0 }}
          aria-label="Your profile"
        >
          <Avatar user={user} size={32} style={{ border: "2px solid rgba(255,255,255,0.2)" }} />
        </button>
        <p className="t-sub mt-2" style={{ color: "#8E8E93" }}>Real places. Recommended by people you trust.</p>
      </div>

      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
          <input data-testid="explore-search" className="ios-input" placeholder="Search a city..."
            value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36, background: "#fff" }} />
        </div>
      </div>

      {cities === null && <div className="px-4 t-sub muted">Loading...</div>}
      {cities && cities.length === 0 && (
        <div className="px-6 mt-10" data-testid="explore-empty">
          <h3 className="t-title2">No recommendations yet</h3>
          <p className="t-sub muted mt-1">Follow some people to see their recommendations here. Find them in the People tab.</p>
          <Link to="/people" className="btn-pill btn-primary inline-flex mt-4">Find people</Link>
        </div>
      )}

      {cities && cities.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3" data-testid="explore-grid">
          {filtered.map((c) => {
            const isNew = c.last_rec_at && (Date.now() - new Date(c.last_rec_at).getTime() < 7 * 86400000);
            return (
              <Link key={c.id} to={`/city/${c.id}`} data-testid={`city-card-${c.id}`} className="ios-card"
                style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 6, textDecoration: "none", color: "#1C1C1E", position: "relative" }}>
                {isNew && <span className="t-label" style={{ position: "absolute", top: 10, right: 10, background: "#0A84FF", color: "#fff", padding: "2px 8px", borderRadius: 9999 }}>NEW</span>}
                <div style={{ fontSize: 28 }}>{c.flag_emoji}</div>
                <div className="t-title3">{c.name}</div>
                <div className="t-cap muted">{c.country}</div>
                <div className="flex items-center gap-2 mt-2">
                  <StackedAvatars users={c.friends || []} size={22} />
                  <span className="t-cap muted">{c.friend_count} {c.friend_count === 1 ? "person" : "people"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
