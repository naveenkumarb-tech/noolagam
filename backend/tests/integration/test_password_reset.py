from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_url_token
from app.models import AuthToken
from app.services.email import deliver_password_reset_email
from tests.conftest import EMAIL, PASSWORD
from tests.helpers import assert_error, login, refresh, register, reset_token_from

NEW_PASSWORD = "brand-new-password"


async def _request_reset_token(
    session: AsyncSession, sent_emails: list[EmailMessage], user_id: int = 1
) -> str:
    await deliver_password_reset_email(session, user_id)
    return reset_token_from(sent_emails[-1])


async def _reset(client: AsyncClient, token: str, password: str = NEW_PASSWORD):
    return await client.post("/api/v1/auth/reset-password", json={"token": token, "password": password})


async def test_forgot_password_gives_the_same_response_for_any_email(
    client: AsyncClient, queued_reset_emails: list[int]
) -> None:
    await register(client)

    known = await client.post("/api/v1/auth/forgot-password", json={"email": EMAIL})
    unknown = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert queued_reset_emails == [1]


async def test_reset_email_goes_to_the_user_and_only_a_hash_is_stored(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)

    raw_token = await _request_reset_token(session, sent_emails)

    assert sent_emails[0]["To"] == EMAIL
    stored = (await session.execute(select(AuthToken))).scalar_one()
    assert stored.purpose == "reset_password"
    assert stored.token_hash == hash_url_token(raw_token)
    assert stored.token_hash != raw_token
    expected_expiry = datetime.now(UTC) + timedelta(minutes=30)
    assert abs(stored.expires_at - expected_expiry) < timedelta(seconds=30)


async def test_delivering_for_a_deleted_user_does_nothing(
    session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await deliver_password_reset_email(session, 999)

    assert sent_emails == []


async def test_reset_changes_the_password(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    token = await _request_reset_token(session, sent_emails)

    assert (await _reset(client, token)).status_code == 204

    assert_error(await login(client, password=PASSWORD), 401, "INVALID_CREDENTIALS")
    assert (await login(client, password=NEW_PASSWORD)).status_code == 200


async def test_reset_logs_out_every_existing_session(
    make_client: Callable[[], AsyncClient], session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    async with make_client() as phone, make_client() as laptop:
        await register(phone)
        await login(laptop)
        token = await _request_reset_token(session, sent_emails)

        await _reset(phone, token)

        assert_error(await refresh(phone), 401, "INVALID_REFRESH_TOKEN")
        assert_error(await refresh(laptop), 401, "INVALID_REFRESH_TOKEN")


async def test_stale_device_after_reset_does_not_log_out_the_new_session(
    make_client: Callable[[], AsyncClient], session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    async with make_client() as old_device, make_client() as new_device:
        await register(old_device)
        token = await _request_reset_token(session, sent_emails)
        await _reset(new_device, token)
        await login(new_device, password=NEW_PASSWORD)

        assert_error(await refresh(old_device), 401, "INVALID_REFRESH_TOKEN")

        assert (await refresh(new_device)).status_code == 200


async def test_reset_link_works_only_once(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    token = await _request_reset_token(session, sent_emails)
    await _reset(client, token)

    assert_error(await _reset(client, token, "another-password"), 400, "INVALID_RESET_TOKEN")
    assert (await login(client, password=NEW_PASSWORD)).status_code == 200


async def test_requesting_a_new_link_cancels_the_previous_one(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    first = await _request_reset_token(session, sent_emails)
    second = await _request_reset_token(session, sent_emails)

    assert_error(await _reset(client, first), 400, "INVALID_RESET_TOKEN")
    assert (await _reset(client, second)).status_code == 204


async def test_expired_link_is_rejected(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    token = await _request_reset_token(session, sent_emails)
    await session.execute(update(AuthToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    await session.commit()

    assert_error(await _reset(client, token), 400, "INVALID_RESET_TOKEN")
    assert (await login(client)).status_code == 200


async def test_unknown_token_is_rejected(client: AsyncClient) -> None:
    assert_error(await _reset(client, "made-up-token"), 400, "INVALID_RESET_TOKEN")


async def test_reset_validates_the_new_password_and_keeps_the_token_usable(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    await register(client)
    token = await _request_reset_token(session, sent_emails)

    assert_error(await _reset(client, token, "short12"), 422, "VALIDATION_ERROR")
    assert (await _reset(client, token)).status_code == 204
