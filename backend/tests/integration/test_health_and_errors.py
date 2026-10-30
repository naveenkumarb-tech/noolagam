import pytest
from httpx import AsyncClient
from redis.asyncio import Redis

from app.core.redis import get_redis
from app.main import app
from app.repositories import users
from tests.conftest import EMAIL, PASSWORD
from tests.helpers import assert_error


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_when_everything_is_up(client: AsyncClient) -> None:
    response = await client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "redis": "ok"}


async def test_not_ready_when_redis_is_down(client: AsyncClient) -> None:
    unreachable = Redis(host="localhost", port=1, socket_connect_timeout=0.1)
    app.dependency_overrides[get_redis] = lambda: unreachable

    response = await client.get("/ready")

    assert response.status_code == 503
    assert response.json()["redis"] == "unavailable"
    await unreachable.aclose()


async def test_request_id_is_generated_when_missing(client: AsyncClient) -> None:
    assert (await client.get("/health")).headers["X-Request-ID"]


async def test_request_id_is_kept_when_valid(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "abc-123"})

    assert response.headers["X-Request-ID"] == "abc-123"


async def test_request_id_is_replaced_when_unsafe(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "bad id\twith spaces"})

    assert response.headers["X-Request-ID"] != "bad id\twith spaces"


async def test_unknown_route_uses_the_error_format(client: AsyncClient) -> None:
    assert_error(await client.get("/nope"), 404, "HTTP_404")


async def test_unexpected_error_is_a_clean_500(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def explode(*_: object) -> None:
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(users, "get_by_email", explode)

    response = await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})

    assert_error(response, 500, "INTERNAL_ERROR")
    assert "secret internal detail" not in response.text
