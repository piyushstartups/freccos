import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Wordmark from "../components/Wordmark";
import Feed from "../components/Feed";
import LovedSection, { SectionHeader } from "../components/LovedSection";
import ExploreCitiesPreview, { CityCard } from "../components/ExploreCitiesPreview";
import { Search, Bell, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";

const SUBTABS = [
  { id: "cities", label: "Places" },
  { id: "feed", label: "Feed" },
];

export default function Explore() {
  const { user } = useAuth();
  const [cities, setCities] = useState(null);
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const [subtab, setSubtab] = useState(() => {
    try { return sessionStorage.getItem("freccos:explore:subtab") || "cities"; } catch { return "cities"; }
  });
  const nav = useNavigate();

  useEffect(() => {
    try { sessionStorage.setItem("freccos:explore:subtab", subtab); } catch { /* noop */ }
  }, [subtab]);

  useEffect(() => {
    if (subtab !== "cities") return;
    if (cities !== null) return;
    (async () => {
      try { const { data } = await api.get("/explore/cities"); setCities(data); }
      catch { setCities([]); }
    })();
  }, [subtab, cities]);

  useEffect(() => {
    api.get("/users/me/notifications/unread-count")
      .then(({ data }) => setUnread(data.count || 0)).catch(() => {});
  }, []);

  const followingNone = !user || (user.following || []).length === 0;

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
          style={{ position: "absolute", right: 8, top: "calc(var(--safe-area-top) - 4px)", background: "transparent", border: "none", color: "#fff",
            width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9999 }}
          aria-label="Notifications"
        >
          <Bell size={22} strokeWidth={1.8} />
          <NotifBadge count={unread} />
        </button>
        <div style={{ paddingTop: 4 }}>
          <Wordmark size={44} color="#fff" />
        </div>
        <p style={{ color: "#8E8E93", fontSize: 13, marginTop: 10, letterSpacing: 0.2 }}>
          Discover the world through your people.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="px-4 pt-3 pb-1" style={{ display: "flex", gap: 8 }} data-testid="explore-subtabs">
        {SUBTABS.map((t) => {
          const active = subtab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubtab(t.id)}
              data-testid={`subtab-${t.id}`}
              className="btn-pill"
              style={{
                padding: "6px 14px", fontSize: 13, fontWeight: 600,
                background: active ? "#0A84FF" : "transparent",
                color: active ? "#fff" : "#8E8E93",
                border: active ? "1px solid #0A84FF" : "1px solid #E5E5EA",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {subtab === "feed" && (
        <div className="pt-2" data-testid="explore-feed">
          {/* Empty state: not following anyone — show only the cities discover section */}
          {followingNone ? (
            <>
              <div className="px-6" style={{ marginTop: 28, textAlign: "center" }} data-testid="feed-empty-no-follows">
                <h3 className="t-title2" style={{ fontSize: 18 }}>Follow your friends to see the places they love.</h3>
                <button
                  onClick={() => nav("/people")}
                  className="btn-pill btn-primary mt-4"
                  style={{ padding: "10px 18px" }}
                >
                  Find friends
                </button>
              </div>
              <ExploreCitiesPreview onSeeAll={() => setSubtab("cities")} />
            </>
          ) : (
            <>
              {/* Section 1: chronological feed (limited to 10 items) */}
              <SectionHeader
                icon={<Sparkles size={15} color="#0A84FF" />}
                title="New from your people"
                marginTop={8}
              />
              <div style={{ marginTop: 8 }}>
                <Feed onSwitchToCities={() => setSubtab("cities")} maxItems={10} hideEmptyHint />
              </div>
              {/* Section 2 */}
              <LovedSection />
              {/* Section 3 */}
              <ExploreCitiesPreview onSeeAll={() => setSubtab("cities")} />
            </>
          )}
        </div>
      )}

      {subtab === "cities" && (
        <>
          <div className="px-4 pt-4 pb-1">
            <p className="t-sub muted" style={{ fontSize: 13, marginBottom: 10 }}>
              Explore recommendations in the cities your people have been to.
            </p>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
              <input data-testid="explore-search" className="ios-input" placeholder="Where do you want to go?"
                value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 36, background: "#fff" }} />
            </div>
          </div>

          {cities === null && <div className="px-4 t-sub muted mt-3">Loading...</div>}
          {cities && cities.length === 0 && (
            <div className="px-6 mt-10" data-testid="explore-empty">
              <h3 className="t-title2">No recommendations yet</h3>
              <p className="t-sub muted mt-1">Follow your friends to see the places they love.</p>
              <Link to="/people" className="btn-pill btn-primary inline-flex mt-4">Find friends</Link>
            </div>
          )}

          {cities && cities.length > 0 && (
            <div className="px-4 grid grid-cols-2 gap-3 mt-3" data-testid="explore-grid">
              {filtered.map((c) => <CityCard key={c.id} city={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotifBadge({ count }) {
  if (!count || count <= 0) return null;
  const label = count > 9 ? "9+" : String(count);
  return (
    <span
      data-testid="explore-bell-badge"
      aria-label={`${count} unread notifications`}
      style={{
        position: "absolute", top: 4, right: 4,
        minWidth: 18, height: 18, padding: "0 5px",
        background: "#FF453A", color: "#fff",
        border: "2px solid #1C1C1E", borderRadius: 9999,
        fontSize: 10, fontWeight: 700, lineHeight: "14px",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {label}
    </span>
  );
}
