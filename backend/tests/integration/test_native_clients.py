from collections.abc import Callable

import pytest
from httpx import AsyncClient

from app.core.security import decode_token
from tests.conftest import EMAIL, NAME, PASSWORD
from tests.helpers import assert_error, register

AUTH = "/api/v1/auth"
NATIVE = {"X-Client-Type": "native"}


async def _native_register(client: AsyncClient) -> dict[str, str]:
    response = await client.post(
        f"{AUTH}/register", json={"name": NAME, "email": EMAIL, "password": PASSWORD}, headers=NATIVE
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_register_gives_the_app_its_refresh_token_without_a_cookie(client: AsyncClient) -> None:
    response = await client.post(
        f"{AUTH}/register", json={"name": NAME, "email": EMAIL, "password": PASSWORD}, headers=NATIVE
    )

    body = response.json()
    assert decode_token(body["refresh_token"], "refresh")["sub"] == "1"
    assert decode_token(body["access_token"], "access")["sub"] == "1"
    assert "set-cookie" not in response.headers


async def test_login_gives_the_app_its_refresh_token(client: AsyncClient) -> None:
    await register(client)
    client.cookies.clear()

    response = await client.post(f"{AUTH}/login", json={"email": EMAIL, "password": PASSWORD}, headers=NATIVE)

    assert response.status_code == 200
    assert response.json()["refresh_token"]
    assert "set-cookie" not in response.headers


async def test_browser_responses_are_unchanged(client: AsyncClient) -> None:
    response = await register(client)

    assert set(response.json()) == {"access_token", "token_type"}
    assert "refresh_token=" in response.headers["set-cookie"]


async def test_refresh_with_a_token_in_the_body_rotates_it(client: AsyncClient) -> None:
    old = (await _native_register(client))["refresh_token"]

    response = await client.post(f"{AUTH}/refresh", json={"refresh_token": old})

    assert response.status_code == 200
    new = response.json()["refresh_token"]
    assert new != old
    assert "set-cookie" not in response.headers
    assert (await client.post(f"{AUTH}/refresh", json={"refresh_token": new})).status_code == 200


async def test_reusing_an_old_token_in_the_body_ends_the_session(client: AsyncClient) -> None:
    old = (await _native_register(client))["refresh_token"]
    new = (await client.post(f"{AUTH}/refresh", json={"refresh_token": old})).json()["refresh_token"]

    response = await client.post(f"{AUTH}/refresh", json={"refresh_token": old})

    assert_error(response, 401, "INVALID_REFRESH_TOKEN")
    assert_error(
        await client.post(f"{AUTH}/refresh", json={"refresh_token": new}), 401, "INVALID_REFRESH_TOKEN"
    )


@pytest.mark.parametrize("payload", [{"refresh_token": "garbage"}, {"refresh_token": ""}, {}])
async def test_refresh_rejects_a_bad_token_in_the_body(client: AsyncClient, payload: dict[str, str]) -> None:
    response = await client.post(f"{AUTH}/refresh", json=payload)

    assert response.status_code in (401, 422)


async def test_a_cookie_alone_never_reveals_the_token_even_when_asking_as_native(client: AsyncClient) -> None:
    await register(client)

    response = await client.post(f"{AUTH}/refresh", headers=NATIVE)

    assert response.status_code == 200
    assert "refresh_token" not in response.json()
    assert "refresh_token=" in response.headers["set-cookie"]


async def test_logout_with_a_token_in_the_body_ends_only_that_session(
    make_client: Callable[[], AsyncClient],
) -> None:
    async with make_client() as app, make_client() as browser:
        token = (await _native_register(app))["refresh_token"]
        await browser.post(f"{AUTH}/login", json={"email": EMAIL, "password": PASSWORD})

        assert (await app.post(f"{AUTH}/logout", json={"refresh_token": token})).status_code == 204

        assert (await browser.post(f"{AUTH}/refresh")).status_code == 200
        # Last, because reusing a revoked token counts as theft and ends every session.
        assert_error(
            await app.post(f"{AUTH}/refresh", json={"refresh_token": token}), 401, "INVALID_REFRESH_TOKEN"
        )


async def test_change_password_gives_the_app_its_new_session(client: AsyncClient) -> None:
    tokens = await _native_register(client)

    response = await client.post(
        "/api/v1/users/me/change-password",
        json={"current_password": PASSWORD, "new_password": "brand-new-password"},
        headers={**NATIVE, "Authorization": f"Bearer {tokens['access_token']}"},
    )

    new = response.json()["refresh_token"]
    assert (await client.post(f"{AUTH}/refresh", json={"refresh_token": new})).status_code == 200
    assert_error(
        await client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]}),
        401,
        "INVALID_REFRESH_TOKEN",
    )


@pytest.mark.parametrize("origin", ["http://localhost", "https://localhost", "http://localhost:5173"])
async def test_the_app_and_the_website_are_allowed_origins(client: AsyncClient, origin: str) -> None:
    response = await client.options(
        f"{AUTH}/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-client-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


async def test_other_origins_are_refused(client: AsyncClient) -> None:
    response = await client.options(
        f"{AUTH}/login",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )

    assert "access-control-allow-origin" not in response.headers
