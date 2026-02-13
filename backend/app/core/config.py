from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "FieldFriends API"
    api_v1_prefix: str = ""
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/fieldfriends"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    log_level: str = "INFO"
    jwt_secret: str = "replace-with-a-random-secret-of-at-least-32-characters"
    jwt_issuer: str = "fieldfriends"
    jwt_audience: str = "fieldfriends-users"
    jwt_expires_minutes: int = 60
    jwt_algorithm: str = "HS256"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            if not value.strip():
                return []
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
