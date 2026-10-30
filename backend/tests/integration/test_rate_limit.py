import pytest
from httpx import AsyncClient
from redis.asyncio import Redis

from app.core.redis import get_redis
from app.main import app
from app.middleware.rate_limit import FORGOT_PASSWORD_LIMIT, LOGIN_LIMIT, REGISTER_LIMIT
from tests.conftest import EMAIL
from tests.helpers import assert_error, login, register


async def test_login_is_limited_per_email_and_says_when_to_retry(client: AsyncClient) -> None:
    for _ in range(LOGIN_LIMIT.per_email):
        assert_error(await login(client), 401, "INVALID_CREDENTIALS")

    response = await login(client)

    assert_error(response, 429, "RATE_LIMITED")
    assert 0 < int(response.headers["Retry-After"]) <= LOGIN_LIMIT.window_seconds


async def test_login_limit_for_one_email_does_not_block_another(client: AsyncClient) -> None:
    for _ in range(LOGIN_LIMIT.per_email + 1):
        await login(client)

    assert_error(await login(client, email="other@example.com"), 401, "INVALID_CREDENTIALS")


async def test_login_is_limited_per_ip(client: AsyncClient) -> None:
    for attempt in range(LOGIN_LIMIT.per_ip):
        await login(client, email=f"user{attempt}@example.com")

    assert_error(await login(client, email="fresh@example.com"), 429, "RATE_LIMITED")


async def test_register_is_limited_per_email(client: AsyncClient) -> None:
    for _ in range(REGISTER_LIMIT.per_email):
        await register(client)

    assert_error(await register(client), 429, "RATE_LIMITED")


async def test_forgot_password_is_limited_per_email(client: AsyncClient) -> None:
    payload = {"email": EMAIL}
    for _ in range(FORGOT_PASSWORD_LIMIT.per_email):
        assert (await client.post("/api/v1/auth/forgot-password", json=payload)).status_code == 202

    assert_error(await client.post("/api/v1/auth/forgot-password", json=payload), 429, "RATE_LIMITED")


@pytest.mark.parametrize("attempts", [LOGIN_LIMIT.per_email + 2])
async def test_requests_still_work_when_redis_is_down(client: AsyncClient, attempts: int) -> None:
    unreachable = Redis(host="localhost", port=1, socket_connect_timeout=0.1)
    app.dependency_overrides[get_redis] = lambda: unreachable

    for _ in range(attempts):
        assert_error(await login(client), 401, "INVALID_CREDENTIALS")

    await unreachable.aclose()
