from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthToken, AuthTokenPurpose


def add(
    session: AsyncSession, user_id: int, purpose: AuthTokenPurpose, token_hash: str, expires_at: datetime
) -> None:
    session.add(AuthToken(user_id=user_id, purpose=purpose, token_hash=token_hash, expires_at=expires_at))


async def get_usable_for_update(
    session: AsyncSession, token_hash: str, purpose: AuthTokenPurpose
) -> AuthToken | None:
    result = await session.execute(
        select(AuthToken)
        .where(
            AuthToken.token_hash == token_hash,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > datetime.now(UTC),
        )
        .with_for_update()
    )
    return result.scalar_one_or_none()


async def delete_unused(session: AsyncSession, user_id: int, purpose: AuthTokenPurpose) -> None:
    await session.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
    )
