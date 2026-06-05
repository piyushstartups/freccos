import io
import uuid
import pytest
import requests

# ----- Auth tests -----
class TestAuth:
    def test_validate_invite_valid(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/validate-invite", json={"code": "FRECCOS1"})
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is True
        assert data["referrer_name"] == "Priya Sharma"

    def test_validate_invite_bad(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/validate-invite", json={"code": "BADCODE99"})
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is False
        assert "message" in data and len(data["message"]) > 0

    def test_login_priya(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "priya@freccos.com", "password": "Demo1234!"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "priya@freccos.com"
        assert data["invite_code"] == "FRECCOS1"
        # check cookies set
        cookies = api_client.cookies.get_dict()
        assert "access_token" in cookies
        assert "refresh_token" in cookies

    def test_login_invalid_password(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login",
                          json={"email": "priya@freccos.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_cookie(self, priya_client, base_url):
        r = priya_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "priya@freccos.com"

    def test_me_no_cookie(self, base_url):
        r = requests.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_register_with_invite_mutual_follow(self, base_url):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        unique = uuid.uuid4().hex[:8]
        email = f"TEST_user_{unique}@freccos.com"
        r = s.post(f"{base_url}/api/auth/register", json={
            "invite_code": "FRECCOS1", "name": "Test User",
            "email": email, "password": "Demo1234!",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        # priya id should be in following
        # fetch priya id
        r2 = requests.post(f"{base_url}/api/auth/login",
                           json={"email": "priya@freccos.com", "password": "Demo1234!"})
        priya = r2.json()
        assert priya["id"] in data["following"]
        assert priya["id"] in data["followers"]
        # verify cookies
        cookies = s.cookies.get_dict()
        assert "access_token" in cookies

    def test_register_bad_invite(self, base_url):
        unique = uuid.uuid4().hex[:8]
        r = requests.post(f"{base_url}/api/auth/register", json={
            "invite_code": "NOPECODE", "name": "X",
            "email": f"TEST_x_{unique}@freccos.com", "password": "Demo1234!",
        })
        assert r.status_code == 400


# ----- Explore / Cities -----
class TestExplore:
    def test_explore_cities(self, priya_client, base_url):
        r = priya_client.get(f"{base_url}/api/explore/cities")
        assert r.status_code == 200
        cities = r.json()
        names = {c["name"] for c in cities}
        assert {"Alibag", "Goa", "Paris", "Tokyo"}.issubset(names)
        for c in cities:
            assert "friends" in c and "friend_count" in c

    def test_city_recs_top_pick(self, priya_client, base_url):
        # find Alibag
        cities = priya_client.get(f"{base_url}/api/explore/cities").json()
        alibag = next(c for c in cities if c["name"] == "Alibag")
        r = priya_client.get(f"{base_url}/api/cities/{alibag['id']}/recommendations")
        assert r.status_code == 200
        recs = r.json()
        sundowner = next((x for x in recs if x["place_name"] == "Sundowner Cafe"), None)
        assert sundowner is not None
        assert len(sundowner["contributors"]) >= 2

    def test_city_recs_food_filter(self, priya_client, base_url):
        cities = priya_client.get(f"{base_url}/api/explore/cities").json()
        alibag = next(c for c in cities if c["name"] == "Alibag")
        r = priya_client.get(f"{base_url}/api/cities/{alibag['id']}/recommendations?category=food")
        assert r.status_code == 200
        for rec in r.json():
            assert rec["category"] == "food"


# ----- Recommendations -----
class TestRecommendations:
    def test_create_rec_via_city_name(self, priya_client, base_url):
        r = priya_client.post(f"{base_url}/api/recommendations", json={
            "place_name": f"TEST_Place_{uuid.uuid4().hex[:6]}",
            "category": "food",
            "city_name": "Berlin",
            "country": "Germany",
            "country_code": "DE",
            "note": "Test note",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["city"]["name"] == "Berlin"

    def test_create_rec_missing_fields(self, priya_client, base_url):
        r = priya_client.post(f"{base_url}/api/recommendations", json={
            "place_name": "X", "category": "food",
        })
        assert r.status_code == 400


# ----- Trip Plans -----
class TestTripPlans:
    def test_save_unsave_check_flow(self, priya_client, base_url):
        # use Arjun's session to get a Tokyo rec
        arjun = requests.Session()
        arjun.headers.update({"Content-Type": "application/json"})
        arjun.post(f"{base_url}/api/auth/login",
                   json={"email": "arjun@freccos.com", "password": "Demo1234!"})
        cities = arjun.get(f"{base_url}/api/explore/cities").json()
        tokyo = next(c for c in cities if c["name"] == "Tokyo")
        recs = arjun.get(f"{base_url}/api/cities/{tokyo['id']}/recommendations").json()
        rec_id = recs[0]["primary_rec_id"]

        # Priya saves the rec
        r = priya_client.post(f"{base_url}/api/trip-plans/{tokyo['id']}/save",
                              json={"recommendation_id": rec_id})
        assert r.status_code == 200
        # Save again -> already_saved
        r2 = priya_client.post(f"{base_url}/api/trip-plans/{tokyo['id']}/save",
                               json={"recommendation_id": rec_id})
        assert r2.status_code == 200
        assert r2.json().get("already_saved") is True

        # list trip plans
        plans = priya_client.get(f"{base_url}/api/trip-plans").json()
        plan = next((p for p in plans if p["city_id"] == tokyo["id"]), None)
        assert plan is not None
        assert plan["saved_count"] >= 1
        assert "checked_count" in plan
        assert plan["city"]["name"] == "Tokyo"

        # check toggle - Priya has no own recs in Tokyo, so prompt should be True
        r3 = priya_client.post(f"{base_url}/api/trip-plans/{tokyo['id']}/check",
                               json={"recommendation_id": rec_id, "checked": True})
        assert r3.status_code == 200
        assert r3.json().get("prompt_add_to_trips") is True

        # unsave
        r4 = priya_client.post(f"{base_url}/api/trip-plans/{tokyo['id']}/unsave",
                               json={"recommendation_id": rec_id})
        assert r4.status_code == 200


# ----- Users / Follow -----
class TestUsers:
    def test_get_user_profile(self, priya_client, base_url):
        # get arjun's id
        arjun_login = requests.post(f"{base_url}/api/auth/login",
                                    json={"email": "arjun@freccos.com", "password": "Demo1234!"})
        arjun_id = arjun_login.json()["id"]
        r = priya_client.get(f"{base_url}/api/users/{arjun_id}")
        assert r.status_code == 200
        data = r.json()
        for key in ("city_count", "country_count", "follower_count", "following_count", "is_following", "cities"):
            assert key in data

    def test_follow_unfollow(self, base_url):
        # register two users
        s1 = requests.Session(); s1.headers.update({"Content-Type": "application/json"})
        s2 = requests.Session(); s2.headers.update({"Content-Type": "application/json"})
        u1_email = f"TEST_f1_{uuid.uuid4().hex[:6]}@freccos.com"
        u2_email = f"TEST_f2_{uuid.uuid4().hex[:6]}@freccos.com"
        r1 = s1.post(f"{base_url}/api/auth/register",
                     json={"invite_code": "FRECCOS1", "name": "F1", "email": u1_email, "password": "Demo1234!"})
        r2 = s2.post(f"{base_url}/api/auth/register",
                     json={"invite_code": "FRECCOS1", "name": "F2", "email": u2_email, "password": "Demo1234!"})
        u1_id = r1.json()["id"]; u2_id = r2.json()["id"]
        # u1 follows u2
        rf = s1.post(f"{base_url}/api/users/{u2_id}/follow")
        assert rf.status_code == 200
        # verify
        prof = s1.get(f"{base_url}/api/users/{u2_id}").json()
        assert prof["is_following"] is True
        # unfollow
        ru = s1.post(f"{base_url}/api/users/{u2_id}/unfollow")
        assert ru.status_code == 200
        prof2 = s1.get(f"{base_url}/api/users/{u2_id}").json()
        assert prof2["is_following"] is False


# ----- Upload + Places autocomplete -----
class TestUploadAndPlaces:
    def test_upload_image(self, priya_client, base_url):
        # tiny valid PNG (1x1 red pixel)
        png_bytes = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
            "0000000d49444154789c63f8cfc0f01f000301010032d62a1f0000000049454e44ae426082"
        )
        files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
        # remove default Content-Type for multipart
        s = requests.Session()
        s.cookies = priya_client.cookies
        r = s.post(f"{base_url}/api/upload", files=files)
        if r.status_code == 503:
            pytest.skip("Storage unavailable in env")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and "url" in data
        # retrieve file
        path = data["path"]
        r2 = s.get(f"{base_url}/api/files/{path}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")

    def test_places_autocomplete_no_500(self, priya_client, base_url):
        r = priya_client.get(f"{base_url}/api/places/autocomplete?q=alibag")
        assert r.status_code == 200
        assert "suggestions" in r.json()
