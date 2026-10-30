import asyncio
import logging
import smtplib
from typing import Any

from app.core.redis import create_redis
from app.db.session import worker_session
from app.services.email import deliver_password_reset_email, deliver_verification_email
from app.services.enrichment import enrich_book as run_enrichment
from app.services.open_library import OpenLibraryUnavailableError
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

RETRY_OPTIONS: dict[str, Any] = {
    "retry_backoff": True,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 5,
    "acks_late": True,
}
EMAIL_FAILURES = (smtplib.SMTPException, OSError)


async def _send_password_reset_email(user_id: int) -> None:
    async with worker_session() as session:
        await deliver_password_reset_email(session, user_id)


async def _send_verification_email(user_id: int) -> None:
    async with worker_session() as session:
        await deliver_verification_email(session, user_id)


async def _enrich_book(book_id: int) -> None:
    # Created here, because a Redis connection cannot outlive this task's event loop.
    redis = create_redis()
    try:
        async with worker_session() as session:
            await run_enrichment(session, redis, book_id)
    finally:
        await redis.aclose()


@celery_app.task(name="send_password_reset_email", autoretry_for=EMAIL_FAILURES, **RETRY_OPTIONS)
def send_password_reset_email(user_id: int) -> None:
    asyncio.run(_send_password_reset_email(user_id))


@celery_app.task(name="send_verification_email", autoretry_for=EMAIL_FAILURES, **RETRY_OPTIONS)
def send_verification_email(user_id: int) -> None:
    asyncio.run(_send_verification_email(user_id))


@celery_app.task(name="enrich_book", autoretry_for=(OpenLibraryUnavailableError,), **RETRY_OPTIONS)
def enrich_book(book_id: int) -> None:
    asyncio.run(_enrich_book(book_id))


def enqueue_password_reset_email(user_id: int) -> None:
    """Never raises: an unavailable broker must not change the response to a forgot-password request."""
    try:
        send_password_reset_email.apply_async(args=[user_id], retry=False)
    except Exception:
        logger.exception("Could not queue the password reset email for user %s", user_id)


def enqueue_verification_email(user_id: int) -> None:
    """Never raises: an unavailable broker must not fail a sign-up; the user can ask for the email again."""
    try:
        send_verification_email.apply_async(args=[user_id], retry=False)
    except Exception:
        logger.exception("Could not queue the verification email for user %s", user_id)


def enqueue_book_enrichment(book_id: int) -> None:
    """Never raises: the book is already saved, and its details are optional."""
    try:
        enrich_book.apply_async(args=[book_id], retry=False)
    except Exception:
        logger.exception("Could not queue enrichment for book %s", book_id)
