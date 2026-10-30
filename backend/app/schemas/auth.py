from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.core.security import BCRYPT_MAX_BYTES


def _lowercase(email: str) -> str:
    return email.lower()


def _check_new_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Use at least 8 characters")
    if len(password.encode()) > BCRYPT_MAX_BYTES:
        raise ValueError("That password is too long")
    return password


Email = Annotated[EmailStr, Field(max_length=255), AfterValidator(_lowercase)]
NewPassword = Annotated[str, AfterValidator(_check_new_password)]


class RegisterRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    email: Email
    password: NewPassword


class LoginRequest(BaseModel):
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=1024)]


class ForgotPasswordRequest(BaseModel):
    email: Email


class ResetPasswordRequest(BaseModel):
    token: Annotated[str, Field(min_length=1, max_length=255)]
    password: NewPassword


class RefreshRequest(BaseModel):
    """Sent by the Android app, which keeps its refresh token on the device instead of in a cookie."""

    refresh_token: Annotated[str, Field(min_length=1, max_length=4096)]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: Literal["bearer"] = "bearer"  # noqa: S105


class MessageResponse(BaseModel):
    message: str
