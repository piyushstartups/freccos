import React, { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import api from "../lib/api";
import { Map, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AddTripSheet({ open, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const debRef = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(""); setSuggestions([]); setSelected(null); }
  }, [open]);

  useEffect(() => {
    if (selected) return;
    if (!query || query.length < 2) { setSuggestions([]); return; }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q: query } });
        setSuggestions(data.suggestions || []);
      } catch { setSuggestions([]); }
    }, 220);
    return () => clearTimeout(debRef.current);
  }, [query, selected]);

  const pick = async (s) => {
    setSuggestions([]);
    try {
      const { data } = await api.get(`/places/details/${s.place_id}`);
      setSelected({
        city: data.city || s.main_text,
        country: data.country, country_code: data.country_code,
      });
      setQuery(data.city ? `${data.city}${data.country ? ", " + data.country : ""}` : s.main_text);
    } catch {
      setSelected({ city: s.main_text });
      setQuery(s.main_text);
    }
  };

  const submit = async () => {
    if (submitting) return;
    const cityName = selected?.city || query.trim();
    if (!cityName) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/trips", {
        city_name: cityName,
        country: selected?.country,
        country_code: selected?.country_code,
      });
      toast.success(`${data.city?.name || cityName} added to your trips`);
      onAdded?.(data);
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't add right now — try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a trip" testId="add-trip-sheet">
      <div className="px-4 pb-6" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <p className="t-sub muted mb-2">Pick a city you&apos;ve been to. You can add specific recommendations from inside.</p>
        <div style={{ position: "relative" }}>
          <input
            data-testid="trip-city-input"
            className="ios-input"
            placeholder="Search a city..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          />
          {suggestions.length > 0 && (
            <div className="ios-card"
              style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 20, padding: "4px 0", maxHeight: 240, overflowY: "auto" }}>
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  data-testid="trip-suggestion"
                  className="w-full text-left px-4 py-2.5"
                  style={{ background: "transparent", border: "none" }}
                  onClick={() => pick(s)}
                >
                  <div className="t-body font-medium">{s.main_text}</div>
                  {s.secondary_text && <div className="t-cap muted">{s.secondary_text}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          data-testid="trip-submit"
          className="btn-pill btn-primary w-full mt-6"
          disabled={submitting || !(selected?.city || query.trim())}
          onClick={submit}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Map size={18} />}
          Add to my trips
        </button>
      </div>
    </BottomSheet>
  );
}
