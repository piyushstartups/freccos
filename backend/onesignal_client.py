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
    if not name: return "Someone"
    return name.split(" ")[0]


def _abs_url(path: str) -> str:
    if not path: return FRONTEND_URL
    if path.startswith("http"): return path
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
        return r.json()
    except Exception as e:
        logger.exception("[onesignal] send exception: %s", e)
        return None


async def update_tags_by_external_id(external_id: str, tags: dict) -> None:
    """Patch OneSignal user tags by external_id. Tag values must be strings."""
    if not APP_ID or not API_KEY or not external_id:
        return
    flat = {}
    for k, v in (tags or {}).items():
        if v is None: continue
        flat[k] = ",".join(map(str, v)) if isinstance(v, list) else str(v)
    if not flat: return
    headers = {"Authorization": f"Key {API_KEY}", "Content-Type": "application/json"}
    url = f"/apps/{APP_ID}/users/external_id/{external_id}"
    try:
        async with httpx.AsyncClient(base_url=ONESIGNAL_BASE, timeout=10.0) as c:
            r = await c.patch(url, json={"properties": {"tags": flat}}, headers=headers)
        if r.status_code not in (200, 202):
            logger.warning("[onesignal] tag patch failed %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.exception("[onesignal] tag patch exception: %s", e)


# -------- Core send helper (called by every trigger) --------

async def _send_to_user(
    db,
    user_id: str,
    pref_key: str,
    body: str,
    *,
    heading: str = "Freccos",
    url_path: Optional[str] = None,
) -> None:
    """Look up the recipient, check prefs + quiet hours, then push via OneSignal."""
    if not user_id: return
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "notification_preferences": 1, "timezone": 1})
    if not user: return
    prefs = (user.get("notification_preferences") or default_prefs())
    if not prefs.get(pref_key, True):
        return
    # Quiet hours only apply to broadcast-style notifications (monthly impact summary).
    # Personal/triggered notifications are immediate — that's the whole point.
    if pref_key == "monthly_impact" and _in_quiet_hours(user.get("timezone")):
        logger.info("[onesignal] quiet hours, skipping %s to %s", pref_key, user_id)
        return
    payload = {
        "headings": {"en": heading},
        "contents": {"en": body},
        "include_aliases": {"external_id": [user_id]},
        "data": {"pref_key": pref_key},
    }
    if url_path:
        payload["url"] = _abs_url(url_path)
        payload["web_url"] = _abs_url(url_path)
    await _post_notification(payload)


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
    await _send_to_user(db, recipient_id, "new_follower", body, url_path=f"/user/{actor['id']}")

async def trig_follow_accepted(db, accepter: dict, requester_id: str) -> None:
    """2. [Name] accepted your follow request"""
    body = f"{_first(accepter.get('name'))} accepted your follow request."
    await _send_to_user(db, requester_id, "follow_accepted", body, url_path=f"/user/{accepter['id']}")

async def trig_invite_joined(db, joiner: dict, inviter_id: str) -> None:
    """3. [Name] just joined Freccos using your invite"""
    body = f"{_first(joiner.get('name'))} just joined Freccos using your invite."
    await _send_to_user(db, inviter_id, "invite_joined", body, url_path=f"/user/{joiner['id']}")

async def trig_rec_in_saved_city(db, actor: dict, city: dict, recipient_id: str) -> None:
    """4. [Name] added a new recommendation in [City]. Check it out"""
    if await _was_recently_notified(db, recipient_id, actor["id"], "rec_in_saved_city"):
        return
    body = f"{_first(actor.get('name'))} added a new recommendation in {city.get('name')}. Check it out."
    await _send_to_user(db, recipient_id, "rec_in_saved_city", body, url_path=f"/city/{city['id']}")
    await _mark_notified(db, recipient_id, actor["id"], "rec_in_saved_city")

async def trig_friend_rec_burst(db, actor: dict, count: int, recipient_id: str) -> None:
    """5/6. [Name] just added X new recommendations. See what they found"""
    if await _was_recently_notified(db, recipient_id, actor["id"], "friend_rec_burst"):
        return
    body = f"{_first(actor.get('name'))} just added {count} new recommendations. See what they found."
    await _send_to_user(db, recipient_id, "friend_rec_burst", body, url_path="/explore?tab=feed")
    await _mark_notified(db, recipient_id, actor["id"], "friend_rec_burst")

async def trig_friend_new_trip(db, actor: dict, city: dict, recipient_id: str) -> None:
    """6. [Name] just added a trip to [City]"""
    if await _was_recently_notified(db, recipient_id, actor["id"], f"friend_new_trip:{city['id']}", minutes=60):
        return
    body = f"{_first(actor.get('name'))} just added a trip to {city.get('name')}."
    await _send_to_user(db, recipient_id, "friend_new_trip", body, url_path="/explore?tab=feed")
    await _mark_notified(db, recipient_id, actor["id"], f"friend_new_trip:{city['id']}")

async def trig_your_rec_saved(db, saver: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """7. [Name] saved your recommendation for [Place Name] in [City]"""
    body = f"{_first(saver.get('name'))} saved your recommendation for {place_name} in {city_name}."
    await _send_to_user(db, owner_id, "your_rec_saved", body, url_path=f"/r/{rec_id}")

async def trig_your_rec_visited(db, visitor: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """8. [Name] just visited [Place]. A place you recommended"""
    body = f"{_first(visitor.get('name'))} just visited {place_name} in {city_name}. A place you recommended."
    await _send_to_user(db, owner_id, "your_rec_visited", body, url_path=f"/r/{rec_id}")

async def trig_your_rec_inspired(db, inspiree: dict, place_name: str, city_name: str, owner_id: str, rec_id: str) -> None:
    """9. [Name] loved [Place] and added their own rec. You inspired them"""
    body = f"{_first(inspiree.get('name'))} loved {place_name} in {city_name} and added their own recommendation. You inspired them."
    await _send_to_user(db, owner_id, "your_rec_inspired", body, url_path=f"/r/{rec_id}")

async def trig_monthly_impact(db, recipient_id: str, month_label: str) -> None:
    """10. Your Freccos impact for [Month] is ready"""
    body = f"Your Freccos impact for {month_label} is ready. See how your recommendations travelled the world."
    await _send_to_user(db, recipient_id, "monthly_impact", body, url_path="/me")


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
