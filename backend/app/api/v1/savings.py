import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.finance_plus import SavingsGoal, SavingsGoalContribution
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.arthly_plus import (
    MonthlySavingsHistoryItem,
    SavingsDashboardResponse,
    SavingsGoalContributeRequest,
    SavingsGoalContributionOut,
    SavingsGoalCreate,
    SavingsGoalOut,
    SavingsGoalUpdate,
    SavingsPeriodCard,
)
from app.services.notification_service import evaluate_goal_milestones

router = APIRouter(prefix="/savings", tags=["Savings & Goals"])


def _calc_rate(income: float, savings: float) -> float:
    if income <= 0:
        return 0.0
    return round((savings / income) * 100, 2)


def _serialize_goal(goal: SavingsGoal) -> SavingsGoalOut:
    today = date.today()
    target = float(goal.target_amount)
    current = float(goal.current_amount)
    remaining = max(0.0, round(target - current, 2))
    pct = min(100.0, round((current / target) * 100, 2)) if target > 0 else 0.0
    days_rem = (goal.target_date - today).days

    if goal.status == "COMPLETED" or current >= target:
        pace_status = "COMPLETED"
        req_monthly = 0.0
        req_weekly = 0.0
        suggestion = f"Congratulations! Goal '{goal.name}' is 100% funded."
    elif days_rem <= 0:
        pace_status = "OVERDUE"
        req_monthly = remaining
        req_weekly = remaining
        suggestion = f"Target date passed. Add ₹{remaining:,.0f} or extend your target date."
    else:
        months_rem = max(1.0, days_rem / 30.0)
        weeks_rem = max(1.0, days_rem / 7.0)
        req_monthly = round(remaining / months_rem, 2)
        req_weekly = round(remaining / weeks_rem, 2)

        start_d = goal.created_at.date() if goal.created_at else today
        total_days = max(1, (goal.target_date - start_d).days)
        elapsed_days = max(0, (today - start_d).days)
        expected_pct = (elapsed_days / total_days) * 100
        pace_status = "BEHIND_SCHEDULE" if (elapsed_days > 7 and pct + 8.0 < expected_pct) else "ON_TRACK"
        suggestion = (
            f"Save ₹{req_monthly:,.0f}/month (₹{req_weekly:,.0f}/week) to reach '{goal.name}' "
            f"by {goal.target_date.strftime('%d %b %Y')}."
        )

    contribs = sorted(goal.contributions or [], key=lambda c: (c.contribution_date, c.created_at), reverse=True)
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=round(target, 2),
        current_amount=round(current, 2),
        remaining_amount=remaining,
        completion_percentage=pct,
        target_date=goal.target_date,
        days_remaining=days_rem,
        required_monthly_saving=req_monthly,
        required_weekly_saving=req_weekly,
        pace_status=pace_status,
        suggestion=suggestion,
        icon=goal.icon,
        color=goal.color,
        status=goal.status,
        completed_at=goal.completed_at,
        notes=goal.notes,
        created_at=goal.created_at,
        contributions=[
            SavingsGoalContributionOut(
                id=c.id,
                goal_id=c.goal_id,
                amount=round(float(c.amount), 2),
                contribution_date=c.contribution_date,
                notes=c.notes,
                created_at=c.created_at,
            )
            for c in contribs[:10]
        ],
    )


