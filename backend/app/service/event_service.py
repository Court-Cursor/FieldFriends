from __future__ import annotations

from datetime import UTC, datetime
import uuid

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_participant import EventParticipant
from app.models.user import User
from app.repo import event_repo, participant_repo
from app.schemas.event import EventCreateRequest


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def create_event(db: Session, creator: User, payload: EventCreateRequest) -> Event:
    """Create an event after validating business constraints."""
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end_time must be after start_time")

    event = Event(
        creator_id=creator.id,
        title=payload.title,
        sport_type=payload.sport_type,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location_text=payload.location_text,
        latitude=payload.latitude,
        longitude=payload.longitude,
        max_participants=payload.max_participants,
    )
    created_event = event_repo.create_event(db, event)
    participant_repo.create_participation(db, created_event.id, creator.id)
    return created_event


def list_events(
    db: Session,
    current_user: User | None,
    q: str | None,
    sport: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
    offset: int,
) -> list[tuple[Event, int, bool | None]]:
    """List upcoming events with joined counts and join flag."""
    events = event_repo.list_upcoming_events(db, q, sport, date_from, date_to, limit, offset)
    event_ids = [event.id for event in events]
    counts = event_repo.get_joined_counts(db, event_ids)

    joined_ids: set[uuid.UUID] = set()
    if current_user:
        joined_ids = event_repo.get_joined_event_ids_for_user(db, event_ids, current_user.id)

    return [
        (event, counts.get(event.id, 0), (event.id in joined_ids) if current_user else None)
        for event in events
    ]


def get_event_detail(
    db: Session,
    event_id: uuid.UUID,
    current_user: User | None,
) -> tuple[Event, int, bool | None, list[tuple[EventParticipant, User]] | None]:
    """Get one event with joined count and optional join flag."""
    event = event_repo.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    joined_count = participant_repo.count_participants(db, event.id)
    is_joined = None
    if current_user:
        is_joined = participant_repo.get_participation(db, event.id, current_user.id) is not None

    participants: list[tuple[EventParticipant, User]] | None = None
    if current_user and (current_user.id == event.creator_id or is_joined):
        participants = participant_repo.list_participants_with_users(db, event.id)
    return event, joined_count, is_joined, participants


def join_event(db: Session, event_id: uuid.UUID, current_user: User) -> tuple[Event, int, bool | None]:
    """Join an event and prevent duplicate participation."""
    event = event_repo.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if _as_utc(event.end_time) <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot join an event that already ended")

    existing = participant_repo.get_participation(db, event.id, current_user.id)
    if existing:
        joined_count = participant_repo.count_participants(db, event.id)
        return event, joined_count, True

    current_count = participant_repo.count_participants(db, event.id)
    if event.max_participants is not None and current_count >= event.max_participants:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event is full")

    try:
        participant_repo.create_participation(db, event.id, current_user.id)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already joined this event") from exc

    joined_count = participant_repo.count_participants(db, event.id)
    return event, joined_count, True


def leave_event(db: Session, event_id: uuid.UUID, current_user: User) -> tuple[Event, int, bool]:
    """Leave an event if the current user is a joined non-creator participant."""
    event = event_repo.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.creator_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Creator cannot leave their own event")

    removed = participant_repo.delete_participation(db, event.id, current_user.id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is not joined to this event")

    joined_count = participant_repo.count_participants(db, event.id)
    return event, joined_count, False


def delete_event(db: Session, event_id: uuid.UUID, current_user: User) -> None:
    """Delete an event when requested by its creator."""
    event = event_repo.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can delete this event")

    event_repo.delete_event(db, event.id)


def remove_participant(db: Session, event_id: uuid.UUID, target_user_id: uuid.UUID, current_user: User) -> None:
    """Remove a joined participant from an event when requested by its creator."""
    event = event_repo.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if event.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the creator can remove participants")

    if target_user_id == event.creator_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove event creator")

    removed = participant_repo.delete_participation(db, event.id, target_user_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")


def get_my_events(db: Session, current_user: User) -> tuple[list[tuple[Event, int, bool]], list[tuple[Event, int, bool]]]:
    """Return created and joined events for the authenticated user."""
    created_events = event_repo.get_events_by_creator(db, current_user.id)
    joined_events = [
        event
        for event in event_repo.get_events_joined_by_user(db, current_user.id)
        if event.creator_id != current_user.id
    ]

    all_ids = [event.id for event in created_events] + [event.id for event in joined_events]
    counts = event_repo.get_joined_counts(db, list(set(all_ids)))

    created_payload = [(event, counts.get(event.id, 0), True) for event in created_events]
    joined_payload = [(event, counts.get(event.id, 0), True) for event in joined_events]
    return created_payload, joined_payload
