import re
from email.message import EmailMessage
from typing import Any

from httpx import AsyncClient, Response

from tests.conftest import EMAIL, NAME, PASSWORD


def assert_error(response: Response, status_code: int, code: str) -> dict[str, Any]:
    assert response.status_code == status_code, response.text
    error: dict[str, Any] = response.json()["error"]
    assert error["code"] == code
    assert error["request_id"] == response.headers["X-Request-ID"]
    return error


async def register(client: AsyncClient, email: str = EMAIL, password: str = PASSWORD) -> Response:
    return await client.post(
        "/api/v1/auth/register", json={"name": NAME, "email": email, "password": password}
    )


async def login(client: AsyncClient, email: str = EMAIL, password: str = PASSWORD) -> Response:
    return await client.post("/api/v1/auth/login", json={"email": email, "password": password})


async def refresh(client: AsyncClient) -> Response:
    return await client.post("/api/v1/auth/refresh")


def reset_token_from(message: EmailMessage) -> str:
    plain = message.get_body(("plain",))
    assert plain is not None
    match = re.search(r"/reset-password\?token=([\w-]+)", plain.get_content())
    assert match is not None
    return match.group(1)


async def auth_headers(client: AsyncClient, email: str = EMAIL) -> dict[str, str]:
    response = await register(client, email=email)
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
