import asyncio
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    BookNotFoundError,
    InvalidBookDateError,
    InvalidStatusTransitionError,
    PageExceedsTotalError,
    RatingNotAllowedError,
)
from app.models import Book, BookStatus
from app.repositories import books
from app.repositories.books import BookFilters
from app.schemas.book import (
    BookCounts,
    BookCreate,
    BookFacets,
    BookSort,
    BookUpdate,
    FinishReadingRequest,
    StartReadingRequest,
    UpdateProgressRequest,
)
from app.services import cover_files
from app.services.cache import invalidate_stats


def _today() -> date:
    return datetime.now(UTC).date()


def _check_not_future(value: date) -> None:
    # The client sends its local date, and some time zones are a day ahead of UTC.
    if value > _today() + timedelta(days=1):
        raise InvalidBookDateError()


def _apply_start(book: Book, started_at: date | None) -> None:
    if started_at is not None:
        _check_not_future(started_at)
    book.status = BookStatus.READING
    book.started_at = started_at or book.started_at or _today()


def _apply_finish(book: Book, finished_at: date | None, rating: int | None) -> None:
    finish_date = finished_at or _today()
    _check_not_future(finish_date)
    # A book with no start date can be finished directly; it then starts and ends on the same day.
    started_at = book.started_at or finish_date
    if started_at > finish_date:
        raise InvalidBookDateError()

    book.status = BookStatus.FINISHED
    book.started_at = started_at
    book.finished_at = finish_date
    book.rating = rating
    if book.page_count is not None:
        book.current_page = book.page_count


async def _save(session: AsyncSession, redis: Redis, user_id: int) -> None:
    # In this order: invalidating first would let a request cache the old values again before the commit.
    await session.commit()
    await invalidate_stats(redis, user_id)


async def create_book(session: AsyncSession, redis: Redis, user_id: int, data: BookCreate) -> Book:
    if data.rating is not None and data.status != BookStatus.FINISHED:
        raise RatingNotAllowedError()
    if (data.started_at and data.status == BookStatus.TO_READ) or (
        data.finished_at and data.status != BookStatus.FINISHED
    ):
        raise InvalidBookDateError()

    book = Book(
        user_id=user_id,
        title=data.title,
        author=data.author,
        isbn=data.isbn,
        page_count=data.page_count,
        gifted_by=data.gifted_by,
        cover_url=data.cover_url,
        description=data.description,
        started_at=data.started_at,
    )
    if data.status == BookStatus.READING:
        _apply_start(book, data.started_at)
    elif data.status == BookStatus.FINISHED:
        _apply_finish(book, data.finished_at, data.rating)

    books.add(session, book)
    await _save(session, redis, user_id)
    return book


async def get_book(session: AsyncSession, user_id: int, book_id: int) -> Book:
    book = await books.get_for_user(session, user_id, book_id)
    if book is None:
        raise BookNotFoundError()
    return book


def _check_dates(book: Book) -> None:
    """Checks the dates against the book's status, after an edit has been applied to them."""
    if book.status == BookStatus.TO_READ and (book.started_at or book.finished_at):
        raise InvalidBookDateError()
    if book.status == BookStatus.READING and (book.started_at is None or book.finished_at):
        raise InvalidBookDateError()
    if book.status == BookStatus.FINISHED and (book.started_at is None or book.finished_at is None):
        raise InvalidBookDateError()
    for value in (book.started_at, book.finished_at):
        if value is not None:
            _check_not_future(value)
    if book.started_at and book.finished_at and book.started_at > book.finished_at:
        raise InvalidBookDateError()


async def update_book(
    session: AsyncSession, redis: Redis, user_id: int, book_id: int, data: BookUpdate
) -> Book:
    book = await get_book(session, user_id, book_id)
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(book, name, value)

    _check_dates(book)
    if book.page_count is not None:
        if book.status == BookStatus.FINISHED:
            book.current_page = book.page_count
        elif book.current_page > book.page_count:
            raise PageExceedsTotalError()
    await _save(session, redis, user_id)
    return book


async def delete_book(session: AsyncSession, redis: Redis, user_id: int, book_id: int) -> None:
    book = await get_book(session, user_id, book_id)
    cover_url = book.cover_url
    await books.delete(session, book)
    await _save(session, redis, user_id)
    await asyncio.to_thread(cover_files.remove, cover_url)


async def set_book_cover(session: AsyncSession, user_id: int, book_id: int, photo: bytes) -> Book:
    """Saves the new photo before touching the book, so a failure leaves the old cover in place."""
    book = await get_book(session, user_id, book_id)
    previous_url = book.cover_url
    book.cover_url = await asyncio.to_thread(cover_files.save, photo)
    await session.commit()
    await asyncio.to_thread(cover_files.remove, previous_url)
    return book


async def reset_book(session: AsyncSession, redis: Redis, user_id: int, book_id: int) -> Book:
    book = await get_book(session, user_id, book_id)
    book.status = BookStatus.TO_READ
    book.started_at = None
    book.finished_at = None
    book.current_page = 0
    book.rating = None
    await _save(session, redis, user_id)
    return book


async def start_reading(
    session: AsyncSession, redis: Redis, user_id: int, book_id: int, data: StartReadingRequest
) -> Book:
    book = await get_book(session, user_id, book_id)
    if book.status == BookStatus.FINISHED:
        raise InvalidStatusTransitionError()
    _apply_start(book, data.started_at)
    await _save(session, redis, user_id)
    return book


async def update_progress(
    session: AsyncSession, user_id: int, book_id: int, data: UpdateProgressRequest
) -> Book:
    book = await get_book(session, user_id, book_id)
    if book.status != BookStatus.READING:
        raise InvalidStatusTransitionError()
    if book.page_count is not None and data.current_page > book.page_count:
        raise PageExceedsTotalError()
    book.current_page = data.current_page
    # Stats only count finished books, so the page while reading does not invalidate them.
    await session.commit()
    return book


async def finish_reading(
    session: AsyncSession, redis: Redis, user_id: int, book_id: int, data: FinishReadingRequest
) -> Book:
    book = await get_book(session, user_id, book_id)
    if book.status == BookStatus.FINISHED:
        # Finishing again only changes the rating, so the original finish date stays.
        book.rating = data.rating
    else:
        _apply_finish(book, data.finished_at, data.rating)
    await _save(session, redis, user_id)
    return book


async def list_books(
    session: AsyncSession, user_id: int, filters: BookFilters, sort: BookSort, page: int, per_page: int
) -> tuple[Sequence[Book], int]:
    return await books.list_for_user(session, user_id, filters, sort, per_page, (page - 1) * per_page)


async def search_books(
    session: AsyncSession, user_id: int, query: str, filters: BookFilters, page: int, per_page: int
) -> tuple[Sequence[Book], int]:
    return await books.search_for_user(session, user_id, query, filters, per_page, (page - 1) * per_page)


async def get_facets(session: AsyncSession, user_id: int) -> BookFacets:
    authors, gifted_by = await books.get_facets(session, user_id)
    return BookFacets(authors=authors, gifted_by=gifted_by)


async def list_currently_reading(session: AsyncSession, user_id: int) -> Sequence[Book]:
    return await books.list_currently_reading(session, user_id)


async def get_counts(session: AsyncSession, user_id: int) -> BookCounts:
    return BookCounts(**await books.count_for_user(session, user_id))
