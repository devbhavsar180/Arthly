"""Add voice entries and bank statement reconciliation schema.

Revision ID: 0002_voice_and_reconciliation
Revises: 0001_initial_schema
Create Date: 2026-11-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_voice_and_reconciliation"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add preferred_voice_language to user_settings
    with op.batch_alter_table("user_settings") as batch_op:
        batch_op.add_column(
            sa.Column("preferred_voice_language", sa.String(length=20), nullable=False, server_default="gu")
        )

    # 2. Voice entries table
    op.create_table(
        "voice_entries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False, server_default="gu"),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("recognized_transactions", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_voice_entries_user_id", "voice_entries", ["user_id"])

    # 3. Bank statements table
    op.create_table(
        "bank_statements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_format", sa.String(length=16), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("opening_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("closing_balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_debits", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_credits", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total_transactions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bank_statements_user_id", "bank_statements", ["user_id"])
    op.create_index("ix_bank_statements_user_period", "bank_statements", ["user_id", "year", "month"])

    # 4. Bank statement transactions table
    op.create_table(
        "bank_statement_transactions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("statement_id", sa.String(length=36), sa.ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reference_no", sa.String(length=128), nullable=True),
        sa.Column("debit_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("credit_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("raw_type", sa.String(length=16), nullable=False),
        sa.Column("balance", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_bank_stmt_tx_statement_id", "bank_statement_transactions", ["statement_id"])
    op.create_index("ix_bank_stmt_tx_user_id", "bank_statement_transactions", ["user_id"])
    op.create_index("ix_bank_stmt_tx_date", "bank_statement_transactions", ["transaction_date"])

    # 5. Reconciliation sessions table
    op.create_table(
        "reconciliation_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("statement_id", sa.String(length=36), sa.ForeignKey("bank_statements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
        sa.Column("summary_stats", sa.JSON(), nullable=False),
        sa.Column("date_tolerance_days", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rec_sessions_user_id", "reconciliation_sessions", ["user_id"])
    op.create_index("ix_rec_sessions_statement_id", "reconciliation_sessions", ["statement_id"])
    op.create_index("ix_rec_sessions_user_period", "reconciliation_sessions", ["user_id", "year", "month"])

    # 6. Reconciliation matches table
    op.create_table(
        "reconciliation_matches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), sa.ForeignKey("reconciliation_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bank_transaction_id", sa.String(length=36), sa.ForeignKey("bank_statement_transactions.id", ondelete="CASCADE"), nullable=True),
        sa.Column("app_transaction_id", sa.String(length=36), sa.ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("match_score", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("review_action", sa.String(length=32), nullable=False, server_default="NONE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rec_matches_session_id", "reconciliation_matches", ["session_id"])
    op.create_index("ix_rec_matches_user_id", "reconciliation_matches", ["user_id"])
    op.create_index("ix_rec_matches_bank_tx_id", "reconciliation_matches", ["bank_transaction_id"])
    op.create_index("ix_rec_matches_app_tx_id", "reconciliation_matches", ["app_transaction_id"])


def downgrade() -> None:
    op.drop_table("reconciliation_matches")
    op.drop_table("reconciliation_sessions")
    op.drop_table("bank_statement_transactions")
    op.drop_table("bank_statements")
    op.drop_table("voice_entries")
    with op.batch_alter_table("user_settings") as batch_op:
        batch_op.drop_column("preferred_voice_language")
