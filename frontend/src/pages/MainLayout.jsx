import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Fab from "../components/Fab";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddBucketListSheet from "../components/AddBucketListSheet";

export default function MainLayout() {
  const [recOpen, setRecOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  return (
    <>
      <Outlet />
      <Fab
        onAddRec={() => setRecOpen(true)}
        onAddTrip={() => { nav("/me"); }}
        onAddBucket={() => setBucketOpen(true)}
      />
      <BottomNav />
      <AddRecommendationSheet
        open={recOpen}
        onClose={() => setRecOpen(false)}
        onCreated={() => {
          // Best-effort refresh of current view by reloading the route
          window.dispatchEvent(new Event("freccos:refresh"));
        }}
      />
      <AddBucketListSheet
        open={bucketOpen}
        onClose={() => setBucketOpen(false)}
        onAdded={(plan) => { if (plan?.city_id) nav(`/trips`); }}
      />
    </>
  );
}
