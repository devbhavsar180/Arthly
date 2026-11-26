import calendar
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.finance_plus import Budget, BudgetAlertLog
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.arthly_plus import (
    BudgetHistoryItem,
    BudgetOut,
    BudgetPeriodSummary,
    BudgetUpsertRequest,
)
from app.services.notification_service import evaluate_budgets_for_user

router = APIRouter(prefix="/budgets", tags=["Budgets & Alerts"])


def _alert_status_from_pct(pct: float) -> str:
    if pct > 100.001:
        return "EXCEEDED"
    if pct >= 100.0:
        return "REACHED_100"
    if pct >= 90.0:
        return "WARNING_90"
    if pct >= 80.0:
        return "WARNING_80"
    return "OK"


def _build_budget_out(
    b: Budget,
    spent: Decimal,
    triggered_thresholds: list[int],
) -> BudgetOut:
    limit_f = float(b.limit_amount)
    spent_f = float(spent)
    rem_f = round(limit_f - spent_f, 2)
    pct = round((spent_f / limit_f) * 100, 2) if limit_f > 0 else 0.0
    is_overall = b.category_id is None
    return BudgetOut(
        id=b.id,
        category_id=b.category_id,
        category_name="Overall Monthly Budget" if is_overall else (b.category.name if b.category else "Category"),
        category_color="#2563EB" if is_overall else (b.category.color if b.category else "#64748B"),
        is_overall=is_overall,
        month=b.month,
        year=b.year,
        limit_amount=round(limit_f, 2),
        spent_amount=round(spent_f, 2),
        remaining_amount=rem_f,
        utilization_percentage=pct,
        alert_status=_alert_status_from_pct(pct),  # type: ignore[arg-type]
        triggered_thresholds=sorted(triggered_thresholds),
    )


@router.get("", response_model=BudgetPeriodSummary)
def get_budgets_for_period(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    sel_month = month or today.month
    sel_year = year or today.year

    budgets = (
        db.query(Budget)
        .options(joinedload(Budget.category), joinedload(Budget.alert_logs))
        .filter(Budget.user_id == current_user.id, Budget.month == sel_month, Budget.year == sel_year)
        .all()
    )

    last_day = calendar.monthrange(sel_year, sel_month)[1]
    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.transaction_type == "EXPENSE",
            Transaction.transaction_date >= date(sel_year, sel_month, 1),
            Transaction.transaction_date <= date(sel_year, sel_month, last_day),
        )
        .all()
    )

    total_spent = sum((Decimal(str(t.amount)) for t in expenses), Decimal("0.00"))
    spent_by_cat: dict[str, Decimal] = {}
    for t in expenses:
        spent_by_cat[t.category_id] = spent_by_cat.get(t.category_id, Decimal("0.00")) + Decimal(str(t.amount))

    overall_out: BudgetOut | None = None
    category_outs: list[BudgetOut] = []
    alerts_count = 0

    for b in budgets:
        spent = total_spent if b.category_id is None else spent_by_cat.get(b.category_id, Decimal("0.00"))
        logs = [l.threshold_percent for l in (b.alert_logs or []) if l.month == sel_month and l.year == sel_year]
        if logs:
            alerts_count += 1
        out = _build_budget_out(b, spent, logs)
        if out.is_overall:
            overall_out = out
        else:
            category_outs.append(out)

    category_outs.sort(key=lambda x: x.utilization_percentage, reverse=True)

    return BudgetPeriodSummary(
        month=sel_month,
        year=sel_year,
        month_label=f"{calendar.month_name[sel_month]} {sel_year}",
        overall_budget=overall_out,
        category_budgets=category_outs,
        total_budgeted_categories=round(sum(c.limit_amount for c in category_outs), 2),
        total_spent_in_budgeted_categories=round(sum(c.spent_amount for c in category_outs), 2),
        total_monthly_expenses=round(float(total_spent), 2),
        alerts_triggered_count=alerts_count,
    )


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def upsert_budget(
    payload: BudgetUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_key = "OVERALL"
    if payload.category_id:
        cat = (
            db.query(Category)
            .filter(Category.id == payload.category_id, Category.user_id == current_user.id)
            .first()
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
        if cat.type != "EXPENSE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Budgets can only be set for expense categories.",
            )
        scope_key = cat.id

    existing = (
        db.query(Budget)
        .filter(
            Budget.user_id == current_user.id,
            Budget.budget_scope_key == scope_key,
            Budget.month == payload.month,
            Budget.year == payload.year,
        )
        .first()
    )

    if existing:
        existing.limit_amount = payload.limit_amount
        budget = existing
        # Reset alert thresholds that are no longer reached under the raised limit
        last_day = calendar.monthrange(payload.year, payload.month)[1]
        expenses = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.transaction_type == "EXPENSE",
                Transaction.transaction_date >= date(payload.year, payload.month, 1),
                Transaction.transaction_date <= date(payload.year, payload.month, last_day),
            )
            .all()
        )
        spent_val = sum(
            (Decimal(str(t.amount)) for t in expenses if payload.category_id is None or t.category_id == payload.category_id),
            Decimal("0.00"),
        )
        new_pct = float((spent_val / Decimal(str(payload.limit_amount))) * Decimal("100"))
        db.query(BudgetAlertLog).filter(
            BudgetAlertLog.budget_id == budget.id,
            BudgetAlertLog.threshold_percent > int(new_pct),
        ).delete()
    else:
        budget = Budget(
            user_id=current_user.id,
            category_id=payload.category_id,
            budget_scope_key=scope_key,
            month=payload.month,
            year=payload.year,
            limit_amount=payload.limit_amount,
        )
        db.add(budget)

    db.flush()
    evaluate_budgets_for_user(db, current_user.id, payload.month, payload.year)
    db.commit()

    budget = (
        db.query(Budget)
        .options(joinedload(Budget.category), joinedload(Budget.alert_logs))
        .filter(Budget.id == budget.id)
        .first()
    )

    last_day = calendar.monthrange(payload.year, payload.month)[1]
    q = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == "EXPENSE",
        Transaction.transaction_date >= date(payload.year, payload.month, 1),
        Transaction.transaction_date <= date(payload.year, payload.month, last_day),
    )
    if budget.category_id:
        q = q.filter(Transaction.category_id == budget.category_id)
    spent = sum((Decimal(str(t.amount)) for t in q.all()), Decimal("0.00"))
    logs = [l.threshold_percent for l in (budget.alert_logs or [])]
    return _build_budget_out(budget, spent, logs)


