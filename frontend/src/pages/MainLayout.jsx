import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Fab from "../components/Fab";
import AddRecommendationSheet from "../components/AddRecommendationSheet";
import AddBucketListSheet from "../components/AddBucketListSheet";

export default function MainLayout() {
  const [recOpen, setRecOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState(false);
  const nav = useNavigate();
  return (
    <>
      <Outlet />
      <Fab
        // "Add a recommendation" and "Add a trip" both open the rec sheet —
        // a trip in Freccos = a city you've been to, which is exactly a recommendation.
        onAddRec={() => setRecOpen(true)}
        onAddTrip={() => setRecOpen(true)}
        onAddBucket={() => setBucketOpen(true)}
      />
      <BottomNav />
      <AddRecommendationSheet
        open={recOpen}
        onClose={() => setRecOpen(false)}
        onCreated={() => {
          window.dispatchEvent(new Event("freccos:refresh"));
          // Navigate to Profile so user sees their new "trip"
          nav("/me");
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
