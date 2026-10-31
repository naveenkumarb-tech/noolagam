import io
from collections.abc import AsyncIterator, Callable
from pathlib import Path

import pytest
from httpx import AsyncClient, Response
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.upload_limit import MAX_REQUEST_BYTES
from app.services import cover_files
from app.services.enrichment import enrich_book
from tests.conftest import FakeOpenLibrary
from tests.helpers import assert_error, auth_headers

BOOKS = "/api/v1/books"
ORIENTATION_TAG = 274
GPS_TAG = 34853
MAKE_TAG = 271


def image_bytes(
    fmt: str = "JPEG", size: tuple[int, int] = (800, 1200), exif: Image.Exif | None = None
) -> bytes:
    image = Image.new("RGB", size, (15, 118, 110))
    output = io.BytesIO()
    image.save(output, format=fmt, **({"exif": exif} if exif else {}))
    return output.getvalue()


@pytest.fixture
async def headers(client: AsyncClient) -> dict[str, str]:
    return await auth_headers(client)


async def _book(client: AsyncClient, headers: dict[str, str], **fields: object) -> dict:
    payload = {"title": "Wings of Fire", "author": "Kalam", **fields}
    return (await client.post(BOOKS, json=payload, headers=headers)).json()


async def _upload(
    client: AsyncClient,
    headers: dict[str, str],
    book_id: int,
    data: bytes | None = None,
    filename: str = "photo.jpg",
    content_type: str = "image/jpeg",
) -> Response:
    files = {"photo": (filename, image_bytes() if data is None else data, content_type)}
    return await client.post(f"{BOOKS}/{book_id}/cover", files=files, headers=headers)


def _stored_files(media_dir: Path) -> list[Path]:
    covers = media_dir / "covers"
    return sorted(covers.iterdir()) if covers.exists() else []


