import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import Avatar from "./Avatar";
import { CategoryChip } from "./CategoryChip";
import PlaceSheet from "./PlaceSheet";
import { Bookmark, BookmarkCheck, ChevronRight, Sparkles, Plane } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, photoUrl } from "../lib/utils-frec";
import { useAuth } from "../lib/auth";
import { track, Events } from "../lib/analytics";

const PAGE_FIRST = 20;
const PAGE_MORE = 10;

export default function Feed({ onSwitchToCities }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState(null); // null = initial loading
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [placeOpen, setPlaceOpen] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);
  const pullStartY = useRef(null);

  // Cached items in sessionStorage so re-open feels instant
  const CACHE_KEY = "freccos:feed:v1";

  const loadFirst = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const { data } = await api.get("/feed", { params: { limit: PAGE_FIRST } });
      setItems(data.items || []);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* noop */ }
    } catch { /* leave items as is */ }
    finally { setRefreshing(false); }
  }, []);

  // Cache-then-network on mount
  useEffect(() => {
    let cached = null;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) cached = JSON.parse(raw);
    } catch { /* ignore */ }
    if (cached?.items) {
      setItems(cached.items);
      setCursor(cached.next_cursor);
      setHasMore(!!cached.next_cursor);
    }
    loadFirst(false);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get("/feed", { params: { limit: PAGE_MORE, before: cursor } });
      setItems((prev) => [...(prev || []), ...(data.items || [])]);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch { /* keep what we have */ }
    finally { setLoadingMore(false); }
  }, [cursor, loadingMore]);

  // IntersectionObserver-driven infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore(); },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // Pull-to-refresh — only when scrolled to top
  const onTouchStart = (e) => {
    if ((containerRef.current?.scrollTop ?? window.scrollY) > 0) { pullStartY.current = null; return; }
    pullStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (pullStartY.current == null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) setPullY(Math.min(dy * 0.5, 80));
  };
  const onTouchEnd = async () => {
    if (pullY > 50) { await loadFirst(true); }
    setPullY(0);
    pullStartY.current = null;
  };

  const openPlace = (item) => {
    const cityId = item.city?.id;
    if (item.type === "new_rec") {
      track(Events.PLACE_CARD_OPENED, { place_name: item.place_name, city_id: cityId, category: item.category, source: "feed" });
      setPlaceOpen({
        cityId,
        group: {
          place_key: item.rec_id,
          place_name: item.place_name,
          place_id: item.place_id,
          category: item.category,
          photo_url: item.photo_url,
          is_saved: savedIds.has(item.rec_id),
          primary_rec_id: item.rec_id,
          contributors: [{
            id: item.rec_id,
            place_name: item.place_name,
            category: item.category,
            note: item.note,
            photo_url: item.photo_url,
            created_at: item.created_at,
            user: item.user,
          }],
        },
      });
    } else if (item.type === "top_pick") {
      track(Events.PLACE_CARD_OPENED, { place_name: item.place_name, city_id: cityId, category: item.category, source: "feed_toppick" });
      setPlaceOpen({
        cityId,
        group: {
          place_key: item.primary_rec_id,
          place_name: item.place_name,
          place_id: item.place_id,
          category: item.category,
          is_saved: false,
          primary_rec_id: item.primary_rec_id,
          contributors: item.contributors,
        },
      });
    }
  };

  const inlineSave = async (item, e) => {
    e.stopPropagation();
    try {
      await api.post(`/trip-plans/${item.city.id}/save`, { recommendation_id: item.rec_id });
      setSavedIds((s) => new Set([...s, item.rec_id]));
      toast.success(`Saved ${item.place_name}`);
      track(Events.RECOMMENDATION_SAVED, { place_name: item.place_name, city_id: item.city.id, saved_from_user_id: item.user?.id });
    } catch (err) { toast.error(err?.response?.data?.detail || "Couldn't save"); }
  };

  // ----------------- Render -----------------
  if (items === null) return <FeedSkeleton />;

  if (items.length === 0 && (!user?.following || user.following.length === 0)) {
    return (
      <EmptyState
        testId="feed-empty-no-follows"
        title="Nothing here yet"
        message="Follow people to see their recommendations."
        ctaLabel="Find people to follow →"
        onCta={() => nav("/people")}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        testId="feed-empty-quiet"
        title="All caught up"
        message="Your people haven't added anything recently."
        ctaLabel="Explore cities →"
        onCta={onSwitchToCities}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: `translateY(${pullY}px)`, transition: pullStartY.current ? "none" : "transform 200ms ease-out" }}
      data-testid="feed"
    >
      {(refreshing || pullY > 0) && (
        <div style={{ textAlign: "center", padding: "8px 0", color: "#8E8E93", fontSize: 12 }}>
          {refreshing ? "Refreshing…" : pullY > 50 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div className="px-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => {
          if (item.type === "new_rec") return <NewRecCard key={item.id} item={item} saved={savedIds.has(item.rec_id)} onOpen={() => openPlace(item)} onSave={(e) => inlineSave(item, e)} />;
          if (item.type === "new_trip") return <NewTripCard key={item.id} item={item} onExplore={() => { track(Events.CITY_EXPLORED, { city_name: item.city.name, country: item.city.country, source: "feed" }); nav(`/city/${item.city.id}`); }} />;
          if (item.type === "top_pick") return <TopPickCard key={item.id} item={item} onOpen={() => openPlace(item)} />;
          return null;
        })}

        {loadingMore && <FeedSkeletonCard />}
        {!hasMore && items.length > 5 && (
          <div style={{ textAlign: "center", color: "#8E8E93", fontSize: 12, padding: "12px 0 24px" }}>
            You're all caught up.
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>

      <PlaceSheet
        open={!!placeOpen}
        onClose={() => setPlaceOpen(null)}
        cityId={placeOpen?.cityId}
        group={placeOpen?.group}
        onChange={() => { /* feed doesn't need refresh on save toggle */ }}
      />
    </div>
  );
}

