from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.repo import participant_repo
from app.schemas.auth import AuthRequest
from app.schemas.event import EventCreateRequest
from app.service import event_service
from app.service.auth_service import signup

import uuid

def _future_time(hours: int) -> datetime:
    return datetime.now(UTC) + timedelta(hours=hours)


def test_create_event_validation_rejects_invalid_time_order(db_session) -> None:
    auth = signup(db_session, AuthRequest(email="creator@example.com", password="password123"))
    creator = db_session.get(User, auth.user.id)
    assert creator is not None

    payload = EventCreateRequest(
        title="Morning Game",
        start_time=_future_time(2),
        end_time=_future_time(1),
        location_text="Main Field",
    )

    with pytest.raises(HTTPException) as exc:
        event_service.create_event(db_session, creator, payload)

    assert exc.value.status_code == 422


def test_join_event_prevents_duplicates(db_session) -> None:
    creator_auth = signup(db_session, AuthRequest(email="creator2@example.com", password="password123"))
    joiner_auth = signup(db_session, AuthRequest(email="joiner@example.com", password="password123"))

    creator = db_session.get(User, creator_auth.user.id)
    joiner = db_session.get(User, joiner_auth.user.id)
    assert creator is not None
    assert joiner is not None

    event = event_service.create_event(
        db_session,
        creator,
        EventCreateRequest(
            title="Evening Match",
            sport_type="soccer",
            start_time=_future_time(2),
            end_time=_future_time(3),
            location_text="West Park",
        ),
    )

    event_service.join_event(db_session, event.id, joiner)
    event_service.join_event(db_session, event.id, joiner)

    assert participant_repo.count_participants(db_session, event.id) == 1

def test_list_events(db_session) -> None:
    creator_auth = signup(db_session, AuthRequest(email="creator2@example.com", password="password123"))
    creator = db_session.get(User, creator_auth.user.id)
    assert creator is not None

    event_service.create_event(
        db_session,
        creator,
        EventCreateRequest(
            title="Morning Match",
            sport_type="soccer",
            start_time=_future_time(2),
            end_time=_future_time(3),
            location_text="Main Field",
        ),
    )
    event_service.create_event(
        db_session,
        creator,
        EventCreateRequest(
            title="Afternoon Match",
            sport_type="basketball",
            start_time=_future_time(4),
            end_time=_future_time(5),
            location_text="East Park",
        ),
    )

    events = event_service.list_events(db_session, creator, None, None, None, None, limit=10, offset=0)
    assert len(events) >= 2
    titles = {event[0].title for event in events}
    assert "Morning Match" in titles
    assert "Afternoon Match" in titles

def test_get_event_detail(db_session) -> None:
    creator_auth = signup(db_session, AuthRequest(email="creator2@example.com", password="password123"))
    creator = db_session.get(User, creator_auth.user.id)
    assert creator is not None

    event_created = event_service.create_event(
        db_session,
        creator,
        EventCreateRequest(
            title="Morning Match",
            sport_type="soccer",
            start_time=_future_time(2),
            end_time=_future_time(3),
            location_text="Main Field",
        ),
    )

    event_details = event_service.get_event_detail(db_session, event_created.id, creator)
    assert event_details[0].id == event_created.id
    assert event_details[0].title == "Morning Match"

def test_get_event_detail_not_found(db_session) -> None:
    with pytest.raises(HTTPException) as exc:
        event_service.get_event_detail(db_session, uuid.uuid4(), None)
    assert exc.value.status_code == 404

def test_get_my_events(db_session) -> None:
    auth = signup(db_session, AuthRequest(email="creator@example.com", password="password123"))
    creator = db_session.get(User, auth.user.id)
    assert creator is not None

    event_1 = event_service.create_event(
        db_session,
        creator,
        EventCreateRequest(
            title="Morning Game",
            start_time=_future_time(1),
            end_time=_future_time(2),
            location_text="Main Field",
        ),
    )

    creator_auth = signup(db_session, AuthRequest(email="creator2@example.com", password="password123"))
    creator2 = db_session.get(User, creator_auth.user.id)
    assert creator2 is not None

    event_2 = event_service.create_event(
        db_session,
        creator2,
        EventCreateRequest(
            title="Morning Match",
            sport_type="soccer",
            start_time=_future_time(2),
            end_time=_future_time(3),
            location_text="Main Field",
        ),
    )

    event_service.join_event(db_session, event_2.id, creator)

    my_events = event_service.get_my_events(db_session, creator)
    created_events = my_events[0]
    joined_events = my_events[1]
    assert len(created_events) == 1
    assert created_events[0][0].id == event_1.id
    assert len(joined_events) == 1
    assert joined_events[0][0].id == event_2.id

def test_join_event_not_found(db_session) -> None:
    auth = signup(db_session, AuthRequest(email="creator@example.com", password="password123"))
    user = db_session.get(User, auth.user.id)
    assert user is not None

    with pytest.raises(HTTPException) as exc:
        event_service.join_event(db_session, uuid.uuid4(), user)
    assert exc.value.status_code == 404
    assert "Event not found" in exc.value.detail
