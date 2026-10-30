import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any, Literal

import bcrypt
import jwt

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"
BCRYPT_MAX_BYTES = 72

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode()
    if len(encoded) > BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode())


@lru_cache
def _dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    """Takes as long as a real check, so login timing does not reveal whether an email is registered."""
    verify_password(password, _dummy_password_hash())


def _encode(claims: dict[str, Any], token_type: TokenType, expires_at: datetime) -> str:
    payload = {**claims, "type": token_type, "iat": datetime.now(UTC), "exp": expires_at}
    return jwt.encode(payload, get_settings().jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)


def create_access_token(user_id: int, token_version: int) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=get_settings().access_token_minutes)
    return _encode({"sub": str(user_id), "tv": token_version}, "access", expires_at)


@dataclass(frozen=True)
class IssuedRefreshToken:
    token: str
    jti: str
    expires_at: datetime


def create_refresh_token(user_id: int, token_version: int) -> IssuedRefreshToken:
    jti = uuid.uuid4().hex
    expires_at = datetime.now(UTC) + timedelta(days=get_settings().refresh_token_days)
    token = _encode({"sub": str(user_id), "tv": token_version, "jti": jti}, "refresh", expires_at)
    return IssuedRefreshToken(token=token, jti=jti, expires_at=expires_at)


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Raises jwt.InvalidTokenError if the token is invalid, expired or of the wrong type."""
    claims: dict[str, Any] = jwt.decode(
        token,
        get_settings().jwt_secret.get_secret_value(),
        algorithms=[JWT_ALGORITHM],
        options={"require": ["exp", "sub", "tv", "type"]},
    )
    if claims["type"] != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return claims


def hash_url_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_url_token() -> tuple[str, str]:
    """Returns the raw token for the email link and the SHA-256 hash that is stored."""
    raw_token = secrets.token_urlsafe(32)
    return raw_token, hash_url_token(raw_token)
