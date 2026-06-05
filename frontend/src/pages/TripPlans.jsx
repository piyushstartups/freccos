import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Briefcase } from "lucide-react";

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

  const upcoming = plans.filter((p) => p.saved_count > 0);
  const bucket = plans.filter((p) => p.saved_count === 0);

  return (
    <div className="pb-32 fade-in" data-testid="trips-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 16px" }}>
        <h1 className="t-large" style={{ color: "#fff" }}>Trip plans</h1>
        <p className="t-sub" style={{ color: "#8E8E93" }}>Cities you're planning, sorted out.</p>
      </div>

      {plans.length === 0 && (
        <div className="px-6 mt-8" data-testid="trips-empty">
          <Briefcase size={36} color="#C7C7CC" />
          <h3 className="t-title2 mt-3">No trips planned yet</h3>
          <p className="t-sub muted mt-1">
            Explore a city and save recommendations from friends to start planning.
          </p>
          <Link to="/explore" className="btn-pill btn-primary inline-flex mt-4">
            Explore cities
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="section-header">Upcoming trips</div>
          <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="upcoming-list">
            {upcoming.map((p) => (
              <button
                key={p.id}
                data-testid={`trip-${p.city_id}`}
                onClick={() => nav(`/trips/${p.city_id}`)}
                className="list-row w-full text-left"
                style={{ background: "transparent", border: "none" }}
              >
                <span style={{ fontSize: 24 }}>{p.city?.flag_emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="t-title3">{p.city?.name}</div>
                  <div className="t-cap muted">
                    {p.saved_count} saved · {p.checked_count} ticked
                  </div>
                </div>
                <span className="muted">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {bucket.length > 0 && (
        <>
          <div className="section-header">Bucket list</div>
          <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="bucket-list">
            {bucket.map((p) => (
              <button
                key={p.id}
                data-testid={`bucket-${p.city_id}`}
                onClick={() => nav(`/city/${p.city_id}`)}
                className="list-row w-full text-left"
                style={{ background: "transparent", border: "none" }}
              >
                <span style={{ fontSize: 24 }}>{p.city?.flag_emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="t-title3">{p.city?.name}</div>
                  <div className="t-cap muted">No recommendations saved yet</div>
                </div>
                <span className="muted">›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
