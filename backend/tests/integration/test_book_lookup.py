import pytest
from httpx import AsyncClient

from tests.conftest import FakeOpenLibrary
from tests.helpers import assert_error, auth_headers

LOOKUP = "/api/v1/books/lookup"
BOOKS = "/api/v1/books"
ISBN = "9780735211292"


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def test_lookup_requires_login(client: AsyncClient) -> None:
    assert_error(await client.get(LOOKUP, params={"isbn": ISBN}), 401, "NOT_AUTHENTICATED")


async def test_lookup_returns_details_and_the_clean_isbn(
    client: AsyncClient, headers: dict[str, str], fake_open_library: FakeOpenLibrary
) -> None:
    fake_open_library.docs = [
        {"key": "/works/OL1W", "title": "Atomic Habits", "author_name": ["James Clear"], "cover_i": 5,
         "number_of_pages_median": 320}
    ]  # fmt: skip

    response = await client.get(LOOKUP, params={"isbn": "978-0-7352-1129-2"}, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "isbn": ISBN,
        "title": "Atomic Habits",
        "author": "James Clear",
        "page_count": 320,
        "cover_url": "https://covers.openlibrary.org/b/id/5-M.jpg?default=false",
        "description": None,
    }


async def test_lookup_rejects_an_invalid_isbn_without_calling_out(
    client: AsyncClient, headers: dict[str, str], fake_open_library: FakeOpenLibrary
) -> None:
    response = await client.get(LOOKUP, params={"isbn": "9780735211293"}, headers=headers)

    assert_error(response, 422, "VALIDATION_ERROR")
    assert fake_open_library.requests == []


async def test_lookup_not_found(client: AsyncClient, headers: dict[str, str]) -> None:
    assert_error(
        await client.get(LOOKUP, params={"isbn": ISBN}, headers=headers), 404, "BOOK_LOOKUP_NOT_FOUND"
    )


async def test_lookup_explains_an_outage(
    client: AsyncClient, headers: dict[str, str], fake_open_library: FakeOpenLibrary
) -> None:
    fake_open_library.connection_fails = True

    response = await client.get(LOOKUP, params={"isbn": ISBN}, headers=headers)

    assert_error(response, 503, "BOOK_LOOKUP_UNAVAILABLE")


async def test_create_keeps_details_from_a_lookup(client: AsyncClient, headers: dict[str, str]) -> None:
    payload = {
        "title": "Atomic Habits",
        "author": "James Clear",
        "isbn": "978-0-7352-1129-2",
        "cover_url": "https://covers.openlibrary.org/b/id/5-M.jpg?default=false",
        "description": "Tiny changes.",
    }

    book = (await client.post(BOOKS, json=payload, headers=headers)).json()

    assert book["isbn"] == ISBN
    assert book["cover_url"] == payload["cover_url"]
    assert book["description"] == "Tiny changes."


@pytest.mark.parametrize(
    "fields",
    [
        {"isbn": "12345"},
        {"cover_url": "http://example.com/cover.jpg"},
        {"cover_url": "javascript:alert(1)"},
        {"description": "x" * 20_001},
        {"page_count": 100_001},
    ],
)
async def test_create_rejects_unsafe_or_invalid_values(
    client: AsyncClient, headers: dict[str, str], fields: dict[str, object]
) -> None:
    payload = {"title": "t", "author": "a", **fields}

    assert_error(await client.post(BOOKS, json=payload, headers=headers), 422, "VALIDATION_ERROR")


async def test_progress_cannot_exceed_the_database_range(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = (
        await client.post(BOOKS, json={"title": "t", "author": "a", "status": "reading"}, headers=headers)
    ).json()

    response = await client.post(
        f"{BOOKS}/{book['id']}/progress", json={"current_page": 10_000_000_000}, headers=headers
    )

    assert_error(response, 422, "VALIDATION_ERROR")
