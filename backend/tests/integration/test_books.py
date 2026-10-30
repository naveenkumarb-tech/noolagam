from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book
from tests.helpers import assert_error, auth_headers

BOOKS = "/api/v1/books"
TODAY = datetime.now(UTC).date()


def _iso(value: date) -> str:
    return value.isoformat()


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _create(client: AsyncClient, headers: dict[str, str], **fields: object) -> dict:
    payload = {"title": "Wings of Fire", "author": "Kalam", "page_count": 200, **fields}
    response = await client.post(BOOKS, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _action(
    client: AsyncClient, headers: dict[str, str], book_id: int, action: str, **body: object
) -> Response:
    return await client.post(f"{BOOKS}/{book_id}/{action}", json=body, headers=headers)


async def test_books_require_login(client: AsyncClient) -> None:
    for response in (
        await client.get(BOOKS),
        await client.post(BOOKS, json={"title": "x", "author": "y"}),
        await client.get(f"{BOOKS}/current"),
        await client.get(f"{BOOKS}/counts"),
        await client.post(f"{BOOKS}/1/start"),
    ):
        assert_error(response, 401, "NOT_AUTHENTICATED")


async def test_create_defaults_to_to_read_and_hides_internal_fields(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers, gifted_by="  Ravi ", isbn="  ")

    assert book["status"] == "to_read"
    assert book["current_page"] == 0
    assert book["progress_percent"] == 0
    assert book["gifted_by"] == "Ravi"
    assert book["isbn"] is None
    assert book["started_at"] is None
    assert "search_vector" not in book
    assert "user_id" not in book


@pytest.mark.parametrize(
    "fields",
    [
        {"title": "  "},
        {"author": ""},
        {"page_count": 0},
        {"page_count": -1},
        {"rating": 6},
        {"status": "lost"},
    ],
)
async def test_create_validates_input(
    client: AsyncClient, headers: dict[str, str], fields: dict[str, object]
) -> None:
    payload = {"title": "t", "author": "a", "status": "finished", **fields}

    assert_error(await client.post(BOOKS, json=payload, headers=headers), 422, "VALIDATION_ERROR")


async def test_create_as_reading_sets_the_start_date(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading")

    assert book["status"] == "reading"
    assert book["started_at"] == _iso(TODAY)


async def test_create_as_finished_can_backfill_old_dates(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(
        client, headers, status="finished", started_at="2019-03-01", finished_at="2019-04-01", rating=4
    )

    assert book["started_at"] == "2019-03-01"
    assert book["finished_at"] == "2019-04-01"
    assert book["current_page"] == 200
    assert book["progress_percent"] == 100
    assert book["rating"] == 4


@pytest.mark.parametrize(
    ("fields", "code"),
    [
        ({"rating": 4}, "RATING_NOT_ALLOWED"),
        ({"status": "reading", "rating": 4}, "RATING_NOT_ALLOWED"),
        ({"started_at": "2020-01-01"}, "INVALID_BOOK_DATE"),
        ({"status": "reading", "finished_at": "2020-01-01"}, "INVALID_BOOK_DATE"),
        (
            {"status": "finished", "started_at": "2020-02-01", "finished_at": "2020-01-01"},
            "INVALID_BOOK_DATE",
        ),
    ],
)
async def test_create_rejects_inconsistent_values(
    client: AsyncClient, headers: dict[str, str], fields: dict[str, object], code: str
) -> None:
    payload = {"title": "t", "author": "a", **fields}

    assert_error(await client.post(BOOKS, json=payload, headers=headers), 422, code)


async def test_start_sets_status_and_date(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)

    response = await _action(client, headers, book["id"], "start")

    assert response.status_code == 200
    assert response.json()["status"] == "reading"
    assert response.json()["started_at"] == _iso(TODAY)


async def test_start_works_without_a_body(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)

    response = await client.post(f"{BOOKS}/{book['id']}/start", headers=headers)

    assert response.json()["status"] == "reading"


async def test_start_uses_the_date_from_the_client(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)
    tomorrow = _iso(TODAY + timedelta(days=1))

    response = await _action(client, headers, book["id"], "start", started_at=tomorrow)

    assert response.json()["started_at"] == tomorrow


async def test_start_rejects_a_date_far_in_the_future(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)
    future = _iso(TODAY + timedelta(days=2))

    assert_error(
        await _action(client, headers, book["id"], "start", started_at=future), 422, "INVALID_BOOK_DATE"
    )


async def test_starting_again_keeps_the_original_date(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading", started_at="2020-01-01")

    response = await _action(client, headers, book["id"], "start")

    assert response.json()["started_at"] == "2020-01-01"


async def test_finished_book_cannot_be_started(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="finished")

    assert_error(await _action(client, headers, book["id"], "start"), 409, "INVALID_STATUS_TRANSITION")


async def test_progress_updates_the_page_and_percent(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading", page_count=420)

    response = await _action(client, headers, book["id"], "progress", current_page=186)

    assert response.json()["current_page"] == 186
    assert response.json()["progress_percent"] == 44


async def test_progress_cannot_pass_the_page_count(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading")

    response = await _action(client, headers, book["id"], "progress", current_page=201)

    assert_error(response, 422, "PAGE_EXCEEDS_TOTAL")


async def test_progress_without_a_page_count_has_no_percent(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _create(client, headers, status="reading", page_count=None)

    response = await _action(client, headers, book["id"], "progress", current_page=5000)

    assert response.json()["current_page"] == 5000
    assert response.json()["progress_percent"] is None


async def test_progress_rejects_negative_pages(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading")

    response = await _action(client, headers, book["id"], "progress", current_page=-1)

    assert_error(response, 422, "VALIDATION_ERROR")


@pytest.mark.parametrize("status", ["to_read", "finished"])
async def test_progress_needs_a_book_being_read(
    client: AsyncClient, headers: dict[str, str], status: str
) -> None:
    book = await _create(client, headers, status=status)

    response = await _action(client, headers, book["id"], "progress", current_page=1)

    assert_error(response, 409, "INVALID_STATUS_TRANSITION")


async def test_finish_fills_in_the_details(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading", started_at="2020-01-01")

    response = await _action(client, headers, book["id"], "finish", rating=5)

    finished = response.json()
    assert finished["status"] == "finished"
    assert finished["finished_at"] == _iso(TODAY)
    assert finished["started_at"] == "2020-01-01"
    assert finished["current_page"] == 200
    assert finished["rating"] == 5


async def test_finishing_a_to_read_book_sets_both_dates(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers)

    finished = (await _action(client, headers, book["id"], "finish")).json()

    assert finished["started_at"] == finished["finished_at"] == _iso(TODAY)
    assert finished["rating"] is None


async def test_finish_before_the_start_date_is_rejected(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="reading", started_at="2020-02-01")

    response = await _action(client, headers, book["id"], "finish", finished_at="2020-01-01")

    assert_error(response, 422, "INVALID_BOOK_DATE")


async def test_finishing_again_only_changes_the_rating(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _create(client, headers, status="finished", finished_at="2020-01-01", rating=3)

    updated = (
        await _action(client, headers, book["id"], "finish", finished_at="2021-01-01", rating=5)
    ).json()

    assert updated["rating"] == 5
    assert updated["finished_at"] == "2020-01-01"


async def test_more_than_one_book_can_be_read_at_once(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, title="Older", status="reading", started_at="2020-01-01")
    await _create(client, headers, title="Newer", status="reading", started_at="2021-01-01")
    await _create(client, headers, title="Not started")

    response = await client.get(f"{BOOKS}/current", headers=headers)

    assert [book["title"] for book in response.json()] == ["Newer", "Older"]


async def test_counts(client: AsyncClient, headers: dict[str, str]) -> None:
    await _create(client, headers, gifted_by="Ravi")
    await _create(client, headers)
    await _create(client, headers, status="reading", gifted_by="Priya")
    await _create(client, headers, status="finished")

    response = await client.get(f"{BOOKS}/counts", headers=headers)

    assert response.json() == {"total": 4, "to_read": 2, "reading": 1, "finished": 1, "gifted": 2}


async def test_counts_for_a_new_user_are_zero(client: AsyncClient, headers: dict[str, str]) -> None:
    response = await client.get(f"{BOOKS}/counts", headers=headers)

    assert response.json() == {"total": 0, "to_read": 0, "reading": 0, "finished": 0, "gifted": 0}


async def test_list_shows_newest_first_with_status_filter_and_pages(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    for number in range(3):
        await _create(client, headers, title=f"To read {number}")
    await _create(client, headers, title="Being read", status="reading")

    newest = (await client.get(BOOKS, params={"per_page": 1}, headers=headers)).json()
    second_page = (
        await client.get(BOOKS, params={"status": "to_read", "per_page": 2, "page": 2}, headers=headers)
    ).json()

    assert newest["total"] == 4
    assert [book["title"] for book in newest["items"]] == ["Being read"]
    assert second_page["total"] == 3
    assert second_page["page"] == 2
    assert [book["title"] for book in second_page["items"]] == ["To read 0"]


@pytest.mark.parametrize("params", [{"status": "lost"}, {"page": 0}, {"per_page": 101}, {"sort": "price"}])
async def test_list_validates_parameters(
    client: AsyncClient, headers: dict[str, str], params: dict[str, object]
) -> None:
    assert_error(await client.get(BOOKS, params=params, headers=headers), 422, "VALIDATION_ERROR")


async def test_users_cannot_see_or_change_each_others_books(
    make_client: Callable[[], AsyncClient],
) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        book = await _create(owner, owner_headers, status="reading", gifted_by="Ravi")

        assert (await other.get(BOOKS, headers=other_headers)).json()["total"] == 0
        assert (await other.get(f"{BOOKS}/current", headers=other_headers)).json() == []
        assert (await other.get(f"{BOOKS}/counts", headers=other_headers)).json()["total"] == 0
        for action, body in (("start", {}), ("progress", {"current_page": 1}), ("finish", {})):
            response = await _action(other, other_headers, book["id"], action, **body)
            assert_error(response, 404, "BOOK_NOT_FOUND")

        current = (await owner.get(f"{BOOKS}/current", headers=owner_headers)).json()
        assert current[0]["current_page"] == 0


async def test_unknown_book_is_not_found(client: AsyncClient, headers: dict[str, str]) -> None:
    assert_error(await _action(client, headers, 999, "start"), 404, "BOOK_NOT_FOUND")


async def test_search_vector_is_generated_by_the_database(
    client: AsyncClient, headers: dict[str, str], session: AsyncSession
) -> None:
    await _create(client, headers, title="Ponniyin Selvan", author="Kalki")

    vector = await session.scalar(select(Book.search_vector))

    assert "ponniyin" in vector
    assert "kalki" in vector
