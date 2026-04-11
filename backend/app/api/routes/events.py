from __future__ import annotations

from datetime import UTC, datetime
import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.user import User
from app.schemas.event import EventCreateRequest, EventParticipantResponse, EventResponse, to_event_response
from app.service import event_service

router = APIRouter(prefix="/events", tags=["events"])


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@router.post("", response_model=EventResponse, status_code=201)
def create_event(
    payload: EventCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventResponse:
    event = event_service.create_event(db, current_user, payload)
    return to_event_response(event, joined_count=1, is_joined_by_me=True)


@router.get("", response_model=list[EventResponse])
def list_events(
    q: str | None = None,
    sport: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> list[EventResponse]:
    events = event_service.list_events(
        db=db,
        current_user=current_user,
        q=q,
        sport=sport,
        date_from=_to_utc(date_from),
        date_to=_to_utc(date_to),
        limit=limit,
        offset=offset,
    )
    return [to_event_response(event, joined_count, is_joined) for event, joined_count, is_joined in events]


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> EventResponse:
    event, joined_count, is_joined, participants = event_service.get_event_detail(db, event_id, current_user)
    participants_payload = None
    if participants is not None:
        participants_payload = [
            EventParticipantResponse(user_id=user.id, email=user.email, joined_at=participant.joined_at)
            for participant, user in participants
        ]
    return to_event_response(event, joined_count, is_joined, participants_payload)


@router.post("/{event_id}/join", response_model=EventResponse)
def join_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventResponse:
    event, joined_count, is_joined = event_service.join_event(db, event_id, current_user)
    return to_event_response(event, joined_count, is_joined)


@router.delete("/{event_id}/leave", response_model=EventResponse)
def leave_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventResponse:
    event, joined_count, is_joined = event_service.leave_event(db, event_id, current_user)
    return to_event_response(event, joined_count, is_joined)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    event_service.delete_event(db, event_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{event_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_participant(
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    event_service.remove_participant(db, event_id, user_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
