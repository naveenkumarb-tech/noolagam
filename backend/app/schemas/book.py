from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    model_validator,
)

from app.core.isbn import normalize_isbn
from app.models import BookStatus

# Keeps page numbers well inside the database's integer range.
MAX_PAGES = 100_000

RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Rating = Annotated[int, Field(ge=1, le=5)]


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


OptionalText = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None,
    BeforeValidator(_blank_to_none),
]


def _check_https_url(value: str) -> str:
    if not value.startswith("https://"):
        raise ValueError("Must be an https:// URL")
    return value


Isbn = Annotated[str, AfterValidator(normalize_isbn)]
OptionalIsbn = Annotated[Isbn | None, BeforeValidator(_blank_to_none)]
OptionalCoverUrl = Annotated[
    Annotated[str, StringConstraints(max_length=2000), AfterValidator(_check_https_url)] | None,
    BeforeValidator(_blank_to_none),
]
OptionalDescription = Annotated[
    Annotated[str, StringConstraints(strip_whitespace=True, max_length=20_000)] | None,
    BeforeValidator(_blank_to_none),
]


class BookCreate(BaseModel):
    title: RequiredText
    author: RequiredText
    isbn: OptionalIsbn = None
    page_count: Annotated[int, Field(gt=0, le=MAX_PAGES)] | None = None
    gifted_by: OptionalText = None
    cover_url: OptionalCoverUrl = None
    description: OptionalDescription = None
    status: BookStatus = BookStatus.TO_READ
    started_at: date | None = None
    finished_at: date | None = None
    rating: Rating | None = None


class BookSort(StrEnum):
    RECENT = "recent"
    TITLE = "title"
    AUTHOR = "author"
    FINISHED = "finished"


class BookUpdate(BaseModel):
    """Status, progress and rating are absent: they only change through the action endpoints."""

    title: RequiredText | None = None
    author: RequiredText | None = None
    isbn: OptionalIsbn = None
    page_count: Annotated[int, Field(gt=0, le=MAX_PAGES)] | None = None
    gifted_by: OptionalText = None
    description: OptionalDescription = None
    notes: Annotated[str, StringConstraints(max_length=20_000)] | None = None
    started_at: date | None = None
    finished_at: date | None = None

    @model_validator(mode="after")
    def reject_clearing_required_fields(self) -> Self:
        for name in ("title", "author"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be empty")
        return self


class StartReadingRequest(BaseModel):
    started_at: date | None = None


class UpdateProgressRequest(BaseModel):
    current_page: Annotated[int, Field(ge=0, le=MAX_PAGES)]


class FinishReadingRequest(BaseModel):
    finished_at: date | None = None
    rating: Rating | None = None


class BookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str
    isbn: str | None
    cover_url: str | None
    description: str | None
    page_count: int | None
    current_page: int
    gifted_by: str | None
    status: BookStatus
    rating: int | None
    notes: str | None
    started_at: date | None
    finished_at: date | None
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def progress_percent(self) -> int | None:
        if self.page_count is None:
            return None
        return round(self.current_page / self.page_count * 100)


class BookLookupResponse(BaseModel):
    isbn: str
    title: str | None
    author: str | None
    page_count: int | None
    cover_url: str | None
    description: str | None


class BookListResponse(BaseModel):
    items: list[BookResponse]
    total: int
    page: int
    per_page: int


class BookFacets(BaseModel):
    authors: list[str]
    gifted_by: list[str]


class BookCounts(BaseModel):
    total: int
    to_read: int
    reading: int
    finished: int
    gifted: int
