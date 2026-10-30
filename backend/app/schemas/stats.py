from pydantic import BaseModel


class MonthCount(BaseModel):
    month: str
    count: int


class AuthorCount(BaseModel):
    author: str
    count: int


class GifterCount(BaseModel):
    name: str
    count: int


class StatsResponse(BaseModel):
    total_books: int
    finished: int
    currently_reading: int
    to_read: int
    gifted_books: int
    year: int
    available_years: list[int]
    finished_this_year: int
    pages_read_this_year: int
    avg_days_per_book: int | None
    finished_by_month: list[MonthCount]
    top_authors: list[AuthorCount]
    gifted_by: list[GifterCount]
