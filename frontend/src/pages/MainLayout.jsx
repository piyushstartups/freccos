import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Fab from "../components/Fab";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddTripSheet from "../components/AddTripSheet";

export default function MainLayout() {
  const [recOpen, setRecOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <Outlet />
      <Fab
        onAddRec={() => setRecOpen(true)}
        onAddTrip={() => setTripOpen(true)}
      />
      <BottomNav />
      <AddRecommendationSheet
        open={recOpen}
        onClose={() => setRecOpen(false)}
        onCreated={() => {
          window.dispatchEvent(new Event("freccos:refresh"));
          nav("/me");
        }}
      />
      <AddTripSheet
        open={tripOpen}
        onClose={() => setTripOpen(false)}
        // After a trip is created, take the user straight to that city
        // inside their personal profile so they can start adding recs.
        onAdded={(trip) => {
          if (trip?.city_id) nav(`/me?city=${trip.city_id}`);
          else nav("/me");
        }}
      />
    </>
  );
}
