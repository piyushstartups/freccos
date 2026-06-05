import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Fab from "../components/Fab";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddBucketListSheet from "../components/AddBucketListSheet";
import AddTripSheet from "../components/AddTripSheet";

export default function MainLayout() {
  const [recOpen, setRecOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <Outlet />
      <Fab
        onAddRec={() => setRecOpen(true)}
        onAddTrip={() => setTripOpen(true)}
        onAddBucket={() => setBucketOpen(true)}
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
        onAdded={() => { nav("/me"); }}
      />
      <AddBucketListSheet
        open={bucketOpen}
        onClose={() => setBucketOpen(false)}
        onAdded={(plan) => { if (plan?.city_id) nav(`/trips`); }}
      />
    </>
  );
}
