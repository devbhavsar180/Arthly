import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class OtpVerification(Base):
    __tablename__ = "otp_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    mobile_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(
        String(24), nullable=False
    )  # REGISTER | LOGIN | FORGOT_PASSWORD | VERIFY_MOBILE
    otp_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    resend_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_otp_mobile_purpose_created", "mobile_number", "purpose", "created_at"),
    )


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    target_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    icon: Mapped[str] = mapped_column(String(40), nullable=False, default="target")
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#059669")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")  # ACTIVE | COMPLETED | PAUSED
    last_milestone_notified: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    contributions: Mapped[list["SavingsGoalContribution"]] = relationship(
        "SavingsGoalContribution", back_populates="goal", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_savings_goals_target_positive"),
        CheckConstraint("current_amount >= 0", name="ck_savings_goals_current_nonneg"),
        Index("ix_savings_goals_user_status", "user_id", "status"),
    )


class SavingsGoalContribution(Base):
    __tablename__ = "savings_goal_contributions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    goal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    contribution_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    goal: Mapped["SavingsGoal"] = relationship("SavingsGoal", back_populates="contributions")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_goal_contrib_positive"),
    )


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True
    )
    budget_scope_key: Mapped[str] = mapped_column(String(64), nullable=False)  # category_id or 'OVERALL'
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    category = relationship("Category")
    alert_logs: Mapped[list["BudgetAlertLog"]] = relationship(
        "BudgetAlertLog", back_populates="budget", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("limit_amount > 0", name="ck_budgets_limit_positive"),
        CheckConstraint("month >= 1 AND month <= 12", name="ck_budgets_month_valid"),
        UniqueConstraint("user_id", "budget_scope_key", "month", "year", name="uq_budget_user_scope_period"),
        Index("ix_budgets_user_period", "user_id", "year", "month"),
    )


class BudgetAlertLog(Base):
    __tablename__ = "budget_alert_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    budget_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    threshold_percent: Mapped[int] = mapped_column(Integer, nullable=False)  # 80, 90, 100, 101 (exceeded)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="alert_logs")

    __table_args__ = (
        UniqueConstraint(
            "budget_id", "threshold_percent", "month", "year", name="uq_budget_alert_threshold_period"
        ),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="info")  # info | success | warning | danger
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    action_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_notifications_user_read_created", "user_id", "is_read", "created_at"),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    budget_alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    goal_alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    unusual_spending_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    monthly_summary_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    web_push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expo_push_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class PaymentScreenshot(Base):
    __tablename__ = "payment_screenshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    upi_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    payment_app: Mapped[str | None] = mapped_column(String(40), nullable=True)
    merchant_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    extracted_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    extracted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    extracted_category: Mapped[str] = mapped_column(String(80), nullable=False, default="Others")
    payment_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    duplicate_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="PENDING_REVIEW"
    )  # PENDING_REVIEW | CONFIRMED | DISCARDED
    linked_transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_payment_screenshots_user_hash", "user_id", "file_hash"),
        Index("ix_payment_screenshots_user_ref", "user_id", "upi_transaction_id"),
    )


class SystemCategory(Base):
    __tablename__ = "system_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # INCOME | EXPENSE
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#2563EB")
    icon: Mapped[str] = mapped_column(String(40), nullable=False, default="tag")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (
        CheckConstraint("type IN ('INCOME', 'EXPENSE')", name="ck_sys_categories_type"),
        UniqueConstraint("name", "type", name="uq_sys_categories_name_type"),
    )


class AppAnnouncement(Base):
    __tablename__ = "app_announcements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    created_by_admin_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    recipients_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class AppConfig(Base):
    __tablename__ = "app_configs"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class AdminActivityLog(Base):
    __tablename__ = "admin_activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    admin_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)


class SystemActivityLog(Base):
    __tablename__ = "system_activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default="INFO")  # INFO | WARNING | ERROR
    component: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
