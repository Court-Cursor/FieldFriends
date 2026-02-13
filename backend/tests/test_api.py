from __future__ import annotations

from datetime import UTC, datetime, timedelta


def _future_iso(hours: int) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def signup_and_get_token(client, email: str, password: str = "password123") -> str:
    response = client.post("/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201
    return response.json()["access_token"]


def test_signup_login_flow(client) -> None:
    signup_response = client.post(
        "/auth/signup",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert signup_response.status_code == 201
    assert signup_response.json()["user"]["email"] == "user@example.com"

    login_response = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user@example.com"


def test_create_event_requires_auth(client) -> None:
    response = client.post(
        "/events",
        json={
            "title": "Pickup Basketball",
            "start_time": _future_iso(2),
            "end_time": _future_iso(3),
            "location_text": "City Court",
        },
    )
    assert response.status_code == 401


def test_join_event_requires_auth(client) -> None:
    token = signup_and_get_token(client, "creator@example.com")

    create_response = client.post(
        "/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Weekend Tennis",
            "start_time": _future_iso(3),
            "end_time": _future_iso(4),
            "location_text": "Court 1",
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["id"]

    join_response = client.post(f"/events/{event_id}/join")
    assert join_response.status_code == 401
