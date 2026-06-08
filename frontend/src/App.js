import React, { useEffect } from "react";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import { track, identify, Events } from "./lib/analytics";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import AuthCallback from "./pages/AuthCallback";
import Explore from "./pages/Explore";
import CityDetail from "./pages/CityDetail";
import People from "./pages/People";
import FriendProfile from "./pages/FriendProfile";
import TripPlans from "./pages/TripPlans";
import TripDetail from "./pages/TripDetail";
import MyProfile from "./pages/MyProfile";
import MainLayout from "./pages/MainLayout";
import PWAInstallBanner from "./components/PWAInstallBanner";
import Notifications from "./pages/Notifications";
import FollowList from "./pages/FollowList";
import BlockedAccounts from "./pages/BlockedAccounts";
import LegalPage from "./pages/LegalPage";
import NotificationSettings from "./pages/NotificationSettings";

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

// Maps a pathname → human-readable screen name for analytics
function screenNameFromPath(pathname) {
  if (pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/forgot") return null; // pre-auth screens
  if (pathname.startsWith("/explore")) return "Explore";
  if (matchPath("/city/:cityId", pathname)) return "City View";
  if (pathname === "/people") return "People";
  if (matchPath("/user/:userId/:mode", pathname)) {
    const m = matchPath("/user/:userId/:mode", pathname);
    return m.params.mode === "followers" ? "Followers" : "Following";
  }
  if (matchPath("/user/:userId", pathname)) return "Friend Profile";
  if (pathname === "/trips") return "Saved";
  if (matchPath("/trips/:cityId", pathname)) return "Trip Plan";
  if (pathname === "/me") return "Profile";
  if (pathname === "/me/blocked") return "Blocked Accounts";
  if (pathname === "/notifications") return "Notifications";
  return null;
}

function AnalyticsObserver() {
  const location = useLocation();
  const { user } = useAuth();
  // Identify on login/signup whenever user object changes
  useEffect(() => {
    if (user?.id) identify(user.id, { name: user.name, email: user.email });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fire page_viewed on every route change
  useEffect(() => {
    const screen = screenNameFromPath(location.pathname);
    if (screen) track(Events.PAGE_VIEWED, { screen_name: screen, path: location.pathname });
  }, [location.pathname]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=") || (typeof window !== "undefined" && window.location.hash?.includes("session_id="))) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/privacy" element={<LegalPage title="Privacy Policy" testId="privacy-page" />} />
      <Route path="/terms" element={<LegalPage title="Terms of Service" testId="terms-page" />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/explore" element={<Explore />} />
        <Route path="/city/:cityId" element={<CityDetail />} />
        <Route path="/people" element={<People />} />
        <Route path="/friends" element={<Navigate to="/people" replace />} />
        <Route path="/user/:userId" element={<FriendProfile />} />
        <Route path="/user/:userId/:mode" element={<FollowList />} />
        <Route path="/trips" element={<TripPlans />} />
        <Route path="/trips/:cityId" element={<TripDetail />} />
        <Route path="/me" element={<MyProfile />} />
        <Route path="/me/blocked" element={<BlockedAccounts />} />
        <Route path="/me/notifications" element={<NotificationSettings />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
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
          <AnalyticsObserver />
          <AppRoutes />
          <Toaster position="top-center" closeButton richColors />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
