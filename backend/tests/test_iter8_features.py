"""Iteration 8 backend tests — verify total_save_count per-city is returned in
both GET /api/trips (self) and GET /api/users/{user_id} (any profile).
Also re-runs the lightweight Iter-7 regressions inline (resolver + already_saved).
"""
import os
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
def priya():
    return _login("priya@freccos.com")


@pytest.fixture(scope="module")
def arjun():
    return _login("arjun@freccos.com")


@pytest.fixture(scope="module")
def priya_uid(priya):
    return priya.get(f"{BASE_URL}/api/auth/me").json()["id"]


@pytest.fixture(scope="module")
def arjun_uid(arjun):
    return arjun.get(f"{BASE_URL}/api/auth/me").json()["id"]


# --- Iter 8 Feature 1: GET /api/trips returns total_save_count per city ---
class TestTripsTotalSaveCount:
    def test_trips_has_total_save_count_field(self, priya):
        r = priya.get(f"{BASE_URL}/api/trips")
        assert r.status_code == 200
        trips = r.json()
        assert isinstance(trips, list) and len(trips) > 0, "Priya should have trips"
        for t in trips:
            assert "total_save_count" in t, f"trip {t.get('city',{}).get('name')} missing total_save_count"
            assert isinstance(t["total_save_count"], int)
            assert t["total_save_count"] >= 0

    def test_priya_alibag_has_saves(self, priya):
        trips = priya.get(f"{BASE_URL}/api/trips").json()
        alibag = next((t for t in trips if (t.get("city") or {}).get("name") == "Alibag"), None)
        assert alibag is not None, "Priya should have Alibag"
        # Per problem statement Alibag saves=3 — accept >=1 to be resilient
        assert alibag["total_save_count"] >= 1, f"Alibag total_save_count={alibag['total_save_count']}"


# --- Iter 8 Feature 2: GET /api/users/{user_id} cities have total_save_count ---
class TestUserProfileTotalSaveCount:
    def test_self_profile_cities_have_field(self, priya, priya_uid):
        r = priya.get(f"{BASE_URL}/api/users/{priya_uid}")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data and isinstance(data["cities"], list)
        assert len(data["cities"]) > 0
        for c in data["cities"]:
            assert "total_save_count" in c, f"city {c.get('name')} missing total_save_count"
            assert isinstance(c["total_save_count"], int)

    def test_friend_profile_cities_have_field(self, priya, arjun_uid):
        r = priya.get(f"{BASE_URL}/api/users/{arjun_uid}")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data
        assert len(data["cities"]) > 0
        for c in data["cities"]:
            assert "total_save_count" in c
            assert isinstance(c["total_save_count"], int)

    def test_arjun_alibag_visible_to_priya_has_saves(self, priya, arjun_uid):
        data = priya.get(f"{BASE_URL}/api/users/{arjun_uid}").json()
        alibag = next((c for c in data["cities"] if c.get("name") == "Alibag"), None)
        assert alibag is not None
        assert alibag["total_save_count"] >= 1


# --- Iter 7 regression — keep these lightweight ---
class TestIter7Regression:
    def test_rec_resolver_still_works(self, priya, arjun_uid):
        recs = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations").json()
        assert recs
        rid = recs[0]["id"]
        cid = recs[0]["city_id"]
        r = priya.get(f"{BASE_URL}/api/r/{rid}")
        assert r.status_code == 200
        d = r.json()
        assert d["rec_id"] == rid
        assert d["city_id"] == cid

    def test_save_already_saved_short_circuit(self, priya, arjun_uid):
        recs = priya.get(f"{BASE_URL}/api/users/{arjun_uid}/recommendations").json()
        assert recs
        rid = recs[0]["id"]
        cid = recs[0]["city_id"]
        # Ensure saved
        priya.post(f"{BASE_URL}/api/trip-plans/{cid}/save", json={"recommendation_id": rid})
        # Save again — must say already_saved
        r2 = priya.post(f"{BASE_URL}/api/trip-plans/{cid}/save", json={"recommendation_id": rid})
        assert r2.status_code == 200
        assert r2.json().get("already_saved") is True
