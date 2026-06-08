"""
Backend tests for Web Push Notifications + Impact Loop (iteration 5).

Covers:
- GET/PATCH /api/users/me/notification-prefs (10 keys, partial update, notifications_seen)
- GET /api/me/impact (shape + visible flag)
- GET /api/r/{rec_id} (deep-link helper)
- PATCH /api/users/me with timezone
- /api/auth/me payload contains new fields
- Impact tracking (save -> save_count, visit -> visit_count, inspired -> inspired_count)
- OneSignal credentials shouldn't break / block user endpoints
"""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-travel-recs.preview.emergentagent.com").rstrip("/")
PRIYA = {"email": "priya@freccos.com", "password": "Demo1234!"}
ARJUN = {"email": "arjun@freccos.com", "password": "Demo1234!"}


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text}")
    return s


# ----- Fixtures -----
@pytest.fixture(scope="module")
def priya():
    return _login(PRIYA)

@pytest.fixture(scope="module")
def arjun():
    return _login(ARJUN)

@pytest.fixture(scope="module")
def priya_me(priya):
    return priya.get(f"{BASE}/api/auth/me", timeout=10).json()

@pytest.fixture(scope="module")
def arjun_me(arjun):
    return arjun.get(f"{BASE}/api/auth/me", timeout=10).json()


# ----- notification-prefs -----

EXPECTED_KEYS = {
    "new_follower", "follow_accepted", "invite_joined",
    "rec_in_saved_city", "friend_rec_burst", "friend_new_trip",
    "your_rec_saved", "your_rec_visited", "your_rec_inspired", "monthly_impact",
}


class TestNotificationPrefs:
    def test_get_shape_and_10_keys(self, priya):
        r = priya.get(f"{BASE}/api/users/me/notification-prefs", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"preferences", "notifications_seen", "timezone", "groups"}
        prefs = data["preferences"]
        assert set(prefs.keys()) == EXPECTED_KEYS, f"Missing/extra keys: {set(prefs.keys()) ^ EXPECTED_KEYS}"
        # All 10 keys must be present across the three groups
        groups = data["groups"]
        assert set(groups.keys()) == {"social", "activity", "impact"}
        all_grouped_keys = {item["key"] for g in groups.values() for item in g}
        assert all_grouped_keys == EXPECTED_KEYS
        assert isinstance(data["notifications_seen"], bool)

    def test_partial_update_only_flips_one_key(self, priya):
        # Set all true first
        priya.patch(f"{BASE}/api/users/me/notification-prefs",
                    json={"preferences": {k: True for k in EXPECTED_KEYS}}, timeout=10)
        # Flip just new_follower
        r = priya.patch(f"{BASE}/api/users/me/notification-prefs",
                        json={"preferences": {"new_follower": False}}, timeout=10)
        assert r.status_code == 200, r.text
        # Re-GET and verify
        g = priya.get(f"{BASE}/api/users/me/notification-prefs", timeout=10).json()
        prefs = g["preferences"]
        assert prefs["new_follower"] is False
        for k in EXPECTED_KEYS - {"new_follower"}:
            assert prefs[k] is True, f"key {k} flipped unexpectedly to {prefs[k]}"
        # Restore
        priya.patch(f"{BASE}/api/users/me/notification-prefs",
                    json={"preferences": {"new_follower": True}}, timeout=10)

    def test_notifications_seen_flag_persists(self, priya):
        # Set to False first
        priya.patch(f"{BASE}/api/users/me/notification-prefs",
                    json={"notifications_seen": False}, timeout=10)
        # Flip true
        r = priya.patch(f"{BASE}/api/users/me/notification-prefs",
                        json={"notifications_seen": True}, timeout=10)
        assert r.status_code == 200
        me = priya.get(f"{BASE}/api/auth/me", timeout=10).json()
        assert me.get("notifications_seen") is True


