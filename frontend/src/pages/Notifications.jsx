import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { ChevronLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Notifications() {
  const nav = useNavigate();
  const [items, setItems] = useState(null);

  const load = async () => {
    const { data } = await api.get("/users/me/notifications");
    setItems(data);
    api.post("/users/me/notifications/mark-read").catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const accept = async (n) => {
    try {
      // Find the matching follow-request id
      const { data: reqs } = await api.get("/users/me/follow-requests");
      const match = reqs.find((r) => r.requester_id === n.actor?.id);
      if (!match) { toast("Request no longer pending"); load(); return; }
      await api.post(`/users/me/follow-requests/${match.id}/accept`);
      toast.success(`${n.actor?.name} is now following you`);
      load();
    } catch { toast.error("Couldn't accept"); }
  };

  const decline = async (n) => {
    try {
      const { data: reqs } = await api.get("/users/me/follow-requests");
      const match = reqs.find((r) => r.requester_id === n.actor?.id);
      if (match) await api.post(`/users/me/follow-requests/${match.id}/decline`);
      load();
    } catch { toast.error("Couldn't decline"); }
  };

  const open = (n) => {
    if (!n.actor?.id) return;
    if (n.kind === "bucket_recs" && n.payload?.city_id) {
      nav(`/city/${n.payload.city_id}`);
    } else {
      nav(`/user/${n.actor.id}`);
    }
  };

  return (
    <div className="pb-32 fade-in" data-testid="notifications-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 18px" }}>
        <button
          onClick={() => nav(-1)}
          style={{ background: "transparent", border: "none", color: "#0A84FF", display: "inline-flex", alignItems: "center" }}
        >
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="t-large mt-2" style={{ color: "#fff" }}>Notifications</h1>
      </div>

      {items === null && <div className="p-6 t-sub muted">Loading...</div>}
      {items && items.length === 0 && (
        <div className="px-6 mt-8" data-testid="notif-empty">
          <p className="t-sub muted">No notifications yet. When friends follow you or post recommendations in your bucket-list cities, you&apos;ll see them here.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="mx-4 mt-3 space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className="ios-card"
              style={{ padding: "12px 14px", position: "relative" }}
              data-testid={`notif-${n.id}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => open(n)}
                  style={{ background: "transparent", border: "none", padding: 0, flexShrink: 0 }}
                  aria-label="Open"
                >
                  {n.actor ? <Avatar user={n.actor} size={40} /> : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E5E5EA" }} />
                  )}
                </button>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => open(n)}>
                  <NotifText n={n} />
                  <div className="t-cap muted mt-1">{timeAgo(n.created_at)}</div>
                  {n.kind === "follow_request" && (
                    <div className="flex gap-2 mt-2">
                      <button
                        data-testid={`notif-accept-${n.id}`}
                        onClick={(e) => { e.stopPropagation(); accept(n); }}
                        className="btn-pill btn-primary"
                        style={{ padding: "6px 14px", fontSize: 13 }}
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button
                        data-testid={`notif-decline-${n.id}`}
                        onClick={(e) => { e.stopPropagation(); decline(n); }}
                        className="btn-pill"
                        style={{ padding: "6px 14px", fontSize: 13, background: "rgba(120,120,128,0.12)", color: "#1C1C1E" }}
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  )}
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#0A84FF", flexShrink: 0, marginTop: 6 }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotifText({ n }) {
  const actorName = n.actor?.name || "Someone";
  if (n.kind === "follow_request")
    return <span className="t-sub"><strong>{actorName}</strong> wants to follow you</span>;
  if (n.kind === "new_follower")
    return <span className="t-sub"><strong>{actorName}</strong> started following you</span>;
  if (n.kind === "request_accepted")
    return <span className="t-sub"><strong>{actorName}</strong> accepted your follow request</span>;
  if (n.kind === "invite_signup")
    return <span className="t-sub"><strong>{actorName}</strong> just joined Freccos using your invite!</span>;
  if (n.kind === "bucket_recs")
    return <span className="t-sub"><strong>{actorName}</strong> just added a recommendation in {n.payload?.city_name || "a city on your bucket list"}</span>;
  return <span className="t-sub">{actorName} did something</span>;
}
