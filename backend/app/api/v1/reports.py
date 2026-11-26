import calendar
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.finance_plus import Budget, SavingsGoal
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.arthly_plus import (
    BudgetVsActualItem,
    EnhancedAnalyticsResponse,
    MonthlySavingsHistoryItem,
    WeeklySpendItem,
)
from app.services.reports import generate_csv_report, generate_excel_report, generate_pdf_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/analytics", response_model=EnhancedAnalyticsResponse)
def get_enhanced_analytics(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    sel_month = month or today.month
    sel_year = year or today.year

    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == current_user.id)
        .all()
    )

    # 1. Weekly analysis (last 6 calendar weeks up to selected month end or today)
    ref_end = min(
        today if (sel_year == today.year and sel_month == today.month) else date(sel_year, sel_month, calendar.monthrange(sel_year, sel_month)[1]),
        date(sel_year, sel_month, calendar.monthrange(sel_year, sel_month)[1]),
    )
    current_week_start = ref_end - timedelta(days=ref_end.weekday())
    weekly_analysis: list[WeeklySpendItem] = []
    for i in range(5, -1, -1):
        ws = current_week_start - timedelta(days=i * 7)
        we = ws + timedelta(days=6)
        w_inc = sum((float(t.amount) for t in txs if ws <= t.transaction_date <= we and t.transaction_type == "INCOME"), 0.0)
        w_exp = sum((float(t.amount) for t in txs if ws <= t.transaction_date <= we and t.transaction_type == "EXPENSE"), 0.0)
        weekly_analysis.append(
            WeeklySpendItem(
                week_label=f"{ws.strftime('%d %b')}",
                start_date=ws,
                end_date=we,
                income=round(w_inc, 2),
                expenses=round(w_exp, 2),
                savings=round(w_inc - w_exp, 2),
            )
        )

    # 2. Budget vs Actual for selected month
    budgets = (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(
            Budget.user_id == current_user.id,
            Budget.month == sel_month,
            Budget.year == sel_year,
            Budget.category_id != None,  # noqa: E711
        )
        .all()
    )
    m_start = date(sel_year, sel_month, 1)
    m_end = date(sel_year, sel_month, calendar.monthrange(sel_year, sel_month)[1])
    cat_spent: dict[str, Decimal] = {}
    for t in txs:
        if t.transaction_type == "EXPENSE" and m_start <= t.transaction_date <= m_end:
            cat_spent[t.category_id] = cat_spent.get(t.category_id, Decimal("0.00")) + Decimal(str(t.amount))

    budget_vs_actual: list[BudgetVsActualItem] = []
    for b in budgets:
        lim = float(b.limit_amount)
        act = float(cat_spent.get(b.category_id or "", Decimal("0.00")))
        budget_vs_actual.append(
            BudgetVsActualItem(
                category_name=b.category.name if b.category else "Category",
                color=b.category.color if b.category else "#2563EB",
                budget_limit=round(lim, 2),
                actual_spent=round(act, 2),
                utilization_percentage=round((act / lim) * 100, 1) if lim > 0 else 0.0,
            )
        )

    # 3. Yearly totals & 12-month savings trend
    yearly_inc = 0.0
    yearly_exp = 0.0
    monthly_savings_trend: list[MonthlySavingsHistoryItem] = []
    for m in range(1, 13):
        ms = date(sel_year, m, 1)
        me = date(sel_year, m, calendar.monthrange(sel_year, m)[1])
        mi = sum((float(t.amount) for t in txs if ms <= t.transaction_date <= me and t.transaction_type == "INCOME"), 0.0)
        mx = sum((float(t.amount) for t in txs if ms <= t.transaction_date <= me and t.transaction_type == "EXPENSE"), 0.0)
        yearly_inc += mi
        yearly_exp += mx
        msav = mi - mx
        monthly_savings_trend.append(
            MonthlySavingsHistoryItem(
                month=m,
                year=sel_year,
                label=calendar.month_abbr[m],
                income=round(mi, 2),
                expenses=round(mx, 2),
                savings=round(msav, 2),
                savings_rate=round((msav / mi) * 100, 1) if mi > 0 else 0.0,
            )
        )

    yearly_sav = yearly_inc - yearly_exp
    yearly_rate = round((yearly_sav / yearly_inc) * 100, 2) if yearly_inc > 0 else 0.0

    # 4. Top spending categories for selected year
    yr_cat_agg: dict[str, dict] = {}
    for t in txs:
        if t.transaction_type == "EXPENSE" and t.transaction_date.year == sel_year:
            cname = t.category.name if t.category else "Other"
            ccol = t.category.color if t.category else "#94A3B8"
            if cname not in yr_cat_agg:
                yr_cat_agg[cname] = {"category_name": cname, "color": ccol, "amount": 0.0, "count": 0}
            yr_cat_agg[cname]["amount"] += float(t.amount)
            yr_cat_agg[cname]["count"] += 1

    top_cats = sorted(yr_cat_agg.values(), key=lambda x: x["amount"], reverse=True)[:8]
    for item in top_cats:
        item["amount"] = round(item["amount"], 2)
        item["percentage"] = round((item["amount"] / yearly_exp) * 100, 1) if yearly_exp > 0 else 0.0

    # 5. Goals progress snapshot
    goals = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    goals_progress = [
        {
            "id": g.id,
            "name": g.name,
            "target_amount": round(float(g.target_amount), 2),
            "current_amount": round(float(g.current_amount), 2),
            "percentage": min(100.0, round((float(g.current_amount) / float(g.target_amount)) * 100, 1)) if float(g.target_amount) > 0 else 0.0,
            "status": g.status,
            "color": g.color,
        }
        for g in goals
    ]

    return EnhancedAnalyticsResponse(
        month=sel_month,
        year=sel_year,
        weekly_analysis=weekly_analysis,
        budget_vs_actual=budget_vs_actual,
        yearly_income=round(yearly_inc, 2),
        yearly_expenses=round(yearly_exp, 2),
        yearly_savings=round(yearly_sav, 2),
        yearly_savings_rate=yearly_rate,
        top_spending_categories=top_cats,
        monthly_savings_trend=monthly_savings_trend,
        goals_progress=goals_progress,
    )


@router.get("/pdf/expense")
def download_expense_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="expense",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf/income")
def download_income_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="income",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/pdf/summary")
def download_summary_pdf(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_pdf_report(
        db=db,
        user=current_user,
        report_kind="summary",
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/excel")
def download_excel_report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_excel_report(
        db=db,
        user=current_user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/csv")
def download_csv_report(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    category_id: str | None = Query(default=None),
    payment_mode: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content, filename = generate_csv_report(
        db=db,
        user=current_user,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_mode=payment_mode,
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
