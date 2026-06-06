import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function BlockedAccounts() {
  const nav = useNavigate();
  const [list, setList] = useState(null);

  const load = async () => {
    const { data } = await api.get("/users/me/blocked");
    setList(data);
  };
  useEffect(() => { load(); }, []);

  const unblock = async (u) => {
    if (!window.confirm(`Unblock ${u.name}?`)) return;
    try { await api.post(`/users/${u.id}/unblock`); toast("Unblocked"); load(); }
    catch { toast.error("Couldn't unblock"); }
  };

  return (
    <div className="pb-32 fade-in" data-testid="blocked-page">
      <div className="app-header" style={{ background: "#1C1C1E", color: "#fff", padding: "32px 16px 18px" }}>
        <button onClick={() => nav(-1)} style={{ background: "transparent", border: "none", color: "#0A84FF", display: "inline-flex", alignItems: "center" }}>
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="t-large mt-2" style={{ color: "#fff" }}>Blocked accounts</h1>
      </div>
      {list === null && <div className="p-6 t-sub muted">Loading...</div>}
      {list && list.length === 0 && (
        <div className="px-6 mt-8"><p className="t-sub muted">You haven&apos;t blocked anyone.</p></div>
      )}
      {list && list.length > 0 && (
        <div className="ios-card mx-4 mt-3" style={{ overflow: "hidden" }}>
          {list.map((u) => (
            <div key={u.id} className="list-row" data-testid={`blocked-${u.id}`}>
              <Avatar user={u} size={40} />
              <div style={{ flex: 1 }}>
                <div className="t-title3">{u.name}</div>
              </div>
              <button onClick={() => unblock(u)} className="btn-pill btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
