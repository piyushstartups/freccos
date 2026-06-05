import React, { useEffect } from "react";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import AuthCallback from "./pages/AuthCallback";
import Explore from "./pages/Explore";
import CityDetail from "./pages/CityDetail";
import Friends from "./pages/Friends";
import FriendProfile from "./pages/FriendProfile";
import TripPlans from "./pages/TripPlans";
import TripDetail from "./pages/TripDetail";
import MyProfile from "./pages/MyProfile";
import MainLayout from "./pages/MainLayout";
import PWAInstallBanner from "./components/PWAInstallBanner";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="frec-shell flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <p className="muted">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  // Detect OAuth callback in URL hash synchronously
  if (location.hash?.includes("session_id=") || (typeof window !== "undefined" && window.location.hash?.includes("session_id="))) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/explore" element={<Explore />} />
        <Route path="/city/:cityId" element={<CityDetail />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/user/:userId" element={<FriendProfile />} />
        <Route path="/trips" element={<TripPlans />} />
        <Route path="/trips/:cityId" element={<TripDetail />} />
        <Route path="/me" element={<MyProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Service worker registration deferred until load to avoid blocking
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="frec-shell">
          <PWAInstallBanner />
          <AppRoutes />
          <Toaster position="top-center" closeButton richColors />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
