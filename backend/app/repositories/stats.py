from dataclasses import dataclass
from datetime import date

from sqlalchemy import ColumnElement, Integer, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, BookStatus

TOP_AUTHORS_LIMIT = 5


@dataclass(frozen=True)
class YearTotals:
    finished: int
    pages: int
    avg_days: float | None


def _finished_in_year(user_id: int, year: int) -> list[ColumnElement[bool]]:
    return [
        Book.user_id == user_id,
        Book.status == BookStatus.FINISHED,
        Book.finished_at >= date(year, 1, 1),
        Book.finished_at < date(year + 1, 1, 1),
    ]


async def get_year_totals(session: AsyncSession, user_id: int, year: int) -> YearTotals:
    days = Book.finished_at - Book.started_at
    row = (
        await session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Book.page_count), 0),
                # A start and finish on the same day means the dates were not tracked, such as a book
                # added long after it was read. Counting those as 0 days would drag the average down.
                func.avg(days).filter(Book.started_at < Book.finished_at),
            ).where(*_finished_in_year(user_id, year))
        )
    ).one()
    return YearTotals(finished=row[0], pages=row[1], avg_days=float(row[2]) if row[2] is not None else None)


async def get_finished_by_month(session: AsyncSession, user_id: int, year: int) -> dict[int, int]:
    month = cast(extract("month", Book.finished_at), Integer)
    rows = await session.execute(
        select(month, func.count()).where(*_finished_in_year(user_id, year)).group_by(month)
    )
    return {row[0]: row[1] for row in rows}


async def get_top_authors(session: AsyncSession, user_id: int, year: int) -> list[tuple[str, int]]:
    count = func.count()
    rows = await session.execute(
        select(Book.author, count)
        .where(*_finished_in_year(user_id, year))
        .group_by(Book.author)
        .order_by(count.desc(), Book.author)
        .limit(TOP_AUTHORS_LIMIT)
    )
    return [(row[0], row[1]) for row in rows]


async def get_gifters(session: AsyncSession, user_id: int) -> list[tuple[str, int]]:
    count = func.count()
    rows = await session.execute(
        select(Book.gifted_by, count)
        .where(Book.user_id == user_id, Book.gifted_by.is_not(None))
        .group_by(Book.gifted_by)
        .order_by(count.desc(), Book.gifted_by)
    )
    return [(row[0], row[1]) for row in rows if row[0] is not None]


async def get_finished_years(session: AsyncSession, user_id: int) -> list[int]:
    year = cast(extract("year", Book.finished_at), Integer)
    rows = await session.scalars(
        select(year).where(Book.user_id == user_id, Book.finished_at.is_not(None)).distinct()
    )
    return list(rows)
