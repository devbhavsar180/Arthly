import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.reconciliation import (
    BankStatement,
    BankStatementTransaction,
    ReconciliationMatch,
    ReconciliationSession,
)
from app.models.transaction import Transaction


def _token_similarity(s1: str, s2: str) -> float:
    """Calculate token overlap Jaccard similarity."""
    t1 = set(s1.lower().replace(",", " ").replace("-", " ").split())
    t2 = set(s2.lower().replace(",", " ").replace("-", " ").split())
    if not t1 or not t2:
        return 0.0
    intersection = t1.intersection(t2)
    union = t1.union(t2)
    return len(intersection) / len(union)


class ReconciliationEngine:
    @classmethod
    def run_reconciliation(
        cls,
        db: Session,
        user_id: str,
        statement: BankStatement,
        date_tolerance_days: int = 3,
    ) -> ReconciliationSession:
        """Execute automated reconciliation between bank statement and app transactions."""
        month = statement.month
        year = statement.year

        # Calculate month date range with tolerance padding
        _, last_day = calendar.monthrange(year, month)
        start_date = date(year, month, 1) - timedelta(days=date_tolerance_days)
        end_date = date(year, month, last_day) + timedelta(days=date_tolerance_days)

        # 1. Fetch bank transactions
        bank_txs = (
            db.query(BankStatementTransaction)
            .filter(BankStatementTransaction.statement_id == statement.id)
            .order_by(BankStatementTransaction.transaction_date.asc())
            .all()
        )

        # 2. Fetch app transactions in range
        app_txs = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
            .order_by(Transaction.transaction_date.asc())
            .all()
        )

        matched_bank_ids = set()
        matched_app_ids = set()
        matches_to_create = []

        # Pass 1: Exact Amount, Compatible Type, Date within tolerance
        for b_tx in bank_txs:
            b_amount = Decimal(str(b_tx.debit_amount if b_tx.raw_type == "DEBIT" else b_tx.credit_amount))
            expected_app_type = "EXPENSE" if b_tx.raw_type == "DEBIT" else "INCOME"
            b_date = b_tx.transaction_date if isinstance(b_tx.transaction_date, date) else date.fromisoformat(str(b_tx.transaction_date))

            best_match = None
            best_score = -1.0
            best_status = "MISSING_IN_APP"

            for a_tx in app_txs:
                if a_tx.id in matched_app_ids:
                    continue
                if a_tx.transaction_type != expected_app_type:
                    continue

                a_amount = Decimal(str(a_tx.amount))
                diff_amt = abs(b_amount - a_amount)
                a_date = a_tx.transaction_date if isinstance(a_tx.transaction_date, date) else date.fromisoformat(str(a_tx.transaction_date))
                day_diff = abs((b_date - a_date).days)

                if diff_amt < Decimal("0.01") and day_diff <= date_tolerance_days:
                    # Exact amount match!
                    sim = _token_similarity(b_tx.description, f"{a_tx.title} {a_tx.notes or ''}")
                    # Score from 75 to 100 based on exact date and token similarity
                    score = 80.0 - (day_diff * 4.0) + (sim * 20.0)
                    score = max(75.0, min(100.0, score))
                    
                    if score > best_score:
                        best_score = score
                        best_match = a_tx
                        best_status = "MATCHED"

            if best_match:
                matched_bank_ids.add(b_tx.id)
                matched_app_ids.add(best_match.id)
                a_match_date = best_match.transaction_date if isinstance(best_match.transaction_date, date) else date.fromisoformat(str(best_match.transaction_date))
                matches_to_create.append({
                    "bank_transaction_id": b_tx.id,
                    "app_transaction_id": best_match.id,
                    "status": best_status,
                    "match_score": best_score,
                    "notes": f"Matched with ±{abs((b_date - a_match_date).days)} days variance",
                })

        # Pass 2: Fuzzy / Mismatch check for unmatched bank transactions
        for b_tx in bank_txs:
            if b_tx.id in matched_bank_ids:
                continue

            b_amount = Decimal(str(b_tx.debit_amount if b_tx.raw_type == "DEBIT" else b_tx.credit_amount))
            expected_app_type = "EXPENSE" if b_tx.raw_type == "DEBIT" else "INCOME"
            b_date = b_tx.transaction_date if isinstance(b_tx.transaction_date, date) else date.fromisoformat(str(b_tx.transaction_date))

            candidate = None
            cand_score = 0.0
            cand_status = "MISSING_IN_APP"

            for a_tx in app_txs:
                if a_tx.id in matched_app_ids:
                    continue
                if a_tx.transaction_type != expected_app_type:
                    continue

                a_amount = Decimal(str(a_tx.amount))
                a_date = a_tx.transaction_date if isinstance(a_tx.transaction_date, date) else date.fromisoformat(str(a_tx.transaction_date))
                day_diff = abs((b_date - a_date).days)
                sim = _token_similarity(b_tx.description, f"{a_tx.title} {a_tx.notes or ''}")

                # If descriptions strongly match or date matches exactly with slight amount diff
                if sim >= 0.4 and day_diff <= date_tolerance_days:
                    cand_score = 50.0 + (sim * 30.0)
                    cand_status = "MISMATCH"
                    candidate = a_tx
                    break
                elif day_diff == 0 and abs(b_amount - a_amount) <= Decimal("50.00"):
                    cand_score = 60.0
                    cand_status = "NEEDS_REVIEW"
                    candidate = a_tx
                    break

            if candidate:
                matched_bank_ids.add(b_tx.id)
                matched_app_ids.add(candidate.id)
                matches_to_create.append({
                    "bank_transaction_id": b_tx.id,
                    "app_transaction_id": candidate.id,
                    "status": cand_status,
                    "match_score": cand_score,
                    "notes": f"Discrepancy detected: Bank ₹{b_amount} vs App ₹{candidate.amount}",
                })
            else:
                matches_to_create.append({
                    "bank_transaction_id": b_tx.id,
                    "app_transaction_id": None,
                    "status": "MISSING_IN_APP",
                    "match_score": 0.0,
                    "notes": "Transaction present in bank statement but not recorded in app",
                })

        # Pass 3: App transactions not found in bank statement
        for a_tx in app_txs:
            a_date = a_tx.transaction_date if isinstance(a_tx.transaction_date, date) else date.fromisoformat(str(a_tx.transaction_date))
            # Only consider app transactions that strictly fall in target month
            if a_date.month == month and a_date.year == year:
                if a_tx.id not in matched_app_ids:
                    matches_to_create.append({
                        "bank_transaction_id": None,
                        "app_transaction_id": a_tx.id,
                        "status": "NOT_FOUND_IN_BANK",
                        "match_score": 0.0,
                        "notes": "Transaction recorded in app but not found in bank statement",
                    })

        # Calculate summary statistics
        matched_cnt = sum(1 for m in matches_to_create if m["status"] == "MATCHED")
        missing_cnt = sum(1 for m in matches_to_create if m["status"] == "MISSING_IN_APP")
        not_in_bank_cnt = sum(1 for m in matches_to_create if m["status"] == "NOT_FOUND_IN_BANK")
        mismatch_cnt = sum(1 for m in matches_to_create if m["status"] == "MISMATCH")
        review_cnt = sum(1 for m in matches_to_create if m["status"] == "NEEDS_REVIEW")

        summary_stats = {
            "total_bank_transactions": len(bank_txs),
            "total_app_transactions": len([a for a in app_txs if a.transaction_date.month == month and a.transaction_date.year == year]),
            "matched_count": matched_cnt,
            "missing_in_app_count": missing_cnt,
            "not_found_in_bank_count": not_in_bank_cnt,
            "mismatch_count": mismatch_cnt,
            "needs_review_count": review_cnt,
            "total_bank_debits": float(statement.total_debits),
            "total_bank_credits": float(statement.total_credits),
            "date_tolerance_days": date_tolerance_days,
        }

        # Create session
        session = ReconciliationSession(
            user_id=user_id,
            statement_id=statement.id,
            month=month,
            year=year,
            status="completed",
            summary_stats=summary_stats,
            date_tolerance_days=date_tolerance_days,
        )
        db.add(session)
        db.flush()

        for m_data in matches_to_create:
            match = ReconciliationMatch(
                session_id=session.id,
                user_id=user_id,
                bank_transaction_id=m_data["bank_transaction_id"],
                app_transaction_id=m_data["app_transaction_id"],
                status=m_data["status"],
                match_score=m_data["match_score"],
                notes=m_data["notes"],
            )
            db.add(match)

        db.commit()
        db.refresh(session)
        return session
