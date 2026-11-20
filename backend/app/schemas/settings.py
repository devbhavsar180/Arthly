from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr


class CurrencyUpdateRequest(BaseModel):
    currency_code: str = Field(..., min_length=3, max_length=10)
    currency_symbol: str = Field(..., min_length=1, max_length=8)


class VoiceLanguageUpdateRequest(BaseModel):
    preferred_voice_language: Literal["gu", "en", "hi", "auto"] = Field(..., description="Preferred voice recognition language")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    confirmation: str = Field(..., description="Must be DELETE")


class BackupCategoryItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    type: Literal["INCOME", "EXPENSE"]
    color: str = "#2563EB"
    icon: str = "tag"
    is_default: bool = False


class BackupTransactionItem(BaseModel):
    transaction_type: Literal["INCOME", "EXPENSE"]
    title: str = Field(..., min_length=1, max_length=160)
    amount: Decimal = Field(..., gt=Decimal("0"))
    category_name: str = Field(..., min_length=1, max_length=80)
    payment_mode: str | None = None
    transaction_date: date
    notes: str | None = None


class BackupPayload(BaseModel):
    version: str = "1.0"
    exported_at: str | None = None
    settings: dict | None = None
    categories: list[BackupCategoryItem] = []
    transactions: list[BackupTransactionItem] = []
    replace_existing: bool = False
