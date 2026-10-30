from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def get_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


def add(session: AsyncSession, name: str, email: str, password_hash: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash)
    session.add(user)
    return user
