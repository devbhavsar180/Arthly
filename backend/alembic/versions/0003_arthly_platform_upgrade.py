"""Arthly platform upgrade: OTP auth, savings goals, budgets, notifications, screenshot OCR, admin & system logs.

Revision ID: 0003_arthly_platform_upgrade
Revises: 0002_voice_and_reconciliation
Create Date: 2026-11-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_arthly_platform_upgrade"
down_revision: Union[str, None] = "0002_voice_and_reconciliation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend users table safely preserving all existing accounts
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("mobile_number", sa.String(length=20), nullable=True))
        batch_op.add_column(
            sa.Column("mobile_verified", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column("role", sa.String(length=20), nullable=False, server_default="USER")
        )
        batch_op.add_column(sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_mobile_number", "users", ["mobile_number"], unique=True)

    # 2. Extend transactions table for duplicate ref detection & source tracking
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("external_ref_id", sa.String(length=128), nullable=True))
        batch_op.add_column(
            sa.Column("source", sa.String(length=24), nullable=False, server_default="MANUAL")
        )
    op.create_index("ix_transactions_external_ref_id", "transactions", ["external_ref_id"])

    # 3. OTP Verifications table
    op.create_table(
        "otp_verifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("mobile_number", sa.String(length=20), nullable=False),
        sa.Column("purpose", sa.String(length=24), nullable=False),
        sa.Column("otp_hash", sa.String(length=64), nullable=False),
        sa.Column("verification_token_hash", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("resend_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_otp_verifications_user_id", "otp_verifications", ["user_id"])
    op.create_index("ix_otp_verifications_mobile_number", "otp_verifications", ["mobile_number"])
    op.create_index(
        "ix_otp_verifications_verification_token_hash",
        "otp_verifications",
        ["verification_token_hash"],
    )
    op.create_index(
        "ix_otp_mobile_purpose_created",
        "otp_verifications",
        ["mobile_number", "purpose", "created_at"],
    )

    # 4. Savings Goals & Contributions tables
    op.create_table(
        "savings_goals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("icon", sa.String(length=40), nullable=False, server_default="target"),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#059669"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("last_milestone_notified", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("target_amount > 0", name="ck_savings_goals_target_positive"),
        sa.CheckConstraint("current_amount >= 0", name="ck_savings_goals_current_nonneg"),
    )
    op.create_index("ix_savings_goals_user_id", "savings_goals", ["user_id"])
    op.create_index("ix_savings_goals_target_date", "savings_goals", ["target_date"])
    op.create_index("ix_savings_goals_user_status", "savings_goals", ["user_id", "status"])

    op.create_table(
        "savings_goal_contributions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("goal_id", sa.String(length=36), sa.ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("contribution_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_goal_contrib_positive"),
    )
    op.create_index("ix_goal_contrib_goal_id", "savings_goal_contributions", ["goal_id"])
    op.create_index("ix_goal_contrib_user_id", "savings_goal_contributions", ["user_id"])

    # 5. Budgets & Alert Logs tables
    op.create_table(
        "budgets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.String(length=36), sa.ForeignKey("categories.id", ondelete="CASCADE"), nullable=True),
        sa.Column("budget_scope_key", sa.String(length=64), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("limit_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("limit_amount > 0", name="ck_budgets_limit_positive"),
        sa.CheckConstraint("month >= 1 AND month <= 12", name="ck_budgets_month_valid"),
        sa.UniqueConstraint("user_id", "budget_scope_key", "month", "year", name="uq_budget_user_scope_period"),
    )
    op.create_index("ix_budgets_user_id", "budgets", ["user_id"])
    op.create_index("ix_budgets_category_id", "budgets", ["category_id"])
    op.create_index("ix_budgets_user_period", "budgets", ["user_id", "year", "month"])

    op.create_table(
        "budget_alert_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("budget_id", sa.String(length=36), sa.ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("threshold_percent", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("budget_id", "threshold_percent", "month", "year", name="uq_budget_alert_threshold_period"),
    )
    op.create_index("ix_budget_alert_logs_budget_id", "budget_alert_logs", ["budget_id"])
    op.create_index("ix_budget_alert_logs_user_id", "budget_alert_logs", ["user_id"])

    # 6. Notifications & Preferences tables
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="info"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("action_url", sa.String(length=255), nullable=True),
        sa.Column("dedup_key", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_type", "notifications", ["notification_type"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_dedup_key", "notifications", ["dedup_key"])
    op.create_index("ix_notifications_user_read_created", "notifications", ["user_id", "is_read", "created_at"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("budget_alerts_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("goal_alerts_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("unusual_spending_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("monthly_summary_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("web_push_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expo_push_token", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"], unique=True)

    # 7. Payment Screenshots table
    op.create_table(
        "payment_screenshots",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("upi_transaction_id", sa.String(length=128), nullable=True),
        sa.Column("payment_app", sa.String(length=40), nullable=True),
        sa.Column("merchant_name", sa.String(length=160), nullable=True),
        sa.Column("extracted_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("extracted_date", sa.Date(), nullable=True),
        sa.Column("extracted_category", sa.String(length=80), nullable=False, server_default="Others"),
        sa.Column("payment_description", sa.Text(), nullable=True),
        sa.Column("raw_ocr_text", sa.Text(), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("is_duplicate", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("duplicate_reason", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING_REVIEW"),
        sa.Column("linked_transaction_id", sa.String(length=36), sa.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_payment_screenshots_user_id", "payment_screenshots", ["user_id"])
    op.create_index("ix_payment_screenshots_file_hash", "payment_screenshots", ["file_hash"])
    op.create_index("ix_payment_screenshots_upi_tx_id", "payment_screenshots", ["upi_transaction_id"])
    op.create_index("ix_payment_screenshots_user_hash", "payment_screenshots", ["user_id", "file_hash"])
    op.create_index("ix_payment_screenshots_user_ref", "payment_screenshots", ["user_id", "upi_transaction_id"])

    # 8. Admin & System Management tables
    op.create_table(
        "system_categories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#2563EB"),
        sa.Column("icon", sa.String(length=40), nullable=False, server_default="tag"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("type IN ('INCOME', 'EXPENSE')", name="ck_sys_categories_type"),
        sa.UniqueConstraint("name", "type", name="uq_sys_categories_name_type"),
    )

    op.create_table(
        "app_announcements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_by_admin_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="info"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("recipients_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "app_configs",
        sa.Column("key", sa.String(length=80), primary_key=True),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "admin_activity_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("admin_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=40), nullable=True),
        sa.Column("target_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_admin_activity_logs_admin_user_id", "admin_activity_logs", ["admin_user_id"])
    op.create_index("ix_admin_activity_logs_action", "admin_activity_logs", ["action"])

    op.create_table(
        "system_activity_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("level", sa.String(length=16), nullable=False, server_default="INFO"),
        sa.Column("component", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("system_activity_logs")
    op.drop_table("admin_activity_logs")
    op.drop_table("app_configs")
    op.drop_table("app_announcements")
    op.drop_table("system_categories")
    op.drop_table("payment_screenshots")
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("budget_alert_logs")
    op.drop_table("budgets")
    op.drop_table("savings_goal_contributions")
    op.drop_table("savings_goals")
    op.drop_table("otp_verifications")
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_index("ix_transactions_external_ref_id")
        batch_op.drop_column("source")
        batch_op.drop_column("external_ref_id")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_mobile_number")
        batch_op.drop_column("last_active_at")
        batch_op.drop_column("role")
        batch_op.drop_column("mobile_verified")
        batch_op.drop_column("mobile_number")
