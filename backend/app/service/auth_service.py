from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.repo import user_repo
from app.schemas.auth import AuthRequest, AuthResponse, UserSummary


def signup(db: Session, payload: AuthRequest) -> AuthResponse:
    """Register a new user and return an access token."""
    existing = user_repo.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = user_repo.create_user(db, payload.email, hash_password(payload.password))
    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=UserSummary.model_validate(user))


def login(db: Session, payload: AuthRequest) -> AuthResponse:
    """Authenticate an existing user and return an access token."""
    user = user_repo.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=UserSummary.model_validate(user))


def get_user_or_404(db: Session, user_id: uuid.UUID):
    """Load a user by id or raise 404."""
    user = user_repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