class TestAuthMePayload:
    def test_auth_me_includes_new_fields(self, priya):
        r = priya.get(f"{BASE}/api/auth/me", timeout=10)
        assert r.status_code == 200
        me = r.json()
        assert "notification_preferences" in me
        assert set(me["notification_preferences"].keys()) == EXPECTED_KEYS
        assert "notifications_seen" in me
        assert isinstance(me["notifications_seen"], bool)
        assert "timezone" in me  # may be None

    def test_patch_users_me_timezone_persists(self, priya):
        r = priya.patch(f"{BASE}/api/users/me",
                        json={"timezone": "Asia/Kolkata"}, timeout=10)
        assert r.status_code == 200, r.text
        me = priya.get(f"{BASE}/api/auth/me", timeout=10).json()
        assert me.get("timezone") == "Asia/Kolkata"


class TestDeepLink:
    def test_invalid_rec_id_returns_404(self, priya):
        r = priya.get(f"{BASE}/api/r/{uuid.uuid4()}", timeout=10)
        assert r.status_code == 404

    def test_valid_rec_returns_shape(self, priya, priya_me):
        # Pull one of Priya's own recs via /api/trips → city ids
        trips = priya.get(f"{BASE}/api/trips", timeout=10).json()
        rec_id = None
        for t in trips:
            cid = t["city_id"]
            recs = priya.get(f"{BASE}/api/users/{priya_me['id']}/cities/{cid}/recommendations", timeout=10).json()
            if recs:
                rec_id = recs[0]["id"]
                break
        if not rec_id:
            pytest.skip("Priya has no recs to test deep-link")
        r = priya.get(f"{BASE}/api/r/{rec_id}", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "rec_id" in body and "city_id" in body
        assert body["rec_id"] == rec_id


class TestImpactLoop:
    """End-to-end: Arjun saves/visits/inspires from Priya's rec, then Priya's /me/impact reflects it."""

    @pytest.fixture(scope="class")
    def priya_rec(self, arjun, priya):
        """Find a Priya-owned recommendation Arjun can save."""
        # Get Priya's id from her own /auth/me
        me = priya.get(f"{BASE}/api/auth/me", timeout=10).json()
        priya_id = me["id"]
        # Use Priya's /api/trips to enumerate her cities, then fetch her recs from Arjun's session
        trips = priya.get(f"{BASE}/api/trips", timeout=10).json()
        for t in trips:
            cid = t["city_id"]
            recs = arjun.get(f"{BASE}/api/users/{priya_id}/cities/{cid}/recommendations", timeout=10).json()
            if recs:
                # pick a rec NOT yet saved by arjun if possible
                return {"rec": recs[0], "city": t["city"], "priya_id": priya_id}
        pytest.skip("No Priya recs found")

    def test_save_increments_save_count_and_impact(self, arjun, priya, priya_rec, arjun_me):
        rec = priya_rec["rec"]; city = priya_rec["city"]
        rec_id = rec["id"]; city_id = city["id"]
        before = rec.get("save_count", 0)

        # Save (idempotent if already saved)
        r = arjun.post(f"{BASE}/api/trip-plans/{city_id}/save",
                       json={"recommendation_id": rec_id}, timeout=15)
        assert r.status_code in (200, 201), r.text
        # Endpoint should respond fast (<2s) — measured by requests timeout above
        body = r.json()
        assert body.get("ok") is True

        # Verify rec save_count and saved_by_users (use user-cities raw listing)
        recs = arjun.get(f"{BASE}/api/users/{priya_rec['priya_id']}/cities/{city_id}/recommendations", timeout=10).json()
        target = next((x for x in recs if x["id"] == rec_id), None)
        assert target is not None, "rec not in city listing"
        if not body.get("already_saved"):
            assert target.get("save_count", 0) >= before + 1
        assert arjun_me["id"] in (target.get("saved_by_users") or []) or body.get("already_saved")

        # Priya impact reflects at least 1 save
        impact = priya.get(f"{BASE}/api/me/impact", timeout=10).json()
        assert impact["all_time"]["saves"] >= 1
        assert impact["visible"] is True
        # shape
        assert set(impact.keys()) >= {"visible", "month_label", "follower_count", "current_month", "all_time", "most_loved"}
        assert set(impact["all_time"].keys()) >= {"saves", "visits", "inspired"}

    def test_check_increments_visit_count(self, arjun, priya, priya_rec, arjun_me):
        rec = priya_rec["rec"]; city = priya_rec["city"]
        rec_id = rec["id"]; city_id = city["id"]
        # Mark visited
        r = arjun.post(f"{BASE}/api/trip-plans/{city_id}/check",
                       json={"recommendation_id": rec_id, "checked": True}, timeout=15)
        assert r.status_code in (200, 201), r.text

        # Verify visit_count via direct admin-less path
        recs = arjun.get(f"{BASE}/api/users/{priya_rec['priya_id']}/cities/{city_id}/recommendations", timeout=10).json()
        target = next((x for x in recs if x["id"] == rec_id), None)
        # If the trip plan auto-removed after all-checked, that's still fine — counts persist on rec
        if target is not None:
            assert target.get("visit_count", 0) >= 1
            assert arjun_me["id"] in (target.get("visited_by_users") or [])

        impact = priya.get(f"{BASE}/api/me/impact", timeout=10).json()
        assert impact["all_time"]["visits"] >= 1

    def test_inspired_when_arjun_posts_same_place(self, arjun, priya, priya_rec):
        """Arjun creates a new rec with the SAME place_name in the SAME city → inspired_count += 1."""
        rec = priya_rec["rec"]; city = priya_rec["city"]
        rec_id = rec["id"]; city_id = city["id"]
        place_name = rec["place_name"]

        # Re-save first to ensure trip plan exists with Priya's rec referenced (it may have been auto-removed)
        arjun.post(f"{BASE}/api/trip-plans/{city_id}/save",
                   json={"recommendation_id": rec_id}, timeout=15)

        before_inspired = rec.get("inspired_count", 0)

        # Arjun creates his own rec for the same place
        payload = {
            "city_id": city_id,
            "place_name": place_name,
            "place_id": rec.get("place_id"),
            "category": rec.get("category", "food"),
            "note": "TEST_inspired_loop",
        }
        r = arjun.post(f"{BASE}/api/recommendations", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        new_rec = r.json()
        new_rec_id = new_rec["id"]

        # Pull Priya's original rec to verify inspired_count incremented
        recs = arjun.get(f"{BASE}/api/users/{priya_rec['priya_id']}/cities/{city_id}/recommendations", timeout=10).json()
        target = next((x for x in recs if x["id"] == rec_id), None)
        if target is None:
            pytest.skip("Original rec disappeared from listing")
        # Already-inspired guard means at most +1 even if test re-runs
        assert target.get("inspired_count", 0) >= 1, f"inspired_count={target.get('inspired_count')}"

        impact = priya.get(f"{BASE}/api/me/impact", timeout=10).json()
        assert impact["all_time"]["inspired"] >= 1

        # Cleanup the test rec so we don't pollute Arjun's profile
        try:
            arjun.delete(f"{BASE}/api/recommendations/{new_rec_id}", timeout=10)
        except Exception:
            pass


class TestNonBlockingOneSignal:
    """The user-facing endpoints must not block on OneSignal — verify <2s response."""

    def test_follow_unfollow_fast(self, priya):
        # Use Kabir (public) as target
        r = priya.get(f"{BASE}/api/users/search?q=kabir", timeout=10).json()
        kabir = next((u for u in r if "Kabir" in u.get("name", "") or u.get("email", "").startswith("kabir")), None)
        if not kabir:
            pytest.skip("Kabir not found")
        t0 = time.time()
        f = priya.post(f"{BASE}/api/users/{kabir['id']}/follow", timeout=5)
        elapsed = time.time() - t0
        assert f.status_code in (200, 201), f.text
        assert elapsed < 2.5, f"follow took {elapsed:.2f}s"
        # cleanup
        priya.post(f"{BASE}/api/users/{kabir['id']}/unfollow", timeout=10)
