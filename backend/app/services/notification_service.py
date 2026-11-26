import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.finance_plus import (
    Budget,
    BudgetAlertLog,
    Notification,
    NotificationPreference,
    SavingsGoal,
)
from app.models.transaction import Transaction


def get_or_create_preferences(db: Session, user_id: str) -> NotificationPreference:
    prefs = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if not prefs:
        prefs = NotificationPreference(user_id=user_id)
        db.add(prefs)
        db.flush()
    return prefs


def create_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    severity: str = "info",
    action_url: str | None = None,
    dedup_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Notification | None:
    """Create a centralized user notification respecting user preferences and dedup keys."""
    prefs = get_or_create_preferences(db, user_id)

    if notification_type in ("BUDGET_WARNING", "BUDGET_EXCEEDED") and not prefs.budget_alerts_enabled:
        return None
    if notification_type in ("GOAL_PROGRESS", "GOAL_COMPLETED") and not prefs.goal_alerts_enabled:
        return None
    if notification_type == "GOAL_REMINDER" and not prefs.reminders_enabled:
        return None
    if notification_type == "UNUSUAL_SPENDING" and not prefs.unusual_spending_enabled:
        return None
    if notification_type == "MONTHLY_SUMMARY" and not prefs.monthly_summary_enabled:
        return None

    if dedup_key:
        existing = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.dedup_key == dedup_key)
            .first()
        )
        if existing:
            return None

    notif = Notification(
        user_id=user_id,
        title=title[:160],
        message=message,
        notification_type=notification_type,
        severity=severity,
        is_read=False,
        action_url=action_url,
        dedup_key=dedup_key,
        metadata_json=metadata,
    )
    db.add(notif)
    db.flush()
    return notif


def evaluate_budgets_for_user(
    db: Session,
    user_id: str,
    month: int,
    year: int,
) -> list[Notification]:
    """Evaluate all category and overall monthly budgets for a period and emit deduplicated threshold alerts.
    Thresholds: 80%, 90%, 100%, and 101 (>100% Exceeded). Never repeats for the same threshold in the month.
    """
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        .all()
    )
    if not budgets:
        return []

    last_day = calendar.monthrange(year, month)[1]
    start_d = date(year, month, 1)
    end_d = date(year, month, last_day)

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == "EXPENSE",
            Transaction.transaction_date >= start_d,
            Transaction.transaction_date <= end_d,
        )
        .all()
    )

    total_spent = sum((Decimal(str(t.amount)) for t in expenses), Decimal("0.00"))
    spent_by_cat: dict[str, Decimal] = {}
    for t in expenses:
        spent_by_cat[t.category_id] = spent_by_cat.get(t.category_id, Decimal("0.00")) + Decimal(str(t.amount))

    cat_names = {
        c.id: c.name
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    }

    created_alerts: list[Notification] = []
    month_label = f"{calendar.month_name[month]} {year}"

    for b in budgets:
        limit_amt = Decimal(str(b.limit_amount))
        if limit_amt <= 0:
            continue

        spent = total_spent if b.category_id is None else spent_by_cat.get(b.category_id, Decimal("0.00"))
        pct = float((spent / limit_amt) * Decimal("100"))
        scope_label = "Overall Monthly Budget" if b.category_id is None else f"{cat_names.get(b.category_id, 'Category')} Budget"

        existing_logs = {
            log.threshold_percent
            for log in db.query(BudgetAlertLog)
            .filter(
                BudgetAlertLog.budget_id == b.id,
                BudgetAlertLog.month == month,
                BudgetAlertLog.year == year,
            )
            .all()
        }

        crossed: list[int] = []
        if pct >= 80:
            crossed.append(80)
        if pct >= 90:
            crossed.append(90)
        if pct >= 100:
            crossed.append(100)
        if pct > 100.001:
            crossed.append(101)

        new_thresholds = [th for th in crossed if th not in existing_logs]
        if not new_thresholds:
            continue

        # Record all newly crossed thresholds so lower levels do not re-trigger later
        for th in new_thresholds:
            db.add(
                BudgetAlertLog(
                    budget_id=b.id,
                    user_id=user_id,
                    threshold_percent=th,
                    month=month,
                    year=year,
                )
            )

        highest = max(new_thresholds)
        spent_str = f"₹{float(spent):,.2f}"
        limit_str = f"₹{float(limit_amt):,.2f}"

        if highest == 101:
            title = f"Budget Exceeded: {scope_label}"
            msg = (
                f"You have exceeded your {month_label} {scope_label} ({spent_str} spent vs {limit_str} limit, "
                f"{pct:.0f}% used)."
            )
            ntype = "BUDGET_EXCEEDED"
            severity = "danger"
        elif highest == 100:
            title = f"100% Budget Reached: {scope_label}"
            msg = f"Your {month_label} {scope_label} has reached 100% ({spent_str} of {limit_str})."
            ntype = "BUDGET_EXCEEDED"
            severity = "danger"
        elif highest == 90:
            title = f"90% Budget Warning: {scope_label}"
            msg = f"Warning: {pct:.0f}% of your {month_label} {scope_label} is consumed ({spent_str} of {limit_str})."
            ntype = "BUDGET_WARNING"
            severity = "warning"
        else:
            title = f"80% Budget Alert: {scope_label}"
            msg = f"Heads up: {pct:.0f}% of your {month_label} {scope_label} is used ({spent_str} of {limit_str})."
            ntype = "BUDGET_WARNING"
            severity = "warning"

        notif = create_notification(
            db=db,
            user_id=user_id,
            title=title,
            message=msg,
            notification_type=ntype,
            severity=severity,
            action_url="/budgets",
            dedup_key=f"budget:{b.id}:{year}-{month}:{highest}",
            metadata={"budget_id": b.id, "threshold": highest, "percent": round(pct, 1)},
        )
        if notif:
            created_alerts.append(notif)

    db.flush()
    return created_alerts