async def test_upload_sets_the_cover_and_it_can_be_viewed(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    book = await _book(client, headers)

    response = await _upload(client, headers, book["id"])

    assert response.status_code == 200
    url = response.json()["cover_url"]
    assert url.startswith("/api/v1/media/covers/")
    photo = await client.get(url)
    assert photo.status_code == 200
    assert photo.headers["content-type"] == "image/jpeg"
    assert photo.headers["x-content-type-options"] == "nosniff"
    assert Image.open(io.BytesIO(photo.content)).format == "JPEG"
    assert (await client.get(f"{BOOKS}/{book['id']}", headers=headers)).json()["cover_url"] == url


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
async def test_common_photo_formats_are_accepted_and_become_jpeg(
    client: AsyncClient, headers: dict[str, str], media_dir: Path, fmt: str
) -> None:
    book = await _book(client, headers)

    assert (await _upload(client, headers, book["id"], image_bytes(fmt))).status_code == 200

    assert Image.open(_stored_files(media_dir)[0]).format == "JPEG"


async def test_a_transparent_png_is_accepted(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _book(client, headers)
    output = io.BytesIO()
    Image.new("RGBA", (100, 100), (0, 0, 0, 0)).save(output, format="PNG")

    assert (await _upload(client, headers, book["id"], output.getvalue())).status_code == 200


async def test_large_photos_are_shrunk_keeping_their_shape(
    client: AsyncClient, headers: dict[str, str], media_dir: Path
) -> None:
    book = await _book(client, headers)

    await _upload(client, headers, book["id"], image_bytes(size=(3000, 4000)))

    assert Image.open(_stored_files(media_dir)[0]).size == (900, 1200)


async def test_hidden_data_such_as_location_is_removed(
    client: AsyncClient, headers: dict[str, str], media_dir: Path
) -> None:
    book = await _book(client, headers)
    exif = Image.Exif()
    exif[MAKE_TAG] = "Secret Phone"
    exif[GPS_TAG] = {1: "N", 3: "E"}
    original = image_bytes(exif=exif)
    assert Image.open(io.BytesIO(original)).getexif().get(MAKE_TAG) == "Secret Phone"

    await _upload(client, headers, book["id"], original)

    stored = _stored_files(media_dir)[0]
    assert len(Image.open(stored).getexif()) == 0
    assert b"Secret Phone" not in stored.read_bytes()


async def test_a_sideways_phone_photo_is_stored_upright(
    client: AsyncClient, headers: dict[str, str], media_dir: Path
) -> None:
    book = await _book(client, headers)
    exif = Image.Exif()
    exif[ORIENTATION_TAG] = 6  # How a phone marks a photo taken while held upright.

    await _upload(client, headers, book["id"], image_bytes(size=(400, 300), exif=exif))

    assert Image.open(_stored_files(media_dir)[0]).size == (300, 400)


@pytest.mark.parametrize(
    ("data", "filename", "content_type"),
    [
        (b"this is not an image", "photo.jpg", "image/jpeg"),
        (
            b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
            "photo.svg",
            "image/svg+xml",
        ),
        (b"<html><script>alert(1)</script></html>", "photo.png", "image/png"),
        (b"", "photo.jpg", "image/jpeg"),
    ],
)
async def test_anything_that_is_not_really_a_photo_is_refused(
    client: AsyncClient,
    headers: dict[str, str],
    media_dir: Path,
    data: bytes,
    filename: str,
    content_type: str,
) -> None:
    book = await _book(client, headers)

    response = await _upload(client, headers, book["id"], data, filename, content_type)

    assert_error(response, 422, "INVALID_IMAGE")
    assert _stored_files(media_dir) == []


async def test_other_image_formats_are_refused(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _book(client, headers)

    response = await _upload(client, headers, book["id"], image_bytes("GIF"), "photo.gif", "image/gif")

    assert_error(response, 422, "INVALID_IMAGE")


async def test_a_corrupted_photo_is_refused(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _book(client, headers)

    response = await _upload(client, headers, book["id"], image_bytes()[:200])

    assert_error(response, 422, "INVALID_IMAGE")


async def test_a_photo_with_too_many_pixels_is_refused(
    client: AsyncClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cover_files, "MAX_PIXELS", 100)
    book = await _book(client, headers)

    assert_error(await _upload(client, headers, book["id"]), 422, "INVALID_IMAGE")


async def test_an_oversized_file_is_refused(
    client: AsyncClient, headers: dict[str, str], media_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cover_files, "MAX_UPLOAD_BYTES", 100)
    book = await _book(client, headers)

    response = await _upload(client, headers, book["id"])

    assert_error(response, 413, "IMAGE_TOO_LARGE")
    assert _stored_files(media_dir) == []


async def test_a_huge_upload_is_refused_before_login_is_even_checked(client: AsyncClient) -> None:
    files = {"photo": ("photo.jpg", bytes(MAX_REQUEST_BYTES), "image/jpeg")}

    response = await client.post(f"{BOOKS}/1/cover", files=files)

    assert_error(response, 413, "IMAGE_TOO_LARGE")


async def test_an_upload_that_hides_its_size_is_refused(client: AsyncClient) -> None:
    async def chunks() -> AsyncIterator[bytes]:
        yield b"data"

    response = await client.post(f"{BOOKS}/1/cover", content=chunks())

    assert_error(response, 413, "IMAGE_TOO_LARGE")


async def test_a_too_large_error_can_be_read_by_the_android_app(client: AsyncClient) -> None:
    files = {"photo": ("photo.jpg", bytes(MAX_REQUEST_BYTES), "image/jpeg")}

    response = await client.post(f"{BOOKS}/1/cover", files=files, headers={"Origin": "http://localhost"})

    assert response.headers["access-control-allow-origin"] == "http://localhost"


async def test_a_missing_file_is_a_validation_error(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _book(client, headers)

    response = await client.post(f"{BOOKS}/{book['id']}/cover", headers=headers)

    assert_error(response, 422, "VALIDATION_ERROR")


async def test_upload_needs_login(client: AsyncClient) -> None:
    response = await client.post(f"{BOOKS}/1/cover", files={"photo": ("p.jpg", image_bytes(), "image/jpeg")})

    assert_error(response, 401, "NOT_AUTHENTICATED")


async def test_nobody_can_add_a_photo_to_someone_elses_book(
    make_client: Callable[[], AsyncClient], media_dir: Path
) -> None:
    async with make_client() as owner, make_client() as other:
        owner_headers = await auth_headers(owner, "owner@example.com")
        other_headers = await auth_headers(other, "other@example.com")
        book = await _book(owner, owner_headers)

        assert_error(await _upload(other, other_headers, book["id"]), 404, "BOOK_NOT_FOUND")

        assert _stored_files(media_dir) == []
        current = (await owner.get(f"{BOOKS}/{book['id']}", headers=owner_headers)).json()
        assert current["cover_url"] is None


async def test_a_new_photo_replaces_the_old_file(
    client: AsyncClient, headers: dict[str, str], media_dir: Path
) -> None:
    book = await _book(client, headers)
    first = (await _upload(client, headers, book["id"])).json()["cover_url"]

    second = (await _upload(client, headers, book["id"])).json()["cover_url"]

    assert second != first
    assert len(_stored_files(media_dir)) == 1
    assert (await client.get(first)).status_code == 404
    assert (await client.get(second)).status_code == 200


async def test_replacing_an_open_library_cover_works(client: AsyncClient, headers: dict[str, str]) -> None:
    book = await _book(client, headers, cover_url="https://covers.openlibrary.org/b/id/5-M.jpg?default=false")

    response = await _upload(client, headers, book["id"])

    assert response.json()["cover_url"].startswith("/api/v1/media/covers/")


async def test_deleting_a_book_deletes_its_photo(
    client: AsyncClient, headers: dict[str, str], media_dir: Path
) -> None:
    book = await _book(client, headers)
    url = (await _upload(client, headers, book["id"])).json()["cover_url"]

    await client.delete(f"{BOOKS}/{book['id']}", headers=headers)

    assert _stored_files(media_dir) == []
    assert (await client.get(url)).status_code == 404


async def test_a_stuck_file_does_not_fail_the_delete(
    client: AsyncClient, headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(_: Path, missing_ok: bool = False) -> None:
        raise PermissionError

    book = await _book(client, headers)
    await _upload(client, headers, book["id"])
    monkeypatch.setattr(Path, "unlink", refuse)

    assert (await client.delete(f"{BOOKS}/{book['id']}", headers=headers)).status_code == 204


def test_removing_a_cover_ignores_addresses_it_did_not_create(media_dir: Path) -> None:
    outside = media_dir / "keep.jpg"
    outside.write_bytes(b"data")

    cover_files.remove(None)
    cover_files.remove("https://covers.openlibrary.org/b/id/5-M.jpg")
    cover_files.remove(f"{cover_files.COVER_URL_PREFIX}../keep.jpg")

    assert outside.exists()


async def test_the_background_job_keeps_your_photo(
    client: AsyncClient,
    headers: dict[str, str],
    session: AsyncSession,
    redis,
    fake_open_library: FakeOpenLibrary,
) -> None:
    fake_open_library.docs = [
        {"key": "/works/OL1W", "title": "Wings of Fire", "author_name": ["Kalam"], "cover_i": 5,
         "number_of_pages_median": 180}
    ]  # fmt: skip
    book = await _book(client, headers)
    url = (await _upload(client, headers, book["id"])).json()["cover_url"]

    await enrich_book(session, redis, book["id"])

    updated = (await client.get(f"{BOOKS}/{book['id']}", headers=headers)).json()
    assert updated["cover_url"] == url
    assert updated["page_count"] == 180


@pytest.mark.parametrize(
    "name",
    [
        "missing",
        "..%2F..%2Fetc%2Fpasswd",
        "..%2Fapp.py",
        "a" * 32 + ".png",
        "A" * 32 + ".jpg",
        "0" * 32 + ".jpg",
    ],
)
async def test_only_real_cover_names_can_be_read(client: AsyncClient, name: str) -> None:
    assert (await client.get(f"/api/v1/media/covers/{name}")).status_code == 404


async def test_the_address_of_a_photo_cannot_be_set_directly(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    response = await client.post(
        BOOKS, json={"title": "t", "author": "a", "cover_url": "/api/v1/media/covers/x.jpg"}, headers=headers
    )

    assert_error(response, 422, "VALIDATION_ERROR")


async def test_uploads_are_rate_limited(client: AsyncClient, headers: dict[str, str], monkeypatch) -> None:
    from app.middleware import rate_limit
    from app.routers import books as books_router

    limit = rate_limit.RateLimit(per_ip=100, per_email=2, window_seconds=60)
    monkeypatch.setattr(books_router, "COVER_UPLOAD_LIMIT", limit)
    book = await _book(client, headers)
    for _ in range(2):
        assert (await _upload(client, headers, book["id"])).status_code == 200

    assert_error(await _upload(client, headers, book["id"]), 429, "RATE_LIMITED")
