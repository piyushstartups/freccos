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
import { shareInvite } from "../lib/invite";
import NotificationsBanner from "./NotificationsBanner";

const PAGE_FIRST = 20;
const PAGE_MORE = 10;

// Stable place key — must match the backend's _place_key
function placeKeyOf(item) {
  return item.place_id || `name::${(item.place_name || "").toLowerCase().trim()}`;
}

export default function Feed({ onSwitchToCities, maxItems, hideEmptyHint }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState(null); // null = initial loading
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [placeOpen, setPlaceOpen] = useState(null);
  // Saved state is keyed by place_key so a save persists across rec instances of the same place.
  const [savedKeys, setSavedKeys] = useState(new Set());
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);
  const pullStartY = useRef(null);

  // Cached items in sessionStorage so re-open feels instant
  const CACHE_KEY = "freccos:feed:v1";

  // Build the savedKeys set from the server's `is_saved` flags so it survives reloads.
  const mergeSavedFromItems = useCallback((newItems, replace = false) => {
    setSavedKeys((prev) => {
      const next = replace ? new Set() : new Set(prev);
      for (const it of newItems) {
        if (it && it.is_saved) next.add(placeKeyOf(it));
      }
      return next;
    });
  }, []);

  const loadFirst = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const { data } = await api.get("/feed", { params: { limit: PAGE_FIRST } });
      const list = data.items || [];
      setItems(list);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
      mergeSavedFromItems(list, true);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* noop */ }
    } catch { /* leave items as is */ }
    finally { setRefreshing(false); }
  }, [mergeSavedFromItems]);

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
      mergeSavedFromItems(cached.items, true);
    }
    loadFirst(false);
  }, [loadFirst, mergeSavedFromItems]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get("/feed", { params: { limit: PAGE_MORE, before: cursor } });
      const list = data.items || [];
      setItems((prev) => [...(prev || []), ...list]);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
      mergeSavedFromItems(list, false);
    } catch { /* keep what we have */ }
    finally { setLoadingMore(false); }
  }, [cursor, loadingMore, mergeSavedFromItems]);

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
    if (!cityId) return;
    const key = placeKeyOf(item);
    if (item.type === "new_rec") {
      track(Events.PLACE_CARD_OPENED, { place_name: item.place_name, city_id: cityId, category: item.category, source: "feed" });
      setPlaceOpen({
        cityId,
        group: {
          place_key: key,
          place_name: item.place_name,
          place_id: item.place_id,
          category: item.category,
          photo_url: item.photo_url,
          is_saved: savedKeys.has(key),
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
          place_key: key,
          place_name: item.place_name,
          place_id: item.place_id,
          category: item.category,
          is_saved: savedKeys.has(key),
          primary_rec_id: item.primary_rec_id,
          contributors: item.contributors,
        },
      });
    }
  };

  // Refresh saved state when the PlaceSheet save toggles — re-pull /feed quietly
  const refreshSavedFromServer = useCallback(async () => {
    try {
      const { data } = await api.get("/feed", { params: { limit: Math.max(items?.length || PAGE_FIRST, PAGE_FIRST) } });
      mergeSavedFromItems(data.items || [], true);
    } catch { /* noop */ }
  }, [items, mergeSavedFromItems]);

  const inlineSave = async (item, e) => {
    e.stopPropagation();
    const key = placeKeyOf(item);
    if (savedKeys.has(key)) {
      // Already saved — open the place sheet so the user can unsave with confirmation
      openPlace(item);
      return;
    }
    try {
      await api.post(`/trip-plans/${item.city.id}/save`, { recommendation_id: item.rec_id });
      setSavedKeys((s) => new Set([...s, key]));
      toast.success(`Saved ${item.place_name}`);
      track(Events.RECOMMENDATION_SAVED, { place_name: item.place_name, city_id: item.city.id, saved_from_user_id: item.user?.id });
    } catch (err) { toast.error(err?.response?.data?.detail || "Couldn't save"); }
  };

  // ----------------- Render -----------------
  if (items === null) return <FeedSkeleton />;

  if (items.length === 0 && (!user?.following || user.following.length === 0)) {
    if (hideEmptyHint) return null;
    return (
      <EmptyState
        testId="feed-empty-no-follows"
        title="Follow your friends to see the places they love."
        message=""
        ctaLabel="Find friends →"
        onCta={() => nav("/people")}
      />
    );
  }
  if (items.length === 0) {
    if (hideEmptyHint) {
      return (
        <div className="px-4" data-testid="feed-quiet-hint" style={{ textAlign: "center", padding: "12px 16px" }}>
          <p className="t-sub muted" style={{ marginBottom: 12 }}>
            All caught up. Your people have not added anything recently.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={onSwitchToCities}
              data-testid="feed-quiet-explore"
              className="btn-pill btn-primary"
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              Explore places
            </button>
            <button
              onClick={() => shareInvite({ code: user?.invite_code, surface: "feed_empty" })}
              data-testid="feed-quiet-invite"
              className="btn-pill"
              style={{ padding: "8px 16px", fontSize: 13, background: "rgba(10,132,255,0.10)", color: "#0A84FF" }}
            >
              Invite friends
            </button>
          </div>
        </div>
      );
    }
    return (
      <EmptyState
        testId="feed-empty-quiet"
        title="All caught up. Your people have not added anything recently."
        message=""
        ctaLabel="Explore places →"
        onCta={onSwitchToCities}
      />
    );
  }

  const displayedItems = typeof maxItems === "number" ? items.slice(0, maxItems) : items;

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      // CRITICAL: only set transform when we're actually pulling. A non-none
      // transform creates a containing block for `position: fixed` descendants
      // — applying `translateY(0px)` permanently would cause the PlaceSheet
      // bottom-sheet (rendered as a child below) to position itself relative
      // to this Feed div instead of the viewport, making it appear offscreen
      // and behave unpredictably on card tap.
      style={pullY > 0
        ? { transform: `translateY(${pullY}px)`, transition: pullStartY.current ? "none" : "transform 200ms ease-out" }
        : undefined}
      data-testid="feed"
    >
      {(refreshing || pullY > 0) && (
        <div style={{ textAlign: "center", padding: "8px 0", color: "#8E8E93", fontSize: 12 }}>
          {refreshing ? "Refreshing…" : pullY > 50 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <NotificationsBanner />

      <div className="px-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayedItems.map((item) => {
          if (item.type === "new_rec") {
            const key = placeKeyOf(item);
            return <NewRecCard key={item.id} item={item} saved={savedKeys.has(key)} onOpen={() => openPlace(item)} onSave={(e) => inlineSave(item, e)} />;
          }
          if (item.type === "new_trip") return <NewTripCard key={item.id} item={item} onExplore={() => { track(Events.CITY_EXPLORED, { city_name: item.city.name, country: item.city.country, source: "feed" }); nav(`/city/${item.city.id}`); }} />;
          if (item.type === "top_pick") return <TopPickCard key={item.id} item={item} onOpen={() => openPlace(item)} />;
          return null;
        })}

        {/* Hide loading skeleton + 'all caught up' line when we're rendering inside the
            multi-section Explore Feed — the parent owns spacing in that mode. */}
        {!maxItems && loadingMore && <FeedSkeletonCard />}
        {!maxItems && !hasMore && items.length > 5 && (
          <div style={{ textAlign: "center", color: "#8E8E93", fontSize: 12, padding: "12px 0 24px" }}>
            You&apos;re all caught up.
          </div>
        )}
        {!maxItems && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>

      <PlaceSheet
        open={!!placeOpen}
        onClose={() => setPlaceOpen(null)}
        cityId={placeOpen?.cityId}
        group={placeOpen?.group}
        onChange={refreshSavedFromServer}
      />
    </div>
  );
}

