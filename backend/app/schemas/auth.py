from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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
    mobile_number: str | None = None
    mobile_verified: bool = False
    role: str = "USER"
    full_name: str
    is_active: bool = True
    created_at: datetime
    settings: UserSettingsOut | None = None


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    mobile_number: str | None = Field(default=None, max_length=20)


class RegisterWithOtpRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    mobile_number: str = Field(..., min_length=8, max_length=20)
    email: EmailStr | None = None
    password: str = Field(..., min_length=8, max_length=128)
    verification_token: str | None = Field(default=None, max_length=255)
    otp: str | None = Field(default=None, min_length=6, max_length=6)


class LoginRequest(BaseModel):
    # Supports email OR mobile_number OR generic identifier
    email: str | None = None
    mobile_number: str | None = None
    identifier: str | None = None
    password: str = Field(..., min_length=1, max_length=128)

    @model_validator(mode="after")
    def ensure_identifier(self) -> "LoginRequest":
        if not (self.email or self.mobile_number or self.identifier):
            raise ValueError("Email or mobile number is required.")
        return self


class LoginOtpRequest(BaseModel):
    mobile_number: str = Field(..., min_length=8, max_length=20)
    otp: str | None = Field(default=None, min_length=6, max_length=6)
    verification_token: str | None = Field(default=None, max_length=255)


OtpPurpose = Literal["REGISTER", "LOGIN", "FORGOT_PASSWORD", "VERIFY_MOBILE"]


class OtpSendRequest(BaseModel):
    mobile_number: str = Field(..., min_length=8, max_length=20)
    purpose: OtpPurpose


class OtpSendResponse(BaseModel):
    message: str
    mobile_number: str
    expires_in_seconds: int
    cooldown_seconds: int
    # Populated ONLY in non-production sandbox console mode when no SMS provider is configured
    dev_otp: str | None = None


class OtpVerifyRequest(BaseModel):
    mobile_number: str = Field(..., min_length=8, max_length=20)
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: OtpPurpose


class OtpVerifyResponse(BaseModel):
    verified: bool
    message: str
    mobile_number: str
    verification_token: str | None = None


class ResetPasswordOtpRequest(BaseModel):
    mobile_number: str = Field(..., min_length=8, max_length=20)
    verification_token: str | None = Field(default=None, max_length=255)
    otp: str | None = Field(default=None, min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordOtpRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match.")
        return self


class VerifyMobileRequest(BaseModel):
    mobile_number: str = Field(..., min_length=8, max_length=20)
    otp: str | None = Field(default=None, min_length=6, max_length=6)
    verification_token: str | None = Field(default=None, max_length=255)


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
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)
