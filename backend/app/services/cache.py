import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

STATS_TTL_SECONDS = 60 * 60
# Outlives every cached entry, so a version number that restarts can never match an old entry.
VERSION_TTL_SECONDS = 30 * 24 * 60 * 60


def _version_key(user_id: int) -> str:
    return f"stats:version:{user_id}"


def _stats_key(user_id: int, version: str, year: int) -> str:
    return f"stats:{user_id}:{version}:{year}"


async def read_stats(redis: Redis, user_id: int, year: int) -> tuple[str | None, str | None]:
    """Returns the cached JSON, if any, and the version it should be saved under.

    Saving under the version read before the stats were calculated means that a book changing in the
    meantime leaves those now out-of-date stats where nothing will read them.
    """
    try:
        version = await redis.get(_version_key(user_id)) or "0"
        return await redis.get(_stats_key(user_id, version, year)), version
    except RedisError:
        logger.warning("Stats cache skipped because Redis is unavailable", exc_info=True)
        return None, None


async def save_stats(redis: Redis, user_id: int, version: str | None, year: int, stats_json: str) -> None:
    if version is None:
        return
    try:
        await redis.set(_stats_key(user_id, version, year), stats_json, ex=STATS_TTL_SECONDS)
    except RedisError:
        logger.warning("Stats not cached because Redis is unavailable", exc_info=True)


async def invalidate_stats(redis: Redis, user_id: int) -> None:
    try:
        async with redis.pipeline(transaction=True) as pipeline:
            pipeline.incr(_version_key(user_id))
            pipeline.expire(_version_key(user_id), VERSION_TTL_SECONDS)
            await pipeline.execute()
    except RedisError:
        logger.warning("Stats cache for user %s may be out of date for up to an hour", user_id, exc_info=True)
