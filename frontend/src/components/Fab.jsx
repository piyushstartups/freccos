import React, { useState } from "react";
import { Plus, MapPin, Map, X } from "lucide-react";

// FAB with exactly two speed-dial options: Add a recommendation and Add a trip.
// Bucket-list entry-point has been removed per the latest spec — recs and trips
// are the only first-class create actions.
export default function Fab({ onAddRec, onAddTrip }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.18)" }}
          data-testid="fab-backdrop"
        />
      )}
      {open && (
        <div
          style={{
            position: "fixed",
            right: "max(16px, calc((100vw - 430px)/2 + 16px))",
            bottom: 160,
            display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
            zIndex: 10003,
          }}
          className="fade-in"
        >
          <button
            data-testid="fab-add-rec"
            className="speed-item"
            onClick={() => { setOpen(false); onAddRec?.(); }}
          >
            <MapPin size={18} color="#FF9F0A" />
            Add a recommendation
          </button>
          <button
            data-testid="fab-add-trip"
            className="speed-item"
            onClick={() => { setOpen(false); onAddTrip?.(); }}
          >
            <Map size={18} color="#BF5AF2" />
            Add a trip
          </button>
        </div>
      )}
      <button
        data-testid="fab-main"
        className="fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add"
      >
        {open ? <X size={26} /> : <Plus size={26} />}
      </button>
    </>
  );
}