/* -------------- Cards -------------- */

function CardShell({ children, onClick, tonal = false, accentLeft = false, testId }) {
  // Note — DO NOT add `onTouchEnd` here. iOS/Android both fire a synthetic
  // `click` after `touchend`; running the open handler in both lands the
  // follow-up click on the just-mounted backdrop and instantly closes the
  // sheet ("ghost-click"). `cursor:pointer` is enough for iOS Safari to
  // dispatch click events on a non-button container.
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
        borderLeft: accentLeft ? "3px solid #0A84FF" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ user, when }) {
  // Avatar and name are always profile links — stopPropagation so they don't open the place sheet.
  const stop = (e) => e.stopPropagation();
  if (!user?.id) {
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Link
        to={`/user/${user.id}`}
        onClick={stop}
        style={{ display: "inline-flex", textDecoration: "none" }}
        data-testid={`feed-avatar-${user.id}`}
      >
        <Avatar user={user} size={36} />
      </Link>
      <Link
        to={`/user/${user.id}`}
        onClick={stop}
        style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
        data-testid={`feed-name-${user.id}`}
      >
        <div className="t-title3" style={{ fontSize: 14 }}>{user.name}</div>
      </Link>
      <div className="t-cap tertiary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatRelativeTime(when)}</div>
    </div>
  );
}

