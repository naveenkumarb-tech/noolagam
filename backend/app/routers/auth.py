from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Request, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.db.session import get_session
from app.middleware.rate_limit import (
    FORGOT_PASSWORD_LIMIT,
    LOGIN_LIMIT,
    REGISTER_LIMIT,
    enforce_rate_limit,
)
from app.routers.tokens import REFRESH_COOKIE, REFRESH_COOKIE_PATH, token_response
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services import auth as auth_service
from app.worker.tasks import enqueue_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
RedisDep = Annotated[Redis, Depends(get_redis)]
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, request: Request, response: Response, session: SessionDep, redis: RedisDep
) -> TokenResponse:
    await enforce_rate_limit(redis, "register", REGISTER_LIMIT, _client_ip(request), data.email)
    return token_response(response, await auth_service.register(session, data))


@router.post("/login")
async def login(
    data: LoginRequest, request: Request, response: Response, session: SessionDep, redis: RedisDep
) -> TokenResponse:
    await enforce_rate_limit(redis, "login", LOGIN_LIMIT, _client_ip(request), data.email)
    return token_response(response, await auth_service.login(session, data))


@router.post("/refresh")
async def refresh(
    response: Response, session: SessionDep, refresh_token: RefreshCookie = None
) -> TokenResponse:
    return token_response(response, await auth_service.refresh(session, refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, session: SessionDep, refresh_token: RefreshCookie = None) -> None:
    await auth_service.logout(session, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    redis: RedisDep,
) -> MessageResponse:
    await enforce_rate_limit(redis, "forgot_password", FORGOT_PASSWORD_LIMIT, _client_ip(request), data.email)
    user_id = await auth_service.find_user_id_for_password_reset(session, data.email)
    if user_id is not None:
        # Queued after the response, so response time does not reveal whether the email is registered.
        background_tasks.add_task(enqueue_password_reset_email, user_id)
    return MessageResponse(message="If an account exists for this email, a reset link is on its way.")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(data: ResetPasswordRequest, session: SessionDep) -> None:
    await auth_service.reset_password(session, data)
