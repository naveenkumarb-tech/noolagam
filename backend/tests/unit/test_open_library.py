import pytest

from app.services import open_library
from app.services.open_library import is_same_author, is_same_title
from tests.conftest import FakeOpenLibrary

ISBN = "9780735211292"
WORK = "/works/OL1W"


async def test_lookup_combines_search_and_edition(fake_open_library: FakeOpenLibrary) -> None:
    fake_open_library.docs = [
        {"key": WORK, "title": "O Alquimista", "author_name": ["Paulo Coelho"], "cover_i": 7,
         "number_of_pages_median": 197}
    ]  # fmt: skip
    fake_open_library.edition = {"title": "The Alchemist", "works": [{"key": WORK}]}
    fake_open_library.works[WORK] = {"description": "A shepherd's journey."}

    details = await open_library.lookup_by_isbn(ISBN)

    assert details is not None
    assert details.title == "The Alchemist"
    assert details.author == "Paulo Coelho"
    assert details.page_count == 197
    assert details.cover_url == "https://covers.openlibrary.org/b/id/7-M.jpg?default=false"
    assert details.description == "A shepherd's journey."


async def test_edition_details_win_when_present(fake_open_library: FakeOpenLibrary) -> None:
    fake_open_library.docs = [{"key": WORK, "author_name": ["Search Author"], "cover_i": 7,
                               "number_of_pages_median": 100}]  # fmt: skip
    fake_open_library.edition = {
        "title": "Edition", "authors": [{"name": "Edition Author"}], "number_of_pages": 222, "covers": [9],
        "description": {"type": "/type/text", "value": " Edition text "},
    }  # fmt: skip

    details = await open_library.lookup_by_isbn(ISBN)

    assert details is not None
    assert details.author == "Edition Author"
    assert details.page_count == 222
    assert details.cover_url == "https://covers.openlibrary.org/b/id/9-M.jpg?default=false"
    assert details.description == "Edition text"


async def test_lookup_works_with_only_an_edition(fake_open_library: FakeOpenLibrary) -> None:
    fake_open_library.edition = {"title": "Only edition", "covers": [-1]}

    details = await open_library.lookup_by_isbn(ISBN)

    assert details is not None
    assert details.title == "Only edition"
    assert details.author is None
    assert details.cover_url is None


async def test_lookup_returns_none_when_nothing_is_found(fake_open_library: FakeOpenLibrary) -> None:
    assert await open_library.lookup_by_isbn(ISBN) is None


async def test_a_failed_description_request_does_not_lose_the_rest(
    fake_open_library: FakeOpenLibrary,
) -> None:
    fake_open_library.docs = [{"key": WORK, "title": "Found"}]

    details = await open_library.lookup_by_isbn(ISBN)

    assert details is not None
    assert details.title == "Found"
    assert details.description is None


@pytest.mark.parametrize("failure", ["status", "connection"])
async def test_outages_raise_a_clear_error(fake_open_library: FakeOpenLibrary, failure: str) -> None:
    fake_open_library.error_status = 503 if failure == "status" else None
    fake_open_library.connection_fails = failure == "connection"

    with pytest.raises(open_library.OpenLibraryUnavailableError):
        await open_library.lookup_by_isbn(ISBN)


async def test_find_match_skips_results_that_are_not_close(fake_open_library: FakeOpenLibrary) -> None:
    fake_open_library.docs = [
        {"key": "/works/OL2W", "title": "Wings of Fire", "author_name": ["Someone Else"], "cover_i": 1},
        {"key": "/works/OL3W", "title": "Wings of Desire", "author_name": ["Kalam"], "cover_i": 2},
        {"key": WORK, "title": "Wings of fire", "author_name": ["A. P. J. Abdul Kalam"], "cover_i": 3},
    ]

    details = await open_library.find_match("Wings of Fire", "Kalam")

    assert details is not None
    assert details.cover_url == "https://covers.openlibrary.org/b/id/3-M.jpg?default=false"


async def test_find_match_returns_none_rather_than_a_wrong_book(fake_open_library: FakeOpenLibrary) -> None:
    fake_open_library.docs = [{"key": WORK, "title": "Another Book", "author_name": ["Kalki"], "cover_i": 3}]

    assert await open_library.find_match("Ponniyin Selvan", "Kalki") is None


@pytest.mark.parametrize(
    ("wanted", "found"),
    [
        ("Atomic Habits", "atomic habits"),
        ("Atomic Habits", "Atomic Habits: An Easy Way to Build Good Habits"),
        ("The Alchemist.", "The Alchemist"),
        ("பொன்னியின் செல்வன்", "பொன்னியின் செல்வன்"),
        ("Thirukural", "Thirukkural"),
    ],
)
def test_same_titles(wanted: str, found: str) -> None:
    assert is_same_title(wanted, found)


@pytest.mark.parametrize(
    ("wanted", "found"),
    [
        ("Ponniyin Selvan – Part 2", "Ponniyin Selvan"),
        ("Ponniyin Selvan Part 1", "Ponniyin Selvan Part 2"),
        ("Wings of Fire", "Wings of Desire"),
        ("Atomic Habits", ""),
    ],
)
def test_different_titles(wanted: str, found: str) -> None:
    assert not is_same_title(wanted, found)


@pytest.mark.parametrize(
    ("wanted", "found"),
    [("Kalam", "A. P. J. Abdul Kalam"), ("James Clear", "JAMES CLEAR"), ("Thiruvalluvar", "Tiruvalluvar")],
)
def test_same_authors(wanted: str, found: str) -> None:
    assert is_same_author(wanted, found)


@pytest.mark.parametrize(("wanted", "found"), [("Kalki", "Sujatha"), ("", "Kalki"), ("...", "Kalki")])
def test_different_authors(wanted: str, found: str) -> None:
    assert not is_same_author(wanted, found)
