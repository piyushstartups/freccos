import React, { useEffect, useRef, useState } from "react";
import BottomSheet from "./BottomSheet";
import api from "../lib/api";
import { CATEGORIES } from "../lib/utils-frec";
import { Camera, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { track, Events } from "../lib/analytics";

export default function AddRecommendationSheet({ open, onClose, lockedCity, onCreated, editingRec, prefillRec }) {
  const isEdit = !!editingRec;
  const [placeQuery, setPlaceQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cityName, setCityName] = useState("");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [category, setCategory] = useState(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPlaceQuery(""); setSuggestions([]); setSelectedPlace(null);
      setShowSuggestions(false); setCityName(""); setCountry(""); setCountryCode("");
      setCategory(null); setNote(""); setPhoto(null); setPhotoPreview(null);
      return;
    }
    if (editingRec) {
      setPlaceQuery(editingRec.place_name || "");
      setCategory(editingRec.category || null);
      setNote(editingRec.note || "");
      if (editingRec.photo_url) setPhoto({ url: editingRec.photo_url });
      // No city editing in edit mode — locked to current city
    } else if (prefillRec) {
      // Pre-fill from a saved friend's rec — user is adding their own version
      setPlaceQuery(prefillRec.place_name || "");
      setCategory(prefillRec.category || null);
      if (prefillRec.place_id) {
        setSelectedPlace({
          place_id: prefillRec.place_id,
          display_name: prefillRec.place_name || "",
          formatted_address: prefillRec.place_address || "",
        });
      }
    }
  }, [open, editingRec, prefillRec]);

  useEffect(() => {
    if (isEdit) return;             // no autocomplete when editing — keep place locked
    if (selectedPlace) return;
    if (!placeQuery || placeQuery.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/places/autocomplete", { params: { q: placeQuery } });
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [placeQuery, selectedPlace, isEdit]);

  const pickSuggestion = async (s) => {
    setShowSuggestions(false);
    setSelectedPlace({ place_id: s.place_id, display_name: s.main_text });
    setPlaceQuery(s.main_text);
    try {
      const { data } = await api.get(`/places/details/${s.place_id}`);
      setSelectedPlace({
        place_id: data.place_id,
        display_name: data.display_name || s.main_text,
        formatted_address: data.formatted_address,
        city: data.city, country: data.country, country_code: data.country_code,
      });
      if (!lockedCity) {
        setCityName(data.city || "");
        setCountry(data.country || "");
        setCountryCode(data.country_code || "");
      }
    } catch { /* keep partial */ }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhoto(data);
      setPhotoPreview(URL.createObjectURL(file));
    } catch { toast.error("Couldn't upload that photo — try a smaller one."); }
    finally { setUploading(false); }
  };

  const canSubmit = placeQuery.trim().length > 0 && category && (isEdit || lockedCity || cityName.trim());

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload = {
          place_name: placeQuery.trim(),
          category,
          note: note.trim() || "",
          photo_url: photo?.url || null,
        };
        const { data } = await api.patch(`/recommendations/${editingRec.id}`, payload);
        toast.success("Recommendation updated");
        onCreated?.(data);
        onClose?.();
      } else {
        const payload = {
          place_name: selectedPlace?.display_name || placeQuery.trim(),
          category,
          note: note.trim() || undefined,
          photo_url: photo?.url,
          place_id: selectedPlace?.place_id,
          place_address: selectedPlace?.formatted_address,
        };
        if (lockedCity?.id) {
          payload.city_id = lockedCity.id;
        } else {
          payload.city_name = cityName.trim();
          payload.country = country || undefined;
          payload.country_code = countryCode || undefined;
        }
        const { data } = await api.post("/recommendations", payload);
        track(Events.RECOMMENDATION_ADDED, {
          city_name: lockedCity?.name || cityName.trim(),
          country: lockedCity?.country || country || null,
          category,
          has_photo: !!photo,
          has_note: !!(note && note.trim()),
        });
        toast.success("Recommendation added!");
        onCreated?.(data);
        onClose?.();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Something didn't work — try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit recommendation" : "Add a recommendation"}
      testId="add-rec-sheet"
    >
      <div className="px-4 pb-6" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <div style={{ position: "relative" }}>
          <label className="t-label muted block mb-1">Place</label>
          <input
            data-testid="rec-place-input"
            className="ios-input"
            placeholder="Search a place..."
            value={placeQuery}
            onChange={(e) => { setPlaceQuery(e.target.value); setSelectedPlace(null); }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            disabled={isEdit && false}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="ios-card"
              style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 20, padding: "4px 0", maxHeight: 240, overflowY: "auto" }}
              data-testid="rec-place-suggestions"
            >
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  className="w-full text-left px-4 py-2.5"
                  style={{ background: "transparent", border: "none" }}
                  data-testid="rec-place-suggestion"
                  onClick={() => pickSuggestion(s)}
                >
                  <div className="t-body font-medium">{s.main_text}</div>
                  {s.secondary_text && <div className="t-cap muted">{s.secondary_text}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isEdit && (
          <div className="mt-4">
            <label className="t-label muted block mb-1">City</label>
            {lockedCity ? (
              <div className="ios-input" style={{ background: "rgba(120,120,128,0.08)", color: "#3a3a3c" }} data-testid="rec-city-locked">
                {lockedCity.flag_emoji} {lockedCity.name}{lockedCity.country ? `, ${lockedCity.country}` : ""}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  data-testid="rec-city-input"
                  className="ios-input"
                  placeholder="City"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                />
                <input
                  data-testid="rec-country-input"
                  className="ios-input"
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{ maxWidth: 130 }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="t-label muted block mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  data-testid={`rec-cat-${c.id}`}
                  onClick={() => setCategory(c.id)}
                  className={`chip ${active ? "chip-active" : c.className}`}
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="t-label muted block mb-1">Note <span className="tertiary">(optional)</span></label>
          <textarea
            data-testid="rec-note-input"
            className="ios-input"
            placeholder="What made it special? Any tips?"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="mt-4">
          <label className="t-label muted block mb-1">Photo <span className="tertiary">(optional)</span></label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-testid="rec-photo-input"
            style={{ display: "none" }}
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          {photoPreview || photo?.url ? (
            <div
              data-testid="rec-photo-preview"
              style={{
                width: "100%", aspectRatio: "4 / 3",
                background: `url('${photoPreview || ((process.env.REACT_APP_BACKEND_URL || "") + photo.url)}') center/cover`,
                borderRadius: 12, position: "relative",
              }}
            >
              <button
                onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="t-cap"
                style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(28,28,30,0.7)", color: "#fff",
                  border: "none", borderRadius: 9999, padding: "4px 10px",
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="ios-card flex items-center justify-center gap-2 w-full"
              data-testid="rec-photo-btn"
              style={{ padding: "14px", color: "#0A84FF", border: "1px dashed #d0d0d4", boxShadow: "none" }}
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              {uploading ? "Uploading..." : "Add a photo"}
            </button>
          )}
        </div>

        <button
          data-testid="rec-submit"
          className="btn-pill btn-primary w-full mt-6"
          disabled={!canSubmit || submitting}
          onClick={submit}
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {isEdit ? "Save changes" : "Post recommendation"}
        </button>
      </div>
    </BottomSheet>
  );
}
