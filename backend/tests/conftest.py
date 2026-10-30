import asyncio
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field
from email.message import EmailMessage
from typing import Any

import httpx
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_session
from app.main import app
from app.services import email as email_service
from app.services import open_library
from app.worker import tasks

TEST_DATABASE = "noolagam_test"
TEST_REDIS_DB = 15

PASSWORD = "secret-password-1"
NAME = "Ravi"
EMAIL = "ravi@example.com"


def _test_database_url() -> str:
    url = make_url(get_settings().database_url).set(database=TEST_DATABASE)
    return url.render_as_string(hide_password=False)


async def _create_test_database() -> None:
    admin_engine = create_async_engine(
        get_settings().database_url, poolclass=NullPool, isolation_level="AUTOCOMMIT"
    )
    async with admin_engine.connect() as connection:
        await connection.execute(text(f"DROP DATABASE IF EXISTS {TEST_DATABASE} WITH (FORCE)"))
        await connection.execute(text(f"CREATE DATABASE {TEST_DATABASE}"))
    await admin_engine.dispose()


def alembic_config() -> Config:
    config = Config("alembic.ini")
    config.attributes["database_url"] = _test_database_url()
    return config


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    asyncio.run(_create_test_database())
    command.upgrade(alembic_config(), "head")


@pytest.fixture(autouse=True)
def _fast_password_hashing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "bcrypt_rounds", 4)


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    test_engine = create_async_engine(_test_database_url(), poolclass=NullPool)
    async with test_engine.begin() as connection:
        await connection.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
    yield test_engine
    await test_engine.dispose()


@pytest.fixture
def sessions(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def session(sessions: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with sessions() as db_session:
        yield db_session


@pytest.fixture
async def redis() -> AsyncIterator[Redis]:
    base_url = get_settings().redis_url.rsplit("/", 1)[0]
    client: Redis = Redis.from_url(f"{base_url}/{TEST_REDIS_DB}", decode_responses=True)
    await client.flushdb()
    yield client
    await client.aclose()


@pytest.fixture(autouse=True)
def _overrides(sessions: async_sessionmaker[AsyncSession], redis: Redis) -> Any:
    async def override_session() -> AsyncIterator[AsyncSession]:
        async with sessions() as db_session:
            yield db_session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_redis] = lambda: redis
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def make_client() -> Callable[[], AsyncClient]:
    """Each client has its own cookies, like a separate device."""

    def _make() -> AsyncClient:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        return AsyncClient(transport=transport, base_url="http://testserver.local")

    return _make


@pytest.fixture
async def client(make_client: Callable[[], AsyncClient]) -> AsyncIterator[AsyncClient]:
    async with make_client() as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def queued_reset_emails(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    queued: list[int] = []
    monkeypatch.setattr(
        tasks.send_password_reset_email,
        "apply_async",
        lambda args, retry: queued.append(args[0]),
    )
    return queued


@pytest.fixture(autouse=True)
def queued_enrichments(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    queued: list[int] = []
    monkeypatch.setattr(tasks.enrich_book, "apply_async", lambda args, retry: queued.append(args[0]))
    return queued


@dataclass
class FakeOpenLibrary:
    """Stands in for openlibrary.org, so that no test ever reaches the real service."""

    docs: list[dict[str, Any]] = field(default_factory=list)
    edition: dict[str, Any] | None = None
    works: dict[str, dict[str, Any]] = field(default_factory=dict)
    error_status: int | None = None
    connection_fails: bool = False
    requests: list[httpx.Request] = field(default_factory=list)

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.connection_fails:
            raise httpx.ConnectTimeout("timed out", request=request)
        if self.error_status:
            return httpx.Response(self.error_status)
        path = request.url.path
        if path == "/search.json":
            return httpx.Response(200, json={"docs": self.docs})
        if path == "/api/books":
            key = request.url.params["bibkeys"]
            return httpx.Response(200, json={key: {"details": self.edition}} if self.edition else {})
        work = self.works.get(path.removesuffix(".json"))
        return httpx.Response(200, json=work) if work else httpx.Response(404)


@pytest.fixture(autouse=True)
def fake_open_library(monkeypatch: pytest.MonkeyPatch) -> FakeOpenLibrary:
    fake = FakeOpenLibrary()

    def create_client() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(fake.handle), base_url=open_library.BASE_URL)

    monkeypatch.setattr(open_library, "create_client", create_client)
    return fake


@pytest.fixture
def sent_emails(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    sent: list[EmailMessage] = []
    monkeypatch.setattr(email_service, "send_message", sent.append)
    return sent