@router.get("/dashboard", response_model=SavingsDashboardResponse)
def get_savings_dashboard(
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
        .filter(Transaction.user_id == current_user.id)
        .all()
    )

    # Weekly window (current week Mon..Sun or 7-day rolling ending today)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    month_start = date(sel_year, sel_month, 1)
    month_end = date(sel_year, sel_month, calendar.monthrange(sel_year, sel_month)[1])

    prev_m = 12 if sel_month == 1 else sel_month - 1
    prev_y = sel_year - 1 if sel_month == 1 else sel_year
    prev_start = date(prev_y, prev_m, 1)
    prev_end = date(prev_y, prev_m, calendar.monthrange(prev_y, prev_m)[1])

    year_start = date(sel_year, 1, 1)
    year_end = date(sel_year, 12, 31)

    def _sum_range(start_d: date | None, end_d: date | None) -> tuple[float, float, float]:
        inc = Decimal("0.00")
        exp = Decimal("0.00")
        for t in txs:
            if start_d and t.transaction_date < start_d:
                continue
            if end_d and t.transaction_date > end_d:
                continue
            if t.transaction_type == "INCOME":
                inc += Decimal(str(t.amount))
            else:
                exp += Decimal(str(t.amount))
        sav = inc - exp
        return round(float(inc), 2), round(float(exp), 2), round(float(sav), 2)

    w_inc, w_exp, w_sav = _sum_range(week_start, week_end)
    m_inc, m_exp, m_sav = _sum_range(month_start, month_end)
    _, _, prev_m_sav = _sum_range(prev_start, prev_end)
    y_inc, y_exp, y_sav = _sum_range(year_start, year_end)
    all_inc, all_exp, all_sav = _sum_range(None, None)

    monthly_history: list[MonthlySavingsHistoryItem] = []
    for m in range(1, 13):
        ms = date(sel_year, m, 1)
        me = date(sel_year, m, calendar.monthrange(sel_year, m)[1])
        mi, mx, msv = _sum_range(ms, me)
        monthly_history.append(
            MonthlySavingsHistoryItem(
                month=m,
                year=sel_year,
                label=calendar.month_abbr[m],
                income=mi,
                expenses=mx,
                savings=msv,
                savings_rate=_calc_rate(mi, msv),
            )
        )

    goals = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.status.asc(), SavingsGoal.target_date.asc())
        .all()
    )
    goals_out = [_serialize_goal(g) for g in goals]
    total_target = round(sum(g.target_amount for g in goals_out), 2)
    total_allocated = round(sum(g.current_amount for g in goals_out), 2)
    completed_count = sum(1 for g in goals_out if g.status == "COMPLETED")

    return SavingsDashboardResponse(
        month=sel_month,
        year=sel_year,
        weekly=SavingsPeriodCard(
            label="This Week",
            income=w_inc,
            expenses=w_exp,
            savings=w_sav,
            savings_rate=_calc_rate(w_inc, w_sav),
        ),
        monthly=SavingsPeriodCard(
            label=f"{calendar.month_name[sel_month]} {sel_year}",
            income=m_inc,
            expenses=m_exp,
            savings=m_sav,
            savings_rate=_calc_rate(m_inc, m_sav),
        ),
        yearly=SavingsPeriodCard(
            label=f"Year {sel_year}",
            income=y_inc,
            expenses=y_exp,
            savings=y_sav,
            savings_rate=_calc_rate(y_inc, y_sav),
        ),
        all_time=SavingsPeriodCard(
            label="Total Accumulated",
            income=all_inc,
            expenses=all_exp,
            savings=all_sav,
            savings_rate=_calc_rate(all_inc, all_sav),
        ),
        previous_month_savings=prev_m_sav,
        savings_change_amount=round(m_sav - prev_m_sav, 2),
        monthly_history=monthly_history,
        goals_summary={
            "total_goals": len(goals_out),
            "active_goals": len(goals_out) - completed_count,
            "completed_goals": completed_count,
            "total_target_amount": total_target,
            "total_saved_in_goals": total_allocated,
            "overall_goal_progress": round((total_allocated / total_target) * 100, 2) if total_target > 0 else 0.0,
        },
        goals=goals_out,
    )


@router.get("/goals", response_model=list[SavingsGoalOut])
def list_savings_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goals = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.status.asc(), SavingsGoal.target_date.asc())
        .all()
    )
    return [_serialize_goal(g) for g in goals]


@router.post("/goals", response_model=SavingsGoalOut, status_code=status.HTTP_201_CREATED)
def create_savings_goal(
    payload: SavingsGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_done = Decimal(payload.current_amount) >= Decimal(payload.target_amount)
    goal = SavingsGoal(
        user_id=current_user.id,
        name=payload.name.strip(),
        target_amount=payload.target_amount,
        current_amount=payload.current_amount,
        target_date=payload.target_date,
        icon=payload.icon,
        color=payload.color,
        status="COMPLETED" if is_done else "ACTIVE",
        completed_at=datetime.now(timezone.utc) if is_done else None,
        notes=payload.notes,
    )
    db.add(goal)
    db.flush()

    if Decimal(payload.current_amount) > 0:
        db.add(
            SavingsGoalContribution(
                goal_id=goal.id,
                user_id=current_user.id,
                amount=payload.current_amount,
                contribution_date=date.today(),
                notes="Initial savings deposit",
            )
        )
    evaluate_goal_milestones(db, goal)
    db.commit()

    goal = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.id == goal.id)
        .first()
    )
    return _serialize_goal(goal)


@router.put("/goals/{goal_id}", response_model=SavingsGoalOut)
def update_savings_goal(
    goal_id: str,
    payload: SavingsGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found.")

    if payload.name is not None:
        goal.name = payload.name.strip()
    if payload.target_amount is not None:
        goal.target_amount = payload.target_amount
    if payload.target_date is not None:
        goal.target_date = payload.target_date
    if payload.icon is not None:
        goal.icon = payload.icon
    if payload.color is not None:
        goal.color = payload.color
    if payload.notes is not None:
        goal.notes = payload.notes
    if payload.status is not None:
        goal.status = payload.status
        if payload.status == "COMPLETED" and not goal.completed_at:
            goal.completed_at = datetime.now(timezone.utc)
        elif payload.status != "COMPLETED":
            goal.completed_at = None

    evaluate_goal_milestones(db, goal)
    db.commit()
    db.refresh(goal)
    return _serialize_goal(goal)


@router.post("/goals/{goal_id}/contribute", response_model=SavingsGoalOut)
def contribute_to_goal(
    goal_id: str,
    payload: SavingsGoalContributeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found.")

    db.add(
        SavingsGoalContribution(
            goal_id=goal.id,
            user_id=current_user.id,
            amount=payload.amount,
            contribution_date=payload.contribution_date,
            notes=payload.notes,
        )
    )
    goal.current_amount = Decimal(str(goal.current_amount)) + Decimal(str(payload.amount))
    evaluate_goal_milestones(db, goal)
    db.commit()

    goal = (
        db.query(SavingsGoal)
        .options(joinedload(SavingsGoal.contributions))
        .filter(SavingsGoal.id == goal.id)
        .first()
    )
    return _serialize_goal(goal)


@router.delete("/goals/{goal_id}")
def delete_savings_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.id == goal_id, SavingsGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Savings goal not found.")

    db.delete(goal)
    db.commit()
    return {"message": "Savings goal deleted successfully."}