// Compact note with 3-line clamp and inline "Read more" toggle
function ClampedNote({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Detect overflow once mounted
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text]);
  return (
    <div style={{ marginTop: 6 }}>
      <p
        ref={ref}
        style={{
          color: "#3a3a3c", fontSize: 14, lineHeight: 1.4, margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {text}
      </p>
      {overflows && !expanded && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          style={{ background: "transparent", border: "none", padding: 0, marginTop: 4, color: "#0A84FF", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          Read more
        </button>
      )}
    </div>
  );
}

function NewRecCard({ item, saved, onOpen, onSave }) {
  return (
    <CardShell onClick={onOpen} testId={`feed-new-rec-${item.rec_id}`}>
      <CardHeader user={item.user} when={item.created_at} />
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
      <div className="t-title3" style={{ marginTop: 10, wordBreak: "break-word" }}>{item.place_name}</div>
      {item.city?.name && (
        <div style={{ marginTop: 6 }}>
          <span
            data-testid={`feed-city-chip-${item.rec_id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "#F2F2F7", color: "#1C1C1E",
              fontSize: 12, fontWeight: 500,
              padding: "3px 9px", borderRadius: 9999,
            }}
          >
            <span aria-hidden style={{ lineHeight: 1 }}>{item.city.flag_emoji}</span>
            <span>{item.city.name}</span>
          </span>
        </div>
      )}
      {item.note && <ClampedNote text={item.note} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 }}>
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
            display: "inline-flex", alignItems: "center", gap: 6,
            flexShrink: 0,
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
    <CardShell accentLeft testId={`feed-new-trip-${item.id}`}>
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
  const stop = (e) => e.stopPropagation();
  return (
    <CardShell tonal onClick={onOpen} testId={`feed-top-pick-${item.id}`}>
      <div className="t-cap tertiary" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#0A84FF" }}>
        <Sparkles size={12} /> Your people love this place
      </div>
      <div className="t-title2" style={{ marginTop: 8, fontSize: 18, fontWeight: 700, wordBreak: "break-word" }}>{item.place_name}</div>
      {item.city && (
        <div className="t-sub muted" style={{ marginTop: 2, fontSize: 13 }}>
          {item.city.name} {item.city.flag_emoji}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <div style={{ display: "inline-flex" }}>
          {visible.map((c, i) => (
            c.user?.id ? (
              <Link
                key={c.id || i}
                to={`/user/${c.user.id}`}
                onClick={stop}
                style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid #F0F7FF", borderRadius: "50%", display: "inline-block" }}
                data-testid={`feed-top-avatar-${c.user.id}`}
              >
                <Avatar user={c.user} size={28} />
              </Link>
            ) : (
              <div key={c.id || i} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid #F0F7FF", borderRadius: "50%" }}>
                <Avatar user={c.user} size={28} />
              </div>
            )
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
