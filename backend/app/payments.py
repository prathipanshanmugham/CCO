import hashlib
import hmac
import os

import razorpay


def payment_ready() -> bool:
    return bool(os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET") and os.environ.get("RAZORPAY_WEBHOOK_SECRET"))


def create_gateway_order(amount_paise: int, receipt: str) -> dict:
    client = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))
    return client.order.create({"amount": amount_paise, "currency": "INR", "receipt": receipt[:40], "payment_capture": 1})


def verify_webhook(payload: bytes, signature: str) -> bool:
    expected = hmac.new(os.environ["RAZORPAY_WEBHOOK_SECRET"].encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)