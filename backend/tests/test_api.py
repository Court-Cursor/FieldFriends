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


def test_create_event_auto_joins_creator(client) -> None:
    token = signup_and_get_token(client, "creator-auto-join-api@example.com")
    response = client.post(
        "/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Auto Joined API Event",
            "start_time": _future_iso(2),
            "end_time": _future_iso(3),
            "location_text": "Main Arena",
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["joined_count"] == 1
    assert payload["is_joined_by_me"] is True


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


def _create_event(client, token: str, title: str = "Role Event") -> str:
    response = client.post(
        "/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": title,
            "start_time": _future_iso(2),
            "end_time": _future_iso(3),
            "location_text": "Main Arena",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_leave_event_and_rejoin_flow(client) -> None:
    owner_token = signup_and_get_token(client, "owner-flow@example.com")
    joiner_token = signup_and_get_token(client, "joiner-flow@example.com")
    event_id = _create_event(client, owner_token, "Lifecycle Event")

    join_response = client.post(f"/events/{event_id}/join", headers={"Authorization": f"Bearer {joiner_token}"})
    assert join_response.status_code == 200

    leave_response = client.delete(f"/events/{event_id}/leave", headers={"Authorization": f"Bearer {joiner_token}"})
    assert leave_response.status_code == 200
    assert leave_response.json()["is_joined_by_me"] is False

    rejoin_response = client.post(f"/events/{event_id}/join", headers={"Authorization": f"Bearer {joiner_token}"})
    assert rejoin_response.status_code == 200
    assert rejoin_response.json()["is_joined_by_me"] is True


def test_creator_cannot_leave_own_event(client) -> None:
    owner_token = signup_and_get_token(client, "owner-cannot-leave@example.com")
    event_id = _create_event(client, owner_token, "Owner Leave Rule")

    response = client.delete(f"/events/{event_id}/leave", headers={"Authorization": f"Bearer {owner_token}"})
    assert response.status_code == 403


def test_delete_event_owner_only(client) -> None:
    owner_token = signup_and_get_token(client, "owner-delete-api@example.com")
    other_token = signup_and_get_token(client, "other-delete-api@example.com")
    event_id = _create_event(client, owner_token, "Owner Delete")

    forbidden = client.delete(f"/events/{event_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert forbidden.status_code == 403

    success = client.delete(f"/events/{event_id}", headers={"Authorization": f"Bearer {owner_token}"})
    assert success.status_code == 204

    not_found = client.get(f"/events/{event_id}")
    assert not_found.status_code == 404


def test_owner_can_remove_participant(client) -> None:
    owner_token = signup_and_get_token(client, "owner-remove-api@example.com")
    joiner_token = signup_and_get_token(client, "joiner-remove-api@example.com")
    outsider_token = signup_and_get_token(client, "outsider-remove-api@example.com")

    joiner_me = client.get("/me", headers={"Authorization": f"Bearer {joiner_token}"})
    assert joiner_me.status_code == 200
    joiner_id = joiner_me.json()["id"]

    event_id = _create_event(client, owner_token, "Remove Participant")
    joined = client.post(f"/events/{event_id}/join", headers={"Authorization": f"Bearer {joiner_token}"})
    assert joined.status_code == 200

    forbidden = client.delete(
        f"/events/{event_id}/participants/{joiner_id}",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert forbidden.status_code == 403

    removed = client.delete(
        f"/events/{event_id}/participants/{joiner_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert removed.status_code == 204


def test_participants_visible_to_joined_or_creator_only(client) -> None:
    owner_token = signup_and_get_token(client, "owner-visibility@example.com")
    joiner_token = signup_and_get_token(client, "joiner-visibility@example.com")
    outsider_token = signup_and_get_token(client, "outsider-visibility@example.com")
    event_id = _create_event(client, owner_token, "Visibility Event")

    joined = client.post(f"/events/{event_id}/join", headers={"Authorization": f"Bearer {joiner_token}"})
    assert joined.status_code == 200

    owner_detail = client.get(f"/events/{event_id}", headers={"Authorization": f"Bearer {owner_token}"})
    assert owner_detail.status_code == 200
    assert isinstance(owner_detail.json().get("participants"), list)
    assert len(owner_detail.json()["participants"]) == 2

    joined_detail = client.get(f"/events/{event_id}", headers={"Authorization": f"Bearer {joiner_token}"})
    assert joined_detail.status_code == 200
    assert isinstance(joined_detail.json().get("participants"), list)

    outsider_detail = client.get(f"/events/{event_id}", headers={"Authorization": f"Bearer {outsider_token}"})
    assert outsider_detail.status_code == 200
    assert outsider_detail.json().get("participants") is None


def test_my_events_includes_participants(client) -> None:
    owner_token = signup_and_get_token(client, "owner-my-events@example.com")
    joiner_token = signup_and_get_token(client, "joiner-my-events@example.com")

    event_id = _create_event(client, owner_token, "My Events Participants")
    joined = client.post(f"/events/{event_id}/join", headers={"Authorization": f"Bearer {joiner_token}"})
    assert joined.status_code == 200

    my_events = client.get("/users/me/events", headers={"Authorization": f"Bearer {owner_token}"})
    assert my_events.status_code == 200
    payload = my_events.json()

    created_event = next(event for event in payload["created_events"] if event["id"] == event_id)
    assert isinstance(created_event.get("participants"), list)
    assert len(created_event["participants"]) == 2
