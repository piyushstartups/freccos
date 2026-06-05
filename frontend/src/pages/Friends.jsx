import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { Search, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function Friends() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await api.get("/users/search", { params: q ? { q } : {} });
    setUsers(data);
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const following = users.filter((u) => u.is_following);
  const discover = users.filter((u) => !u.is_following);

  const toggleFollow = async (u) => {
    try {
      if (u.is_following) {
        await api.post(`/users/${u.id}/unfollow`);
        toast(`Unfollowed ${u.name}`);
      } else {
        await api.post(`/users/${u.id}/follow`);
        toast.success(`Now following ${u.name}`);
      }
      load();
    } catch { toast.error("Couldn't update follow"); }
  };

  return (
    <div className="pb-32 fade-in" data-testid="friends-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "44px 16px 16px" }}>
        <h1 className="t-large" style={{ color: "#fff" }}>Friends</h1>
        <p className="t-sub" style={{ color: "#8E8E93" }}>The people behind your recommendations.</p>
      </div>
      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
          <input
            data-testid="friends-search"
            className="ios-input"
            placeholder="Search people..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, background: "#fff" }}
          />
        </div>
      </div>

      {following.length > 0 && (
        <>
          <div className="section-header">People you follow</div>
          <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="following-list">
            {following.map((u) => (
              <UserRow key={u.id} u={u} onToggle={toggleFollow} />
            ))}
          </div>
        </>
      )}

      <div className="section-header">{following.length > 0 ? "Discover" : "People on Freccos"}</div>
      <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="discover-list">
        {discover.length === 0 && following.length === 0 && (
          <div className="px-4 py-6 text-center t-sub muted" data-testid="friends-empty">
            You're not following anyone yet. Search for friends or invite them with your code.
          </div>
        )}
        {discover.map((u) => (
          <UserRow key={u.id} u={u} onToggle={toggleFollow} />
        ))}
      </div>
    </div>
  );
}

function UserRow({ u, onToggle }) {
  return (
    <div className="list-row">
      <Link to={`/user/${u.id}`} className="flex items-center gap-3" style={{ textDecoration: "none", color: "inherit", flex: 1 }} data-testid={`user-link-${u.id}`}>
        <Avatar user={u} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
          {u.bio && <div className="t-cap muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.bio}</div>}
        </div>
      </Link>
      <button
        data-testid={`follow-toggle-${u.id}`}
        onClick={() => onToggle(u)}
        className="btn-pill"
        style={{
          padding: "6px 14px", fontSize: 13,
          background: u.is_following ? "rgba(120,120,128,0.12)" : "#0A84FF",
          color: u.is_following ? "#1C1C1E" : "#fff",
        }}
      >
        {u.is_following ? <UserCheck size={14} /> : <UserPlus size={14} />}
        {u.is_following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
