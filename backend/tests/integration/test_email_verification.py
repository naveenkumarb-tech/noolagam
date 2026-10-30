from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_url_token
from app.middleware.rate_limit import RESEND_VERIFICATION_LIMIT
from app.models import AuthToken, User
from app.services.email import deliver_password_reset_email, deliver_verification_email
from tests.conftest import EMAIL
from tests.helpers import assert_error, register, reset_token_from, verify_token_from


async def _verify(client: AsyncClient, token: str):
    return await client.post("/api/v1/auth/verify-email", json={"token": token})


async def _resend(client: AsyncClient, email: str = EMAIL):
    return await client.post("/api/v1/auth/resend-verification", json={"email": email})


async def _is_verified(session: AsyncSession) -> bool:
    session.expire_all()
    return (await session.execute(select(User))).scalar_one().is_verified


async def test_registering_queues_a_verification_email(
    client: AsyncClient, queued_verification_emails: list[int]
) -> None:
    await register(client)

    assert queued_verification_emails == [1]


async def test_verification_link_verifies_once(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await deliver_verification_email(session, 1)
    token = verify_token_from(sent_emails[0])

    assert sent_emails[0]["To"] == EMAIL
    assert (await _verify(client, token)).status_code == 204
    assert await _is_verified(session)
    assert_error(await _verify(client, token), 400, "INVALID_VERIFICATION_TOKEN")


async def test_only_a_hash_of_the_token_is_stored_and_it_lasts_24_hours(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await deliver_verification_email(session, 1)
    stored = (await session.execute(select(AuthToken))).scalar_one()

    assert stored.purpose == "verify_email"
    assert stored.token_hash == hash_url_token(verify_token_from(sent_emails[0]))
    assert abs(stored.expires_at - (datetime.now(UTC) + timedelta(hours=24))) < timedelta(seconds=30)


async def test_expired_link_is_rejected(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await deliver_verification_email(session, 1)
    await session.execute(update(AuthToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    await session.commit()

    assert_error(await _verify(client, verify_token_from(sent_emails[0])), 400, "INVALID_VERIFICATION_TOKEN")
    assert not await _is_verified(session)


async def test_a_new_email_cancels_the_previous_link(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await deliver_verification_email(session, 1)
    await deliver_verification_email(session, 1)

    assert_error(await _verify(client, verify_token_from(sent_emails[0])), 400, "INVALID_VERIFICATION_TOKEN")
    assert (await _verify(client, verify_token_from(sent_emails[1]))).status_code == 204


async def test_reset_token_cannot_verify_an_email(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await deliver_password_reset_email(session, 1)

    assert_error(await _verify(client, reset_token_from(sent_emails[0])), 400, "INVALID_VERIFICATION_TOKEN")


async def test_no_email_is_sent_to_a_verified_user(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    await session.execute(update(User).values(is_verified=True))
    await session.commit()

    await deliver_verification_email(session, 1)

    assert sent_emails == []


async def test_resend_gives_the_same_response_for_any_email(
    client: AsyncClient, session: AsyncSession, queued_verification_emails: list[int]
) -> None:
    await register(client)
    queued_verification_emails.clear()

    known = await _resend(client)
    unknown = await _resend(client, "nobody@example.com")
    await session.execute(update(User).values(is_verified=True))
    await session.commit()
    verified = await _resend(client)

    assert known.status_code == unknown.status_code == verified.status_code == 202
    assert known.json() == unknown.json() == verified.json()
    assert queued_verification_emails == [1]


async def test_resend_is_rate_limited(client: AsyncClient) -> None:
    for _ in range(RESEND_VERIFICATION_LIMIT.per_email):
        assert (await _resend(client)).status_code == 202

    assert_error(await _resend(client), 429, "RATE_LIMITED")
