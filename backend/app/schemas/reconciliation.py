from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class BankStatementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    file_format: str
    month: int
    year: int
    opening_balance: Decimal | None = None
    closing_balance: Decimal | None = None
    total_debits: Decimal
    total_credits: Decimal
    total_transactions: int
    created_at: datetime


class BankStatementTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_date: date
    description: str
    reference_no: str | None = None
    debit_amount: Decimal
    credit_amount: Decimal
    raw_type: str
    balance: Decimal | None = None


class AppTransactionBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_type: str
    title: str
    amount: Decimal
    payment_mode: str | None = None
    transaction_date: date
    notes: str | None = None
    category_name: str | None = None


class ReconciliationMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    status: str
    match_score: float
    review_action: str
    notes: str | None = None
    bank_transaction: BankStatementTransactionOut | None = None
    app_transaction: AppTransactionBrief | None = None


class ReconciliationSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    month: int
    year: int
    status: str
    summary_stats: dict[str, Any]
    date_tolerance_days: int
    created_at: datetime
    statement: BankStatementOut | None = None
    matches: list[ReconciliationMatchOut] = []


class MatchActionRequest(BaseModel):
    action: Literal["CONFIRMED", "REJECTED", "CREATED_EXPENSE", "CREATED_INCOME", "IGNORED"]
    category_id: str | None = None
    notes: str | None = None
