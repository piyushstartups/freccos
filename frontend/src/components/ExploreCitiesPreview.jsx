import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import StackedAvatars from "./StackedAvatars";
import { SectionHeader } from "./LovedSection";
import { Compass } from "lucide-react";

/**
 * Bottom section on the Explore Feed — 3–4 city cards from the user's network,
 * sorted by rec_count. "See all cities" → switches to Cities tab.
 */
export default function ExploreCitiesPreview({ onSeeAll }) {
  const [cities, setCities] = useState(null);
  useEffect(() => {
    api.get("/explore/cities").then(({ data }) => setCities(data || [])).catch(() => setCities([]));
  }, []);
  if (cities === null || cities.length === 0) return null;
  const top = cities.slice(0, 4);
  return (
    <div data-testid="feed-cities-preview" style={{ marginBottom: 16 }}>
      <SectionHeader
        icon={<Compass size={15} color="#0A84FF" />}
        title="Explore a city"
        seeAllLabel="See all cities"
        onSeeAll={onSeeAll}
      />
      <div className="px-4 grid grid-cols-2 gap-3" style={{ marginTop: 8 }}>
        {top.map((c) => (
          <CityCard key={c.id} city={c} testId={`feed-city-${c.id}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Apple-style minimal city card — re-used by ExploreCitiesPreview AND the
 * Cities tab grid so both share an identical visual spec. Tight 12px padding
 * with name + flag inline on the first row.
 */
export function CityCard({ city, testId }) {
  return (
    <Link
      to={`/city/${city.id}`}
      data-testid={testId || `city-card-${city.id}`}
      style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#fff", borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: 12, textDecoration: "none", color: "#1C1C1E",
        minHeight: 92,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{city.flag_emoji}</span>
          <span className="t-title3" style={{
            fontSize: 15, fontWeight: 700, color: "#1C1C1E",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
          }}>
            {city.name}
          </span>
        </div>
        <div style={{ color: "#8E8E93", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {city.country}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {(city.friends || []).length > 0 && (
          <StackedAvatars users={(city.friends || []).slice(0, 3)} size={18} />
        )}
        <span style={{ color: "#0A84FF", fontSize: 12, fontWeight: 700 }}>
          {city.rec_count} {city.rec_count === 1 ? "recommendation" : "recommendations"}
        </span>
      </div>
    </Link>
  );
}
