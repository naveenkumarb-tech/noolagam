from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"

    database_url: str
    redis_url: str

    jwt_secret: SecretStr = Field(min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    reset_token_minutes: int = 30
    verify_token_hours: int = 24
    bcrypt_rounds: int = 12

    cors_origins: Annotated[list[str], NoDecode] = []
    frontend_url: str

    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    smtp_host: str
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    email_from: str

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def reject_unsafe_production_settings(self) -> Self:
        if self.environment == "production":
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if self.jwt_secret.get_secret_value().startswith("dev-only"):
                raise ValueError("JWT_SECRET must not be the development secret in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
