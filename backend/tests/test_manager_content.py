"""Manager content/settings API tests + auth."""
import os
import time

import pyotp
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MANAGER_EMAIL = "manager@cleliastudio-demo.com"
MANAGER_PASSWORD = "Manager!2026Studio"
TOTP_SECRET = "JBSWY3DPEHPK3PXP"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def manager_token(api):
    otp = pyotp.TOTP(TOTP_SECRET).now()
    r = api.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": MANAGER_EMAIL, "password": MANAGER_PASSWORD, "otp": otp},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "manager"
    return data["token"]


# --- Public content ---
def test_public_content_returns_defaults(api):
    r = api.get(f"{BASE_URL}/api/content", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "jewellery_types" in data and isinstance(data["jewellery_types"], list)
    assert any(t.get("name") == "Ring" for t in data["jewellery_types"])
    assert "example_ideas" in data and "Ring" in data["example_ideas"]
    assert "metals" in data
    assert "payment_mode" in data
    assert "gold_rate_per_gram" in data
    # no mongo _id leak
    assert "_id" not in data


# --- Manager content requires auth ---
def test_manager_content_denies_anonymous_get(api):
    r = api.get(f"{BASE_URL}/api/manager/content", timeout=10)
    assert r.status_code in (401, 403)


def test_manager_content_denies_anonymous_put(api):
    r = api.put(
        f"{BASE_URL}/api/manager/content",
        json={"gold_rate_per_gram": 1234.5},
        timeout=10,
    )
    assert r.status_code in (401, 403)


# --- Manager can read + update ---
def test_manager_content_get_with_auth(api, manager_token):
    r = api.get(
        f"{BASE_URL}/api/manager/content",
        headers={"Authorization": f"Bearer {manager_token}"},
        timeout=10,
    )
    assert r.status_code == 200
    data = r.json()
    assert "gold_rate_per_gram" in data
    assert "_id" not in data


def test_manager_content_put_updates_and_persists(api, manager_token):
    headers = {"Authorization": f"Bearer {manager_token}"}
    new_rate = 7777.5
    r = api.put(
        f"{BASE_URL}/api/manager/content",
        json={"gold_rate_per_gram": new_rate, "payment_mode": "handoff"},
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["gold_rate_per_gram"] == new_rate
    assert data["payment_mode"] == "handoff"

    # Verify persistence via public GET
    time.sleep(0.3)
    r2 = api.get(f"{BASE_URL}/api/content", timeout=10)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["gold_rate_per_gram"] == new_rate
    assert d2["payment_mode"] == "handoff"

    # Restore to defaults
    api.put(
        f"{BASE_URL}/api/manager/content",
        json={"gold_rate_per_gram": 7420.0, "payment_mode": "self_contained"},
        headers=headers,
        timeout=15,
    )


def test_manager_content_put_rejects_empty(api, manager_token):
    r = api.put(
        f"{BASE_URL}/api/manager/content",
        json={},
        headers={"Authorization": f"Bearer {manager_token}"},
        timeout=10,
    )
    assert r.status_code == 422


def test_manager_content_put_rejects_all_hidden(api, manager_token):
    r = api.put(
        f"{BASE_URL}/api/manager/content",
        json={"jewellery_types": [{"name": "Ring", "visible": False}]},
        headers={"Authorization": f"Bearer {manager_token}"},
        timeout=10,
    )
    assert r.status_code == 422


def test_staff_login_missing_otp(api):
    r = api.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": MANAGER_EMAIL, "password": MANAGER_PASSWORD, "otp": "000000"},
        timeout=10,
    )
    assert r.status_code == 401
