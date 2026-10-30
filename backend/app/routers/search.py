from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import StringConstraints

from app.routers.deps import BookQueryDep, CurrentUser, SessionDep
from app.schemas.book import BookListResponse
from app.services import books as books_service

router = APIRouter(prefix="/search", tags=["books"])

SearchText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


@router.get("")
async def search_books(
    q: Annotated[SearchText, Query()], query: BookQueryDep, user: CurrentUser, session: SessionDep
) -> BookListResponse:
    items, total = await books_service.search_books(
        session, user.id, q, query.filters, query.page, query.per_page
    )
    return query.to_response(items, total)
