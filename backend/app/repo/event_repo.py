from __future__ import annotations

from datetime import UTC, datetime
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.event_participant import EventParticipant


def create_event(db: Session, event: Event) -> Event:
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_event_by_id(db: Session, event_id: uuid.UUID) -> Event | None:
    stmt = select(Event).where(Event.id == event_id)
    return db.execute(stmt).scalar_one_or_none()


def list_upcoming_events(
    db: Session,
    q: str | None,
    sport: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    limit: int,
    offset: int,
) -> list[Event]:
    now = datetime.now(UTC)
    stmt = select(Event).where(Event.start_time >= now)

    if q:
        like_term = f"%{q}%"
        stmt = stmt.where(or_(Event.title.ilike(like_term), Event.location_text.ilike(like_term)))
    if sport:
        stmt = stmt.where(Event.sport_type == sport)
    if date_from:
        stmt = stmt.where(Event.start_time >= date_from)
    if date_to:
        stmt = stmt.where(Event.start_time <= date_to)

    stmt = stmt.order_by(Event.start_time.asc()).offset(offset).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_joined_counts(db: Session, event_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not event_ids:
        return {}

    stmt = (
        select(EventParticipant.event_id, func.count(EventParticipant.id))
        .where(EventParticipant.event_id.in_(event_ids))
        .group_by(EventParticipant.event_id)
    )
    rows = db.execute(stmt).all()
    return {event_id: int(count) for event_id, count in rows}


def get_joined_event_ids_for_user(db: Session, event_ids: list[uuid.UUID], user_id: uuid.UUID) -> set[uuid.UUID]:
    if not event_ids:
        return set()

    stmt = select(EventParticipant.event_id).where(
        and_(EventParticipant.user_id == user_id, EventParticipant.event_id.in_(event_ids))
    )
    rows = db.execute(stmt).scalars().all()
    return set(rows)


def get_events_by_creator(db: Session, creator_id: uuid.UUID) -> list[Event]:
    stmt = select(Event).where(Event.creator_id == creator_id).order_by(Event.start_time.asc())
    return list(db.execute(stmt).scalars().all())


def get_events_joined_by_user(db: Session, user_id: uuid.UUID) -> list[Event]:
    stmt = (
        select(Event)
        .join(EventParticipant, EventParticipant.event_id == Event.id)
        .where(EventParticipant.user_id == user_id)
        .order_by(Event.start_time.asc())
    )
    return list(db.execute(stmt).scalars().all())
