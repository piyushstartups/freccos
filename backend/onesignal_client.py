"""
OneSignal REST API client + Freccos notification triggers.

All triggered notifications go through OneSignal. The frontend tags the user
with `external_id == Freccos user.id`; backend targets via `include_aliases`.

Reference: https://documentation.onesignal.com/reference/create-message
           https://documentation.onesignal.com/reference/quick-start-api-guide
"""
from __future__ import annotations
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import httpx

logger = logging.getLogger("onesignal")

ONESIGNAL_BASE = "https://api.onesignal.com"
APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
API_KEY = os.environ.get("ONESIGNAL_API_KEY", "").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://freccos.com").rstrip("/")

# Quiet hours — 11pm–8am in the recipient's local timezone.
QUIET_START_HOUR = 23
QUIET_END_HOUR = 8

# All notification preference keys + human labels (used by the settings UI).
NOTIFICATION_PREFS: dict[str, dict[str, str]] = {
    # Social
    "new_follower":      {"group": "social",   "label": "New followers"},
    "follow_accepted":   {"group": "social",   "label": "Follow request accepted"},
    "invite_joined":     {"group": "social",   "label": "Friend joined via your invite"},
    # Activity
    "rec_in_saved_city": {"group": "activity", "label": "Friend added a rec in your saved city"},
    "friend_rec_burst":  {"group": "activity", "label": "Friend added new recommendations"},
    "friend_new_trip":   {"group": "activity", "label": "Friend added a new trip"},
    # Impact
    "your_rec_saved":    {"group": "impact",   "label": "Someone saved your recommendation"},
    "your_rec_visited":  {"group": "impact",   "label": "Someone visited a place you recommended"},
    "your_rec_inspired": {"group": "impact",   "label": "Someone was inspired by your recommendation"},
    "monthly_impact":    {"group": "impact",   "label": "Monthly impact summary"},
}

def default_prefs() -> dict[str, bool]:
    return {k: True for k in NOTIFICATION_PREFS.keys()}


def _first(name: str | None) -> str:
    if not name:
        return "Someone"
    return name.split(" ")[0]


def _abs_url(path: str) -> str:
    if not path:
        return FRONTEND_URL
    if path.startswith("http"):
        return path
    return f"{FRONTEND_URL}{path if path.startswith('/') else '/' + path}"


