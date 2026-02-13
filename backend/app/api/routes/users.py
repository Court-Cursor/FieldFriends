from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.event import MyEventsResponse, to_event_response
from app.schemas.user import UserProfile
from app.service import event_service
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserProfile)
def me(current_user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile.model_validate(current_user)


@router.get("/users/me/events", response_model=MyEventsResponse)
def my_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MyEventsResponse:
    created, joined = event_service.get_my_events(db, current_user)
    return MyEventsResponse(
        created_events=[to_event_response(event, joined_count, is_joined) for event, joined_count, is_joined in created],
        joined_events=[to_event_response(event, joined_count, is_joined) for event, joined_count, is_joined in joined],
    )
