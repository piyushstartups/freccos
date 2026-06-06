import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import StackedAvatars from "../components/StackedAvatars";
import Wordmark from "../components/Wordmark";
import { Search, Bell } from "lucide-react";

export default function Explore() {
  const [cities, setCities] = useState(null);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const nav = useNavigate();

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
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 22px", position: "relative", textAlign: "center" }}>
        <button
          data-testid="explore-bell"
          onClick={() => nav("/notifications")}
          style={{ position: "absolute", right: 8, top: 18, background: "transparent", border: "none", color: "#fff",
            width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9999 }}
          aria-label="Notifications"
        >
          <Bell size={22} strokeWidth={1.8} />
          {unread > 0 && <span style={{ position: "absolute", top: 10, right: 10, width: 9, height: 9, background: "#FF453A", borderRadius: 5, border: "2px solid #1C1C1E" }} />}
        </button>
        <div style={{ paddingTop: 4 }}>
          <Wordmark size={44} color="#fff" />
        </div>
        <p style={{ color: "#8E8E93", fontSize: 13, marginTop: 10, letterSpacing: 0.2 }}>
          Real places. Recommended by people you trust.
        </p>
      </div>

      <div className="px-4 pt-4 pb-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
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
        <>
          <div
            className="px-4"
            style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4, marginBottom: 10 }}
          >
            <h2
              style={{
                color: "#1C1C1E",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                margin: 0,
              }}
            >
              Cities your people have been to
            </h2>
            <span style={{ color: "#8E8E93", fontSize: 12 }}>
              {filtered?.length || 0}
            </span>
          </div>

          <div className="px-4 grid grid-cols-2 gap-3" data-testid="explore-grid">
            {filtered.map((c) => {
              const isNew = c.last_rec_at && (Date.now() - new Date(c.last_rec_at).getTime() < 7 * 86400000);
              return (
                <Link
                  key={c.id}
                  to={`/city/${c.id}`}
                  data-testid={`city-card-${c.id}`}
                  className="ios-card"
                  style={{
                    padding: "14px 14px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    textDecoration: "none",
                    color: "#1C1C1E",
                    position: "relative",
                    minHeight: 112,
                  }}
                >
                  {isNew && (
                    <span
                      className="t-label"
                      style={{ position: "absolute", top: 10, left: 10, background: "#0A84FF", color: "#fff", padding: "2px 8px", borderRadius: 9999, fontSize: 10 }}
                    >
                      NEW
                    </span>
                  )}
                  {/* Flag pinned to top-right — minimal, decorative anchor */}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      fontSize: 22,
                      lineHeight: 1,
                      opacity: 0.95,
                    }}
                  >
                    {c.flag_emoji}
                  </span>
                  <div className="t-title3" style={{ paddingRight: 32, marginTop: "auto" }}>
                    {c.name}
                  </div>
                  <div className="t-cap muted">{c.country}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <StackedAvatars users={c.friends || []} size={22} />
                    <span className="t-cap muted">{c.friend_count} {c.friend_count === 1 ? "person" : "people"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
