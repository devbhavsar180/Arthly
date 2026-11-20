from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field


class VoiceParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Transcribed or typed speech text")
    language: Literal["gu", "en", "hi", "auto"] = "auto"


class CandidateTransaction(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    amount: Decimal | None = None
    category_name: str = Field(..., min_length=1, max_length=80)
    transaction_type: Literal["INCOME", "EXPENSE"] = "EXPENSE"
    transaction_date: date
    payment_mode: str = "Cash"
    notes: str | None = None
    confidence: float = 0.9
    requires_attention: bool = False
    warning: str | None = None


class VoiceParseResponse(BaseModel):
    raw_text: str
    detected_language: str
    preferred_language: str
    transactions: list[CandidateTransaction]
    warnings: list[str] = []


class VoiceConfirmItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    amount: Decimal = Field(..., gt=Decimal("0"))
    category_name: str = Field(..., min_length=1, max_length=80)
    transaction_type: Literal["INCOME", "EXPENSE"] = "EXPENSE"
    transaction_date: date
    payment_mode: str = "Cash"
    notes: str | None = None


class VoiceConfirmRequest(BaseModel):
    raw_text: str = Field(..., max_length=2000)
    language: str = "gu"
    transactions: list[VoiceConfirmItem] = Field(..., min_length=1)


class VoiceEntryOut(BaseModel):
    id: str
    language: str
    raw_text: str
    recognized_transactions: list[dict[str, Any]]
    status: str
    created_at: datetime
