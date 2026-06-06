import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import Avatar from "../components/Avatar";
import HeaderBrand from "../components/HeaderBrand";
import { Search, UserPlus, UserCheck, Clock, Compass, Sparkles, Phone } from "lucide-react";
import { toast } from "sonner";

export default function People() {
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [discover, setDiscover] = useState(null);

  const loadDiscover = async () => {
    try {
      const { data } = await api.get("/users/me/discover");
      setDiscover(data);
    } catch { setDiscover({}); }
  };

  useEffect(() => { loadDiscover(); }, []);

  useEffect(() => {
    if (!q) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/users/search", { params: { q } });
        setSearchResults(data);
      } catch { setSearchResults([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const toggleFollow = async (u, fromList, refresh) => {
    try {
      if (u.is_following) {
        if (!window.confirm(`Unfollow ${u.name}?`)) return;
        await api.post(`/users/${u.id}/unfollow`);
      } else {
        const { data } = await api.post(`/users/${u.id}/follow`);
        if (data.status === "requested") toast.success(`Follow request sent to ${u.name}`);
        else toast.success(`Now following ${u.name}`);
      }
      refresh?.();
      loadDiscover();
    } catch { toast.error("Couldn't update follow"); }
  };

  const requestContacts = async () => {
    if (!("contacts" in navigator) || !navigator.contacts?.select) {
      toast("Contacts permission isn't available on this device.");
      return;
    }
    try {
      const props = ["name"]; const opts = { multiple: true };
      const picked = await navigator.contacts.select(props, opts);
      toast.success(`Found ${picked.length} contacts — we'll match these against Freccos in a moment.`);
    } catch { toast("Contacts permission was denied."); }
  };

  return (
    <div className="pb-32 fade-in" data-testid="people-page">
      <HeaderBrand title="People" subtitle="Discover travellers worth following." />

      <div className="px-4 py-3" style={{ position: "sticky", top: 0, background: "#F2F2F7", zIndex: 5 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8E8E93" }} />
          <input
            data-testid="people-search"
            className="ios-input"
            placeholder="Search people..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, background: "#fff" }}
          />
        </div>
      </div>

      {/* Search results */}
      {searchResults !== null && (
        <Section title="Results">
          {searchResults.length === 0 ? (
            <EmptyMini>No one matches &ldquo;{q}&rdquo; yet.</EmptyMini>
          ) : (
            <PeopleList users={searchResults} onToggle={(u) => toggleFollow(u, "search", () => setQ(q))} />
          )}
        </Section>
      )}

      {/* Discovery sections */}
      {searchResults === null && discover && (
        <>
          {/* Contacts — opt-in */}
          <Section title="People you may know" icon={<Phone size={14} />}>
            <div className="ios-card mx-4 px-4 py-3 flex items-center gap-3" data-testid="contacts-card">
              <div style={{ flex: 1 }}>
                <div className="t-title3">Find your contacts</div>
                <div className="t-cap muted">Match your phone contacts against Freccos.</div>
              </div>
              <button onClick={requestContacts} className="btn-pill btn-secondary" style={{ padding: "8px 12px", fontSize: 13 }} data-testid="contacts-btn">
                Allow
              </button>
            </div>
          </Section>

          {discover.friends_of_friends?.length > 0 && (
            <Section title="Friends of friends" icon={<Sparkles size={14} />}>
              <PeopleList users={discover.friends_of_friends} onToggle={(u) => toggleFollow(u, "fof", loadDiscover)} />
            </Section>
          )}
          {discover.active_this_week?.length > 0 && (
            <Section title="Active this week" icon={<Clock size={14} />}>
              <PeopleList users={discover.active_this_week} onToggle={(u) => toggleFollow(u, "active", loadDiscover)} />
            </Section>
          )}
          {discover.bucket_matches?.length > 0 && (
            <Section title="Visited places you'd love" icon={<Compass size={14} />}>
              <PeopleList users={discover.bucket_matches} onToggle={(u) => toggleFollow(u, "bucket", loadDiscover)} />
            </Section>
          )}
          {discover.recently_joined?.length > 0 && (
            <Section title="New to Freccos">
              <PeopleList users={discover.recently_joined} onToggle={(u) => toggleFollow(u, "new", loadDiscover)} />
            </Section>
          )}
          {Object.values(discover).every((arr) => !arr || arr.length === 0) && (
            <div className="px-6 mt-6" data-testid="people-empty">
              <p className="t-sub muted">No one to suggest just yet. As people you follow grow their travel logs, suggestions will appear here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mt-2">
      <div className="section-header flex items-center gap-1" style={{ color: "#3a3a3c" }}>
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function EmptyMini({ children }) {
  return <div className="px-6 t-sub muted">{children}</div>;
}

function PeopleList({ users, onToggle }) {
  return (
    <div className="ios-card mx-4" style={{ overflow: "hidden" }} data-testid="people-list">
      {users.map((u) => (
        <PersonRow key={u.id} u={u} onToggle={() => onToggle(u)} />
      ))}
    </div>
  );
}

function PersonRow({ u, onToggle }) {
  const stats = typeof u.city_count === "number"
    ? `${u.city_count} ${u.city_count === 1 ? "city" : "cities"} · ${u.country_count} ${u.country_count === 1 ? "country" : "countries"}`
    : null;
  const subText = u.followed_by ? `Followed by ${u.followed_by.slice(0, 2).join(", ")}`
    : u.matched_city ? `Been to ${u.matched_city} — on your bucket list`
    : u.latest_rec ? `Latest: '${u.latest_rec.place_name}'${u.latest_rec.city_name ? `, ${u.latest_rec.city_name}` : ""}`
    : null;
  const btnLabel = u.is_following ? "Following" : u.request_pending ? "Requested" : "Follow";
  const btnStyle = u.is_following
    ? { background: "rgba(120,120,128,0.14)", color: "#1C1C1E" }
    : u.request_pending
    ? { background: "rgba(120,120,128,0.14)", color: "#1C1C1E" }
    : { background: "#0A84FF", color: "#fff" };
  return (
    <div className="list-row">
      <Link to={`/user/${u.id}`} className="flex items-center gap-3" style={{ textDecoration: "none", color: "inherit", flex: 1 }} data-testid={`user-link-${u.id}`}>
        <Avatar user={u} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
          {stats && <div className="t-cap muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stats}</div>}
          {subText && <div className="t-cap" style={{ color: "#0A84FF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subText}</div>}
        </div>
      </Link>
      <button
        data-testid={`follow-toggle-${u.id}`}
        onClick={onToggle}
        className="btn-pill"
        style={{ padding: "6px 14px", fontSize: 13, ...btnStyle }}
      >
        {u.is_following ? <UserCheck size={14} /> : <UserPlus size={14} />}
        {btnLabel}
      </button>
    </div>
  );
}
