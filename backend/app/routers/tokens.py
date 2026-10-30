from fastapi import Response

from app.core.config import get_settings
from app.schemas.auth import TokenResponse
from app.services.auth import AuthTokens

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def token_response(response: Response, tokens: AuthTokens) -> TokenResponse:
    """Sends the refresh token only as an httpOnly cookie, and the access token in the body."""
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    return TokenResponse(access_token=tokens.access_token)
