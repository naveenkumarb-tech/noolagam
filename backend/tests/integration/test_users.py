from collections.abc import Callable
from email.message import EmailMessage

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token
from app.middleware.rate_limit import CHANGE_PASSWORD_LIMIT
from app.models import User
from app.services.email import deliver_password_reset_email
from tests.conftest import EMAIL, NAME, PASSWORD
from tests.helpers import assert_error, auth_headers, login, refresh, register, reset_token_from

ME = "/api/v1/users/me"
CHANGE_PASSWORD = f"{ME}/change-password"
NEW_PASSWORD = "brand-new-password"


async def test_me_returns_the_profile_without_internal_fields(client: AsyncClient) -> None:
    response = await client.get("/api/v1/users/me", headers=await auth_headers(client))

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": NAME, "email": EMAIL, "is_verified": False}


async def test_me_requires_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/users/me")

    assert_error(response, 401, "NOT_AUTHENTICATED")
    assert response.headers["WWW-Authenticate"] == "Bearer"


async def test_me_rejects_an_invalid_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/users/me", headers={"Authorization": "Bearer garbage"})

    assert_error(response, 401, "NOT_AUTHENTICATED")


async def test_me_rejects_a_refresh_token(client: AsyncClient) -> None:
    await auth_headers(client)
    token = create_refresh_token(1, 0).token

    response = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})

    assert_error(response, 401, "NOT_AUTHENTICATED")


async def test_me_rejects_a_token_for_a_user_that_does_not_exist(client: AsyncClient) -> None:
    headers = {"Authorization": f"Bearer {create_access_token(999, 0)}"}

    assert_error(await client.get("/api/v1/users/me", headers=headers), 401, "NOT_AUTHENTICATED")


async def test_password_reset_ends_existing_access_tokens(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    headers = await auth_headers(client)
    await deliver_password_reset_email(session, 1)
    token = reset_token_from(sent_emails[0])
    await client.post("/api/v1/auth/reset-password", json={"token": token, "password": "brand-new-password"})

    assert_error(await client.get("/api/v1/users/me", headers=headers), 401, "NOT_AUTHENTICATED")


async def _change(
    client: AsyncClient, headers: dict[str, str], current: str = PASSWORD, new: str = NEW_PASSWORD
):
    return await client.post(
        CHANGE_PASSWORD, json={"current_password": current, "new_password": new}, headers=headers
    )


async def test_name_can_be_changed(client: AsyncClient, session: AsyncSession) -> None:
    headers = await auth_headers(client)

    response = await client.patch(ME, json={"name": "  Ravi Kumar "}, headers=headers)

    assert response.status_code == 200
    assert response.json()["name"] == "Ravi Kumar"
    assert (await client.get(ME, headers=headers)).json()["name"] == "Ravi Kumar"
    assert (await session.execute(select(User))).scalar_one().name == "Ravi Kumar"


@pytest.mark.parametrize("name", ["", "   ", "x" * 101, None])
async def test_name_is_validated(client: AsyncClient, name: object) -> None:
    headers = await auth_headers(client)

    assert_error(await client.patch(ME, json={"name": name}, headers=headers), 422, "VALIDATION_ERROR")


async def test_only_the_name_can_be_changed_this_way(client: AsyncClient) -> None:
    headers = await auth_headers(client)

    await client.patch(
        ME, json={"name": "New", "email": "evil@example.com", "is_verified": True}, headers=headers
    )

    profile = (await client.get(ME, headers=headers)).json()
    assert profile["email"] == EMAIL
    assert profile["is_verified"] is False


async def test_profile_changes_need_login(client: AsyncClient) -> None:
    assert_error(await client.patch(ME, json={"name": "x"}), 401, "NOT_AUTHENTICATED")
    assert_error(
        await client.post(CHANGE_PASSWORD, json={"current_password": "x", "new_password": NEW_PASSWORD}),
        401,
        "NOT_AUTHENTICATED",
    )


async def test_change_password_replaces_the_password(client: AsyncClient) -> None:
    headers = await auth_headers(client)

    assert (await _change(client, headers)).status_code == 200

    assert_error(await login(client, password=PASSWORD), 401, "INVALID_CREDENTIALS")
    assert (await login(client, password=NEW_PASSWORD)).status_code == 200


async def test_wrong_current_password_changes_nothing(client: AsyncClient) -> None:
    headers = await auth_headers(client)

    response = await _change(client, headers, current="wrong-password")

    # Not 401, which the app would read as an expired session.
    assert_error(response, 400, "INVALID_CURRENT_PASSWORD")
    assert (await login(client, password=PASSWORD)).status_code == 200
    assert (await client.get(ME, headers=headers)).status_code == 200


async def test_new_password_must_differ(client: AsyncClient) -> None:
    headers = await auth_headers(client)

    assert_error(await _change(client, headers, new=PASSWORD), 422, "NEW_PASSWORD_SAME")


@pytest.mark.parametrize("new", ["short12", "த" * 25])
async def test_new_password_follows_the_same_rules(client: AsyncClient, new: str) -> None:
    headers = await auth_headers(client)

    response = await _change(client, headers, new=new)

    assert_error(response, 422, "VALIDATION_ERROR")
    assert new not in response.text


async def test_change_password_ends_other_sessions_but_keeps_this_one(
    make_client: Callable[[], AsyncClient],
) -> None:
    async with make_client() as this_device, make_client() as other_device:
        token = (await register(this_device)).json()["access_token"]
        other_token = (await login(other_device)).json()["access_token"]

        response = await _change(this_device, {"Authorization": f"Bearer {token}"})

        new_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        assert (await this_device.get(ME, headers=new_headers)).status_code == 200
        assert (await refresh(this_device)).status_code == 200

        old_headers = {"Authorization": f"Bearer {other_token}"}
        assert_error(await other_device.get(ME, headers=old_headers), 401, "NOT_AUTHENTICATED")
        assert_error(await refresh(other_device), 401, "INVALID_REFRESH_TOKEN")
        # And the old device trying again must not be treated as a stolen token, ending the new session.
        assert (await refresh(this_device)).status_code == 200


async def test_the_old_access_token_stops_working_on_this_device_too(client: AsyncClient) -> None:
    headers = await auth_headers(client)

    await _change(client, headers)

    assert_error(await client.get(ME, headers=headers), 401, "NOT_AUTHENTICATED")


async def test_change_password_cancels_reset_links_already_sent(
    client: AsyncClient, session: AsyncSession, sent_emails: list[EmailMessage]
) -> None:
    headers = await auth_headers(client)
    await deliver_password_reset_email(session, 1)
    token = reset_token_from(sent_emails[0])

    await _change(client, headers)

    response = await client.post(
        "/api/v1/auth/reset-password", json={"token": token, "password": "attacker-password"}
    )
    assert_error(response, 400, "INVALID_RESET_TOKEN")


async def test_change_password_is_rate_limited(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    for _ in range(CHANGE_PASSWORD_LIMIT.per_email):
        await _change(client, headers, current="wrong-password")

    response = await _change(client, headers)

    assert_error(response, 429, "RATE_LIMITED")
    assert (await login(client, password=PASSWORD)).status_code == 200
