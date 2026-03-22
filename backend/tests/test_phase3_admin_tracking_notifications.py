import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests


# Phase coverage: booking tracking, admin subscriptions, worker suggestions, and notification behavior.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
RAZORPAY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")


@pytest.fixture(scope="session")
def api_base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def razorpay_secret() -> str:
    if not RAZORPAY_SECRET:
        pytest.skip("RAZORPAY_KEY_SECRET is not set")
    return RAZORPAY_SECRET


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client, api_base_url) -> str:
    response = api_client.post(
        f"{api_base_url}/api/admin/login",
        json={"email": "admin@dialforhelp.com", "password": "Admin@123"},
        timeout=25,
    )
    assert response.status_code == 200
    token = response.json().get("token")
    assert isinstance(token, str) and token
    return token


def _identity(prefix: str) -> dict:
    uniq = uuid.uuid4().hex[:10]
    return {
        "name": f"TEST_{prefix}_{uniq}",
        "phone": f"+9198{uniq[:8]}",
        "email": f"test_{prefix}_{uniq}@example.com",
    }


def _booking_payload(identity: dict, service: str = "Plumbing") -> dict:
    preferred_date = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    return {
        "full_name": identity["name"],
        "phone": identity["phone"],
        "email": identity["email"],
        "service_type": service,
        "address": "TEST Address, Bengaluru",
        "preferred_date": preferred_date,
        "notes": "TEST phase3 booking",
    }


def _activate_worker_subscription(api_client, api_base_url, razorpay_secret, identity: dict):
    order = api_client.post(
        f"{api_base_url}/api/payments/create-order",
        json={
            "plan_type": "worker",
            "name": identity["name"],
            "email": identity["email"],
            "phone": identity["phone"],
        },
        timeout=40,
    )
    assert order.status_code == 200
    order_id = order.json()["order_id"]

    payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    body = f"{order_id}|{payment_id}".encode("utf-8")
    signature = hmac.new(razorpay_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    verify = api_client.post(
        f"{api_base_url}/api/payments/verify",
        json={
            "plan_type": "worker",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
            "subscriber_name": identity["name"],
            "email": identity["email"],
            "phone": identity["phone"],
        },
        timeout=40,
    )
    assert verify.status_code == 200


def test_track_booking_endpoint_success_and_shape(api_client, api_base_url):
    identity = _identity("track")
    create = api_client.post(
        f"{api_base_url}/api/bookings",
        json=_booking_payload(identity, service="Cleaning"),
        timeout=35,
    )
    assert create.status_code == 200
    created = create.json()

    track = api_client.get(f"{api_base_url}/api/bookings/track/{created['id']}", timeout=25)
    assert track.status_code == 200
    tracked = track.json()

    assert tracked["booking_id"] == created["id"]
    assert tracked["customer_name"] == identity["name"]
    assert tracked["service_type"] == "Cleaning"
    assert tracked["status"] == "pending"
    assert tracked["charge_type"] in ["free", "subscription"]


def test_track_booking_not_found_returns_404(api_client, api_base_url):
    response = api_client.get(f"{api_base_url}/api/bookings/track/{uuid.uuid4()}", timeout=25)
    assert response.status_code == 404
    assert response.json()["detail"] == "Booking ID not found"


def test_admin_subscriptions_requires_token(api_client, api_base_url):
    response = api_client.get(f"{api_base_url}/api/admin/subscriptions", timeout=25)
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing admin token"


def test_admin_subscriptions_returns_expected_fields(api_client, api_base_url, admin_token):
    response = api_client.get(
        f"{api_base_url}/api/admin/subscriptions",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=25,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if data:
        first = data[0]
        for key in [
            "id",
            "plan_type",
            "subscriber_name",
            "email",
            "phone",
            "status",
            "started_at",
            "expires_at",
            "days_remaining",
            "renewal_reminder_due",
        ]:
            assert key in first


def test_suggest_workers_for_booking_returns_ranked_matches(
    api_client,
    api_base_url,
    admin_token,
    razorpay_secret,
):
    booking_identity = _identity("suggest_booking")
    create_booking = api_client.post(
        f"{api_base_url}/api/bookings",
        json=_booking_payload(booking_identity, service="Electrical"),
        timeout=35,
    )
    assert create_booking.status_code == 200
    booking = create_booking.json()

    worker_identity = _identity("suggest_worker")
    _activate_worker_subscription(api_client, api_base_url, razorpay_secret, worker_identity)
    worker_signup = api_client.post(
        f"{api_base_url}/api/workers/signup",
        json={
            "full_name": worker_identity["name"],
            "phone": worker_identity["phone"],
            "email": worker_identity["email"],
            "skill": "Electrical",
            "city": "Test City",
            "years_experience": 7,
            "availability": "Full-time",
            "about": "TEST suggested worker",
        },
        timeout=35,
    )
    assert worker_signup.status_code == 200

    suggestions = api_client.get(
        f"{api_base_url}/api/admin/bookings/{booking['id']}/suggest-workers",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert suggestions.status_code == 200
    data = suggestions.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["skill"] == "Electrical"
    assert isinstance(data[0]["score"], int)


def test_notification_log_behavior_sendgrid_config_and_twilio_missing(api_client, api_base_url):
    identity = _identity("notify")
    create = api_client.post(
        f"{api_base_url}/api/bookings",
        json=_booking_payload(identity, service="Other"),
        timeout=40,
    )
    assert create.status_code == 200
    booking = create.json()

    notification_log = booking["notification_log"]
    assert isinstance(notification_log, list)
    assert len(notification_log) >= 2

    channels = [entry["channel"] for entry in notification_log]
    assert "email" in channels
    assert "sms" in channels

    sms_logs = [entry for entry in notification_log if entry["channel"] == "sms"]
    assert any("Twilio is not configured yet" in item["detail"] for item in sms_logs)

    email_logs = [entry for entry in notification_log if entry["channel"] == "email"]
    assert any("SendGrid is not configured yet" not in item["detail"] for item in email_logs)
