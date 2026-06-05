import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import StackedAvatars from "../components/StackedAvatars";
import { Search } from "lucide-react";

export default function Explore() {
  const [cities, setCities] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/explore/cities");
        setCities(data);
      } catch { setCities([]); }
    })();
  }, []);

  const filtered = cities?.filter((c) =>
    !q ? true : c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.country || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="pb-32 fade-in" data-testid="explore-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 18px" }}>
        <h1 className="t-large" style={{ color: "#fff" }}>Explore</h1>
        <p className="t-sub" style={{ color: "#8E8E93" }}>
          Cities your friends have been to.
        </p>
      </div>

      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }}
          />
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

      {cities === null && (
        <div className="px-4 t-sub muted">Loading...</div>
      )}

      {cities && cities.length === 0 && (
        <div className="px-6 mt-10" data-testid="explore-empty">
          <h3 className="t-title2">No recommendations yet</h3>
          <p className="t-sub muted mt-1">
            Follow some friends to see their recommendations here. Find them in the Friends tab.
          </p>
          <Link to="/friends" className="btn-pill btn-primary inline-flex mt-4">
            Find friends
          </Link>
        </div>
      )}

      {cities && cities.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3" data-testid="explore-grid">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/city/${c.id}`}
              data-testid={`city-card-${c.id}`}
              className="ios-card"
              style={{
                padding: "14px 14px 12px", display: "flex", flexDirection: "column",
                gap: 6, textDecoration: "none", color: "#1C1C1E",
              }}
            >
              <div style={{ fontSize: 28 }}>{c.flag_emoji}</div>
              <div className="t-title3">{c.name}</div>
              <div className="t-cap muted">{c.country}</div>
              <div className="flex items-center gap-2 mt-2">
                <StackedAvatars users={c.friends || []} size={22} />
                <span className="t-cap muted">
                  {c.friend_count} {c.friend_count === 1 ? "friend" : "friends"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
