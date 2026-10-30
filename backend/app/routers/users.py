from fastapi import APIRouter, Request, Response

from app.middleware.rate_limit import CHANGE_PASSWORD_LIMIT, enforce_rate_limit
from app.routers.deps import CurrentUser, RedisDep, SessionDep
from app.routers.tokens import token_response
from app.schemas.auth import TokenResponse
from app.schemas.user import ChangePasswordRequest, UpdateProfileRequest, UserResponse
from app.services import auth as auth_service
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)


@router.patch("/me")
async def update_me(data: UpdateProfileRequest, user: CurrentUser, session: SessionDep) -> UserResponse:
    return UserResponse.model_validate(await users_service.update_profile(session, user, data))


@router.post("/me/change-password", response_model_exclude_none=True)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> TokenResponse:
    ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(redis, "change_password", CHANGE_PASSWORD_LIMIT, ip, user.email)
    return token_response(request, response, await auth_service.change_password(session, user, data))
