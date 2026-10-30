from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, BookStatus
from app.repositories import books
from app.services import open_library
from app.services.cache import invalidate_stats
from app.services.open_library import BookDetails


def _fill_missing_details(book: Book, details: BookDetails) -> None:
    book.cover_url = book.cover_url or details.cover_url
    book.description = book.description or details.description

    # A reader already past this page shows that the found edition is not the one they own.
    page_count = details.page_count
    if book.page_count is None and page_count and page_count >= book.current_page:
        book.page_count = page_count
        if book.status == BookStatus.FINISHED:
            book.current_page = page_count


async def enrich_book(session: AsyncSession, redis: Redis, book_id: int) -> None:
    """Fills only what is empty, so it is safe to retry and never overwrites what the user entered.

    Raises OpenLibraryUnavailableError if Open Library cannot be reached. The book stays saved either way.
    """
    book = await books.get_for_enrichment(session, book_id)
    if book is None or (book.cover_url and book.description and book.page_count):
        return

    isbn, title, author = book.isbn, book.title, book.author
    # No transaction stays open during the slow external calls.
    await session.rollback()

    details = await open_library.lookup_by_isbn(isbn) if isbn else None
    details = details or await open_library.find_match(title, author)
    if details is None:
        return

    # Read again under a lock: the book may have been edited or deleted during those calls.
    book = await books.get_for_enrichment(session, book_id, lock=True)
    if book is None:
        return
    _fill_missing_details(book, details)
    await session.commit()
    # A newly found page count changes the pages read.
    await invalidate_stats(redis, book.user_id)
