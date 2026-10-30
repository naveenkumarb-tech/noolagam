from fastapi import Request, Response

from app.core.config import get_settings
from app.schemas.auth import TokenResponse
from app.services.auth import AuthTokens

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"
CLIENT_TYPE_HEADER = "X-Client-Type"
NATIVE_CLIENT = "native"


def cookie_token_response(response: Response, tokens: AuthTokens) -> TokenResponse:
    """For browsers: the refresh token is only in an httpOnly cookie, out of reach of JavaScript."""
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


def native_token_response(tokens: AuthTokens) -> TokenResponse:
    """For the Android app, which stores the refresh token on the device."""
    return TokenResponse(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


def token_response(request: Request, response: Response, tokens: AuthTokens) -> TokenResponse:
    """Only for requests that proved who the user is with a password.

    A session cookie alone must never produce a token in the body, or a malicious script in a browser
    could use the cookie to read the very token that the cookie exists to hide.
    """
    if request.headers.get(CLIENT_TYPE_HEADER) == NATIVE_CLIENT:
        return native_token_response(tokens)
    return cookie_token_response(response, tokens)
