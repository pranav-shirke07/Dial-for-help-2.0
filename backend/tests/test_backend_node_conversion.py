"""Backend-node conversion smoke/regression tests for startup, auth, booking, and admin analytics flows."""

import os
import subprocess
import time
import uuid
from pathlib import Path

import pytest
import requests


BACKEND_NODE_DIR = Path("/app/backend-node")
BASE_URL = os.environ.get("NODE_BACKEND_TEST_BASE_URL", "http://127.0.0.1:8011").rstrip("/")
API_BASE_URL = f"{BASE_URL}/api"


def _wait_for_server(timeout_seconds=45):
    last_error = None
    start = time.time()
    while time.time() - start < timeout_seconds:
        try:
            response = requests.get(f"{API_BASE_URL}/", timeout=3)
            if response.status_code == 200:
                return
            last_error = f"status={response.status_code}, body={response.text}"
        except requests.RequestException as exc:
            last_error = str(exc)
        time.sleep(1)
    raise RuntimeError(f"Node backend did not become ready in {timeout_seconds}s. Last error: {last_error}")


@pytest.fixture(scope="module")
def node_backend_process():
    """Start backend-node server process for module-level API tests."""
    env = os.environ.copy()
    env["PORT"] = "8011"

    process = subprocess.Popen(
        ["node", "src/server.js"],
        cwd=str(BACKEND_NODE_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        _wait_for_server(timeout_seconds=45)
    except Exception as exc:  # pragma: no cover
        process.terminate()
        try:
            stdout, stderr = process.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate(timeout=5)
        raise RuntimeError(f"Failed to start backend-node runtime: {exc}\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}") from exc

    yield process

    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


@pytest.fixture
def api_client(node_backend_process):
    """HTTP client for backend-node endpoints."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def test_node_health_endpoint_returns_expected_payload(api_client):
    response = api_client.get(f"{API_BASE_URL}/", timeout=15)

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "Dial For Help API (Node + Express) is running"
    assert payload["plans"]["user"] == "₹99/year after 2 free services"
    assert payload["plans"]["worker"] == "₹199/year mandatory before signup"


def test_user_register_login_and_profile_flow(api_client):
    unique = uuid.uuid4().hex[:8]
    register_payload = {
        "full_name": f"TEST Node User {unique}",
        "email": f"test.node.{unique}@example.com",
        "password": "User@123",
        "phone": f"+9199{unique[:8]}",
        "address": "Test Address",
    }

    register_response = api_client.post(f"{API_BASE_URL}/users/register", json=register_payload, timeout=20)
    assert register_response.status_code == 200
    register_data = register_response.json()
    assert isinstance(register_data["token"], str) and len(register_data["token"]) > 10
    assert register_data["user"]["email"] == register_payload["email"].lower()
    assert register_data["user"]["full_name"] == register_payload["full_name"]

    token = register_data["token"]
    profile_response = api_client.get(
        f"{API_BASE_URL}/users/profile",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert profile_response.status_code == 200
    profile_data = profile_response.json()
    assert profile_data["email"] == register_payload["email"].lower()
    assert profile_data["phone"] == register_payload["phone"]

    login_response = api_client.post(
        f"{API_BASE_URL}/users/login",
        json={"email": register_payload["email"], "password": register_payload["password"]},
        timeout=20,
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert isinstance(login_data["token"], str) and len(login_data["token"]) > 10
    assert login_data["user"]["email"] == register_payload["email"].lower()


def test_booking_creation_endpoint(api_client):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "full_name": f"TEST Booking User {unique}",
        "phone": f"+9188{unique[:8]}",
        "email": f"test.booking.{unique}@example.com",
        "service_type": "Cleaning",
        "address": "221B Baker Street",
        "preferred_date": "2026-12-31",
        "notes": "Please ring the bell.",
    }

    response = api_client.post(f"{API_BASE_URL}/bookings", json=payload, timeout=45)
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["id"], str) and len(data["id"]) > 10
    assert data["email"] == payload["email"].lower()
    assert data["service_type"] == payload["service_type"]
    assert data["status"] == "pending"
    assert data["charge_type"] in ["free", "subscription"]


def test_admin_login_demo_logins_and_analytics_endpoints(api_client):
    admin_login_payload = {
        "email": "admin@dialforhelp.com",
        "password": "Admin@123",
    }

    login_response = api_client.post(f"{API_BASE_URL}/admin/login", json=admin_login_payload, timeout=20)
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert isinstance(login_data["token"], str) and len(login_data["token"]) > 10
    assert login_data["admin_email"] == admin_login_payload["email"]

    admin_headers = {"Authorization": f"Bearer {login_data['token']}"}

    demo_response = api_client.get(f"{API_BASE_URL}/admin/demo-logins", headers=admin_headers, timeout=30)
    assert demo_response.status_code == 200
    demo_data = demo_response.json()
    assert isinstance(demo_data, list)
    assert any(item.get("role") == "admin" and item.get("email") == "admin@dialforhelp.com" for item in demo_data)

    analytics_response = api_client.get(f"{API_BASE_URL}/admin/analytics", headers=admin_headers, timeout=30)
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert isinstance(analytics["monthly"], list)
    assert len(analytics["monthly"]) == 6
    assert isinstance(analytics["assignment_completion_rate"], (int, float))
    assert isinstance(analytics["active_subscriptions"], int)
