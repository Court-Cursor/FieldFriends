from __future__ import annotations

import uuid

from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import Session

from app.models.event_participant import EventParticipant
from app.models.user import User


def get_participation(db: Session, event_id: uuid.UUID, user_id: uuid.UUID) -> EventParticipant | None:
    stmt = select(EventParticipant).where(
        and_(EventParticipant.event_id == event_id, EventParticipant.user_id == user_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def create_participation(db: Session, event_id: uuid.UUID, user_id: uuid.UUID) -> EventParticipant:
    participation = EventParticipant(event_id=event_id, user_id=user_id)
    db.add(participation)
    db.commit()
    db.refresh(participation)
    return participation


def count_participants(db: Session, event_id: uuid.UUID) -> int:
    stmt = select(func.count(EventParticipant.id)).where(EventParticipant.event_id == event_id)
    return int(db.execute(stmt).scalar_one())


def delete_participation(db: Session, event_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    stmt = delete(EventParticipant).where(
        and_(EventParticipant.event_id == event_id, EventParticipant.user_id == user_id)
    )
    result = db.execute(stmt)
    db.commit()
    return bool(result.rowcount and result.rowcount > 0)


def list_participants_with_users(db: Session, event_id: uuid.UUID) -> list[tuple[EventParticipant, User]]:
    stmt = (
        select(EventParticipant, User)
        .join(User, User.id == EventParticipant.user_id)
        .where(EventParticipant.event_id == event_id)
        .order_by(EventParticipant.joined_at.asc())
    )
    return list(db.execute(stmt).all())
