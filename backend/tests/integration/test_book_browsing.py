from collections.abc import Callable

import pytest
from httpx import AsyncClient

from tests.helpers import assert_error, auth_headers

BOOKS = "/api/v1/books"
SEARCH = "/api/v1/search"


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _create(
    client: AsyncClient, headers: dict[str, str], title: str, author: str = "A", **fields: object
) -> int:
    response = await client.post(BOOKS, json={"title": title, "author": author, **fields}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _titles(
    client: AsyncClient, headers: dict[str, str], path: str = BOOKS, **params: object
) -> list[str]:
    response = await client.get(path, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [book["title"] for book in response.json()["items"]]


async def test_filter_by_author_and_gifted_by_can_be_combined(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _create(client, headers, "One", "Kalki", gifted_by="Ravi")
    await _create(client, headers, "Two", "Kalki")
    await _create(client, headers, "Three", "Sujatha", gifted_by="Ravi")

    assert sorted(await _titles(client, headers, author="Kalki")) == ["One", "Two"]
    assert sorted(await _titles(client, headers, gifted_by="Ravi")) == ["One", "Three"]
    assert await _titles(client, headers, author="Kalki", gifted_by="Ravi") == ["One"]


async def test_filters_combine_with_status(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "Reading", "Kalki", status="reading")
    await _create(client, headers, "Waiting", "Kalki")

    assert await _titles(client, headers, author="Kalki", status="reading") == ["Reading"]


async def test_sort_by_title_and_author(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "banana", "Zed")
    await _create(client, headers, "Apple", "Mid")
    await _create(client, headers, "Cherry", "Art")

    assert await _titles(client, headers, sort="title") == ["Apple", "banana", "Cherry"]
    assert await _titles(client, headers, sort="author") == ["Cherry", "Apple", "banana"]


async def test_sort_by_finish_date_puts_unfinished_books_last(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _create(client, headers, "Unread")
    await _create(client, headers, "Older", status="finished", finished_at="2020-01-01")
    await _create(client, headers, "Newer", status="finished", finished_at="2021-01-01")

    assert await _titles(client, headers, sort="finished") == ["Newer", "Older", "Unread"]


async def test_sort_is_stable_across_pages(client: AsyncClient, headers: dict[str, str]) -> None:
    for _ in range(5):
        await _create(client, headers, "Same title")

    seen: list[int] = []
    for page in (1, 2, 3):
        response = await client.get(
            BOOKS, params={"sort": "title", "per_page": 2, "page": page}, headers=headers
        )
        seen += [book["id"] for book in response.json()["items"]]

    assert sorted(seen) == [1, 2, 3, 4, 5]


async def test_facets_list_each_value_once_in_order(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "One", "Sujatha", gifted_by="Ravi")
    await _create(client, headers, "Two", "Kalki", gifted_by="Ravi")
    await _create(client, headers, "Three", "Kalki", gifted_by="Arun")
    await _create(client, headers, "Four", "Kalki")

    response = await client.get(f"{BOOKS}/facets", headers=headers)

    assert response.json() == {"authors": ["Kalki", "Sujatha"], "gifted_by": ["Arun", "Ravi"]}


async def test_search_requires_login(client: AsyncClient) -> None:
    assert_error(await client.get(SEARCH, params={"q": "x"}), 401, "NOT_AUTHENTICATED")


@pytest.mark.parametrize("q", ["", "   ", "x" * 201])
async def test_search_validates_the_query(client: AsyncClient, headers: dict[str, str], q: str) -> None:
    assert_error(await client.get(SEARCH, params={"q": q}, headers=headers), 422, "VALIDATION_ERROR")


async def test_search_finds_title_author_and_description(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _create(client, headers, "Wings of Fire", "Kalam")
    await _create(client, headers, "Atomic Habits", "James Clear")
    await _create(client, headers, "Other", "Someone", description="A story about fire and dragons")

    assert await _titles(client, headers, SEARCH, q="kalam") == ["Wings of Fire"]
    assert await _titles(client, headers, SEARCH, q="ATOMIC") == ["Atomic Habits"]
    assert await _titles(client, headers, SEARCH, q="dragons") == ["Other"]


async def test_search_ranks_title_above_author_above_description(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    await _create(client, headers, "In description", "Someone", description="a book about kalki")
    await _create(client, headers, "By author", "Kalki")
    await _create(client, headers, "Kalki in title", "Someone")

    assert await _titles(client, headers, SEARCH, q="kalki") == [
        "Kalki in title",
        "By author",
        "In description",
    ]


async def test_search_matches_the_last_word_as_you_type(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "Ponniyin Selvan", "Kalki")

    assert await _titles(client, headers, SEARCH, q="pon") == ["Ponniyin Selvan"]
    assert await _titles(client, headers, SEARCH, q="ponniyin sel") == ["Ponniyin Selvan"]
    assert await _titles(client, headers, SEARCH, q="xyz") == []


@pytest.mark.parametrize("q", ["!!!", "'", "a & b | c", "kalki:*", "\\", "foo)(", "'; DROP TABLE books; --"])
async def test_search_is_safe_with_any_input(client: AsyncClient, headers: dict[str, str], q: str) -> None:
    await _create(client, headers, "Ponniyin Selvan", "Kalki")

    response = await client.get(SEARCH, params={"q": q}, headers=headers)

    assert response.status_code == 200


async def test_search_combines_with_filters_and_pages(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "Kalki one", status="reading")
    await _create(client, headers, "Kalki two")
    await _create(client, headers, "Kalki three", gifted_by="Ravi")

    assert await _titles(client, headers, SEARCH, q="kalki", status="reading") == ["Kalki one"]
    assert await _titles(client, headers, SEARCH, q="kalki", gifted_by="Ravi") == ["Kalki three"]
    response = await client.get(SEARCH, params={"q": "kalki", "per_page": 2, "page": 2}, headers=headers)
    assert response.json()["total"] == 3
    assert len(response.json()["items"]) == 1


async def test_search_finds_tamil_text(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, "பொன்னியின் செல்வன்", "கல்கி")
    await _create(client, headers, "திருக்குறள்", "திருவள்ளுவர்")
    await _create(client, headers, "Wings of Fire", "Kalam")

    assert await _titles(client, headers, SEARCH, q="செல்வன்") == ["பொன்னியின் செல்வன்"]
    assert await _titles(client, headers, SEARCH, q="கல்கி") == ["பொன்னியின் செல்வன்"]
    assert await _titles(client, headers, SEARCH, q="பொன்னியின் செல்வன்") == ["பொன்னியின் செல்வன்"]
    assert await _titles(client, headers, SEARCH, q="திருக்குறள்") == ["திருக்குறள்"]
    assert await _titles(client, headers, SEARCH, q="பொன்") == ["பொன்னியின் செல்வன்"]


async def test_users_only_search_and_browse_their_own_books(make_client: Callable[[], AsyncClient]) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        await _create(owner, owner_headers, "Secret", "Kalki", gifted_by="Ravi")

        assert await _titles(other, other_headers, SEARCH, q="secret") == []
        assert await _titles(other, other_headers, author="Kalki") == []
        facets = (await other.get(f"{BOOKS}/facets", headers=other_headers)).json()
        assert facets == {"authors": [], "gifted_by": []}
