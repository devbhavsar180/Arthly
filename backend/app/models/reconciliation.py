import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class VoiceEntry(Base):
    __tablename__ = "voice_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String(20), nullable=False, default="gu")
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    recognized_transactions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft, confirmed, cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    user: Mapped["User"] = relationship("User")


class BankStatement(Base):
    __tablename__ = "bank_statements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str] = mapped_column(String(16), nullable=False)  # pdf, csv, xlsx
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    closing_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_debits: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_credits: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_transactions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    user: Mapped["User"] = relationship("User")
    transactions: Mapped[list["BankStatementTransaction"]] = relationship(
        "BankStatementTransaction", back_populates="statement", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["ReconciliationSession"]] = relationship(
        "ReconciliationSession", back_populates="statement", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_bank_statements_user_period", "user_id", "year", "month"),
    )


class BankStatementTransaction(Base):
    __tablename__ = "bank_statement_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    statement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(128), nullable=True)
    debit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    credit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    raw_type: Mapped[str] = mapped_column(String(16), nullable=False)  # DEBIT | CREDIT
    balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    statement: Mapped["BankStatement"] = relationship("BankStatement", back_populates="transactions")
    user: Mapped["User"] = relationship("User")


class ReconciliationSession(Base):
    __tablename__ = "reconciliation_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    statement_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")  # pending, completed
    summary_stats: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    date_tolerance_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    statement: Mapped["BankStatement"] = relationship("BankStatement", back_populates="sessions")
    user: Mapped["User"] = relationship("User")
    matches: Mapped[list["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch", back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_rec_sessions_user_period", "user_id", "year", "month"),
    )


class ReconciliationMatch(Base):
    __tablename__ = "reconciliation_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("reconciliation_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bank_transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bank_statement_transactions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    app_transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # MATCHED, MISSING_IN_APP, NOT_FOUND_IN_BANK, MISMATCH, NEEDS_REVIEW
    match_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    review_action: Mapped[str] = mapped_column(
        String(32), nullable=False, default="NONE"
    )  # NONE, CONFIRMED, REJECTED, CREATED_EXPENSE, CREATED_INCOME, IGNORED
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    session: Mapped["ReconciliationSession"] = relationship("ReconciliationSession", back_populates="matches")
    bank_transaction: Mapped["BankStatementTransaction | None"] = relationship("BankStatementTransaction")
    app_transaction: Mapped["Transaction | None"] = relationship("Transaction")
