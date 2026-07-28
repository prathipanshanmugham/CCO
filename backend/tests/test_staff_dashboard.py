"""Tests for staff dashboard endpoints + role gating (iteration 5)."""
import os
import pyotp
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE:
    # fallback: read frontend/.env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

MANAGER_EMAIL = "manager@cleliastudio-demo.com"
MANAGER_PASSWORD = "Manager!2026Studio"
STAFF_EMAIL = "production@cleliastudio-demo.com"
STAFF_PASSWORD = "Staff!2026Studio"
TOTP_SECRET = "JBSWY3DPEHPK3PXP"


def _staff_login(email, password):
    otp = pyotp.TOTP(TOTP_SECRET).now()
    r = requests.post(f"{BASE}/api/auth/staff/login", json={"email": email, "password": password, "otp": otp}, timeout=15)
    assert r.status_code == 200, f"staff login failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def staff_token():
    tok, user = _staff_login(STAFF_EMAIL, STAFF_PASSWORD)
    assert user["role"] == "staff"
    return tok


@pytest.fixture(scope="module")
def manager_token():
    tok, user = _staff_login(MANAGER_EMAIL, MANAGER_PASSWORD)
    assert user["role"] == "manager"
    return tok


@pytest.fixture(scope="module")
def customer_token():
    # register a fresh customer
    import uuid
    email = f"TEST_dash_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={"name": "Test Dash", "email": email, "password": "Customer!2026Test"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_staff_orders_returns_seeded_stages(staff_token):
    r = requests.get(f"{BASE}/api/staff/orders", headers={"Authorization": f"Bearer {staff_token}"}, timeout=15)
    assert r.status_code == 200
    orders = r.json()
    assert isinstance(orders, list) and len(orders) >= 3
    stages = {o["production_status"] for o in orders if o.get("sample_data")}
    for expected in ("New", "In Production", "QC"):
        assert expected in stages, f"missing seeded stage {expected}: got {stages}"


def test_staff_cannot_access_manager_content(staff_token):
    r = requests.get(f"{BASE}/api/manager/content", headers={"Authorization": f"Bearer {staff_token}"}, timeout=15)
    assert r.status_code == 403, f"staff should get 403, got {r.status_code} {r.text}"


def test_manager_can_access_manager_content(manager_token):
    r = requests.get(f"{BASE}/api/manager/content", headers={"Authorization": f"Bearer {manager_token}"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "jewellery_types" in body


def test_customer_cannot_list_staff_orders(customer_token):
    r = requests.get(f"{BASE}/api/staff/orders", headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
    assert r.status_code == 403, f"customer should get 403, got {r.status_code} {r.text}"


def test_staff_orders_requires_auth():
    r = requests.get(f"{BASE}/api/staff/orders", timeout=15)
    assert r.status_code == 401
