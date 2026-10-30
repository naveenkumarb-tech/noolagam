from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.main import app
from app.services import stats as stats_service
from app.services.enrichment import enrich_book
from tests.conftest import FakeOpenLibrary
from tests.helpers import assert_error, auth_headers

BOOKS = "/api/v1/books"
STATS = "/api/v1/stats"
THIS_YEAR = datetime.now(UTC).year


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _create(client: AsyncClient, headers: dict[str, str], **fields: object) -> dict:
    payload = {"title": "A book", "author": "Kalki", **fields}
    response = await client.post(BOOKS, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _stats(client: AsyncClient, headers: dict[str, str], year: int = 2026) -> dict:
    response = await client.get(STATS, params={"year": year}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def _finished(client: AsyncClient, headers: dict[str, str], when: str, **fields: object) -> dict:
    return await _create(client, headers, status="finished", finished_at=when, **fields)


async def test_stats_require_login(client: AsyncClient) -> None:
    assert_error(await client.get(STATS), 401, "NOT_AUTHENTICATED")


@pytest.mark.parametrize("year", [1899, 2101, "abc"])
async def test_year_is_validated(client: AsyncClient, headers: dict[str, str], year: object) -> None:
    assert_error(await client.get(STATS, params={"year": year}, headers=headers), 422, "VALIDATION_ERROR")


async def test_new_user_gets_zeros_and_twelve_empty_months(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    stats = await _stats(client, headers, THIS_YEAR)

    assert stats["total_books"] == 0
    assert stats["finished_this_year"] == 0
    assert stats["pages_read_this_year"] == 0
    assert stats["avg_days_per_book"] is None
    assert stats["top_authors"] == []
    assert stats["gifted_by"] == []
    assert stats["available_years"] == [THIS_YEAR]
    assert [item["month"] for item in stats["finished_by_month"]] == [
        f"{THIS_YEAR}-{month:02d}" for month in range(1, 13)
    ]
    assert all(item["count"] == 0 for item in stats["finished_by_month"])


async def test_year_defaults_to_the_current_one(client: AsyncClient, headers: dict[str, str]) -> None:
    response = await client.get(STATS, headers=headers)

    assert response.json()["year"] == THIS_YEAR


async def test_overall_counts(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, gifted_by="Ravi")
    await _create(client, headers, status="reading")
    await _finished(client, headers, "2020-01-01", gifted_by="Arun")

    stats = await _stats(client, headers)

    assert stats["total_books"] == 3
    assert stats["finished"] == 1
    assert stats["currently_reading"] == 1
    assert stats["to_read"] == 1
    assert stats["gifted_books"] == 2


async def test_year_figures_only_count_that_year(client: AsyncClient, headers: dict[str, str]) -> None:
    await _finished(client, headers, "2025-01-15", page_count=100)
    await _finished(client, headers, "2025-12-31", page_count=200)
    await _finished(client, headers, "2024-12-31", page_count=999)
    await _finished(client, headers, "2026-01-01", page_count=999)

    stats = await _stats(client, headers, 2025)

    assert stats["finished_this_year"] == 2
    assert stats["pages_read_this_year"] == 300


async def test_finished_by_month_includes_the_edges_of_the_year(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2025-01-01")
    await _finished(client, headers, "2025-03-10")
    await _finished(client, headers, "2025-03-20")
    await _finished(client, headers, "2025-12-31")

    counts = [item["count"] for item in (await _stats(client, headers, 2025))["finished_by_month"]]

    assert counts == [1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]


async def test_a_book_with_unknown_pages_adds_none_but_still_counts(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2026-02-01", page_count=None)
    await _finished(client, headers, "2026-02-02", page_count=50)

    stats = await _stats(client, headers)

    assert stats["finished_this_year"] == 2
    assert stats["pages_read_this_year"] == 50


async def test_average_days_are_rounded(client: AsyncClient, headers: dict[str, str]) -> None:
    await _finished(client, headers, "2026-01-11", started_at="2026-01-01")
    await _finished(client, headers, "2026-01-16", started_at="2026-01-01")

    assert (await _stats(client, headers))["avg_days_per_book"] == 13


async def test_average_ignores_books_with_no_tracked_reading_time(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2026-01-11", started_at="2026-01-01")
    await _finished(client, headers, "2026-03-01")

    assert (await _stats(client, headers))["avg_days_per_book"] == 10


async def test_average_is_empty_when_no_book_has_reading_time(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2026-03-01")

    assert (await _stats(client, headers))["avg_days_per_book"] is None


async def test_average_counts_a_book_started_the_year_before(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2026-01-05", started_at="2025-12-26")

    assert (await _stats(client, headers))["avg_days_per_book"] == 10


async def test_top_authors_count_that_year_most_first(client: AsyncClient, headers: dict[str, str]) -> None:
    for _ in range(3):
        await _finished(client, headers, "2026-01-01", author="Kalki")
    for _ in range(2):
        await _finished(client, headers, "2026-01-01", author="Sujatha")
    await _finished(client, headers, "2026-01-01", author="Abdul")
    for _ in range(9):
        await _finished(client, headers, "2020-01-01", author="Other year")
    await _create(client, headers, author="Not finished")

    assert (await _stats(client, headers))["top_authors"] == [
        {"author": "Kalki", "count": 3},
        {"author": "Sujatha", "count": 2},
        {"author": "Abdul", "count": 1},
    ]


async def test_top_authors_are_limited_to_five(client: AsyncClient, headers: dict[str, str]) -> None:
    for number in range(7):
        await _finished(client, headers, "2026-01-01", author=f"Author {number}")

    assert len((await _stats(client, headers))["top_authors"]) == 5


async def test_gifted_by_is_all_time_most_first(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, gifted_by="Ravi")
    await _finished(client, headers, "2019-01-01", gifted_by="Ravi")
    await _create(client, headers, gifted_by="Arun")
    await _create(client, headers)

    assert (await _stats(client, headers))["gifted_by"] == [
        {"name": "Ravi", "count": 2},
        {"name": "Arun", "count": 1},
    ]


async def test_available_years_include_finished_years_this_year_and_the_one_asked_for(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _finished(client, headers, "2019-01-01")
    await _finished(client, headers, "2021-01-01")

    stats = await _stats(client, headers, 2000)

    assert stats["available_years"] == [THIS_YEAR, 2021, 2019, 2000]


async def test_each_user_sees_only_their_own_stats(make_client: Callable[[], AsyncClient]) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        await _finished(owner, owner_headers, "2026-01-01", page_count=100, gifted_by="Ravi")
        await _stats(owner, owner_headers)

        stats = await _stats(other, other_headers)

        assert stats["total_books"] == 0
        assert stats["pages_read_this_year"] == 0
        assert stats["gifted_by"] == []
        assert stats["available_years"] == sorted({THIS_YEAR, 2026}, reverse=True)


async def test_repeat_requests_are_served_from_the_cache(
    client: AsyncClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    await _finished(client, headers, "2026-01-01")
    first = await _stats(client, headers)

    async def must_not_run(*_: object) -> None:
        raise AssertionError("The stats should have come from the cache")

    monkeypatch.setattr(stats_service, "_calculate", must_not_run)

    assert await _stats(client, headers) == first


async def test_each_year_is_cached_separately(client: AsyncClient, headers: dict[str, str]) -> None:
    await _finished(client, headers, "2026-01-01")
    await _finished(client, headers, "2025-01-01")
    await _finished(client, headers, "2025-02-01")

    assert (await _stats(client, headers, 2026))["finished_this_year"] == 1
    assert (await _stats(client, headers, 2025))["finished_this_year"] == 2
    assert (await _stats(client, headers, 2026))["finished_this_year"] == 1


async def test_cached_entries_expire(client: AsyncClient, headers: dict[str, str], redis: Redis) -> None:
    await _stats(client, headers)

    keys = [key async for key in redis.scan_iter("stats:1:*")]

    assert keys
    assert 0 < await redis.ttl(keys[0]) <= 3600


async def test_adding_a_book_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    await _stats(client, headers)

    await _finished(client, headers, "2026-01-01", page_count=100)

    assert (await _stats(client, headers))["pages_read_this_year"] == 100


async def test_editing_a_book_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _finished(client, headers, "2026-01-01", page_count=100)
    await _stats(client, headers)

    await client.patch(f"{BOOKS}/{book['id']}", json={"page_count": 150}, headers=headers)

    assert (await _stats(client, headers))["pages_read_this_year"] == 150


async def test_deleting_a_book_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _finished(client, headers, "2026-01-01")
    await _stats(client, headers)

    await client.delete(f"{BOOKS}/{book['id']}", headers=headers)

    assert (await _stats(client, headers))["total_books"] == 0


async def test_reset_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _finished(client, headers, "2026-01-01")
    await _stats(client, headers)

    await client.post(f"{BOOKS}/{book['id']}/reset", headers=headers)

    stats = await _stats(client, headers)
    assert stats["finished_this_year"] == 0
    assert stats["to_read"] == 1


async def test_starting_a_book_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)
    await _stats(client, headers)

    await client.post(f"{BOOKS}/{book['id']}/start", headers=headers)

    assert (await _stats(client, headers))["currently_reading"] == 1


async def test_finishing_a_book_updates_the_stats(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading", page_count=80)
    await _stats(client, headers, THIS_YEAR)

    await client.post(f"{BOOKS}/{book['id']}/finish", json={}, headers=headers)

    stats = await _stats(client, headers, THIS_YEAR)
    assert stats["finished_this_year"] == 1
    assert stats["pages_read_this_year"] == 80


async def test_updating_the_page_does_not_empty_the_cache(
    client: AsyncClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    book = await _create(client, headers, status="reading")
    await _stats(client, headers)

    await client.post(f"{BOOKS}/{book['id']}/progress", json={"current_page": 5}, headers=headers)

    async def must_not_run(*_: object) -> None:
        raise AssertionError("A page update should not recalculate the stats")

    monkeypatch.setattr(stats_service, "_calculate", must_not_run)
    await _stats(client, headers)


async def test_one_users_change_keeps_another_users_cache(
    make_client: Callable[[], AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        await _stats(other, other_headers)

        await _create(owner, owner_headers)

        async def must_not_run(*_: object) -> None:
            raise AssertionError("Another user's change should not affect this cache")

        monkeypatch.setattr(stats_service, "_calculate", must_not_run)
        await _stats(other, other_headers)


async def test_enrichment_updates_the_pages_read(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    book = await _finished(
        client, headers, "2026-01-01", page_count=None, title="Atomic Habits", author="James Clear"
    )
    assert (await _stats(client, headers))["pages_read_this_year"] == 0
    fake_open_library.docs = [
        {
            "key": "/works/OL1W",
            "title": "Atomic Habits",
            "author_name": ["James Clear"],
            "number_of_pages_median": 320,
        }
    ]

    await enrich_book(session, redis, book["id"])

    assert (await _stats(client, headers))["pages_read_this_year"] == 320


async def test_a_change_during_the_calculation_cannot_leave_stale_stats(
    client: AsyncClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    await _finished(client, headers, "2026-01-01", page_count=100)
    original = stats_service._calculate

    async def calculate_then_book_changes(*args: object) -> object:
        result = await original(*args)
        await _finished(client, headers, "2026-02-01", page_count=50)
        return result

    monkeypatch.setattr(stats_service, "_calculate", calculate_then_book_changes)
    await _stats(client, headers)
    monkeypatch.setattr(stats_service, "_calculate", original)

    assert (await _stats(client, headers))["pages_read_this_year"] == 150


async def test_stats_and_book_changes_work_when_redis_is_down(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    unreachable = Redis(host="localhost", port=1, socket_connect_timeout=0.1)
    app.dependency_overrides[get_redis] = lambda: unreachable

    await _finished(client, headers, "2026-01-01", page_count=100)

    assert (await _stats(client, headers))["pages_read_this_year"] == 100
    await unreachable.aclose()


async def test_a_cache_write_failure_still_returns_the_stats(
    client: AsyncClient, headers: dict[str, str], redis: Redis, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fail(*_: object, **__: object) -> None:
        raise RedisError("write failed")

    monkeypatch.setattr(redis, "set", fail)

    assert (await _stats(client, headers))["total_books"] == 0
