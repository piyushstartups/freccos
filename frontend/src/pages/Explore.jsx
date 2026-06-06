import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import StackedAvatars from "../components/StackedAvatars";
import Wordmark from "../components/Wordmark";
import { Search, Bell, Send } from "lucide-react";

export default function Explore() {
  const [cities, setCities] = useState(null);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/explore/cities");
        setCities(data);
      } catch { setCities([]); }
    })();
    api.get("/users/me/notifications/unread-count").then(({ data }) => setUnread(data.count || 0)).catch(() => {});
  }, []);

  const filtered = cities?.filter((c) =>
    !q ? true : c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.country || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="pb-32 fade-in" data-testid="explore-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 18px", position: "relative" }}>
        <div className="flex items-center justify-between">
          <Wordmark size={32} color="#fff" />
          <div className="flex items-center gap-1">
            <button
              data-testid="explore-bell"
              onClick={() => nav("/notifications")}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999, position: "relative" }}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#FF453A", borderRadius: 4 }} />
              )}
            </button>
            <button
              data-testid="explore-share-invite"
              onClick={() => nav("/me")}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: 8, borderRadius: 9999 }}
              aria-label="Invite"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="t-sub mt-3" style={{ color: "#8E8E93" }}>Cities your people have been to.</p>
      </div>

      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
          <input
            data-testid="explore-search"
            className="ios-input"
            placeholder="Search a city..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, background: "#fff" }}
          />
        </div>
      </div>

      {cities === null && <div className="px-4 t-sub muted">Loading...</div>}
      {cities && cities.length === 0 && (
        <div className="px-6 mt-10" data-testid="explore-empty">
          <h3 className="t-title2">No recommendations yet</h3>
          <p className="t-sub muted mt-1">
            Follow some people to see their recommendations here. Find them in the People tab.
          </p>
          <Link to="/people" className="btn-pill btn-primary inline-flex mt-4">Find people</Link>
        </div>
      )}

      {cities && cities.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3" data-testid="explore-grid">
          {filtered.map((c) => {
            const isNew = c.last_rec_at && (Date.now() - new Date(c.last_rec_at).getTime() < 7 * 86400000);
            return (
              <Link
                key={c.id}
                to={`/city/${c.id}`}
                data-testid={`city-card-${c.id}`}
                className="ios-card"
                style={{ padding: "14px 14px 12px", display: "flex", flexDirection: "column",
                  gap: 6, textDecoration: "none", color: "#1C1C1E", position: "relative" }}
              >
                {isNew && (
                  <span className="t-label" style={{ position: "absolute", top: 10, right: 10, background: "#0A84FF", color: "#fff", padding: "2px 8px", borderRadius: 9999 }}>
                    NEW
                  </span>
                )}
                <div style={{ fontSize: 28 }}>{c.flag_emoji}</div>
                <div className="t-title3">{c.name}</div>
                <div className="t-cap muted">{c.country}</div>
                <div className="flex items-center gap-2 mt-2">
                  <StackedAvatars users={c.friends || []} size={22} />
                  <span className="t-cap muted">
                    {c.friend_count} {c.friend_count === 1 ? "person" : "people"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
