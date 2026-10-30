import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cli import _seed_books
from app.models import Book
from tests.helpers import register


async def test_seed_adds_books_covering_every_status(client: AsyncClient, session: AsyncSession) -> None:
    await register(client)

    await _seed_books(session, "RAVI@example.com")

    statuses = set((await session.execute(select(Book.status))).scalars())
    assert statuses == {"to_read", "reading", "finished"}
    assert await session.scalar(select(func.count()).select_from(Book)) == 7


async def test_seed_explains_an_unknown_account(session: AsyncSession) -> None:
    with pytest.raises(SystemExit, match="No account found"):
        await _seed_books(session, "nobody@example.com")
