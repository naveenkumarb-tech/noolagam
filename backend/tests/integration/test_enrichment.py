import pytest
from httpx import AsyncClient
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book
from app.services.enrichment import enrich_book
from app.services.open_library import OpenLibraryUnavailableError
from tests.conftest import FakeOpenLibrary
from tests.helpers import auth_headers

ISBN = "9780735211292"
BOOKS = "/api/v1/books"
WORK = "/works/OL1W"


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _create(client: AsyncClient, headers: dict[str, str], **fields: object) -> int:
    payload = {"title": "Atomic Habits", "author": "James Clear", **fields}
    response = await client.post(BOOKS, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _book(session: AsyncSession, book_id: int) -> Book:
    session.expire_all()
    return (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()


def _found(fake: FakeOpenLibrary, pages: int = 320) -> None:
    fake.docs = [
        {"key": WORK, "title": "Atomic Habits", "author_name": ["James Clear"], "cover_i": 5,
         "number_of_pages_median": pages}
    ]  # fmt: skip
    fake.works[WORK] = {"description": "Tiny changes."}


async def test_adding_a_book_queues_enrichment(
    client: AsyncClient, headers: dict[str, str], queued_enrichments: list[int]
) -> None:
    book_id = await _create(client, headers)

    assert queued_enrichments == [book_id]


async def test_fills_empty_details_by_isbn(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers, isbn=ISBN)

    await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.cover_url == "https://covers.openlibrary.org/b/id/5-M.jpg?default=false"
    assert book.description == "Tiny changes."
    assert book.page_count == 320
    assert "ISBN" in str(fake_open_library.requests[0].url) or "isbn" in str(
        fake_open_library.requests[0].url
    )


async def test_without_an_isbn_it_searches_by_title_and_author(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers)

    await enrich_book(session, redis, book_id)

    assert (await _book(session, book_id)).page_count == 320
    assert fake_open_library.requests[0].url.params["title"] == "Atomic Habits"


async def test_refreshes_the_search_vector(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers)

    await enrich_book(session, redis, book_id)

    vector = await session.scalar(select(Book.search_vector).where(Book.id == book_id))
    assert "tiny" in vector


async def test_never_overwrites_what_the_user_entered(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers, page_count=99, description="My words")

    await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.page_count == 99
    assert book.description == "My words"
    assert book.cover_url is not None


async def test_running_twice_changes_nothing_more(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers)
    await enrich_book(session, redis, book_id)
    calls = len(fake_open_library.requests)

    await enrich_book(session, redis, book_id)

    assert len(fake_open_library.requests) == calls


async def test_skips_a_page_count_lower_than_the_current_page(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library, pages=100)
    book_id = await _create(client, headers, status="reading")
    await client.post(f"{BOOKS}/{book_id}/progress", json={"current_page": 150}, headers=headers)

    await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.page_count is None
    assert book.current_page == 150
    assert book.cover_url is not None


async def test_a_finished_book_shows_as_fully_read_once_its_pages_are_known(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    _found(fake_open_library)
    book_id = await _create(client, headers, status="finished")

    await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.page_count == book.current_page == 320


async def test_outage_raises_for_a_retry_and_the_book_stays_saved(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis: Redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    fake_open_library.error_status = 503
    book_id = await _create(client, headers, isbn=ISBN)

    with pytest.raises(OpenLibraryUnavailableError):
        await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.title == "Atomic Habits"
    assert book.cover_url is None


async def test_nothing_found_leaves_the_book_as_it_was(
    client: AsyncClient, headers: dict[str, str], session: AsyncSession, redis: Redis
) -> None:
    book_id = await _create(client, headers)

    await enrich_book(session, redis, book_id)

    book = await _book(session, book_id)
    assert book.cover_url is None
    assert book.page_count is None


async def test_a_deleted_book_is_ignored(
    session: AsyncSession, redis: Redis, fake_open_library: FakeOpenLibrary
) -> None:
    await enrich_book(session, redis, 999)

    assert fake_open_library.requests == []
