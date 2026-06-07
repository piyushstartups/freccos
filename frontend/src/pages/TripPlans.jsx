import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import HeaderBrand from "../components/HeaderBrand";
import { Bookmark } from "lucide-react";

export default function TripPlans() {
  const [plans, setPlans] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/trip-plans");
        setPlans(data);
      } catch { setPlans([]); }
    })();
  }, []);

  if (plans === null) return <div className="p-6 t-sub muted">Loading...</div>;

  return (
    <div className="pb-32 fade-in" data-testid="trips-page">
      <HeaderBrand title="Saved" subtitle="Recommendations from your people." />

      {plans.length === 0 && (
        <div className="px-6 mt-8" data-testid="trips-empty">
          <Bookmark size={36} color="#C7C7CC" />
          <h3 className="t-title2 mt-3">Nothing saved yet</h3>
          <p className="t-sub muted mt-1">
            Explore a city and save recommendations from your people.
          </p>
          <Link to="/explore" className="btn-pill btn-primary inline-flex mt-4">
            Explore →
          </Link>
        </div>
      )}

      {plans.length > 0 && (
        <div className="ios-card mx-4" style={{ overflow: "hidden", marginTop: 12 }} data-testid="bucket-list">
          {plans
            .slice()
            .sort((a, b) => (b.saved_count - a.saved_count))
            .map((p) => (
              <button
                key={p.id}
                data-testid={`bucket-${p.city_id}`}
                onClick={() => nav(p.saved_count > 0 ? `/trips/${p.city_id}` : `/city/${p.city_id}`)}
                className="list-row w-full text-left"
                style={{ background: "transparent", border: "none" }}
              >
                <span style={{ fontSize: 24 }}>{p.city?.flag_emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="t-title3">{p.city?.name}</div>
                  <div className="t-cap muted">
                    {p.saved_count > 0
                      ? `${p.saved_count} saved · ${p.checked_count} ticked`
                      : "No recommendations saved yet"}
                  </div>
                </div>
                <span className="muted">›</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
