from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from tests.helpers import assert_error, auth_headers

BOOKS = "/api/v1/books"


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _create(client: AsyncClient, headers: dict[str, str], **fields: object) -> dict:
    payload = {"title": "Wings of Fire", "author": "Kalam", "page_count": 200, **fields}
    response = await client.post(BOOKS, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _patch(client: AsyncClient, headers: dict[str, str], book_id: int, **fields: object):
    return await client.patch(f"{BOOKS}/{book_id}", json=fields, headers=headers)


async def test_get_one_book(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)

    response = await client.get(f"{BOOKS}/{book['id']}", headers=headers)

    assert response.json() == book


async def test_patch_changes_only_what_was_sent(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, gifted_by="Ravi")

    updated = (await _patch(client, headers, book["id"], title="  New title ", notes="Loved it")).json()

    assert updated["title"] == "New title"
    assert updated["notes"] == "Loved it"
    assert updated["author"] == "Kalam"
    assert updated["gifted_by"] == "Ravi"


async def test_patch_can_clear_optional_fields(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, gifted_by="Ravi", isbn="9780735211292")

    updated = (await _patch(client, headers, book["id"], gifted_by=None, isbn="", page_count=None)).json()

    assert updated["gifted_by"] is None
    assert updated["isbn"] is None
    assert updated["page_count"] is None
    assert updated["progress_percent"] is None


@pytest.mark.parametrize(
    "fields",
    [
        {"title": None},
        {"author": None},
        {"title": "  "},
        {"page_count": 0},
        {"isbn": "123"},
        {"notes": "x" * 20_001},
    ],
)
async def test_patch_validates_input(client: AsyncClient, headers: dict[str, str], fields: dict) -> None:
    book = await _create(client, headers)

    assert_error(await _patch(client, headers, book["id"], **fields), 422, "VALIDATION_ERROR")


async def test_patch_cannot_change_status_progress_or_rating(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers)

    updated = (await _patch(client, headers, book["id"], status="finished", current_page=50, rating=5)).json()

    assert updated["status"] == "to_read"
    assert updated["current_page"] == 0
    assert updated["rating"] is None


async def test_page_count_cannot_go_below_the_current_page(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers, status="reading")
    await client.post(f"{BOOKS}/{book['id']}/progress", json={"current_page": 150}, headers=headers)

    assert_error(await _patch(client, headers, book["id"], page_count=100), 422, "PAGE_EXCEEDS_TOTAL")
    assert (await _patch(client, headers, book["id"], page_count=150)).status_code == 200


async def test_changing_a_finished_books_pages_keeps_it_fully_read(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers, status="finished")

    updated = (await _patch(client, headers, book["id"], page_count=120)).json()

    assert updated["current_page"] == 120
    assert updated["progress_percent"] == 100


async def test_dates_can_be_corrected(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(
        client, headers, status="finished", started_at="2020-01-01", finished_at="2020-02-01"
    )

    updated = (
        await _patch(client, headers, book["id"], started_at="2019-01-01", finished_at="2019-02-01")
    ).json()

    assert updated["started_at"] == "2019-01-01"
    assert updated["finished_at"] == "2019-02-01"


@pytest.mark.parametrize(
    ("status", "fields"),
    [
        ("to_read", {"started_at": "2020-01-01"}),
        ("to_read", {"finished_at": "2020-01-01"}),
        ("reading", {"finished_at": "2020-01-01"}),
        ("reading", {"started_at": None}),
        ("finished", {"finished_at": None}),
        ("finished", {"started_at": "2999-01-01"}),
    ],
)
async def test_dates_must_fit_the_status(
    client: AsyncClient, headers: dict[str, str], status: str, fields: dict
) -> None:
    book = await _create(client, headers, status=status)

    assert_error(await _patch(client, headers, book["id"], **fields), 422, "INVALID_BOOK_DATE")


async def test_finish_date_cannot_be_before_the_start_date(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(
        client, headers, status="finished", started_at="2020-01-01", finished_at="2020-02-01"
    )

    assert_error(
        await _patch(client, headers, book["id"], finished_at="2019-01-01"), 422, "INVALID_BOOK_DATE"
    )


async def test_a_rejected_edit_saves_nothing(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading")
    future = (datetime.now(UTC).date() + timedelta(days=5)).isoformat()

    await _patch(client, headers, book["id"], title="Changed", started_at=future)

    assert (await client.get(f"{BOOKS}/{book['id']}", headers=headers)).json()["title"] == "Wings of Fire"


@pytest.mark.parametrize(
    ("fields", "should_queue"),
    [
        ({"title": "Corrected"}, True),
        ({"author": "Corrected"}, True),
        ({"isbn": "9780735211292"}, True),
        ({"notes": "Just a note"}, False),
        ({"gifted_by": "Ravi"}, False),
    ],
)
async def test_only_identity_changes_look_for_details_again(
    client: AsyncClient,
    headers: dict[str, str],
    queued_enrichments: list[int],
    fields: dict,
    should_queue: bool,
) -> None:
    book = await _create(client, headers)
    queued_enrichments.clear()

    await _patch(client, headers, book["id"], **fields)

    assert queued_enrichments == ([book["id"]] if should_queue else [])


async def test_reset_clears_dates_progress_and_rating_but_keeps_the_rest(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers, status="finished", rating=5, gifted_by="Ravi")
    await _patch(client, headers, book["id"], notes="Keep me")

    reset = (await client.post(f"{BOOKS}/{book['id']}/reset", headers=headers)).json()

    assert reset["status"] == "to_read"
    assert reset["started_at"] is None
    assert reset["finished_at"] is None
    assert reset["current_page"] == 0
    assert reset["rating"] is None
    assert reset["gifted_by"] == "Ravi"
    assert reset["notes"] == "Keep me"


async def test_a_reset_book_can_be_started_again(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="finished", started_at="2019-01-01")
    await client.post(f"{BOOKS}/{book['id']}/reset", headers=headers)

    started = (await client.post(f"{BOOKS}/{book['id']}/start", headers=headers)).json()

    assert started["status"] == "reading"
    assert started["started_at"] != "2019-01-01"


async def test_delete_removes_the_book(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)

    assert (await client.delete(f"{BOOKS}/{book['id']}", headers=headers)).status_code == 204

    assert_error(await client.get(f"{BOOKS}/{book['id']}", headers=headers), 404, "BOOK_NOT_FOUND")
    assert (await client.get(f"{BOOKS}/counts", headers=headers)).json()["total"] == 0


async def test_details_routes_are_private(make_client: Callable[[], AsyncClient]) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        book_id = (await _create(owner, owner_headers))["id"]
        url = f"{BOOKS}/{book_id}"

        assert_error(await other.get(url, headers=other_headers), 404, "BOOK_NOT_FOUND")
        assert_error(
            await other.patch(url, json={"title": "Mine"}, headers=other_headers), 404, "BOOK_NOT_FOUND"
        )
        assert_error(await other.delete(url, headers=other_headers), 404, "BOOK_NOT_FOUND")
        assert_error(await other.post(f"{url}/reset", headers=other_headers), 404, "BOOK_NOT_FOUND")

        assert (await owner.get(url, headers=owner_headers)).json()["title"] == "Wings of Fire"


async def test_details_routes_need_login(client: AsyncClient) -> None:
    for response in (
        await client.get(f"{BOOKS}/1"),
        await client.patch(f"{BOOKS}/1", json={}),
        await client.delete(f"{BOOKS}/1"),
        await client.post(f"{BOOKS}/1/reset"),
        await client.get(f"{BOOKS}/facets"),
    ):
        assert_error(response, 401, "NOT_AUTHENTICATED")