/* -------------- Cards -------------- */

function CardShell({ children, onClick, tonal = false, testId }) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      data-testid={testId}
      className="ios-card"
      style={{
        padding: 16,
        background: tonal ? "#F0F7FF" : "#FFFFFF",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        borderRadius: 12,
        maxHeight: 320,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ user, when }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar user={user} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-title3" style={{ fontSize: 14 }}>{user?.name}</div>
      </div>
      <div className="t-cap tertiary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatRelativeTime(when)}</div>
    </div>
  );
}

function NewRecCard({ item, saved, onOpen, onSave }) {
  const truncated = item.note && item.note.length > 220;
  const noteShown = truncated ? item.note.slice(0, 200).trim() + "…" : item.note;
  return (
    <CardShell onClick={onOpen} testId={`feed-new-rec-${item.rec_id}`}>
      <CardHeader user={item.user} when={item.created_at} />
      <div className="t-sub muted" style={{ marginTop: 6, fontSize: 13 }}>
        Added a recommendation in {item.city?.name} {item.city?.flag_emoji}
      </div>
      {item.photo_url && (
        <div
          style={{
            marginTop: 10,
            width: "100%", aspectRatio: "16/9",
            background: `#eee url('${photoUrl(item.photo_url)}') center/cover`,
            borderRadius: 12,
          }}
        />
      )}
      <div className="t-title3" style={{ marginTop: 10 }}>{item.place_name}</div>
      {noteShown && (
        <p style={{ color: "#3a3a3c", fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>
          {noteShown}{truncated && <span style={{ color: "#0A84FF", marginLeft: 4 }}>Read more</span>}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <CategoryChip category={item.category} />
        <button
          onClick={onSave}
          data-testid={`feed-save-${item.rec_id}`}
          className="btn-pill"
          style={{
            background: saved ? "rgba(48,209,88,0.15)" : "#0A84FF",
            color: saved ? "#1B7C2D" : "#fff",
            border: saved ? "1px solid #30D158" : "none",
            padding: "6px 14px", fontSize: 13,
          }}
        >
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </CardShell>
  );
}

function NewTripCard({ item, onExplore }) {
  return (
    <CardShell testId={`feed-new-trip-${item.id}`}>
      <CardHeader user={item.user} when={item.created_at} />
      <p style={{ color: "#1C1C1E", fontSize: 15, lineHeight: 1.45, marginTop: 8 }}>
        <strong>{item.user?.name?.split(" ")[0]}</strong> added a trip to {item.city.name} {item.city.flag_emoji}
      </p>
      <button
        onClick={onExplore}
        className="link"
        style={{ marginTop: 10, color: "#0A84FF", background: "transparent", border: "none", padding: 0, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        Explore {item.city.name} <ChevronRight size={14} />
      </button>
    </CardShell>
  );
}

function TopPickCard({ item, onOpen }) {
  const contributors = item.contributors || [];
  const visible = contributors.slice(0, 3);
  const namesLine = contributors.length === 2
    ? `${contributors[0].user?.name?.split(" ")[0]} and ${contributors[1].user?.name?.split(" ")[0]} recommended this`
    : `${contributors[0].user?.name?.split(" ")[0]}, ${contributors[1]?.user?.name?.split(" ")[0]} + ${contributors.length - 2} more recommended this`;
  return (
    <CardShell tonal onClick={onOpen} testId={`feed-top-pick-${item.id}`}>
      <div className="t-cap tertiary" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#0A84FF" }}>
        <Sparkles size={12} /> Your people love this place
      </div>
      <div className="t-title2" style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{item.place_name}</div>
      {item.city && (
        <div className="t-sub muted" style={{ marginTop: 2, fontSize: 13 }}>
          {item.city.name} {item.city.flag_emoji}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <div style={{ display: "inline-flex" }}>
          {visible.map((c, i) => (
            <div key={c.id || i} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid #F0F7FF", borderRadius: "50%" }}>
              <Avatar user={c.user} size={28} />
            </div>
          ))}
        </div>
        <p style={{ color: "#1C1C1E", fontSize: 14, lineHeight: 1.4, margin: 0 }}>{namesLine}</p>
      </div>
      <button
        onClick={onOpen}
        style={{ marginTop: 12, color: "#0A84FF", background: "transparent", border: "none", padding: 0, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        See what they say <ChevronRight size={14} />
      </button>
    </CardShell>
  );
}

/* -------------- Skeleton + Empty states -------------- */

function FeedSkeletonCard() {
  return (
    <div className="ios-card" style={{ padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9999, background: "#E5E5EA" }} />
        <div style={{ width: 120, height: 12, background: "#E5E5EA", borderRadius: 4 }} />
      </div>
      <div style={{ width: "60%", height: 12, background: "#EEE", borderRadius: 4, marginTop: 14 }} />
      <div style={{ width: "100%", aspectRatio: "16/9", background: "#EEE", borderRadius: 12, marginTop: 12 }} />
      <div style={{ width: "80%", height: 14, background: "#EEE", borderRadius: 4, marginTop: 12 }} />
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="px-4" style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="feed-skeleton">
      <FeedSkeletonCard />
      <FeedSkeletonCard />
      <FeedSkeletonCard />
    </div>
  );
}

function EmptyState({ title, message, ctaLabel, onCta, testId }) {
  return (
    <div className="px-6" style={{ marginTop: 56, textAlign: "center" }} data-testid={testId}>
      <div style={{ display: "inline-flex", padding: 18, background: "rgba(10,132,255,0.08)", borderRadius: 9999, color: "#0A84FF" }}>
        <Plane size={28} />
      </div>
      <h3 className="t-title2 mt-3">{title}</h3>
      <p className="t-sub muted mt-1" style={{ maxWidth: 320, margin: "6px auto 0" }}>{message}</p>
      <button
        onClick={onCta}
        className="btn-pill btn-primary mt-5"
        style={{ padding: "10px 18px" }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
