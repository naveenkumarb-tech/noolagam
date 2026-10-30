from collections.abc import Callable

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.models import RefreshToken, User
from tests.helpers import assert_error, login, refresh, register


async def test_refresh_rotates_the_token(client: AsyncClient, session: AsyncSession) -> None:
    await register(client)
    old_cookie = client.cookies["refresh_token"]

    response = await refresh(client)

    assert response.status_code == 200
    assert decode_token(response.json()["access_token"], "access")["sub"] == "1"
    assert client.cookies["refresh_token"] != old_cookie
    rows = (await session.execute(select(RefreshToken).order_by(RefreshToken.id))).scalars().all()
    assert [row.revoked_at is not None for row in rows] == [True, False]


async def test_refresh_without_a_cookie_is_rejected(client: AsyncClient) -> None:
    assert_error(await refresh(client), 401, "INVALID_REFRESH_TOKEN")


async def test_refresh_with_a_garbage_cookie_is_rejected(client: AsyncClient) -> None:
    client.cookies.set("refresh_token", "garbage")

    assert_error(await refresh(client), 401, "INVALID_REFRESH_TOKEN")


async def test_access_token_cannot_be_used_to_refresh(client: AsyncClient) -> None:
    access_token = (await register(client)).json()["access_token"]
    client.cookies.clear()
    client.cookies.set("refresh_token", access_token)

    assert_error(await refresh(client), 401, "INVALID_REFRESH_TOKEN")


async def test_reusing_a_refresh_token_revokes_every_session(
    make_client: Callable[[], AsyncClient], session: AsyncSession
) -> None:
    async with make_client() as phone, make_client() as laptop, make_client() as attacker:
        await register(phone)
        await login(laptop)
        attacker.cookies.set("refresh_token", phone.cookies["refresh_token"])
        assert (await refresh(phone)).status_code == 200

        assert_error(await refresh(attacker), 401, "INVALID_REFRESH_TOKEN")

        assert_error(await refresh(phone), 401, "INVALID_REFRESH_TOKEN")
        assert_error(await refresh(laptop), 401, "INVALID_REFRESH_TOKEN")
        assert (await session.execute(select(User))).scalar_one().token_version == 1
        assert (await login(phone)).status_code == 200


async def test_logout_revokes_the_token_and_clears_the_cookie(
    client: AsyncClient, session: AsyncSession
) -> None:
    await register(client)
    cookie = client.cookies["refresh_token"]

    response = await client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    assert "refresh_token" not in client.cookies
    assert (await session.execute(select(RefreshToken))).scalar_one().revoked_at is not None

    client.cookies.set("refresh_token", cookie)
    assert_error(await refresh(client), 401, "INVALID_REFRESH_TOKEN")


async def test_logout_only_ends_the_current_session(make_client: Callable[[], AsyncClient]) -> None:
    async with make_client() as phone, make_client() as laptop:
        await register(phone)
        await login(laptop)

        await phone.post("/api/v1/auth/logout")

        assert (await refresh(laptop)).status_code == 200


async def test_logout_works_without_a_valid_session(client: AsyncClient) -> None:
    assert (await client.post("/api/v1/auth/logout")).status_code == 204

    client.cookies.set("refresh_token", "garbage")
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
