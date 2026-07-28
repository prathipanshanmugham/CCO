"""Iteration 9 verification: profile PATCH persistence, phone regex, PUT/DELETE CORS, staff 403."""
import os
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://luxe-maker-sandbox.preview.emergentagent.com").rstrip("/")
CUSTOMER = {"email": "aarohi@cleliastudio-demo.com", "password": "Customer!2026Studio"}


def _login():
    r = requests.post(f"{BASE}/api/auth/login", json=CUSTOMER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --- Health / Auth ---
def test_health():
    r = requests.get(f"{BASE}/api/health", timeout=10)
    assert r.status_code == 200 and r.json()["status"] == "healthy"


def test_customer_login_ok():
    assert _login()


def test_auth_me_returns_profile_fields():
    tok = _login()
    r = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == CUSTOMER["email"]
    assert data["role"] == "customer"
    assert "name" in data


# --- Profile PATCH persistence ---
def test_profile_patch_persists_name_and_phone():
    tok = _login()
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    new_name = "Aarohi Shah TEST"
    new_phone = "9876543210"
    r = requests.patch(f"{BASE}/api/profile", json={"name": new_name, "phone": new_phone}, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == new_name
    assert body["phone"] == new_phone

    # Log out (discard token), log in again, hit /auth/me to verify persistence
    tok2 = _login()
    me = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {tok2}"}, timeout=10).json()
    assert me["name"] == new_name
    assert me["phone"] == new_phone

    # Restore name (leave phone as is)
    requests.patch(f"{BASE}/api/profile", json={"name": "Aarohi Shah", "phone": new_phone}, headers=headers, timeout=15)


def test_profile_rejects_invalid_phone():
    tok = _login()
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    for bad in ["123", "1234567890", "abcdefghij", "05555555555"]:
        r = requests.patch(f"{BASE}/api/profile", json={"name": "Aarohi Shah", "phone": bad}, headers=headers, timeout=10)
        assert r.status_code == 422, f"Expected 422 for {bad}, got {r.status_code}: {r.text}"


def test_profile_requires_auth():
    r = requests.patch(f"{BASE}/api/profile", json={"name": "Nope"}, timeout=10)
    assert r.status_code in (401, 403)


# --- Staff endpoints rejection for customer ---
def test_customer_cannot_access_staff_orders():
    tok = _login()
    r = requests.get(f"{BASE}/api/staff/orders", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 403


def test_customer_cannot_access_print_file():
    tok = _login()
    # any id works – auth check is first
    r = requests.get(f"{BASE}/api/staff/orders/any-id/print-file", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 403


# --- Design creation still works (regression) ---
def test_create_design_requires_auth():
    r = requests.post(f"{BASE}/api/designs", json={"jewellery_type": "Ring", "prompt": "TEST_iter9 unauthenticated attempt should fail", "model": "gpt-image-1", "specs": {"metal": "18K Yellow Gold"}, "references": []}, timeout=10)
    assert r.status_code in (401, 403)


def test_create_design_ok():
    tok = _login()
    payload = {"jewellery_type": "Ring", "prompt": "TEST_iter9 A slim rose-gold band with a single oval ruby.", "model": "gpt-image-1", "specs": {"metal": "18K Rose Gold"}, "references": []}
    r = requests.post(f"{BASE}/api/designs", json=payload, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, timeout=15)
    assert r.status_code == 200, r.text
    design_id = r.json()["id"]
    lst = requests.get(f"{BASE}/api/designs", headers={"Authorization": f"Bearer {tok}"}, timeout=10).json()
    assert any(d["id"] == design_id for d in lst)


# --- CORS PUT/DELETE preflight now allowed ---
def test_cors_allows_put_and_delete():
    for method in ("PUT", "PATCH", "DELETE"):
        r = requests.options(
            f"{BASE}/api/profile",
            headers={
                "Origin": BASE,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "authorization,content-type",
            },
            timeout=10,
        )
        allowed = r.headers.get("access-control-allow-methods", "")
        assert method in allowed, f"CORS missing {method} in {allowed!r} (status {r.status_code})"


# --- Signup sends the entered name (not hard-coded) ---
def test_signup_persists_entered_name():
    import uuid
    email = f"TEST_iter9_{uuid.uuid4().hex[:8]}@example.com"
    entered_name = "Iter9 Chosen Name"
    r = requests.post(f"{BASE}/api/auth/register", json={"name": entered_name, "email": email, "password": "Password!2026"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["name"] == entered_name
    # Also verify via /auth/me
    me = requests.get(f"{BASE}/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"}, timeout=10).json()
    assert me["name"] == entered_name
