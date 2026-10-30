from typing import Annotated

from fastapi import APIRouter, Query

from app.routers.deps import CurrentUser, RedisDep, SessionDep
from app.schemas.stats import StatsResponse
from app.services import stats as stats_service

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
async def get_stats(
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
    year: Annotated[int | None, Query(ge=1900, le=2100)] = None,
) -> StatsResponse:
    return await stats_service.get_stats(session, redis, user.id, year)
