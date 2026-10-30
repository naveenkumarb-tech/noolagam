from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.auth import NewPassword


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    is_verified: bool


class UpdateProfileRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class ChangePasswordRequest(BaseModel):
    current_password: Annotated[str, Field(min_length=1, max_length=1024)]
    new_password: NewPassword
