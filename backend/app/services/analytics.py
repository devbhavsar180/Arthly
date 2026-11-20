import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.transaction import Transaction
from app.schemas.dashboard import (
    CategoryBreakdownItem,
    DailyTrendItem,
    DashboardCards,
    DashboardResponse,
    HighestTransactionSummary,
    MonthlyFinancialSummary,
    MonthlyTrendItem,
)
from app.schemas.transaction import TransactionOut


def serialize_transaction(tx: Transaction) -> TransactionOut:
    return TransactionOut(
        id=tx.id,
        transaction_type=tx.transaction_type,  # type: ignore[arg-type]
        title=tx.title,
        amount=round(float(tx.amount), 2),
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else "Other",
        category_color=tx.category.color if tx.category else "#94A3B8",
        category_icon=tx.category.icon if tx.category else "tag",
        payment_mode=tx.payment_mode,
        transaction_date=tx.transaction_date,
        notes=tx.notes,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
    )


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def build_dashboard_data(
    db: Session,
    user_id: str,
    month: int | None = None,
    year: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: str | None = None,
) -> DashboardResponse:
    today = date.today()
    sel_year = year or today.year
    sel_month = month or today.month

    month_start, month_end = _month_bounds(sel_year, sel_month)
    prev_year, prev_month = _prev_month(sel_year, sel_month)
    prev_start, prev_end = _month_bounds(prev_year, prev_month)

    # Effective active window for breakdowns & daily trend
    if start_date or end_date:
        active_start = start_date or date(sel_year, 1, 1)
        active_end = end_date or today
    else:
        active_start, active_end = month_start, month_end

    # Base query for user's transactions
    base_q = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == user_id)
    )
    if category_id:
        base_q = base_q.filter(Transaction.category_id == category_id)

    all_txs = base_q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).all()

    # 1) All-time / filtered cards & Selected Month vs Previous Month
    # Cards reflect the active filtered period if date range or month/year is chosen,
    # while This Month's Expenses & Previous Month's Expenses compare selected month vs previous month.
    period_txs = [
        tx for tx in all_txs if active_start <= tx.transaction_date <= active_end
    ]
    month_txs = [
        tx for tx in all_txs if month_start <= tx.transaction_date <= month_end
    ]
    prev_month_txs = [
        tx for tx in all_txs if prev_start <= tx.transaction_date <= prev_end
    ]

    total_income = sum(
        (Decimal(tx.amount) for tx in period_txs if tx.transaction_type == "INCOME"),
        Decimal("0.00"),
    )
    total_expenses = sum(
        (Decimal(tx.amount) for tx in period_txs if tx.transaction_type == "EXPENSE"),
        Decimal("0.00"),
    )
    remaining_balance = total_income - total_expenses
    total_savings = remaining_balance

    this_month_expenses = sum(
        (Decimal(tx.amount) for tx in month_txs if tx.transaction_type == "EXPENSE"),
        Decimal("0.00"),
    )
    prev_month_expenses = sum(
        (Decimal(tx.amount) for tx in prev_month_txs if tx.transaction_type == "EXPENSE"),
        Decimal("0.00"),
    )

    cards = DashboardCards(
        total_income=round(float(total_income), 2),
        total_expenses=round(float(total_expenses), 2),
        remaining_balance=round(float(remaining_balance), 2),
        total_savings=round(float(total_savings), 2),
        this_month_expenses=round(float(this_month_expenses), 2),
        previous_month_expenses=round(float(prev_month_expenses), 2),
    )

    # 2) Monthly Financial Summary (always for sel_month / sel_year)
    monthly_income = sum(
        (Decimal(tx.amount) for tx in month_txs if tx.transaction_type == "INCOME"),
        Decimal("0.00"),
    )
    monthly_expenses = this_month_expenses
    monthly_balance = monthly_income - monthly_expenses

    month_expense_txs = [tx for tx in month_txs if tx.transaction_type == "EXPENSE"]
    cat_month_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    cat_names: dict[str, str] = {}
    for tx in month_expense_txs:
        cname = tx.category.name if tx.category else "Other"
        cat_month_totals[tx.category_id] += Decimal(tx.amount)
        cat_names[tx.category_id] = cname

    highest_cat_name = None
    highest_cat_amount = 0.0
    if cat_month_totals:
        top_cat_id = max(cat_month_totals, key=lambda cid: cat_month_totals[cid])
        highest_cat_name = cat_names[top_cat_id]
        highest_cat_amount = round(float(cat_month_totals[top_cat_id]), 2)

    highest_tx_summary = None
    if month_expense_txs:
        top_tx = max(month_expense_txs, key=lambda t: Decimal(t.amount))
        highest_tx_summary = HighestTransactionSummary(
            id=top_tx.id,
            title=top_tx.title,
            amount=round(float(top_tx.amount), 2),
            category_name=top_tx.category.name if top_tx.category else "Other",
            transaction_date=top_tx.transaction_date,
        )

    days_in_month = calendar.monthrange(sel_year, sel_month)[1]
    if sel_year == today.year and sel_month == today.month:
        elapsed_days = max(1, today.day)
    else:
        elapsed_days = days_in_month
    avg_daily_expense = round(float(monthly_expenses) / elapsed_days, 2) if monthly_expenses > 0 else 0.0

    monthly_summary = MonthlyFinancialSummary(
        month=sel_month,
        year=sel_year,
        month_label=f"{calendar.month_name[sel_month]} {sel_year}",
        total_monthly_income=round(float(monthly_income), 2),
        total_monthly_expenses=round(float(monthly_expenses), 2),
        remaining_balance=round(float(monthly_balance), 2),
        total_savings=round(float(monthly_balance), 2),
        highest_expense_category=highest_cat_name,
        highest_expense_category_amount=highest_cat_amount,
        highest_single_transaction=highest_tx_summary,
        average_daily_expense=avg_daily_expense,
        transaction_count=len(month_txs),
    )

    # 3) Category Breakdown & Category-wise Expense Analysis (active period)
    period_expenses = [tx for tx in period_txs if tx.transaction_type == "EXPENSE"]
    cat_agg: dict[str, dict] = {}
    for tx in period_expenses:
        cid = tx.category_id
        if cid not in cat_agg:
            cat_agg[cid] = {
                "category_id": cid,
                "category_name": tx.category.name if tx.category else "Other",
                "color": tx.category.color if tx.category else "#94A3B8",
                "amount": Decimal("0.00"),
                "count": 0,
            }
        cat_agg[cid]["amount"] += Decimal(tx.amount)
        cat_agg[cid]["count"] += 1

    total_exp_float = float(total_expenses)
    breakdown_items = []
    for data in sorted(cat_agg.values(), key=lambda x: x["amount"], reverse=True):
        amt = float(data["amount"])
        pct = round((amt / total_exp_float) * 100, 2) if total_exp_float > 0 else 0.0
        breakdown_items.append(
            CategoryBreakdownItem(
                category_id=data["category_id"],
                category_name=data["category_name"],
                color=data["color"],
                amount=round(amt, 2),
                percentage=pct,
                transaction_count=data["count"],
            )
        )

    # 4) Monthly Trend & Income vs Expense (all 12 months of selected year)
    monthly_map: dict[int, dict[str, Decimal]] = {
        m: {"income": Decimal("0.00"), "expenses": Decimal("0.00")} for m in range(1, 13)
    }
    for tx in all_txs:
        if tx.transaction_date.year == sel_year:
            m = tx.transaction_date.month
            if tx.transaction_type == "INCOME":
                monthly_map[m]["income"] += Decimal(tx.amount)
            else:
                monthly_map[m]["expenses"] += Decimal(tx.amount)

    monthly_trend: list[MonthlyTrendItem] = []
    for m in range(1, 13):
        inc = float(monthly_map[m]["income"])
        exp = float(monthly_map[m]["expenses"])
        monthly_trend.append(
            MonthlyTrendItem(
                month=m,
                year=sel_year,
                label=calendar.month_abbr[m],
                income=round(inc, 2),
                expenses=round(exp, 2),
                savings=round(inc - exp, 2),
            )
        )

    # 5) Daily Expense Trend (for active period, capped sensibly if very wide range)
    daily_map: dict[date, dict[str, Decimal]] = defaultdict(
        lambda: {"expenses": Decimal("0.00"), "income": Decimal("0.00")}
    )
    for tx in period_txs:
        if tx.transaction_type == "EXPENSE":
            daily_map[tx.transaction_date]["expenses"] += Decimal(tx.amount)
        else:
            daily_map[tx.transaction_date]["income"] += Decimal(tx.amount)

    daily_trend: list[DailyTrendItem] = []
    span_days = (active_end - active_start).days
    if 0 <= span_days <= 62:
        curr = active_start
        while curr <= active_end:
            vals = daily_map[curr]
            daily_trend.append(
                DailyTrendItem(
                    date=curr,
                    label=curr.strftime("%d %b"),
                    expenses=round(float(vals["expenses"]), 2),
                    income=round(float(vals["income"]), 2),
                )
            )
            curr += timedelta(days=1)
    else:
        for d in sorted(daily_map.keys()):
            vals = daily_map[d]
            daily_trend.append(
                DailyTrendItem(
                    date=d,
                    label=d.strftime("%d %b"),
                    expenses=round(float(vals["expenses"]), 2),
                    income=round(float(vals["income"]), 2),
                )
            )

    # 6) Recent Transactions (latest 10 within active period, or overall if period is empty)
    recent_source = period_txs[:10] if period_txs else all_txs[:10]
    recent_transactions = [serialize_transaction(tx) for tx in recent_source]

    return DashboardResponse(
        cards=cards,
        monthly_summary=monthly_summary,
        expense_breakdown=breakdown_items,
        monthly_trend=monthly_trend,
        income_vs_expense=monthly_trend,
        category_analysis=breakdown_items,
        daily_expense_trend=daily_trend,
        recent_transactions=recent_transactions,
    )
