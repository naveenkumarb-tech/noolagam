from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken


def add(session: AsyncSession, user_id: int, jti: str, expires_at: datetime) -> None:
    session.add(RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at))


async def get_by_jti_for_update(session: AsyncSession, jti: str) -> RefreshToken | None:
    result = await session.execute(select(RefreshToken).where(RefreshToken.jti == jti).with_for_update())
    return result.scalar_one_or_none()


async def revoke_all_for_user(session: AsyncSession, user_id: int) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
