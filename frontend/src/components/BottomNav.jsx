import React from "react";
import { NavLink } from "react-router-dom";
import { Compass, Users, Briefcase, User } from "lucide-react";

const items = [
  { to: "/explore", label: "Explore", icon: Compass, testid: "nav-explore" },
  { to: "/friends", label: "Friends", icon: Users, testid: "nav-friends" },
  { to: "/trips", label: "Trips", icon: Briefcase, testid: "nav-trips" },
  { to: "/me", label: "Profile", icon: User, testid: "nav-profile" },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" data-testid="bottom-nav">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          data-testid={it.testid}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <it.icon size={22} strokeWidth={isActive ? 2.4 : 1.8} fill={isActive ? "rgba(10,132,255,0.16)" : "none"} />
              <span>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
