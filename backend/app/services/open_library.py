import asyncio
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

import httpx

BASE_URL = "https://openlibrary.org"
# Without default=false, a missing cover is a 200 response with an invisible 1x1 image,
# so the app could never tell that it should show its placeholder instead.
COVER_URL = "https://covers.openlibrary.org/b/id/{cover_id}-M.jpg?default=false"
USER_AGENT = "Noolagam/0.1 (personal book tracker)"
SEARCH_FIELDS = "key,title,author_name,cover_i,number_of_pages_median"

TITLE_SIMILARITY = 0.9
AUTHOR_SIMILARITY = 0.8


class OpenLibraryUnavailableError(Exception):
    pass


@dataclass(frozen=True)
class BookDetails:
    title: str | None = None
    author: str | None = None
    page_count: int | None = None
    cover_url: str | None = None
    description: str | None = None


def create_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=5,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    )


async def _get_json(client: httpx.AsyncClient, path: str, params: dict[str, Any] | None = None) -> Any:
    try:
        response = await client.get(path, params=params)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise OpenLibraryUnavailableError(f"Open Library request failed: {path}") from error


def _cover_url(cover_id: object) -> str | None:
    # Open Library uses -1 for an edition whose cover was removed.
    if isinstance(cover_id, int) and cover_id > 0:
        return COVER_URL.format(cover_id=cover_id)
    return None


def _text(value: object) -> str | None:
    """Descriptions are either a plain string or {"type": ..., "value": ...}."""
    if isinstance(value, dict):
        value = value.get("value")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


async def _work_description(client: httpx.AsyncClient, work_key: str | None) -> str | None:
    if not work_key:
        return None
    try:
        work = await _get_json(client, f"{work_key}.json")
    except OpenLibraryUnavailableError:
        # The rest of the details are still useful without a description.
        return None
    return _text(work.get("description"))


async def _search(client: httpx.AsyncClient, limit: int, **query: str) -> list[dict[str, Any]]:
    params = {**query, "limit": limit, "fields": SEARCH_FIELDS}
    docs: list[dict[str, Any]] = (await _get_json(client, "/search.json", params)).get("docs", [])
    return docs


async def _edition(client: httpx.AsyncClient, isbn: str) -> dict[str, Any]:
    key = f"ISBN:{isbn}"
    params = {"bibkeys": key, "format": "json", "jscmd": "details"}
    data = await _get_json(client, "/api/books", params)
    edition: dict[str, Any] = data.get(key, {}).get("details", {})
    return edition


def _first_author(names: object) -> str | None:
    if isinstance(names, list) and names:
        first = names[0]
        name = first.get("name") if isinstance(first, dict) else first
        if isinstance(name, str) and name.strip():
            return name.strip()
    return None


async def lookup_by_isbn(isbn: str) -> BookDetails | None:
    """Combines two sources. The edition has the right title for this printing but is often missing
    the author, pages or cover. The search result has those, but only the title of the original work,
    which may be in another language."""
    async with create_client() as client:
        docs, edition = await asyncio.gather(_search(client, limit=1, isbn=isbn), _edition(client, isbn))
        doc = docs[0] if docs else {}
        if not doc and not edition:
            return None

        works = edition.get("works") or [{}]
        work_key = doc.get("key") or works[0].get("key")
        covers = edition.get("covers") or [None]
        return BookDetails(
            title=edition.get("title") or doc.get("title"),
            author=_first_author(edition.get("authors")) or _first_author(doc.get("author_name")),
            page_count=edition.get("number_of_pages") or doc.get("number_of_pages_median"),
            cover_url=_cover_url(covers[0]) or _cover_url(doc.get("cover_i")),
            description=_text(edition.get("description")) or await _work_description(client, work_key),
        )


def _normalize(text: str) -> str:
    folded = unicodedata.normalize("NFKC", text).casefold()
    return " ".join(re.sub(r"[^\w\s]", " ", folded).split())


def _similarity(first: str, second: str) -> float:
    return SequenceMatcher(None, first, second).ratio()


def _titles_match(first: str, second: str) -> bool:
    first, second = _normalize(first), _normalize(second)
    # "Part 1" and "Part 2" are nearly identical as text, but they are different books.
    if re.findall(r"\d+", first) != re.findall(r"\d+", second):
        return False
    return _similarity(first, second) >= TITLE_SIMILARITY


def is_same_title(wanted: str, found: str) -> bool:
    # A subtitle after a colon does not make it a different book.
    return _titles_match(wanted, found) or _titles_match(wanted.split(":")[0], found.split(":")[0])


def is_same_author(wanted: str, found: str) -> bool:
    wanted_name, found_name = _normalize(wanted), _normalize(found)
    if not wanted_name or not found_name:
        return False
    wanted_parts, found_parts = set(wanted_name.split()), set(found_name.split())
    # "Kalam" and "A. P. J. Abdul Kalam" are the same person.
    if wanted_parts <= found_parts or found_parts <= wanted_parts:
        return True
    return _similarity(wanted_name, found_name) >= AUTHOR_SIMILARITY


async def find_match(title: str, author: str) -> BookDetails | None:
    """Only accepts a close match on both title and author: a missing cover is better than a wrong one."""
    async with create_client() as client:
        for doc in await _search(client, limit=5, title=title, author=author):
            authors = doc.get("author_name") or []
            if is_same_title(title, doc.get("title", "")) and any(is_same_author(author, a) for a in authors):
                return BookDetails(
                    title=doc.get("title"),
                    author=_first_author(authors),
                    page_count=doc.get("number_of_pages_median"),
                    cover_url=_cover_url(doc.get("cover_i")),
                    description=await _work_description(client, doc.get("key")),
                )
    return None
