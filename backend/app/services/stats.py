import math
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import books, stats
from app.schemas.stats import AuthorCount, GifterCount, MonthCount, StatsResponse
from app.services import cache


async def _calculate(session: AsyncSession, user_id: int, year: int) -> StatsResponse:
    counts = await books.count_for_user(session, user_id)
    totals = await stats.get_year_totals(session, user_id, year)
    by_month = await stats.get_finished_by_month(session, user_id, year)
    top_authors = await stats.get_top_authors(session, user_id, year)
    gifters = await stats.get_gifters(session, user_id)
    finished_years = await stats.get_finished_years(session, user_id)

    # The current year can always be chosen, and so can the year asked for, even with no books in it.
    current_year = datetime.now(UTC).year
    return StatsResponse(
        total_books=counts["total"],
        finished=counts["finished"],
        currently_reading=counts["reading"],
        to_read=counts["to_read"],
        gifted_books=counts["gifted"],
        year=year,
        available_years=sorted({current_year, year, *finished_years}, reverse=True),
        finished_this_year=totals.finished,
        pages_read_this_year=totals.pages,
        # Not round(), which rounds halves to the nearest even number: 12.5 would become 12.
        avg_days_per_book=math.floor(totals.avg_days + 0.5) if totals.avg_days is not None else None,
        finished_by_month=[
            MonthCount(month=f"{year}-{month:02d}", count=by_month.get(month, 0)) for month in range(1, 13)
        ],
        top_authors=[AuthorCount(author=author, count=count) for author, count in top_authors],
        gifted_by=[GifterCount(name=name, count=count) for name, count in gifters],
    )


async def get_stats(session: AsyncSession, redis: Redis, user_id: int, year: int | None) -> StatsResponse:
    wanted_year = year or datetime.now(UTC).year
    cached, version = await cache.read_stats(redis, user_id, wanted_year)
    if cached is not None:
        return StatsResponse.model_validate_json(cached)

    result = await _calculate(session, user_id, wanted_year)
    await cache.save_stats(redis, user_id, version, wanted_year, result.model_dump_json())
    return result
