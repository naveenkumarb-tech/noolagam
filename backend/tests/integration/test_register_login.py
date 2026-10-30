from email.message import EmailMessage

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.models import RefreshToken, User
from tests.conftest import EMAIL, NAME, PASSWORD
from tests.helpers import assert_error, login, register


async def test_register_stores_the_user_with_a_hashed_password(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await register(client, email="Ravi@Example.COM")

    assert response.status_code == 201
    user = (await session.execute(select(User))).scalar_one()
    assert user.name == NAME
    assert user.email == EMAIL
    assert user.token_version == 0
    assert user.password_hash.startswith("$2b$")
    assert PASSWORD not in user.password_hash


async def test_register_logs_the_user_in(client: AsyncClient, session: AsyncSession) -> None:
    response = await register(client)

    body = response.json()
    assert set(body) == {"access_token", "token_type"}
    assert decode_token(body["access_token"], "access")["sub"] == "1"
    assert (await session.execute(select(RefreshToken))).scalar_one().user_id == 1


async def test_refresh_token_is_only_sent_as_a_protected_cookie(client: AsyncClient) -> None:
    response = await register(client)

    cookie = response.headers["set-cookie"]
    assert cookie.startswith("refresh_token=")
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie
    assert "SameSite=lax" in cookie
    assert "refresh_token" not in response.text


async def test_register_rejects_a_registered_email_ignoring_case(client: AsyncClient) -> None:
    await register(client)

    assert_error(await register(client, email="RAVI@example.com"), 409, "EMAIL_ALREADY_REGISTERED")


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"name": "  ", "email": EMAIL, "password": PASSWORD}, "name"),
        ({"name": "x" * 101, "email": EMAIL, "password": PASSWORD}, "name"),
        ({"name": NAME, "email": "not-an-email", "password": PASSWORD}, "email"),
        ({"name": NAME, "email": EMAIL, "password": "short12"}, "password"),
        ({"name": NAME, "email": EMAIL, "password": "த" * 25}, "password"),
    ],
)
async def test_register_validates_input(client: AsyncClient, payload: dict[str, str], field: str) -> None:
    error = assert_error(await client.post("/api/v1/auth/register", json=payload), 422, "VALIDATION_ERROR")

    assert error["details"][0]["field"] == field


async def test_validation_errors_do_not_echo_the_password(client: AsyncClient) -> None:
    payload = {"name": NAME, "email": EMAIL, "password": "tiny-pw"}

    response = await client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422
    assert "tiny-pw" not in response.text


async def test_password_with_no_number_or_symbol_is_allowed(client: AsyncClient) -> None:
    assert (await register(client, password="onlyletters")).status_code == 201


async def test_login_returns_tokens_and_ignores_email_case(client: AsyncClient) -> None:
    await register(client)

    response = await login(client, email="RAVI@EXAMPLE.COM")

    assert response.status_code == 200
    assert decode_token(response.json()["access_token"], "access")["sub"] == "1"
    assert "refresh_token=" in response.headers["set-cookie"]


async def test_wrong_password_and_unknown_email_look_the_same(client: AsyncClient) -> None:
    await register(client)

    wrong_password = await login(client, password="wrong-password")
    unknown_email = await login(client, email="nobody@example.com")

    first = assert_error(wrong_password, 401, "INVALID_CREDENTIALS")
    second = assert_error(unknown_email, 401, "INVALID_CREDENTIALS")
    assert first["message"] == second["message"]


async def test_login_with_a_very_long_password_is_refused_cleanly(client: AsyncClient) -> None:
    await register(client)

    assert_error(await login(client, password="x" * 100), 401, "INVALID_CREDENTIALS")


@pytest.mark.parametrize("path", ["verify-email", "resend-verification"])
async def test_email_verification_no_longer_exists(client: AsyncClient, path: str) -> None:
    assert_error(
        await client.post(f"/api/v1/auth/{path}", json={"token": "x", "email": EMAIL}), 404, "HTTP_404"
    )


async def test_registering_sends_no_email(client: AsyncClient, sent_emails: list[EmailMessage]) -> None:
    await register(client)

    assert sent_emails == []
