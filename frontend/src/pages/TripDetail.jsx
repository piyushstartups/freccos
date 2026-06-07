import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import PlaceSheet from "../components/PlaceSheet";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import ConfirmDialog from "../components/ConfirmDialog";
import { CategoryTabs, CategoryChip } from "../components/CategoryChip";
import { ChevronLeft, Check, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMonthYear } from "../lib/utils-frec";

export default function TripDetail() {
  const { cityId } = useParams();
  const nav = useNavigate();
  const [plan, setPlan] = useState(null);
  const [category, setCategory] = useState("all");
  const [placeOpen, setPlaceOpen] = useState(null);
  // Confirm dialog for delete-trip and "Did you love it?" prompts
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeRecOpen, setRemoveRecOpen] = useState(null);
  // "Did you love it?" prompt + AddRec pre-fill flow
  const [lovePrompt, setLovePrompt] = useState(null);          // rec object pending prompt
  const [addRecPrefill, setAddRecPrefill] = useState(null);    // rec to pre-fill into AddRec sheet
  const [pendingAutoRemove, setPendingAutoRemove] = useState(false);

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
      // Newly ticked? Show the "Did you love it?" prompt, queue auto-remove if applicable.
      if (newChecked && data?.prompt_add_to_trips) {
        setLovePrompt(rec);
        setPendingAutoRemove(!!data?.auto_removed);
        // Optimistic UI update so the tick shows immediately
        setPlan((p) => p ? { ...p, checked_recs: [...(p.checked_recs || []), rec.id] } : p);
        return;
      }
      // Auto-removed without prompt (shouldn't normally happen now, but be safe)
      if (data?.auto_removed) {
        toast("All ticked off — removed from Saved");
        nav("/trips");
        return;
      }
      load();
    } catch (e) { toast.error("Couldn't update."); }
  };

  const acceptLove = () => {
    const rec = lovePrompt;
    setLovePrompt(null);
    setAddRecPrefill(rec);
  };
  const declineLove = () => {
    setLovePrompt(null);
    if (pendingAutoRemove) {
      setPendingAutoRemove(false);
      toast("All ticked off — removed from Saved");
      nav("/trips");
      return;
    }
    load();
  };

  const onAddRecCreated = () => {
    setAddRecPrefill(null);
    if (pendingAutoRemove) {
      setPendingAutoRemove(false);
      toast("Added — and Saved cleared for this city");
      nav("/trips");
      return;
    }
    load();
  };

  const removeRec = async (rec) => {
    setRemoveRecOpen(null);
    try {
      await api.post(`/trip-plans/${cityId}/unsave`, { recommendation_id: rec.id });
      toast("Removed");
      load();
    } catch { toast.error("Couldn't remove"); }
  };

  const deleteTrip = async () => {
    setDeleteOpen(false);
    await api.delete(`/trip-plans/${cityId}`);
    toast("Removed from Saved");
    nav("/trips");
  };

  if (!plan) return <div className="p-6 t-sub muted">Loading...</div>;

  const filtered = plan.saved.filter((r) => category === "all" || r.category === category);

  return (
    <div className="pb-32 fade-in" data-testid="trip-detail">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 16px" }}>
        <Link to="/trips" style={{ color: "#0A84FF", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          <ChevronLeft size={18} /> Saved
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
            onClick={() => setDeleteOpen(true)}
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
            role="button"
            tabIndex={0}
            onClick={() => setPlaceOpen(r)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlaceOpen(r); } }}
            className={`ios-card ${isChecked(r.id) ? "rec-checked" : ""}`}
            style={{ padding: "14px 16px", cursor: "pointer" }}
            data-testid={`trip-rec-${r.id}`}
          >
            <div className="flex items-start gap-3">
              <button
                data-testid={`trip-check-${r.id}`}
                onClick={(e) => { e.stopPropagation(); toggleCheck(r); }}
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
                onClick={(e) => { e.stopPropagation(); setRemoveRecOpen(r); }}
                style={{ background: "transparent", border: "none", color: "#8E8E93", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <PlaceSheet
        open={!!placeOpen}
        onClose={() => setPlaceOpen(null)}
        cityId={cityId}
        group={placeOpen ? {
          place_key: placeOpen.id,
          place_name: placeOpen.place_name,
          place_id: placeOpen.place_id,
          place_address: placeOpen.place_address,
          category: placeOpen.category,
          photo_url: placeOpen.photo_url,
          is_saved: true,
          primary_rec_id: placeOpen.id,
          contributors: [{ ...placeOpen, user: placeOpen.by_user }],
        } : null}
        onChange={load}
      />

      {/* "Did you love it?" prompt — appears after ticking off a friend's rec */}
      <ConfirmDialog
        open={!!lovePrompt}
        title="Did you love it?"
        message={lovePrompt ? `Add your own rec for ${lovePrompt.place_name}?` : ""}
        confirmLabel="Add my rec"
        cancelLabel="Not now"
        destructive={false}
        onConfirm={acceptLove}
        onCancel={declineLove}
        testId="love-prompt"
      />

      {/* Pre-filled Add Recommendation sheet from a ticked friend's rec */}
      <AddRecommendationSheet
        open={!!addRecPrefill}
        onClose={() => {
          // Closed without creating — still honour auto-remove if pending
          setAddRecPrefill(null);
          if (pendingAutoRemove) {
            setPendingAutoRemove(false);
            toast("All ticked off — removed from Saved");
            nav("/trips");
          } else {
            load();
          }
        }}
        lockedCity={plan.city}
        prefillRec={addRecPrefill}
        onCreated={onAddRecCreated}
      />

      {/* Delete-trip confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        title="Remove from Saved?"
        message={plan.city ? `Remove ${plan.city.name} from your Saved list?` : "Remove from Saved?"}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={deleteTrip}
        onCancel={() => setDeleteOpen(false)}
        testId="confirm-delete-trip"
      />

      {/* Remove single rec confirmation */}
      <ConfirmDialog
        open={!!removeRecOpen}
        title="Remove from Saved?"
        message={removeRecOpen ? `Remove ${removeRecOpen.place_name} from your Saved list?` : ""}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => removeRecOpen && removeRec(removeRecOpen)}
        onCancel={() => setRemoveRecOpen(null)}
        testId="confirm-remove-rec"
      />
    </div>
  );
}
