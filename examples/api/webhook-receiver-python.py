"""
examples/api/webhook-receiver-python.py

Flask webhook receiver for the Waitlist & Viral Referral System.

Features:
  - Signature verification using HMAC-SHA256
  - Event type routing
  - Idempotency guard (in-memory for demo; use Redis in production)
  - Proper error handling and response codes

Requirements:
  pip install flask

Run:
  python examples/api/webhook-receiver-python.py

Then register the webhook in the admin panel:
  POST /api/v1/admin/webhooks
  {
    "url": "http://localhost:4000/webhooks",
    "secret": "whsec_my-signing-secret",
    "events": ["subscriber.created", "referral.created", "reward.unlocked"]
  }
"""

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from flask import Flask, Response, jsonify, request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT   = int(os.environ.get("PORT", 4000))
SECRET = os.environ.get("WEBHOOK_SECRET", "whsec_my-signing-secret")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory idempotency store
# In production replace with Redis:
#   import redis
#   r = redis.Redis(); r.set(f"wh:{event_id}", 1, ex=86400)
# ---------------------------------------------------------------------------
_processed_ids: set[str] = set()

# ---------------------------------------------------------------------------
# Signature verification
#
# The API signs each delivery with HMAC-SHA256(secret, raw_body).
# The signature is sent in the "X-Waitlist-Signature" header as a hex string.
# We use hmac.compare_digest() for a constant-time comparison.
# ---------------------------------------------------------------------------
def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    try:
        return hmac.compare_digest(expected, signature)
    except (TypeError, ValueError):
        return False

# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------
def handle_subscriber_created(event: dict[str, Any]) -> None:
    data     = event.get("data", {})
    email    = data.get("email", "unknown")
    name     = data.get("name") or email
    position = data.get("position")
    ref_code = data.get("referralCode", "")

    logger.info(
        "[subscriber.created] %s joined at position #%s — code: %s",
        name, position, ref_code,
    )
    # Example: trigger a welcome email via SendGrid / Resend / Postmark
    # send_welcome_email(email=email, name=name, position=position, ref_code=ref_code)


def handle_subscriber_approved(event: dict[str, Any]) -> None:
    email = event.get("data", {}).get("email", "unknown")
    logger.info("[subscriber.approved] %s approved", email)
    # Example: send approval email with access link


def handle_subscriber_rejected(event: dict[str, Any]) -> None:
    email = event.get("data", {}).get("email", "unknown")
    logger.info("[subscriber.rejected] %s rejected", email)


def handle_referral_created(event: dict[str, Any]) -> None:
    data            = event.get("data", {})
    referrer_email  = data.get("referrerEmail", "unknown")
    referred_email  = data.get("referredEmail", "unknown")
    new_position    = data.get("referrerPosition")

    logger.info(
        "[referral.created] %s referred %s → now #%s",
        referrer_email, referred_email, new_position,
    )
    # Example: notify referrer that they moved up
    # if new_position is not None:
    #     send_position_update(email=referrer_email, position=new_position)


def handle_reward_unlocked(event: dict[str, Any]) -> None:
    data         = event.get("data", {})
    email        = data.get("email", "unknown")
    reward_name  = data.get("rewardName", "")
    reward_type  = data.get("rewardType", "")
    reward_value = data.get("rewardValue", "")

    logger.info(
        "[reward.unlocked] %s unlocked '%s' (%s: %s)",
        email, reward_name, reward_type, reward_value,
    )
    if reward_type == "code":
        logger.info("  → Should email coupon code '%s' to %s", reward_value, email)
        # send_reward_email(email=email, coupon_code=reward_value)


# ---------------------------------------------------------------------------
# Event router
# ---------------------------------------------------------------------------
EVENT_HANDLERS = {
    "subscriber.created":  handle_subscriber_created,
    "subscriber.approved": handle_subscriber_approved,
    "subscriber.rejected": handle_subscriber_rejected,
    "referral.created":    handle_referral_created,
    "reward.unlocked":     handle_reward_unlocked,
}

# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------
@app.route("/webhooks", methods=["POST"])
def receive_webhook() -> Response:
    # 1. Verify signature
    signature = request.headers.get("X-Waitlist-Signature", "")
    if not signature:
        logger.warning("Webhook received without signature — rejected")
        return jsonify({"error": "Missing X-Waitlist-Signature header"}), 401

    raw_body: bytes = request.get_data()
    if not verify_signature(raw_body, signature, SECRET):
        logger.warning("Webhook signature mismatch — rejected")
        return jsonify({"error": "Invalid signature"}), 401

    # 2. Parse JSON
    try:
        event: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON body"}), 400

    event_id   = event.get("id", "")
    event_type = event.get("type", "")

    # 3. Idempotency guard
    if event_id in _processed_ids:
        logger.info("Duplicate event %s — skipping", event_id)
        return jsonify({"received": True, "duplicate": True}), 200

    _processed_ids.add(event_id)

    # 4. Acknowledge immediately
    # (In a real app you'd push the event to a queue here and return 200 fast,
    #  then process asynchronously with Celery, RQ, or similar.)
    response = jsonify({"received": True})

    # 5. Route to handler (synchronous for simplicity)
    handler = EVENT_HANDLERS.get(event_type)
    if handler:
        try:
            handler(event)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error handling event %s: %s", event_type, exc)
    else:
        logger.info("Unhandled event type: %s", event_type)

    return response, 200


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/health")
def health() -> Response:
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Webhook receiver starting on http://localhost:%s/webhooks", PORT)
    logger.info("Signature secret: %s…", SECRET[:12])
    # Use a production WSGI server (gunicorn) instead of Flask's dev server
    # in production: gunicorn -w 4 -b 0.0.0.0:4000 webhook_receiver:app
    app.run(host="0.0.0.0", port=PORT, debug=False)
