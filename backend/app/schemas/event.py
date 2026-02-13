from __future__ import annotations

from datetime import UTC, datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    sport_type: str | None = Field(default=None, max_length=100)
    description: str | None = None
    start_time: datetime
    end_time: datetime
    location_text: str = Field(min_length=1, max_length=255)
    latitude: float | None = None
    longitude: float | None = None
    max_participants: int | None = Field(default=None, ge=1)

    @field_validator("title", "location_text")
    @classmethod
    def non_empty_trimmed(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator("sport_type")
    @classmethod
    def normalize_sport_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("start_time", "end_time")
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("must include timezone")
        return value.astimezone(UTC)


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    creator_id: uuid.UUID
    title: str
    sport_type: str | None
    description: str | None
    start_time: datetime
    end_time: datetime
    location_text: str
    latitude: float | None
    longitude: float | None
    max_participants: int | None
    created_at: datetime
    joined_count: int
    is_joined_by_me: bool | None = None


class MyEventsResponse(BaseModel):
    created_events: list[EventResponse]
    joined_events: list[EventResponse]


def to_event_response(event, joined_count: int, is_joined_by_me: bool | None) -> EventResponse:
    return EventResponse(
        id=event.id,
        creator_id=event.creator_id,
        title=event.title,
        sport_type=event.sport_type,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        location_text=event.location_text,
        latitude=event.latitude,
        longitude=event.longitude,
        max_participants=event.max_participants,
        created_at=event.created_at,
        joined_count=joined_count,
        is_joined_by_me=is_joined_by_me,
    )
