from collections.abc import Sequence
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotAuthenticatedError
from app.core.redis import get_redis
from app.core.security import decode_token
from app.db.session import get_session
from app.models import Book, BookStatus, User
from app.repositories import users
from app.repositories.books import BookFilters
from app.schemas.book import BookListResponse, BookResponse

_bearer = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
RedisDep = Annotated[Redis, Depends(get_redis)]


async def get_current_user(
    session: SessionDep, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    if credentials is None:
        raise NotAuthenticatedError()
    try:
        claims = decode_token(credentials.credentials, "access")
    except jwt.InvalidTokenError as error:
        raise NotAuthenticatedError() from error

    user = await users.get_by_id(session, int(claims["sub"]))
    # The version check ends existing access tokens as soon as the password is reset.
    if user is None or claims["tv"] != user.token_version:
        raise NotAuthenticatedError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@dataclass(frozen=True)
class BookQuery:
    """The filters and paging shared by the book list and search."""

    filters: BookFilters
    page: int
    per_page: int

    def to_response(self, items: Sequence[Book], total: int) -> BookListResponse:
        return BookListResponse(
            items=[BookResponse.model_validate(book) for book in items],
            total=total,
            page=self.page,
            per_page=self.per_page,
        )


def get_book_query(
    status: Annotated[BookStatus | None, Query()] = None,
    author: Annotated[str | None, Query(max_length=255)] = None,
    gifted_by: Annotated[str | None, Query(max_length=255)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BookQuery:
    return BookQuery(BookFilters(status, author, gifted_by), page, per_page)


BookQueryDep = Annotated[BookQuery, Depends(get_book_query)]
