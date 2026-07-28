"""Focused regression tests for iteration_8 bug fixes:
- POST /api/designs (authenticated customer) persists a new design
- GET /api/designs returns the customer's designs (verify persistence)
- Customer forbidden from staff endpoints (/api/staff/orders, print-file)
- Unauthenticated POST /api/designs => 401/403
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://luxe-maker-sandbox.preview.emergentagent.com").rstrip("/")
CUSTOMER_EMAIL = "aarohi@cleliastudio-demo.com"
CUSTOMER_PASSWORD = "Customer!2026Studio"


def _login():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["role"] == "customer"
    return data["token"], data["user"]


def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_customer_login_ok():
    token, user = _login()
    assert user["email"] == CUSTOMER_EMAIL


def test_content_endpoint():
    r = requests.get(f"{BASE_URL}/api/content", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("jewellery_types"), list)
    assert isinstance(data.get("metals"), list) and len(data["metals"]) > 0


def test_create_design_and_persistence():
    token, user = _login()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "jewellery_type": "Ring",
        "prompt": "TEST_iter8 slim rose-gold band with a single oval ruby and milgrain edging",
        "model": "gpt-image-1",
        "specs": {"metal": "18K Rose Gold"},
        "references": [],
    }
    r = requests.post(f"{BASE_URL}/api/designs", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, f"create design failed: {r.status_code} {r.text}"
    created = r.json()
    assert created["jewellery_type"] == "Ring"
    assert created["prompt"].startswith("TEST_iter8")
    assert created["specs"]["metal"] == "18K Rose Gold"
    assert "id" in created and isinstance(created["id"], str)
    design_id = created["id"]

    # Verify persistence via GET
    r2 = requests.get(f"{BASE_URL}/api/designs", headers=headers, timeout=20)
    assert r2.status_code == 200
    designs = r2.json()
    ids = [d["id"] for d in designs]
    assert design_id in ids, "newly created design not returned in GET /api/designs"
    match = next(d for d in designs if d["id"] == design_id)
    assert match["customer_id"] == user["id"]


def test_designs_requires_auth():
    r = requests.post(f"{BASE_URL}/api/designs",
                      json={"jewellery_type": "Ring", "prompt": "x" * 20, "model": "gpt-image-1",
                            "specs": {"metal": "18K Yellow Gold"}, "references": []}, timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 unauth, got {r.status_code}"


def test_customer_cannot_access_staff_orders():
    token, _ = _login()
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}/api/staff/orders", headers=headers, timeout=15)
    assert r.status_code == 403, f"customer must be forbidden from /api/staff/orders, got {r.status_code}"


def test_customer_cannot_access_print_file():
    token, _ = _login()
    headers = {"Authorization": f"Bearer {token}"}
    # Use any dummy id; auth check should fail before existence check
    r = requests.get(f"{BASE_URL}/api/staff/orders/nonexistent-id/print-file",
                     headers=headers, timeout=15)
    assert r.status_code == 403, f"customer must be forbidden from print-file, got {r.status_code}"
