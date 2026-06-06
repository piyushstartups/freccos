import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { ChevronLeft, Check, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";

export default function TripDetail() {
  const { cityId } = useParams();
  const nav = useNavigate();
  const [plan, setPlan] = useState(null);
  const [category, setCategory] = useState("all");

  const load = async () => {
    const { data } = await api.get(`/trip-plans/${cityId}`);
    setPlan(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cityId]);

  const isChecked = (recId) => plan?.checked_recs?.includes(recId);

  const toggleCheck = async (rec) => {
    const newChecked = !isChecked(rec.id);
    try {
      const { data } = await api.post(`/trip-plans/${cityId}/check`, {
        recommendation_id: rec.id, checked: newChecked,
      });
      if (data.prompt_add_to_trips) {
        if (window.confirm(`Looks like you've been to ${plan.city.name}! Add it to your trips?`)) {
          // Create a "been here" rec — open city detail to add their own rec
          nav(`/city/${cityId}`);
          return;
        }
      }
      load();
    } catch (e) { toast.error("Couldn't update."); }
  };

  const removeRec = async (rec) => {
    if (!window.confirm("Remove from trip plan?")) return;
    try {
      await api.post(`/trip-plans/${cityId}/unsave`, { recommendation_id: rec.id });
      toast("Removed");
      load();
    } catch { toast.error("Couldn't remove"); }
  };

  const deleteTrip = async () => {
    if (!window.confirm("Delete this trip plan entirely?")) return;
    await api.delete(`/trip-plans/${cityId}`);
    toast("Trip plan deleted");
    nav("/trips");
  };

  if (!plan) return <div className="p-6 t-sub muted">Loading...</div>;

  const filtered = plan.saved.filter((r) => category === "all" || r.category === category);
  // group by category
  return (
    <div className="pb-32 fade-in" data-testid="trip-detail">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 16px" }}>
        <Link to="/trips" style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          <ChevronLeft size={18} /> Trip plans
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <div style={{ fontSize: 36 }}>{plan.city?.flag_emoji}</div>
          <div>
            <h1 className="t-large" style={{ color: "#fff", fontSize: 26 }}>{plan.city?.name}</h1>
            <div className="t-cap" style={{ color: "#8E8E93" }}>{plan.saved.length} saved</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            data-testid="trip-add"
            onClick={() => nav(`/city/${cityId}`)}
            className="btn-pill"
            style={{ background: "rgba(10,132,255,0.18)", color: "#0A84FF", padding: "8px 14px", fontSize: 13 }}
          >
            <Plus size={14} /> Add from friends’ recs
          </button>
          <button
            data-testid="trip-delete"
            onClick={deleteTrip}
            className="btn-pill"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", padding: "8px 14px", fontSize: 13 }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <CategoryTabs value={category} onChange={setCategory} />

      <div className="px-4 space-y-3" data-testid="trip-saved-list">
        {filtered.length === 0 && (
          <div className="ios-card px-4 py-6 text-center t-sub muted">
            Nothing saved here yet. Pull from your friends’ recommendations.
          </div>
        )}
        {filtered.map((r) => (
          <div
            key={r.id}
            className={`ios-card ${isChecked(r.id) ? "rec-checked" : ""}`}
            style={{ padding: "14px 16px" }}
            data-testid={`trip-rec-${r.id}`}
          >
            <div className="flex items-start gap-3">
              <button
                data-testid={`trip-check-${r.id}`}
                onClick={() => toggleCheck(r)}
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: isChecked(r.id) ? "#30D158" : "rgba(120,120,128,0.12)",
                  color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2,
                }}
              >
                {isChecked(r.id) && <Check size={16} />}
              </button>
              <div style={{ flex: 1 }}>
                <div className="t-title3 rec-name">{r.place_name}</div>
                <div className="mt-1"><CategoryChip category={r.category} /></div>
                <div className="flex items-center gap-2 mt-2 t-cap muted">
                  {r.by_user && <Avatar user={r.by_user} size={20} />}
                  {r.by_user && <span>via <strong style={{ color: "#1C1C1E" }}>{r.by_user.name}</strong></span>}
                  {r.created_at && <span>· {formatMonthYear(r.created_at)}</span>}
                </div>
                {r.note && <p className="t-body mt-2">{r.note}</p>}
              </div>
              <button
                data-testid={`trip-remove-${r.id}`}
                onClick={() => removeRec(r)}
                style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
