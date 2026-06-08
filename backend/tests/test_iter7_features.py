"""Iteration 7 backend tests: profile recommendations endpoint, rec deep-link
resolver (/api/r/<id>), notification dedup on duplicate saves, and the
already_saved short-circuit for /api/trip-plans/<city_id>/save."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-travel-recs.preview.emergentagent.com",
).rstrip("/")
PWD = "Demo1234!"


def _login(email: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PWD})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def priya() -> requests.Session:
    return _login("priya@freccos.com")


@pytest.fixture(scope="module")
def arjun() -> requests.Session:
    return _login("arjun@freccos.com")


@pytest.fixture(scope="module")
def kabir() -> requests.Session:
    return _login("kabir@freccos.com")


@pytest.fixture(scope="module")
def priya_uid(priya) -> str:
    return priya.get(f"{BASE_URL}/api/auth/me").json()["id"]


@pytest.fixture(scope="module")
def arjun_uid(arjun) -> str:
    return arjun.get(f"{BASE_URL}/api/auth/me").json()["id"]


# --- Feature 1: GET /api/users/{user_id}/recommendations ---
class TestUserRecommendations:
    def test_self_view_no_is_saved_by_me(self, priya, priya_uid):
        r = priya.get(f"{BASE_URL}/api/users/{priya_uid}/recommendations")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        # self view: all is_saved_by_me must be False
        for rec in data:
            assert rec.get("is_saved_by_me") is False, "self-view must always be False"
            assert "city" in rec and rec["city"].get("name")
        # newest first
        ts = [rec.get("created_at", "") for rec in data]
        assert ts == sorted(ts, reverse=True), "must be newest first"

    def test_friend_view_has_is_saved_by_me(self, priya, arjun_uid):
        r = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for rec in data:
            assert "is_saved_by_me" in rec
            assert isinstance(rec["is_saved_by_me"], bool)
            assert rec.get("city", {}).get("name")

    def test_empty_user_returns_empty_array(self, kabir):
        me = kabir.get(f"{BASE_URL}/api/auth/me").json()
        r = kabir.get(f"{BASE_URL}/api/users/{me['id']}/recommendations")
        assert r.status_code == 200
        assert r.json() == []


# --- Feature 2: GET /api/r/<rec_id> resolver ---
class TestRecResolver:
    def test_valid_rec_id(self, priya, arjun, arjun_uid):
        recs = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations").json()
        assert recs, "Arjun should have recs"
        rec_id = recs[0]["id"]
        expected_city = recs[0]["city_id"]
        r = priya.get(f"{BASE_URL}/api/r/{rec_id}")
        assert r.status_code == 200
        d = r.json()
        assert d.get("rec_id") == rec_id
        assert d.get("city_id") == expected_city

    def test_invalid_rec_id_returns_404(self, priya):
        r = priya.get(f"{BASE_URL}/api/r/does-not-exist-xyz")
        assert r.status_code == 404


# --- Feature 3: save already_saved short-circuit + notification dedup ---
class TestSaveDedup:
    def test_double_save_returns_already_saved_no_dup_notification(self, priya, arjun, arjun_uid, priya_uid):
        # Find an Arjun rec, ensure Priya has it saved or save it once
        recs = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations").json()
        assert recs
        target = recs[0]
        rec_id = target["id"]
        city_id = target["city_id"]

        # Make sure Priya has saved it at least once. If already saved, second call must short-circuit.
        save1 = priya.post(
            f"{BASE_URL}/api/trip-plans/{city_id}/save",
            json={"recommendation_id": rec_id},
        )
        assert save1.status_code == 200, save1.text
        # Get arjun notification count BEFORE the dup save
        n_before = arjun.get(f"{BASE_URL}/api/users/me/notifications").json()
        prior_for_rec = [
            n for n in n_before
            if n.get("kind") == "your_rec_saved" and (n.get("payload") or {}).get("rec_id") == rec_id
        ]
        prior_count = len(prior_for_rec)

        # Save again — must return already_saved and not create a new notification
        save2 = priya.post(
            f"{BASE_URL}/api/trip-plans/{city_id}/save",
            json={"recommendation_id": rec_id},
        )
        assert save2.status_code == 200, save2.text
        body = save2.json()
        assert body.get("already_saved") is True, f"expected already_saved=true, got {body}"

        time.sleep(0.5)  # let any async notification finish
        n_after = arjun.get(f"{BASE_URL}/api/users/me/notifications").json()
        after_for_rec = [
            n for n in n_after
            if n.get("kind") == "your_rec_saved" and (n.get("payload") or {}).get("rec_id") == rec_id
        ]
        assert len(after_for_rec) == prior_count, (
            f"Duplicate save must not produce a new your_rec_saved notification. "
            f"before={prior_count} after={len(after_for_rec)}"
        )

    def test_dedup_window_blocks_repeat_save_after_unsave(self, priya, arjun, arjun_uid):
        """Two save events within the 5-min dedup window should only produce one
        your_rec_saved notification (the second should be deduped)."""
        recs = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations").json()
        assert recs
        target = recs[0]
        rec_id = target["id"]
        city_id = target["city_id"]

        def count_notifs():
            n = arjun.get(f"{BASE_URL}/api/users/me/notifications").json()
            return sum(
                1 for x in n
                if x.get("kind") == "your_rec_saved"
                and (x.get("payload") or {}).get("rec_id") == rec_id
            )

        # Reset to a known-unsaved state
        priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/unsave", json={"recommendation_id": rec_id})
        time.sleep(0.3)
        base = count_notifs()

        # First fresh save — may or may not create a notif depending on whether
        # a prior dedup entry is still within its 5-min window from earlier runs.
        priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/save", json={"recommendation_id": rec_id})
        time.sleep(0.6)
        after_first = count_notifs()
        delta_first = after_first - base

        # Unsave + immediate re-save — must be deduped (delta must be 0).
        priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/unsave", json={"recommendation_id": rec_id})
        time.sleep(0.2)
        priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/save", json={"recommendation_id": rec_id})
        time.sleep(0.7)
        after_second = count_notifs()
        delta_second = after_second - after_first

        # Combined: 2 save events within 5 min, at most ONE new notification total.
        assert (delta_first + delta_second) <= 1, (
            f"Two saves within 5-min dedup window produced >1 notification. "
            f"base={base} after_first={after_first} after_second={after_second}"
        )
        # The second one specifically must be deduped (0).
        assert delta_second == 0, (
            f"Second save within 5-min window must be deduped. "
            f"after_first={after_first} after_second={after_second}"
        )
