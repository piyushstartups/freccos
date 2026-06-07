"""Tests for the new trip-plan check lifecycle:
- POST /api/trip-plans/{city_id}/check returns {ok, prompt_add_to_trips, auto_removed}
- When the last saved rec is ticked, the trip_plan document is deleted
- When not all are ticked, auto_removed is False and plan persists
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-travel-recs.preview.emergentagent.com").rstrip("/")


def _login(email, password="Demo1234!"):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.text}"
    return s


@pytest.fixture
def priya():
    return _login("priya@freccos.com")


@pytest.fixture
def arjun():
    return _login("arjun@freccos.com")


def _get_arjun_tokyo_rec(priya):
    # Priya follows Arjun, so Tokyo (where Arjun has recs) appears in her explore feed
    cities = priya.get(f"{BASE_URL}/api/explore/cities").json()
    tokyo = next(c for c in cities if c["name"] == "Tokyo")
    recs = priya.get(f"{BASE_URL}/api/cities/{tokyo['id']}/recommendations").json()
    return tokyo["id"], recs[0]["primary_rec_id"]


def _cleanup(priya, city_id):
    # Best-effort cleanup
    priya.delete(f"{BASE_URL}/api/trip-plans/{city_id}")


class TestCheckLifecycle:
    def test_check_returns_expected_shape_and_auto_removes_on_last(self, priya, arjun):
        city_id, rec_id = _get_arjun_tokyo_rec(priya)
        _cleanup(priya, city_id)

        # Save the rec to create a plan with exactly 1 saved rec
        r_save = priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/save",
                            json={"recommendation_id": rec_id})
        assert r_save.status_code == 200

        # Tick it -> auto_removed should be True
        r = priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/check",
                       json={"recommendation_id": rec_id, "checked": True})
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"ok", "prompt_add_to_trips", "auto_removed"}
        assert data["ok"] is True
        assert data["prompt_add_to_trips"] is True
        assert data["auto_removed"] is True

        # Trip plan should now be deleted -> GET returns implicit empty plan (id=None)
        g = priya.get(f"{BASE_URL}/api/trip-plans/{city_id}")
        assert g.status_code == 200
        gd = g.json()
        assert gd.get("id") is None, f"Trip plan should have been deleted, but got id={gd.get('id')}"
        assert gd.get("saved_recs", []) == []

    def test_check_not_all_ticked_auto_removed_false(self, priya, arjun):
        # Save TWO recs into one plan, tick only one -> auto_removed False, plan persists
        cities = priya.get(f"{BASE_URL}/api/explore/cities").json()
        tokyo = next(c for c in cities if c["name"] == "Tokyo")
        recs = priya.get(f"{BASE_URL}/api/cities/{tokyo['id']}/recommendations").json()
        if len(recs) < 2:
            pytest.skip("Need 2+ recs in Tokyo to run this test")
        rec_a = recs[0]["primary_rec_id"]
        rec_b = recs[1]["primary_rec_id"]

        _cleanup(priya, tokyo["id"])

        assert priya.post(f"{BASE_URL}/api/trip-plans/{tokyo['id']}/save",
                          json={"recommendation_id": rec_a}).status_code == 200
        assert priya.post(f"{BASE_URL}/api/trip-plans/{tokyo['id']}/save",
                          json={"recommendation_id": rec_b}).status_code == 200

        # Tick only rec_a
        r = priya.post(f"{BASE_URL}/api/trip-plans/{tokyo['id']}/check",
                       json={"recommendation_id": rec_a, "checked": True})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["prompt_add_to_trips"] is True
        assert data["auto_removed"] is False

        # Plan still exists
        g = priya.get(f"{BASE_URL}/api/trip-plans/{tokyo['id']}")
        assert g.status_code == 200
        plan = g.json()
        assert rec_a in plan["checked_recs"]
        assert rec_b not in plan["checked_recs"]

        # Now tick rec_b -> auto_removed should become True
        r2 = priya.post(f"{BASE_URL}/api/trip-plans/{tokyo['id']}/check",
                        json={"recommendation_id": rec_b, "checked": True})
        d2 = r2.json()
        assert d2["auto_removed"] is True
        # Plan gone (implicit empty)
        g2 = priya.get(f"{BASE_URL}/api/trip-plans/{tokyo['id']}")
        assert g2.status_code == 200
        assert g2.json().get("id") is None

    def test_uncheck_does_not_auto_remove(self, priya, arjun):
        city_id, rec_id = _get_arjun_tokyo_rec(priya)
        _cleanup(priya, city_id)
        priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/save",
                   json={"recommendation_id": rec_id})
        # Uncheck (checked=False) should never auto_remove or prompt
        r = priya.post(f"{BASE_URL}/api/trip-plans/{city_id}/check",
                       json={"recommendation_id": rec_id, "checked": False})
        assert r.status_code == 200
        d = r.json()
        assert d["auto_removed"] is False
        assert d["prompt_add_to_trips"] is False
        # Cleanup
        _cleanup(priya, city_id)
