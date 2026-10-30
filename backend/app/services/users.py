from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas.user import UpdateProfileRequest


async def update_profile(session: AsyncSession, user: User, data: UpdateProfileRequest) -> User:
    user.name = data.name
    await session.commit()
    return user
