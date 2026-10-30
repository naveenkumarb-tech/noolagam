import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.db.session import get_session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> dict[str, str]:
    checks = {"database": "ok", "redis": "ok"}
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        logger.exception("Readiness check failed for the database")
        checks["database"] = "unavailable"
    try:
        await redis.ping()
    except (RedisError, OSError):
        logger.exception("Readiness check failed for Redis")
        checks["redis"] = "unavailable"

    is_ready = all(value == "ok" for value in checks.values())
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if is_ready else "unavailable", **checks}