def check_unusual_spending(db: Session, tx: Transaction) -> Notification | None:
    """Detect unusually high single expenses relative to user's history in that category."""
    if tx.transaction_type != "EXPENSE":
        return None

    prior = (
        db.query(func.count(Transaction.id), func.avg(Transaction.amount))
        .filter(
            Transaction.user_id == tx.user_id,
            Transaction.category_id == tx.category_id,
            Transaction.transaction_type == "EXPENSE",
            Transaction.id != tx.id,
        )
        .first()
    )
    count = int(prior[0] or 0) if prior else 0
    avg_amt = float(prior[1] or 0.0) if prior else 0.0
    tx_amt = float(tx.amount)

    if count >= 3 and avg_amt > 0 and tx_amt >= max(1000.0, avg_amt * 2.5):
        cat_name = tx.category.name if tx.category else "this category"
        return create_notification(
            db=db,
            user_id=tx.user_id,
            title="Unusual Spending Detected",
            message=(
                f"'{tx.title}' (₹{tx_amt:,.2f}) is significantly higher than your typical ₹{avg_amt:,.0f} "
                f"average in {cat_name}."
            ),
            notification_type="UNUSUAL_SPENDING",
            severity="warning",
            action_url="/transactions",
            dedup_key=f"unusual:{tx.id}",
            metadata={"transaction_id": tx.id, "amount": tx_amt, "category_avg": round(avg_amt, 2)},
        )
    return None


def evaluate_goal_milestones(db: Session, goal: SavingsGoal) -> list[Notification]:
    """Notify user when crossing 25%, 50%, 75%, or 100% completion of a savings goal."""
    target = Decimal(str(goal.target_amount))
    current = Decimal(str(goal.current_amount))
    if target <= 0:
        return []

    pct = float((current / target) * Decimal("100"))
    milestones = [25, 50, 75, 100]
    crossed = [m for m in milestones if pct >= m and m > goal.last_milestone_notified]
    if not crossed:
        return []

    highest = max(crossed)
    goal.last_milestone_notified = highest
    if highest >= 100 and goal.status != "COMPLETED":
        goal.status = "COMPLETED"
        goal.completed_at = datetime.now(timezone.utc)

    created: list[Notification] = []
    if highest >= 100:
        notif = create_notification(
            db=db,
            user_id=goal.user_id,
            title=f"Goal Achieved: {goal.name}!",
            message=(
                f"Congratulations! You reached 100% of your '{goal.name}' target "
                f"(₹{float(current):,.2f} saved)."
            ),
            notification_type="GOAL_COMPLETED",
            severity="success",
            action_url="/savings",
            dedup_key=f"goal:{goal.id}:milestone:100",
            metadata={"goal_id": goal.id, "milestone": 100},
        )
    else:
        remaining = max(0.0, float(target - current))
        notif = create_notification(
            db=db,
            user_id=goal.user_id,
            title=f"{highest}% Savings Goal Reached: {goal.name}",
            message=(
                f"Great progress! You have reached {pct:.0f}% toward '{goal.name}'. "
                f"Only ₹{remaining:,.2f} left to go."
            ),
            notification_type="GOAL_PROGRESS",
            severity="success",
            action_url="/savings",
            dedup_key=f"goal:{goal.id}:milestone:{highest}",
            metadata={"goal_id": goal.id, "milestone": highest},
        )
    if notif:
        created.append(notif)
    db.flush()
    return created


