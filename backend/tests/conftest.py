import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-travel-recs.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def base_url():
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def priya_client(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": "priya@freccos.com", "password": "Demo1234!"})
    if r.status_code != 200:
        pytest.skip(f"Priya login failed: {r.status_code} {r.text}")
    return api_client


@pytest.fixture
def arjun_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "arjun@freccos.com", "password": "Demo1234!"})
    if r.status_code != 200:
        pytest.skip(f"Arjun login failed")
    return s
