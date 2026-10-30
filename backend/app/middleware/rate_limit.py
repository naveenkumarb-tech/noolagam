import hashlib
import logging
from dataclasses import dataclass

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.errors import RateLimitedError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimit:
    per_ip: int
    per_email: int
    window_seconds: int


LOGIN_LIMIT = RateLimit(per_ip=30, per_email=10, window_seconds=300)
REGISTER_LIMIT = RateLimit(per_ip=10, per_email=5, window_seconds=3600)
FORGOT_PASSWORD_LIMIT = RateLimit(per_ip=10, per_email=5, window_seconds=3600)
RESEND_VERIFICATION_LIMIT = RateLimit(per_ip=10, per_email=5, window_seconds=3600)
# Someone with a stolen session could otherwise use this to guess the password.
CHANGE_PASSWORD_LIMIT = RateLimit(per_ip=10, per_email=5, window_seconds=300)


async def _hit(redis: Redis, key: str, limit: int, window_seconds: int) -> None:
    async with redis.pipeline(transaction=True) as pipeline:
        pipeline.incr(key)
        pipeline.expire(key, window_seconds, nx=True)
        pipeline.ttl(key)
        count, _, ttl = await pipeline.execute()
    if count > limit:
        raise RateLimitedError(retry_after_seconds=max(ttl, 1))


async def enforce_rate_limit(redis: Redis, action: str, limit: RateLimit, ip: str, email: str) -> None:
    """Fails open: a Redis outage should not stop people from logging in."""
    email_hash = hashlib.sha256(email.encode()).hexdigest()
    try:
        await _hit(redis, f"rate:{action}:ip:{ip}", limit.per_ip, limit.window_seconds)
        await _hit(redis, f"rate:{action}:email:{email_hash}", limit.per_email, limit.window_seconds)
    except RedisError:
        logger.warning("Rate limiting skipped because Redis is unavailable", exc_info=True)
