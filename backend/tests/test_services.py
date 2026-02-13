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
