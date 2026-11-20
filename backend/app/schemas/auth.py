from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency_code: str
    currency_symbol: str
    theme: str
    preferred_voice_language: str = "gu"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    created_at: datetime
    settings: UserSettingsOut | None = None


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Returned only in local development mode when SMTP is not configured
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)
