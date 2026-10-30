"""create books

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("author", sa.String(255), nullable=False),
        sa.Column("isbn", sa.String(20), nullable=True),
        sa.Column("cover_url", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("current_page", sa.Integer(), server_default="0", nullable=False),
        sa.Column("gifted_by", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="to_read", nullable=False),
        sa.Column("rating", sa.SmallInteger(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("started_at", sa.Date(), nullable=True),
        sa.Column("finished_at", sa.Date(), nullable=True),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(
                "setweight(to_tsvector('simple', coalesce(title, '')), 'A') || "
                "setweight(to_tsvector('simple', coalesce(author, '')), 'B') || "
                "setweight(to_tsvector('simple', coalesce(description, '')), 'C')",
                persisted=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('to_read', 'reading', 'finished')", name="ck_books_status"),
        sa.CheckConstraint(
            "rating IS NULL OR (rating BETWEEN 1 AND 5 AND status = 'finished')", name="ck_books_rating"
        ),
        sa.CheckConstraint("page_count IS NULL OR page_count > 0", name="ck_books_page_count"),
        sa.CheckConstraint(
            "current_page >= 0 AND (page_count IS NULL OR current_page <= page_count)",
            name="ck_books_current_page",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_books_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_books"),
    )
    for columns in (
        ["user_id", "status"],
        ["user_id", "author"],
        ["user_id", "gifted_by"],
        ["user_id", "created_at"],
        ["user_id", "finished_at"],
        ["user_id", "title"],
    ):
        op.create_index(f"ix_books_{'_'.join(columns)}", "books", columns)
    op.create_index("ix_books_search_vector", "books", ["search_vector"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_table("books")
