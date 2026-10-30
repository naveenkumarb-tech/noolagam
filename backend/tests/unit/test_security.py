from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import Settings, get_settings
from app.core.security import (
    JWT_ALGORITHM,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_url_token,
    hash_password,
    hash_url_token,
    verify_password,
)


def test_password_hash_verifies_only_the_right_password() -> None:
    password_hash = hash_password("correct-password")

    assert password_hash.startswith("$2b$")
    assert "correct-password" not in password_hash
    assert verify_password("correct-password", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_password_over_bcrypt_limit_is_refused_instead_of_raising() -> None:
    assert not verify_password("x" * 73, hash_password("x" * 72))


def test_url_token_is_stored_only_as_its_sha256_hash() -> None:
    raw_token, token_hash = generate_url_token()

    assert len(raw_token) >= 43
    assert len(token_hash) == 64
    assert raw_token not in token_hash
    assert hash_url_token(raw_token) == token_hash


def test_access_token_carries_user_and_version() -> None:
    claims = decode_token(create_access_token(7, 3), "access")

    assert claims["sub"] == "7"
    assert claims["tv"] == 3


def test_each_refresh_token_has_a_unique_id() -> None:
    assert create_refresh_token(7, 0).jti != create_refresh_token(7, 0).jti


def test_token_of_the_wrong_type_is_rejected() -> None:
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(create_access_token(7, 0), "refresh")


def test_expired_token_is_rejected() -> None:
    claims = {"sub": "7", "tv": 0, "type": "access", "exp": datetime.now(UTC) - timedelta(seconds=1)}
    token = jwt.encode(claims, get_settings().jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token, "access")


def test_token_signed_with_another_secret_is_rejected() -> None:
    claims = {"sub": "7", "tv": 0, "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=1)}
    token = jwt.encode(claims, "another-secret-that-is-long-enough-to-use", algorithm=JWT_ALGORITHM)

    with pytest.raises(jwt.InvalidSignatureError):
        decode_token(token, "access")


@pytest.mark.parametrize(
    "overrides",
    [
        {"cookie_secure": False},
        {"jwt_secret": "dev-only-secret-that-is-long-enough-to-pass"},
    ],
)
def test_production_refuses_unsafe_settings(overrides: dict[str, object]) -> None:
    values = get_settings().model_dump()
    values["jwt_secret"] = "a-real-production-secret-that-is-long-enough"
    values["smtp_password"] = ""

    Settings(**{**values, "environment": "production", "cookie_secure": True})
    with pytest.raises(ValueError):
        Settings(**{**values, "environment": "production", "cookie_secure": True, **overrides})
