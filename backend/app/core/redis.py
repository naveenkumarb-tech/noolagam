from typing import cast

from fastapi import Request
from redis.asyncio import Redis

from app.core.config import get_settings


def create_redis() -> Redis:
    client: Redis = Redis.from_url(
        get_settings().redis_url,
        decode_responses=True,
        socket_connect_timeout=1,
        socket_timeout=1,
    )
    return client


def get_redis(request: Request) -> Redis:
    return cast(Redis, request.app.state.redis)