def check_smart_reminders(db: Session, user_id: str) -> list[Notification]:
    """Generate deduplicated behind-schedule goal reminders and monthly financial summary notices."""
    today = date.today()
    created: list[Notification] = []

    active_goals = (
        db.query(SavingsGoal)
        .filter(SavingsGoal.user_id == user_id, SavingsGoal.status == "ACTIVE")
        .all()
    )

    for g in active_goals:
        start_d = g.created_at.date() if g.created_at else today
        total_days = max(1, (g.target_date - start_d).days)
        elapsed_days = max(0, (today - start_d).days)
        target_amt = float(g.target_amount)
        curr_amt = float(g.current_amount)
        pct = (curr_amt / target_amt) * 100 if target_amt > 0 else 0.0

        if g.target_date < today and curr_amt < target_amt:
            n = create_notification(
                db=db,
                user_id=user_id,
                title=f"Goal Deadline Passed: {g.name}",
                message=(
                    f"Target date for '{g.name}' has passed with ₹{target_amt - curr_amt:,.2f} remaining. "
                    "Consider extending your target date or adding a contribution."
                ),
                notification_type="GOAL_REMINDER",
                severity="warning",
                action_url="/savings",
                dedup_key=f"goal_overdue:{g.id}:{today.year}-{today.month:02d}",
            )
            if n:
                created.append(n)
        elif total_days >= 14 and elapsed_days / total_days >= 0.25:
            expected_pct = (elapsed_days / total_days) * 100
            if pct + 10.0 < expected_pct:
                days_left = max(1, (g.target_date - today).days)
                months_left = max(1.0, days_left / 30.0)
                needed_per_month = (target_amt - curr_amt) / months_left
                n = create_notification(
                    db=db,
                    user_id=user_id,
                    title=f"Savings Reminder: {g.name}",
                    message=(
                        f"You are slightly behind schedule on '{g.name}' ({pct:.0f}% saved vs {expected_pct:.0f}% pace). "
                        f"Saving ₹{needed_per_month:,.0f}/month will keep you on track."
                    ),
                    notification_type="GOAL_REMINDER",
                    severity="info",
                    action_url="/savings",
                    dedup_key=f"goal_pace:{g.id}:{today.year}-{today.month:02d}",
                )
                if n:
                    created.append(n)

    # Monthly summary reminder at month start (for previous month)
    prev_month = 12 if today.month == 1 else today.month - 1
    prev_year = today.year - 1 if today.month == 1 else today.year
    last_day_prev = calendar.monthrange(prev_year, prev_month)[1]
    prev_txs = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= date(prev_year, prev_month, 1),
            Transaction.transaction_date <= date(prev_year, prev_month, last_day_prev),
        )
        .all()
    )
    if prev_txs:
        prev_inc = sum((float(t.amount) for t in prev_txs if t.transaction_type == "INCOME"), 0.0)
        prev_exp = sum((float(t.amount) for t in prev_txs if t.transaction_type == "EXPENSE"), 0.0)
        prev_sav = prev_inc - prev_exp
        n = create_notification(
            db=db,
            user_id=user_id,
            title=f"{calendar.month_name[prev_month]} {prev_year} Financial Summary",
            message=(
                f"Income: ₹{prev_inc:,.0f} • Expenses: ₹{prev_exp:,.0f} • "
                f"Net Savings: ₹{prev_sav:,.0f}. View detailed analytics or download your PDF summary."
            ),
            notification_type="MONTHLY_SUMMARY",
            severity="info",
            action_url="/reports",
            dedup_key=f"monthly_summary:{prev_year}-{prev_month:02d}",
        )
        if n:
            created.append(n)

    db.commit()
    return created
