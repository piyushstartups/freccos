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
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("requests");

  const load = async () => {
    const [n, r] = await Promise.all([
      api.get("/users/me/notifications").then((r) => r.data),
      api.get("/users/me/follow-requests").then((r) => r.data),
    ]);
    // Drop follow_request entries from the activity feed (they appear in Requests instead)
    setItems(n.filter((x) => x.kind !== "follow_request"));
    setRequests(r);
    // Default tab: Requests if any pending, else Activity
    setTab(r.length > 0 ? "requests" : "activity");
    api.post("/users/me/notifications/mark-read").catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const accept = async (req) => {
    try { await api.post(`/users/me/follow-requests/${req.id}/accept`); toast.success(`${req.requester?.name} is now following you`); load(); }
    catch { toast.error("Couldn't accept"); }
  };
  const decline = async (req) => {
    try { await api.post(`/users/me/follow-requests/${req.id}/decline`); load(); }
    catch { toast.error("Couldn't decline"); }
  };

  const openActivity = (n) => {
    if (n.kind === "bucket_recs" && n.payload?.city_id) nav(`/city/${n.payload.city_id}`);
    else if (n.actor?.id) nav(`/user/${n.actor.id}`);
  };

  return (
    <div className="pb-32 fade-in" data-testid="notifications-page">
      <div style={{ background: "#1C1C1E", color: "#fff", padding: "28px 16px 16px" }}>
        <button onClick={() => nav(-1)} style={{ background: "transparent", border: "none", color: "#0A84FF", display: "inline-flex", alignItems: "center" }}>
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="t-large mt-2" style={{ color: "#fff" }}>Notifications</h1>
      </div>

      <div className="px-4 pt-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ background: "rgba(120,120,128,0.12)", borderRadius: 9999, padding: 4, display: "flex" }}>
          <NotifTabBtn id="requests" active={tab === "requests"} count={requests.length} onClick={() => setTab("requests")} />
          <NotifTabBtn id="activity" active={tab === "activity"} count={0} onClick={() => setTab("activity")} label="Activity" />
        </div>
      </div>

      {items === null && <div className="p-6 t-sub muted">Loading...</div>}

      {tab === "requests" && items !== null && (
        requests.length === 0 ? (
          <div className="px-6 mt-8" data-testid="requests-empty"><p className="t-sub muted">No pending requests.</p></div>
        ) : (
          <div className="mx-4 mt-3 space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="ios-card" style={{ padding: "12px 14px" }} data-testid={`req-${r.id}`}>
                <div className="flex items-start gap-3">
                  {r.requester && <Avatar user={r.requester} size={40} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-sub"><strong>{r.requester?.name}</strong> wants to follow you</div>
                    <div className="t-cap muted mt-1">{timeAgo(r.created_at)}</div>
                    <div className="flex gap-2 mt-2">
                      <button data-testid={`req-accept-${r.id}`} onClick={() => accept(r)} className="btn-pill btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                        <Check size={14} /> Accept
                      </button>
                      <button data-testid={`req-decline-${r.id}`} onClick={() => decline(r)} className="btn-pill" style={{ padding: "6px 14px", fontSize: 13, background: "rgba(120,120,128,0.12)", color: "#1C1C1E" }}>
                        <X size={14} /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "activity" && items !== null && (
        items.length === 0 ? (
          <div className="px-6 mt-8" data-testid="activity-empty">
            <p className="t-sub muted">No activity yet. When friends follow you back or post recs in your bucket-list cities, you&apos;ll see them here.</p>
          </div>
        ) : (
          <div className="mx-4 mt-3 space-y-2">
            {items.map((n) => (
              <button key={n.id} onClick={() => openActivity(n)} className="ios-card w-full text-left"
                style={{ padding: "12px 14px", background: "#fff", border: "none" }} data-testid={`notif-${n.id}`}>
                <div className="flex items-start gap-3">
                  {n.actor ? <Avatar user={n.actor} size={40} /> : <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E5E5EA" }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ActivityText n={n} />
                    <div className="t-cap muted mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#0A84FF", flexShrink: 0, marginTop: 6 }} />}
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function NotifTabBtn({ id, active, count, onClick, label }) {
  const txt = label || (id === "requests" ? "Requests" : "Activity");
  return (
    <button data-testid={`notif-tab-${id}`} onClick={onClick}
      style={{ flex: 1, padding: "8px 12px", border: "none",
        background: active ? "#fff" : "transparent",
        color: "#1C1C1E", fontWeight: 600, fontSize: 14, borderRadius: 9999,
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
      {txt}
      {count > 0 && (
        <span style={{ background: "#FF453A", color: "#fff", fontSize: 11, padding: "1px 6px", borderRadius: 9999, fontWeight: 700 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function ActivityText({ n }) {
  const actorName = n.actor?.name || "Someone";
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
