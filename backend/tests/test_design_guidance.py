"""Backend regression tests for Clelia & Co. Design Studio API."""
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://luxe-maker-sandbox.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# --- Health ---
def test_health(api):
    r = api.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert data["service"] == "clelia-design-studio"


# --- Design guidance streaming ---
def test_design_guidance_stream_success(api):
    payload = {
        "session_id": "test-session-abcd-1234",
        "jewellery_type": "Ring",
        "description": "A slim rose-gold band with a single oval ruby and milgrain detail.",
        "specifications": {"metal": "18K Rose Gold"},
    }
    with api.post(f"{BASE_URL}/api/design-guidance/stream", json=payload, stream=True, timeout=60) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        tokens = []
        start = time.time()
        saw_done = False
        for raw in r.iter_lines(decode_unicode=True):
            if raw is None:
                continue
            if raw.startswith("data: "):
                tokens.append(raw[6:])
            if raw.startswith("event: done"):
                saw_done = True
                break
            if time.time() - start > 55:
                break
        combined = "".join(tokens)
        assert saw_done, "Stream did not report done event"
        assert len(combined) > 50, f"Combined guidance too short: {combined!r}"
        # never leak API key material
        assert "sk-" not in combined
        assert "OPENAI" not in combined.upper()


def test_design_guidance_short_session_rejected(api):
    payload = {
        "session_id": "abc",
        "jewellery_type": "Ring",
        "description": "some description with enough content",
        "specifications": {"metal": "Platinum"},
    }
    r = api.post(f"{BASE_URL}/api/design-guidance/stream", json=payload, timeout=15)
    assert r.status_code == 422


# --- Auth routes surface (unauthenticated) ---
def test_customer_login_invalid(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "nope@example.com", "password": "wrongpass"}, timeout=10)
    assert r.status_code == 401


def test_staff_login_invalid(api):
    r = api.post(
        f"{BASE_URL}/api/auth/staff/login",
        json={"email": "nope@example.com", "password": "wrongpass", "otp": "000000"},
        timeout=10,
    )
    assert r.status_code == 401


def test_designs_requires_auth(api):
    r = api.get(f"{BASE_URL}/api/designs", timeout=10)
    assert r.status_code in (401, 403)
