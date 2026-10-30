from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session


@asynccontextmanager
async def worker_session() -> AsyncIterator[AsyncSession]:
    """Each Celery task runs its own event loop, and pooled connections cannot be shared between loops."""
    worker_engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        async with AsyncSession(worker_engine, expire_on_commit=False) as session:
            yield session
    finally:
        await worker_engine.dispose()