@router.post("/copy-previous")
def copy_previous_month_budgets(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prev_m = 12 if month == 1 else month - 1
    prev_y = year - 1 if month == 1 else year

    prev_budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.month == prev_m, Budget.year == prev_y)
        .all()
    )
    if not prev_budgets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No budgets found in the previous month to copy.",
        )

    existing_scopes = {
        b.budget_scope_key
        for b in db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.month == month, Budget.year == year)
        .all()
    }

    copied = 0
    for pb in prev_budgets:
        if pb.budget_scope_key not in existing_scopes:
            db.add(
                Budget(
                    user_id=current_user.id,
                    category_id=pb.category_id,
                    budget_scope_key=pb.budget_scope_key,
                    month=month,
                    year=year,
                    limit_amount=pb.limit_amount,
                )
            )
            copied += 1

    db.flush()
    evaluate_budgets_for_user(db, current_user.id, month, year)
    db.commit()
    return {"message": f"Copied {copied} budget(s) from {calendar.month_name[prev_m]} {prev_y}.", "copied": copied}


@router.get("/history", response_model=list[BudgetHistoryItem])
def get_budget_history(
    months: int = Query(default=6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    periods: list[tuple[int, int]] = []
    cur_m, cur_y = today.month, today.year
    for _ in range(months):
        periods.append((cur_y, cur_m))
        if cur_m == 1:
            cur_m = 12
            cur_y -= 1
        else:
            cur_m -= 1
    periods.reverse()

    all_budgets = db.query(Budget).filter(Budget.user_id == current_user.id).all()
    all_expenses = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.transaction_type == "EXPENSE")
        .all()
    )

    items: list[BudgetHistoryItem] = []
    for y, m in periods:
        period_budgets = [b for b in all_budgets if b.year == y and b.month == m]
        overall = next((b for b in period_budgets if b.category_id is None), None)
        if overall:
            limit_amt = float(overall.limit_amount)
        else:
            limit_amt = sum(float(b.limit_amount) for b in period_budgets)

        spent = sum(
            (float(t.amount) for t in all_expenses if t.transaction_date.year == y and t.transaction_date.month == m),
            0.0,
        )
        pct = round((spent / limit_amt) * 100, 1) if limit_amt > 0 else 0.0
        items.append(
            BudgetHistoryItem(
                month=m,
                year=y,
                label=f"{calendar.month_abbr[m]} {y}",
                overall_limit=round(limit_amt, 2),
                total_spent=round(spent, 2),
                utilization_percentage=pct,
                status=_alert_status_from_pct(pct) if limit_amt > 0 else "NO_BUDGET",
            )
        )
    return items


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found.")
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted successfully."}
