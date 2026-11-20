from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TransactionType = Literal["INCOME", "EXPENSE"]
PaymentMode = Literal["Cash", "UPI", "Debit Card", "Credit Card", "Other"]


class TransactionCreate(BaseModel):
    transaction_type: TransactionType
    title: str = Field(..., min_length=1, max_length=160)
    amount: Decimal = Field(..., gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    category_id: str = Field(..., min_length=1, max_length=36)
    payment_mode: PaymentMode | None = None
    transaction_date: date = Field(default_factory=date.today)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Title cannot be empty")
        return cleaned

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_payment_mode(self) -> "TransactionCreate":
        if self.transaction_type == "EXPENSE" and not self.payment_mode:
            raise ValueError("Payment mode is required for expenses")
        return self


class TransactionUpdate(BaseModel):
    transaction_type: TransactionType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    amount: Decimal | None = Field(default=None, gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    category_id: str | None = Field(default=None, min_length=1, max_length=36)
    payment_mode: PaymentMode | None = None
    transaction_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Title cannot be empty")
        return cleaned

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned or None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_type: TransactionType
    title: str
    amount: float
    category_id: str
    category_name: str
    category_color: str
    category_icon: str
    payment_mode: str | None = None
    transaction_date: date
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TransactionListResponse(BaseModel):
    items: list[TransactionOut]
    total_count: int
    total_income: float
    total_expenses: float
    net_balance: float
    page: int
    page_size: int
