from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Text, cast, func, literal, select
from sqlalchemy.dialects.postgresql import TSQUERY
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, BookStatus
from app.schemas.book import BookSort


@dataclass(frozen=True)
class BookFilters:
    status: BookStatus | None = None
    author: str | None = None
    gifted_by: str | None = None


def _conditions(user_id: int, filters: BookFilters) -> list[ColumnElement[bool]]:
    conditions = [Book.user_id == user_id]
    if filters.status is not None:
        conditions.append(Book.status == filters.status)
    if filters.author is not None:
        conditions.append(Book.author == filters.author)
    if filters.gifted_by is not None:
        conditions.append(Book.gifted_by == filters.gifted_by)
    return conditions


_SORT_ORDER: dict[BookSort, tuple[Any, ...]] = {
    BookSort.RECENT: (Book.created_at.desc(),),
    BookSort.TITLE: (Book.title.asc(),),
    BookSort.AUTHOR: (Book.author.asc(), Book.title.asc()),
    BookSort.FINISHED: (Book.finished_at.desc().nulls_last(),),
}


def add(session: AsyncSession, book: Book) -> None:
    session.add(book)


async def get_for_user(session: AsyncSession, user_id: int, book_id: int) -> Book | None:
    result = await session.execute(select(Book).where(Book.id == book_id, Book.user_id == user_id))
    return result.scalar_one_or_none()


async def get_for_enrichment(session: AsyncSession, book_id: int, lock: bool = False) -> Book | None:
    """For the background job only. It has no user, so everything else must use get_for_user."""
    query = select(Book).where(Book.id == book_id)
    result = await session.execute(query.with_for_update() if lock else query)
    return result.scalar_one_or_none()


async def list_for_user(
    session: AsyncSession, user_id: int, filters: BookFilters, sort: BookSort, limit: int, offset: int
) -> tuple[Sequence[Book], int]:
    conditions = _conditions(user_id, filters)
    total = await session.scalar(select(func.count()).select_from(Book).where(*conditions))
    result = await session.execute(
        select(Book)
        .where(*conditions)
        .order_by(*_SORT_ORDER[sort], Book.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all(), total or 0


async def search_for_user(
    session: AsyncSession, user_id: int, query: str, filters: BookFilters, limit: int, offset: int
) -> tuple[Sequence[Book], int]:
    # plainto_tsquery makes any input safe. Adding :* to its result lets the last word match as a prefix,
    # for search as you type. Input with no words gives NULL, which matches nothing.
    words = cast(func.plainto_tsquery("simple", query), Text)
    tsquery = cast(func.nullif(words, "") + literal(":*"), TSQUERY)
    conditions = [*_conditions(user_id, filters), Book.search_vector.op("@@")(tsquery)]

    total = await session.scalar(select(func.count()).select_from(Book).where(*conditions))
    result = await session.execute(
        select(Book)
        .where(*conditions)
        .order_by(func.ts_rank(Book.search_vector, tsquery).desc(), Book.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all(), total or 0


async def get_facets(session: AsyncSession, user_id: int) -> tuple[list[str], list[str]]:
    authors = await session.scalars(
        select(Book.author).where(Book.user_id == user_id).distinct().order_by(Book.author)
    )
    gifted_by = await session.scalars(
        select(Book.gifted_by)
        .where(Book.user_id == user_id, Book.gifted_by.is_not(None))
        .distinct()
        .order_by(Book.gifted_by)
    )
    return list(authors), [name for name in gifted_by if name is not None]


async def delete(session: AsyncSession, book: Book) -> None:
    await session.delete(book)


async def list_currently_reading(session: AsyncSession, user_id: int) -> Sequence[Book]:
    result = await session.execute(
        select(Book)
        .where(Book.user_id == user_id, Book.status == BookStatus.READING)
        .order_by(Book.started_at.desc(), Book.id.desc())
    )
    return result.scalars().all()


async def count_for_user(session: AsyncSession, user_id: int) -> dict[str, int]:
    row = (
        await session.execute(
            select(
                func.count().label("total"),
                func.count().filter(Book.status == BookStatus.TO_READ).label("to_read"),
                func.count().filter(Book.status == BookStatus.READING).label("reading"),
                func.count().filter(Book.status == BookStatus.FINISHED).label("finished"),
                func.count(Book.gifted_by).label("gifted"),
            ).where(Book.user_id == user_id)
        )
    ).one()
    return dict(row._mapping)
