import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { useAuth } from "../lib/auth";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

export default function FollowList() {
  const { userId, mode } = useParams();         // mode = 'followers' | 'following'
  const nav = useNavigate();
  const { user: me } = useAuth();
  const [list, setList] = useState(null);
  const [target, setTarget] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const load = async () => {
    try {
      const [{ data: t }, { data: l }] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/users/${userId}/${mode}`),
      ]);
      setTarget(t); setList(l);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load");
      setList([]);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, mode]);

  const toggleFollow = async (u) => {
    try {
      if (u.is_following) {
        if (!window.confirm(`Unfollow ${u.name}?`)) return;
        await api.post(`/users/${u.id}/unfollow`);
      } else {
        await api.post(`/users/${u.id}/follow`);
      }
      load();
    } catch { toast.error("Couldn't update"); }
  };

  const removeFollower = async (u) => {
    setMenuId(null);
    if (!window.confirm(`Remove ${u.name} as a follower?`)) return;
    try {
      await api.delete(`/users/me/followers/${u.id}`);
      toast(`Removed ${u.name}`);
      load();
    } catch { toast.error("Couldn't remove"); }
  };

  const isMine = me?.id === userId;
  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <div className="pb-32 fade-in" data-testid="follow-list-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 18px" }}>
        <button onClick={() => nav(-1)} style={{ background: "transparent", border: "none", color: "#0A84FF", display: "inline-flex", alignItems: "center" }}>
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="t-title1 mt-2" style={{ color: "#fff" }}>{target?.name}</h1>
        <p className="t-sub" style={{ color: "#8E8E93" }}>{title}</p>
      </div>

      {list === null && <div className="p-6 t-sub muted">Loading...</div>}
      {list && list.length === 0 && (
        <div className="px-6 mt-8"><p className="t-sub muted">No one to show here yet.</p></div>
      )}
      {list && list.length > 0 && (
        <div className="ios-card mx-4 mt-3" style={{ overflow: "hidden" }}>
          {list.map((u) => (
            <div key={u.id} className="list-row" style={{ position: "relative" }} data-testid={`follow-row-${u.id}`}>
              <Link to={`/user/${u.id}`} className="flex items-center gap-3" style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                <Avatar user={u} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-title3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                  {u.bio && <div className="t-cap muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.bio}</div>}
                </div>
              </Link>
              {u.id !== me?.id && (
                <button
                  onClick={() => toggleFollow(u)}
                  className="btn-pill"
                  style={{
                    padding: "6px 12px", fontSize: 12,
                    background: u.is_following ? "rgba(120,120,128,0.14)" : "#0A84FF",
                    color: u.is_following ? "#1C1C1E" : "#fff",
                  }}
                >
                  {u.is_following ? "Following" : "Follow"}
                </button>
              )}
              {isMine && mode === "followers" && (
                <button
                  data-testid={`follow-menu-${u.id}`}
                  onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                  style={{ background: "transparent", border: "none", marginLeft: 8, color: "#8E8E93" }}
                >
                  <MoreHorizontal size={18} />
                </button>
              )}
              {menuId === u.id && (
                <>
                  <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                  <div className="ios-card" style={{ position: "absolute", right: 12, top: 44, zIndex: 51, padding: 4, minWidth: 180 }}>
                    <button
                      onClick={() => removeFollower(u)}
                      className="list-row w-full text-left"
                      style={{ background: "transparent", border: "none", color: "#FF453A" }}
                    >
                      Remove follower
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
