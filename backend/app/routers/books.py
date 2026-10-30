from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status

from app.core.errors import BookLookupNotFoundError, BookLookupUnavailableError
from app.routers.deps import BookQueryDep, CurrentUser, RedisDep, SessionDep
from app.schemas.book import (
    BookCounts,
    BookCreate,
    BookFacets,
    BookListResponse,
    BookLookupResponse,
    BookResponse,
    BookSort,
    BookUpdate,
    FinishReadingRequest,
    Isbn,
    StartReadingRequest,
    UpdateProgressRequest,
)
from app.services import books as books_service
from app.services import open_library
from app.worker.tasks import enqueue_book_enrichment

router = APIRouter(prefix="/books", tags=["books"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> BookResponse:
    book = await books_service.create_book(session, redis, user.id, data)
    background_tasks.add_task(enqueue_book_enrichment, book.id)
    return BookResponse.model_validate(book)


@router.get("")
async def list_books(
    query: BookQueryDep, user: CurrentUser, session: SessionDep, sort: BookSort = BookSort.RECENT
) -> BookListResponse:
    items, total = await books_service.list_books(
        session, user.id, query.filters, sort, query.page, query.per_page
    )
    return query.to_response(items, total)


# Declared before the /{book_id} routes, or these names would be read as book IDs.
@router.get("/lookup")
async def lookup_book(isbn: Annotated[Isbn, Query()], _: CurrentUser) -> BookLookupResponse:
    try:
        details = await open_library.lookup_by_isbn(isbn)
    except open_library.OpenLibraryUnavailableError as error:
        raise BookLookupUnavailableError() from error
    if details is None:
        raise BookLookupNotFoundError()
    return BookLookupResponse(
        isbn=isbn,
        title=details.title,
        author=details.author,
        page_count=details.page_count,
        cover_url=details.cover_url,
        description=details.description,
    )


@router.get("/current")
async def currently_reading(user: CurrentUser, session: SessionDep) -> list[BookResponse]:
    books = await books_service.list_currently_reading(session, user.id)
    return [BookResponse.model_validate(book) for book in books]


@router.get("/counts")
async def counts(user: CurrentUser, session: SessionDep) -> BookCounts:
    return await books_service.get_counts(session, user.id)


@router.get("/facets")
async def facets(user: CurrentUser, session: SessionDep) -> BookFacets:
    return await books_service.get_facets(session, user.id)


@router.get("/{book_id}")
async def get_book(book_id: int, user: CurrentUser, session: SessionDep) -> BookResponse:
    return BookResponse.model_validate(await books_service.get_book(session, user.id, book_id))


@router.patch("/{book_id}")
async def update_book(
    book_id: int,
    data: BookUpdate,
    background_tasks: BackgroundTasks,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> BookResponse:
    book = await books_service.update_book(session, redis, user.id, book_id, data)
    # A corrected title or ISBN may now find details that could not be found before.
    if data.model_fields_set & {"title", "author", "isbn"}:
        background_tasks.add_task(enqueue_book_enrichment, book.id)
    return BookResponse.model_validate(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(book_id: int, user: CurrentUser, session: SessionDep, redis: RedisDep) -> None:
    await books_service.delete_book(session, redis, user.id, book_id)


@router.post("/{book_id}/reset")
async def reset_book(book_id: int, user: CurrentUser, session: SessionDep, redis: RedisDep) -> BookResponse:
    return BookResponse.model_validate(await books_service.reset_book(session, redis, user.id, book_id))


@router.post("/{book_id}/start")
async def start_reading(
    book_id: int,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
    data: StartReadingRequest | None = None,
) -> BookResponse:
    book = await books_service.start_reading(session, redis, user.id, book_id, data or StartReadingRequest())
    return BookResponse.model_validate(book)


@router.post("/{book_id}/progress")
async def update_progress(
    book_id: int, data: UpdateProgressRequest, user: CurrentUser, session: SessionDep
) -> BookResponse:
    return BookResponse.model_validate(await books_service.update_progress(session, user.id, book_id, data))


@router.post("/{book_id}/finish")
async def finish_reading(
    book_id: int,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
    data: FinishReadingRequest | None = None,
) -> BookResponse:
    book = await books_service.finish_reading(
        session, redis, user.id, book_id, data or FinishReadingRequest()
    )
    return BookResponse.model_validate(book)
