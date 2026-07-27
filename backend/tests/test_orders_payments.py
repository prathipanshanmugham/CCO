"""Tests for /api/orders, /api/orders/{id}/payment, and Razorpay webhook.

Payment credentials (Razorpay) are intentionally NOT configured in .env, so
`payment_ready()` returns False. These tests validate:
  - GET /api/orders requires bearer token (401).
  - Authenticated customer with no orders receives an empty list (200 + []).
  - POST /api/orders/{id}/payment returns 404 for missing/non-owned orders.
  - POST /api/orders/{id}/payment returns 503 when Razorpay is not configured
    and never exposes secrets in the error body.
  - POST /api/payments/razorpay/webhook rejects missing/invalid signature (401)
    and never exposes secrets.
"""
import os
import time
import uuid

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def customer(api):
    """Register a fresh customer and return {token, id, email}."""
    email = f"TEST_orders_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "TEST Orders User", "email": email, "password": "Password!2026"}
    r = api.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "id": data["user"]["id"], "email": email}


# --- GET /api/orders ---------------------------------------------------------


def test_list_orders_without_token_is_denied(api):
    r = api.get(f"{API}/orders")
    assert r.status_code in (401, 403), r.text


def test_list_orders_with_invalid_token_is_denied(api):
    r = api.get(f"{API}/orders", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code in (401, 403), r.text


def test_list_orders_new_customer_empty(api, customer):
    r = api.get(f"{API}/orders", headers={"Authorization": f"Bearer {customer['token']}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    assert body == []


# --- POST /api/orders/{id}/payment ------------------------------------------


def test_start_payment_missing_order_returns_404(api, customer):
    r = api.post(
        f"{API}/orders/nonexistent-order-id/payment",
        headers={"Authorization": f"Bearer {customer['token']}"},
        json={"payment_option": "full"},
    )
    assert r.status_code == 404, r.text
    assert "razorpay" not in r.text.lower()
    assert "secret" not in r.text.lower()


def _seed_order(customer_id: str, total: int | None) -> str:
    """Insert an order directly into Mongo for the given customer."""
    import asyncio

    order_id = uuid.uuid4().hex
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")

    async def _do():
        client = AsyncIOMotorClient(mongo_url)
        try:
            await client[db_name].orders.insert_one(
                {
                    "id": order_id,
                    "customer_id": customer_id,
                    "design_id": "TEST_design",
                    "total": total,
                    "currency": "INR",
                    "payment_status": "quote_requested",
                    "production_status": "New",
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "timeline": [],
                }
            )
        finally:
            client.close()

    asyncio.get_event_loop().run_until_complete(_do())
    return order_id


def _cleanup_order(order_id: str) -> None:
    import asyncio

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")

    async def _do():
        client = AsyncIOMotorClient(mongo_url)
        try:
            await client[db_name].orders.delete_one({"id": order_id})
        finally:
            client.close()

    asyncio.get_event_loop().run_until_complete(_do())


def test_start_payment_not_owned_returns_404(api, customer):
    """An order owned by someone else must not be reachable."""
    other_order_id = _seed_order(customer_id="not-this-customer", total=100000)
    try:
        r = api.post(
            f"{API}/orders/{other_order_id}/payment",
            headers={"Authorization": f"Bearer {customer['token']}"},
            json={"payment_option": "full"},
        )
        assert r.status_code == 404, r.text
        # Secrets never in body
        assert "razorpay" not in r.text.lower()
    finally:
        _cleanup_order(other_order_id)


def test_start_payment_without_gateway_credentials_returns_503(api, customer):
    """Own order with approved total: gateway inactive -> 503, no secret leak."""
    order_id = _seed_order(customer_id=customer["id"], total=150000)
    try:
        r = api.post(
            f"{API}/orders/{order_id}/payment",
            headers={"Authorization": f"Bearer {customer['token']}"},
            json={"payment_option": "full"},
        )
        assert r.status_code == 503, r.text
        body = r.text.lower()
        # Do not expose secrets or key ids
        assert "rzp_" not in body
        assert "razorpay_key" not in body
        assert "webhook_secret" not in body
        # User-friendly message
        assert "checkout" in body or "configured" in body
    finally:
        _cleanup_order(order_id)


def test_start_payment_without_manager_total_short_circuits_to_503(api, customer):
    """Own order with no total: since gateway is inactive, /payment short-circuits
    to 503 before the total check runs (see server.py:191 vs :194). Recorded as a
    code-review note; the response is still safe (no secrets leaked)."""
    order_id = _seed_order(customer_id=customer["id"], total=None)
    try:
        r = api.post(
            f"{API}/orders/{order_id}/payment",
            headers={"Authorization": f"Bearer {customer['token']}"},
            json={"payment_option": "full"},
        )
        # Under current server ordering this returns 503. Once creds are added
        # it will surface the 422 "Manager must approve" error instead.
        assert r.status_code in (422, 503), r.text
        assert "webhook_secret" not in r.text.lower()
        assert "rzp_" not in r.text.lower()
    finally:
        _cleanup_order(order_id)


def test_start_payment_advance_option_accepted(api, customer):
    """advance option is a valid literal; downstream still 503 due to no creds."""
    order_id = _seed_order(customer_id=customer["id"], total=100000)
    try:
        r = api.post(
            f"{API}/orders/{order_id}/payment",
            headers={"Authorization": f"Bearer {customer['token']}"},
            json={"payment_option": "advance"},
        )
        assert r.status_code == 503, r.text
    finally:
        _cleanup_order(order_id)


def test_start_payment_invalid_option_rejected(api, customer):
    order_id = _seed_order(customer_id=customer["id"], total=100000)
    try:
        r = api.post(
            f"{API}/orders/{order_id}/payment",
            headers={"Authorization": f"Bearer {customer['token']}"},
            json={"payment_option": "half"},
        )
        assert r.status_code == 422, r.text
    finally:
        _cleanup_order(order_id)


# --- POST /api/payments/razorpay/webhook -------------------------------------


def test_webhook_missing_signature_rejected(api):
    r = api.post(
        f"{API}/payments/razorpay/webhook",
        json={"event": "payment.captured", "payload": {"payment": {"entity": {"order_id": "x"}}}},
    )
    assert r.status_code == 401, r.text
    assert "signature" in r.text.lower() or "invalid" in r.text.lower()
    # No secret leakage
    assert "webhook_secret" not in r.text.lower()


def test_webhook_invalid_signature_rejected(api):
    r = api.post(
        f"{API}/payments/razorpay/webhook",
        headers={"X-Razorpay-Signature": "deadbeef" * 8},
        json={"event": "payment.captured", "payload": {"payment": {"entity": {"order_id": "x"}}}},
    )
    assert r.status_code == 401, r.text
    assert "webhook_secret" not in r.text.lower()