def _in_quiet_hours(tz_name: str | None) -> bool:
    """Return True if it's currently 23:00–07:59 in tz_name. Falls back to UTC."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name) if tz_name else timezone.utc
    except Exception:
        tz = timezone.utc
    now = datetime.now(tz)
    h = now.hour
    return h >= QUIET_START_HOUR or h < QUIET_END_HOUR


# -------- Low-level REST calls --------

async def _post_notification(payload: dict) -> Optional[dict]:
    if not APP_ID or not API_KEY:
        logger.info("[onesignal] credentials missing — skipping send: %s", payload.get("name") or payload.get("contents"))
        return None
    headers = {"Authorization": f"Key {API_KEY}", "Content-Type": "application/json"}
    body = {"app_id": APP_ID, "target_channel": "push", **payload}
    try:
        async with httpx.AsyncClient(base_url=ONESIGNAL_BASE, timeout=10.0) as c:
            r = await c.post("/notifications", json=body, headers=headers)
        if r.status_code not in (200, 202):
            logger.warning("[onesignal] send failed %s: %s", r.status_code, r.text[:300])
            return None
        data = r.json()
        # Surface delivery diagnostics — recipients=0 means OneSignal accepted the
        # call but no devices matched (stale sub_ids, missing external_id, etc.).
        recipients = data.get("recipients")
        errors = data.get("errors")
        if recipients == 0 or errors:
            logger.warning("[onesignal] accepted but undelivered: recipients=%s errors=%s payload_keys=%s",
                           recipients, errors, list(payload.keys()))
        else:
            logger.info("[onesignal] delivered: recipients=%s id=%s", recipients, data.get("id"))
        return data
    except Exception as e:
        logger.exception("[onesignal] send exception: %s", e)
        return None


async def update_tags_by_external_id(external_id: str, tags: dict) -> None:
    """Patch OneSignal user tags by external_id. Tag values must be strings."""
    if not APP_ID or not API_KEY or not external_id:
        return
    flat = {}
    for k, v in (tags or {}).items():
        if v is None:
            continue
        flat[k] = ",".join(map(str, v)) if isinstance(v, list) else str(v)
    if not flat:
        return
    headers = {"Authorization": f"Key {API_KEY}", "Content-Type": "application/json"}
    url = f"/apps/{APP_ID}/users/external_id/{external_id}"
    try:
        async with httpx.AsyncClient(base_url=ONESIGNAL_BASE, timeout=10.0) as c:
            r = await c.patch(url, json={"properties": {"tags": flat}}, headers=headers)
        if r.status_code not in (200, 202):
            logger.warning("[onesignal] tag patch failed %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.exception("[onesignal] tag patch exception: %s", e)


async def fetch_user_by_external_id(external_id: str) -> Optional[dict]:
    """GET the OneSignal user record by external_id. Returns the parsed payload
    (with .subscriptions[]) or None if the user doesn't exist on OneSignal yet.

    Used to recover the push token for users where the v16 SDK got stuck on a
    409 conflict during init — the SDK never POSTed the subscription id to our
    backend, but OneSignal itself has the subscription server-side. We pull it
    from OneSignal directly and merge into users.onesignal_subscriptions[].
    """
    if not APP_ID or not API_KEY or not external_id:
        return None
    headers = {"Authorization": f"Key {API_KEY}", "Content-Type": "application/json"}
    url = f"/apps/{APP_ID}/users/by/external_id/{external_id}"
    try:
        async with httpx.AsyncClient(base_url=ONESIGNAL_BASE, timeout=10.0) as c:
            r = await c.get(url, headers=headers)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 404:
            return None
        logger.warning("[onesignal] fetch_user_by_external_id %s -> %s: %s", external_id, r.status_code, r.text[:200])
        return None
    except Exception as e:
        logger.exception("[onesignal] fetch_user_by_external_id exception: %s", e)
        return None


def extract_subscription_ids(user_payload: dict) -> list[dict]:
    """Pull out push subscriptions with non-empty tokens from a OneSignal user
    payload. Returns a list of {subscription_id, opted_in, type, token_present}.
    """
    out = []
    for s in (user_payload or {}).get("subscriptions", []) or []:
        if not s:
            continue
        s_type = (s.get("type") or "").lower()
        if s_type not in ("chromepush", "safaripush", "firefoxpush", "edgepush", "webpush"):
            continue
        sub_id = s.get("id")
        if not sub_id:
            continue
        out.append({
            "subscription_id": sub_id,
            "opted_in": bool(s.get("enabled", True)),
            "type": s_type,
            "token_present": bool(s.get("token")),
        })
    return out


# -------- Core send helper (called by every trigger) --------

async def _send_to_user(
    db,
    user_id: str,
    pref_key: str,
    body: str,
    *,
    heading: str = "Freccos",
    url_path: Optional[str] = None,
    # In-app notification record (always written, regardless of push delivery)
    kind: Optional[str] = None,         # in-app kind (defaults to pref_key)
    actor_id: Optional[str] = None,
    in_app_payload: Optional[dict] = None,
) -> None:
    """Push via OneSignal AND write a row to the in-app `notifications` table.

    Push delivery: prefer the user's stored OneSignal subscription IDs
    (`users.onesignal_subscriptions[].subscription_id`); fall back to external_id
    aliases. Always writes the in-app record so the Activity tab is the source
    of truth regardless of whether push made it through.
    """
    if not user_id:
        return
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "notification_preferences": 1, "timezone": 1, "onesignal_subscriptions": 1},
    )
    if not user:
        return
    prefs = (user.get("notification_preferences") or default_prefs())
    pref_enabled = prefs.get(pref_key, True)

    # 1) ALWAYS write the in-app record (Activity tab) regardless of push prefs.
    try:
        in_app_payload = dict(in_app_payload or {})
        in_app_payload.setdefault("body", body)
        if url_path:
            in_app_payload["deep_link_url"] = url_path
        await db.notifications.insert_one({
            "id": str(__import__("uuid").uuid4()),
            "user_id": user_id,
            "actor_id": actor_id,
            "kind": kind or pref_key,
            "payload": in_app_payload,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.exception("[onesignal] in-app write failed: %s", e)

    # 2) Push delivery — gated by per-user pref toggle (+ quiet hours for broadcasts)
    if not pref_enabled:
        return
    if pref_key == "monthly_impact" and _in_quiet_hours(user.get("timezone")):
        logger.info("[onesignal] quiet hours, skipping %s to %s", pref_key, user_id)
        return

    # Prefer subscription_ids of opted-in devices. Fall back to external_id alias.
    sub_ids: list[str] = []
    all_sub_ids: list[str] = []
    for s in (user.get("onesignal_subscriptions") or []):
        sid = (s or {}).get("subscription_id")
        if not sid:
            continue
        all_sub_ids.append(sid)
        if s.get("opted_in") is not False:  # default to opted-in if flag missing
            sub_ids.append(sid)

    logger.info(
        "[onesignal] sending pref=%s to user=%s — stored_subs=%d opted_in_subs=%d",
        pref_key, user_id, len(all_sub_ids), len(sub_ids),
    )

    payload = {
        "headings": {"en": heading},
        "contents": {"en": body},
        "data": {"pref_key": pref_key, "kind": kind or pref_key},
    }
    if sub_ids:
        payload["include_subscription_ids"] = sub_ids
        targeting = "subscription_ids"
    else:
        payload["include_aliases"] = {"external_id": [user_id]}
        payload["target_channel"] = "push"  # required when targeting aliases
        targeting = "external_id"

    if url_path:
        payload["url"] = _abs_url(url_path)
        payload["web_url"] = _abs_url(url_path)

    resp = await _post_notification(payload)

    # If we targeted sub_ids and OneSignal couldn't deliver to any of them, the
    # stored IDs are stale (typical after a service-worker scope change). Drop
    # them so future sends use the fresh external_id path, and retry once now.
    if resp and sub_ids and (resp.get("recipients") == 0 or resp.get("errors")):
        logger.warning(
            "[onesignal] stale sub_ids for user=%s — pruning %d and retrying via external_id",
            user_id, len(sub_ids),
        )
        try:
            await db.users.update_one(
                {"id": user_id},
                {"$pull": {"onesignal_subscriptions": {"subscription_id": {"$in": sub_ids}}}},
            )
        except Exception as e:
            logger.exception("[onesignal] prune stale subs failed: %s", e)
        retry_payload = {
            "headings": {"en": heading},
            "contents": {"en": body},
            "data": {"pref_key": pref_key, "kind": kind or pref_key},
            "include_aliases": {"external_id": [user_id]},
            "target_channel": "push",
        }
        if url_path:
            retry_payload["url"] = _abs_url(url_path)
            retry_payload["web_url"] = _abs_url(url_path)
        await _post_notification(retry_payload)
        targeting = "external_id (retry)"

    logger.info("[onesignal] sent pref=%s user=%s via=%s", pref_key, user_id, targeting)


# -------- Burst / dedup helpers --------

async def _was_recently_notified(db, recipient_id: str, sender_id: str, kind: str, minutes: int = 30) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    doc = await db.notification_dedup.find_one({
        "recipient_id": recipient_id, "sender_id": sender_id, "kind": kind,
        "sent_at": {"$gte": cutoff.isoformat()},
    })
    return bool(doc)

async def _mark_notified(db, recipient_id: str, sender_id: str, kind: str) -> None:
    await db.notification_dedup.update_one(
        {"recipient_id": recipient_id, "sender_id": sender_id, "kind": kind},
        {"$set": {"sent_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


# -------- The 10 triggers --------

async def trig_new_follower(db, actor: dict, recipient_id: str) -> None:
    """1. [Name] started following you on Freccos"""
    body = f"{_first(actor.get('name'))} started following you on Freccos."
    await _send_to_user(
        db, recipient_id, "new_follower", body,
        url_path=f"/user/{actor['id']}",
        kind="new_follower", actor_id=actor.get("id"),
    )

async def trig_follow_accepted(db, accepter: dict, requester_id: str) -> None:
    """2. [Name] accepted your follow request"""
    body = f"{_first(accepter.get('name'))} accepted your follow request."
    await _send_to_user(
        db, requester_id, "follow_accepted", body,
        url_path=f"/user/{accepter['id']}",
        kind="request_accepted", actor_id=accepter.get("id"),
    )

async def trig_invite_joined(db, joiner: dict, inviter_id: str) -> None:
    """3. [Name] just joined Freccos using your invite"""
    body = f"{_first(joiner.get('name'))} just joined Freccos using your invite."
    await _send_to_user(
        db, inviter_id, "invite_joined", body,
        url_path=f"/user/{joiner['id']}",
        kind="invite_signup", actor_id=joiner.get("id"),
    )

async def trig_rec_in_saved_city(db, actor: dict, city: dict, recipient_id: str) -> None:
    """4. [Name] added a new recommendation in [City]. Check it out"""
    if await _was_recently_notified(db, recipient_id, actor["id"], "rec_in_saved_city"):
        return
    body = f"{_first(actor.get('name'))} added a new recommendation in {city.get('name')}. Check it out."
    await _send_to_user(
        db, recipient_id, "rec_in_saved_city", body,
        url_path=f"/city/{city['id']}",
        kind="rec_in_saved_city", actor_id=actor.get("id"),
        in_app_payload={"city_id": city.get("id"), "city_name": city.get("name")},
    )
    await _mark_notified(db, recipient_id, actor["id"], "rec_in_saved_city")

async def trig_friend_rec_burst(db, actor: dict, count: int, recipient_id: str) -> None:
    """5/6. [Name] just added X new recommendations. See what they found"""
    if await _was_recently_notified(db, recipient_id, actor["id"], "friend_rec_burst"):
        return
    body = f"{_first(actor.get('name'))} just added {count} new recommendations. See what they found."
    await _send_to_user(
        db, recipient_id, "friend_rec_burst", body,
        url_path="/explore?tab=feed",
        kind="friend_rec_burst", actor_id=actor.get("id"),
        in_app_payload={"count": count},
    )
    await _mark_notified(db, recipient_id, actor["id"], "friend_rec_burst")

async def trig_friend_new_trip(db, actor: dict, city: dict, recipient_id: str) -> None:
    """6. [Name] just added a trip to [City]"""
    if await _was_recently_notified(db, recipient_id, actor["id"], f"friend_new_trip:{city['id']}", minutes=60):
        return
    body = f"{_first(actor.get('name'))} just added a trip to {city.get('name')}."
    await _send_to_user(
        db, recipient_id, "friend_new_trip", body,
        url_path="/explore?tab=feed",
        kind="friend_new_trip", actor_id=actor.get("id"),
        in_app_payload={"city_id": city.get("id"), "city_name": city.get("name")},
    )
    await _mark_notified(db, recipient_id, actor["id"], f"friend_new_trip:{city['id']}")

async def trig_your_rec_saved(db, saver: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """7. [Name] saved your recommendation for [Place Name] in [City]"""
    # Dedup: same saver + same rec within 5 minutes → drop (avoids double-tap noise)
    dedup_kind = f"your_rec_saved:{rec_id}"
    if await _was_recently_notified(db, owner_id, saver.get("id") or "", dedup_kind, minutes=5):
        return
    body = f"{_first(saver.get('name'))} saved your recommendation for {place_name} in {city_name}."
    await _send_to_user(
        db, owner_id, "your_rec_saved", body,
        url_path=f"/r/{rec_id}",
        kind="your_rec_saved", actor_id=saver.get("id"),
        in_app_payload={"rec_id": rec_id, "place_name": place_name, "city_name": city_name},
    )
    await _mark_notified(db, owner_id, saver.get("id") or "", dedup_kind)

async def trig_your_rec_visited(db, visitor: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """8. [Name] just visited [Place]. A place you recommended"""
    dedup_kind = f"your_rec_visited:{rec_id}"
    if await _was_recently_notified(db, owner_id, visitor.get("id") or "", dedup_kind, minutes=5):
        return
    body = f"{_first(visitor.get('name'))} just visited {place_name} in {city_name}. A place you recommended."
    await _send_to_user(
        db, owner_id, "your_rec_visited", body,
        url_path=f"/r/{rec_id}",
        kind="your_rec_visited", actor_id=visitor.get("id"),
        in_app_payload={"rec_id": rec_id, "place_name": place_name, "city_name": city_name},
    )
    await _mark_notified(db, owner_id, visitor.get("id") or "", dedup_kind)

async def trig_your_rec_inspired(db, inspiree: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """9. [Name] loved [Place] and added their own rec. You inspired them"""
    dedup_kind = f"your_rec_inspired:{rec_id}"
    if await _was_recently_notified(db, owner_id, inspiree.get("id") or "", dedup_kind, minutes=5):
        return
    body = f"{_first(inspiree.get('name'))} loved {place_name} in {city_name} and added their own recommendation. You inspired them."
    await _send_to_user(
        db, owner_id, "your_rec_inspired", body,
        url_path=f"/r/{rec_id}",
        kind="your_rec_inspired", actor_id=inspiree.get("id"),
        in_app_payload={"rec_id": rec_id, "place_name": place_name, "city_name": city_name},
    )
    await _mark_notified(db, owner_id, inspiree.get("id") or "", dedup_kind)

async def trig_monthly_impact(db, recipient_id: str, month_label: str) -> None:
    """10. Your Freccos impact for [Month] is ready"""
    body = f"Your Freccos impact for {month_label} is ready. See how your recommendations travelled the world."
    await _send_to_user(
        db, recipient_id, "monthly_impact", body,
        url_path="/me",
        kind="monthly_impact",
        in_app_payload={"month_label": month_label},
    )


# -------- Fire-and-forget wrapper (so we never block the request) --------

import asyncio
def fire(coro):
    """Schedule a notification trigger without awaiting it."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        # No running loop — e.g. from a script
        asyncio.run(coro)
