"""Smoke test for /api/feed is_saved flag on every new_rec / top_pick item.

Verifies the backend fix where Feed now emits `is_saved` based on the
caller's saved trip plans (was hardcoded False for top_pick previously).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-travel-recs.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def priya_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "priya@freccos.com", "password": "Demo1234!"},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return s


def test_feed_emits_is_saved_for_every_rec_or_top_pick(priya_session):
    r = priya_session.get(f"{BASE_URL}/api/feed", params={"limit": 30}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    items = data.get("items", [])
    assert isinstance(items, list)
    assert len(items) > 0, "expected at least 1 feed item for Priya"

    for it in items:
        t = it.get("type")
        if t in ("new_rec", "top_pick"):
            assert "is_saved" in it, f"missing is_saved on {t} item id={it.get('id')}"
            assert isinstance(it["is_saved"], bool), f"is_saved must be bool, got {type(it['is_saved'])}"


def test_priya_has_sundowner_saved_in_feed(priya_session):
    """Sundowner Cafe (rec_id starts with ad88549b) is seeded as saved for Priya."""
    r = priya_session.get(f"{BASE_URL}/api/feed", params={"limit": 30}, timeout=15)
    assert r.status_code == 200
    items = r.json().get("items", [])
    sundowner = next(
        (it for it in items if it.get("type") == "new_rec" and (it.get("rec_id") or "").startswith("ad88549b")),
        None,
    )
    assert sundowner is not None, "Sundowner Cafe rec not in feed"
    assert sundowner["is_saved"] is True, f"Expected is_saved=True for Sundowner, got {sundowner.get('is_saved')}"
    assert sundowner.get("place_name") == "Sundowner Cafe"
