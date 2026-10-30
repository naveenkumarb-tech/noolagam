from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.db.base import Base

SEARCH_VECTOR_EXPRESSION = (
    "setweight(to_tsvector('simple', coalesce(title, '')), 'A') || "
    "setweight(to_tsvector('simple', coalesce(author, '')), 'B') || "
    "setweight(to_tsvector('simple', coalesce(description, '')), 'C')"
)


class BookStatus(StrEnum):
    TO_READ = "to_read"
    READING = "reading"
    FINISHED = "finished"


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("status IN ('to_read', 'reading', 'finished')", name="status"),
        CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 5 AND status = 'finished')", name="rating"),
        CheckConstraint("page_count IS NULL OR page_count > 0", name="page_count"),
        CheckConstraint(
            "current_page >= 0 AND (page_count IS NULL OR current_page <= page_count)", name="current_page"
        ),
        Index(None, "user_id", "status"),
        Index(None, "user_id", "author"),
        Index(None, "user_id", "gifted_by"),
        Index(None, "user_id", "created_at"),
        Index(None, "user_id", "finished_at"),
        Index(None, "user_id", "title"),
        Index("ix_books_search_vector", "search_vector", postgresql_using="gin"),
    )
    # Fetches updated_at while saving; loading it later would need I/O outside the async session.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    author: Mapped[str] = mapped_column(String(255))
    isbn: Mapped[str | None] = mapped_column(String(20))
    cover_url: Mapped[str | None]
    description: Mapped[str | None]
    page_count: Mapped[int | None]
    current_page: Mapped[int] = mapped_column(default=0, server_default="0")
    gifted_by: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default=BookStatus.TO_READ, server_default="to_read")
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    notes: Mapped[str | None]
    started_at: Mapped[date | None] = mapped_column(Date)
    finished_at: Mapped[date | None] = mapped_column(Date)
    search_vector: Mapped[str] = deferred(
        mapped_column(TSVECTOR, Computed(SEARCH_VECTOR_EXPRESSION, persisted=True))
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
