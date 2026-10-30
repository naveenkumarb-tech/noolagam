"""Development helpers. Run with: python -m app.cli seed-books you@example.com"""

import argparse
import asyncio
import sys
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import create_redis
from app.db.session import worker_session
from app.models import Book, BookStatus, User
from app.repositories import users
from app.services.cache import invalidate_stats


def _sample_books(user_id: int) -> list[Book]:
    today = datetime.now(UTC).date()

    def days_ago(days: int) -> date:
        return today - timedelta(days=days)

    samples = [
        Book(title="Ponniyin Selvan – Part 2", author="Kalki", page_count=420, gifted_by="Ravi",
             status=BookStatus.READING, current_page=186, started_at=days_ago(18)),
        Book(title="Atomic Habits", author="James Clear", page_count=320, gifted_by="Arun",
             status=BookStatus.READING, current_page=198, started_at=days_ago(30)),
        Book(title="Sivagamiyin Sabatham", author="Kalki", page_count=600),
        Book(title="Thirukkural", author="Thiruvalluvar", page_count=280, gifted_by="Priya"),
        Book(title="Parthiban Kanavu", author="Kalki"),
        Book(title="Wings of Fire", author="A. P. J. Abdul Kalam", page_count=180, gifted_by="Priya",
             status=BookStatus.FINISHED, current_page=180, rating=5,
             started_at=days_ago(60), finished_at=days_ago(45)),
        Book(title="The Alchemist", author="Paulo Coelho", page_count=197,
             status=BookStatus.FINISHED, current_page=197, rating=4,
             started_at=days_ago(90), finished_at=days_ago(80)),
    ]  # fmt: skip
    for book in samples:
        book.user_id = user_id
    return samples


async def _seed_books(session: AsyncSession, email: str) -> User:
    user = await users.get_by_email(session, email.lower())
    if user is None:
        raise SystemExit(f"No account found for {email}. Sign up first.")
    session.add_all(_sample_books(user.id))
    await session.commit()
    return user


async def _run_seed(email: str) -> None:
    redis = create_redis()
    try:
        async with worker_session() as session:
            user = await _seed_books(session, email)
        await invalidate_stats(redis, user.id)
    finally:
        await redis.aclose()
    print(f"Added sample books for {user.email}.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    seed = commands.add_parser("seed-books", help="Add sample books to an account (development only)")
    seed.add_argument("email")
    args = parser.parse_args()

    if get_settings().environment == "production":
        sys.exit("seed-books is not available in production.")
    asyncio.run(_run_seed(args.email))


if __name__ == "__main__":
    main()
