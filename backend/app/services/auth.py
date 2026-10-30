import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime

import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidCurrentPasswordError,
    InvalidRefreshTokenError,
    InvalidResetTokenError,
    NewPasswordSameError,
)
from app.core.security import (
    burn_password_check,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_url_token,
    verify_password,
)
from app.models import AuthTokenPurpose, User
from app.repositories import auth_tokens, refresh_tokens, users
from app.schemas.auth import LoginRequest, RegisterRequest, ResetPasswordRequest
from app.schemas.user import ChangePasswordRequest

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    refresh_token: str


def _issue_tokens(session: AsyncSession, user: User) -> AuthTokens:
    refresh = create_refresh_token(user.id, user.token_version)
    refresh_tokens.add(session, user.id, refresh.jti, refresh.expires_at)
    return AuthTokens(
        access_token=create_access_token(user.id, user.token_version),
        refresh_token=refresh.token,
    )


async def register(session: AsyncSession, data: RegisterRequest) -> AuthTokens:
    if await users.get_by_email(session, data.email):
        raise EmailAlreadyRegisteredError()

    password_hash = await asyncio.to_thread(hash_password, data.password)
    user = users.add(session, data.name, data.email, password_hash)
    try:
        # Two sign-ups with the same email can both pass the check above; the unique constraint decides.
        await session.flush()
    except IntegrityError as error:
        await session.rollback()
        raise EmailAlreadyRegisteredError() from error

    tokens = _issue_tokens(session, user)
    await session.commit()
    return tokens


async def login(session: AsyncSession, data: LoginRequest) -> AuthTokens:
    user = await users.get_by_email(session, data.email)
    if user is None:
        await asyncio.to_thread(burn_password_check, data.password)
        raise InvalidCredentialsError()
    if not await asyncio.to_thread(verify_password, data.password, user.password_hash):
        raise InvalidCredentialsError()

    tokens = _issue_tokens(session, user)
    await session.commit()
    return tokens


async def refresh(session: AsyncSession, raw_token: str | None) -> AuthTokens:
    if raw_token is None:
        raise InvalidRefreshTokenError()
    try:
        claims = decode_token(raw_token, "refresh")
    except jwt.InvalidTokenError as error:
        raise InvalidRefreshTokenError() from error

    stored = await refresh_tokens.get_by_jti_for_update(session, claims.get("jti", ""))
    user = await users.get_by_id(session, int(claims["sub"]))
    if stored is None or user is None:
        raise InvalidRefreshTokenError()

    # Checked before reuse: a device holding a token from before a password reset is not an attack,
    # and must not log out the sessions created since.
    if claims["tv"] != user.token_version:
        raise InvalidRefreshTokenError()

    if stored.revoked_at is not None:
        logger.warning("Refresh token reuse detected for user %s; revoking all sessions", user.id)
        user.token_version += 1
        await refresh_tokens.revoke_all_for_user(session, user.id)
        await session.commit()
        raise InvalidRefreshTokenError()

    stored.revoked_at = datetime.now(UTC)
    tokens = _issue_tokens(session, user)
    await session.commit()
    return tokens


async def logout(session: AsyncSession, raw_token: str | None) -> None:
    if raw_token is None:
        return
    try:
        claims = decode_token(raw_token, "refresh")
    except jwt.InvalidTokenError:
        return

    stored = await refresh_tokens.get_by_jti_for_update(session, claims.get("jti", ""))
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(UTC)
        await session.commit()


async def find_user_id_for_password_reset(session: AsyncSession, email: str) -> int | None:
    user = await users.get_by_email(session, email)
    return user.id if user else None


async def change_password(session: AsyncSession, user: User, data: ChangePasswordRequest) -> AuthTokens:
    """Ends every session, as a stolen one should not survive this, and starts a new one for this device."""
    if not await asyncio.to_thread(verify_password, data.current_password, user.password_hash):
        raise InvalidCurrentPasswordError()
    if await asyncio.to_thread(verify_password, data.new_password, user.password_hash):
        raise NewPasswordSameError()

    user.password_hash = await asyncio.to_thread(hash_password, data.new_password)
    user.token_version += 1
    await refresh_tokens.revoke_all_for_user(session, user.id)
    # A reset link sent before this change must not be able to undo it.
    await auth_tokens.delete_unused(session, user.id, AuthTokenPurpose.RESET_PASSWORD)
    tokens = _issue_tokens(session, user)
    await session.commit()
    return tokens


async def reset_password(session: AsyncSession, data: ResetPasswordRequest) -> None:
    token = await auth_tokens.get_usable_for_update(
        session, hash_url_token(data.token), AuthTokenPurpose.RESET_PASSWORD
    )
    if token is None:
        raise InvalidResetTokenError()
    user = await users.get_by_id(session, token.user_id)
    if user is None:
        raise InvalidResetTokenError()

    token.used_at = datetime.now(UTC)
    user.password_hash = await asyncio.to_thread(hash_password, data.password)
    user.token_version += 1
    await refresh_tokens.revoke_all_for_user(session, user.id)
    await auth_tokens.delete_unused(session, user.id, AuthTokenPurpose.RESET_PASSWORD)
    await session.commit()
