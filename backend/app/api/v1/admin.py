from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.finance_plus import (
    AdminActivityLog,
    AppAnnouncement,
    AppConfig,
    Budget,
    PaymentScreenshot,
    SavingsGoal,
    SystemActivityLog,
    SystemCategory,
)
from app.models.reconciliation import ReconciliationSession, VoiceEntry
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.arthly_plus import (
    AdminActivityLogOut,
    AdminDashboardStats,
    AdminUserOut,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AnnouncementCreate,
    AnnouncementOut,
    AppConfigOut,
    AppConfigUpdate,
    SystemActivityLogOut,
    SystemCategoryCreate,
    SystemCategoryOut,
    SystemCategoryUpdate,
)
from app.services.notification_service import create_notification

router = APIRouter(prefix="/admin", tags=["Admin Panel"])


def _log_admin_action(
    db: Session,
    admin_id: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: str | None = None,
) -> None:
    db.add(
        AdminActivityLog(
            admin_user_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
    )


@router.get("/dashboard", response_model=AdminDashboardStats)
def get_admin_dashboard(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Aggregate platform statistics ONLY. Zero access to personal amounts, titles, OTPs, or screenshots."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0  # noqa: E712
    active_last_30d = (
        db.query(func.count(User.id))
        .filter(User.last_active_at != None, User.last_active_at >= d30)  # noqa: E711
        .scalar()
        or 0
    )
    new_today = db.query(func.count(User.id)).filter(User.created_at >= today_start).scalar() or 0
    new_7d = db.query(func.count(User.id)).filter(User.created_at >= d7).scalar() or 0
    new_30d = db.query(func.count(User.id)).filter(User.created_at >= d30).scalar() or 0
    verified_mobile = (
        db.query(func.count(User.id)).filter(User.mobile_verified == True).scalar() or 0  # noqa: E712
    )
    verified_rate = round((verified_mobile / total_users) * 100, 1) if total_users > 0 else 0.0

    # Strictly aggregate counts — zero amounts or private descriptions
    tx_count = db.query(func.count(Transaction.id)).scalar() or 0
    voice_count = db.query(func.count(VoiceEntry.id)).scalar() or 0
    screenshot_count = db.query(func.count(PaymentScreenshot.id)).scalar() or 0
    recon_count = db.query(func.count(ReconciliationSession.id)).scalar() or 0
    goals_count = db.query(func.count(SavingsGoal.id)).scalar() or 0
    budgets_count = db.query(func.count(Budget.id)).scalar() or 0

    # Last 7 days registration trend
    recent_users = db.query(User.created_at).filter(User.created_at >= d7).all()
    reg_by_day: dict[str, int] = {}
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        reg_by_day[d] = 0
    for (created_at,) in recent_users:
        if created_at:
            key = created_at.date().isoformat()
            if key in reg_by_day:
                reg_by_day[key] += 1

    trend = [{"date": k, "count": v} for k, v in reg_by_day.items()]

    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        active_last_30d=active_last_30d,
        new_registrations_today=new_today,
        new_registrations_7d=new_7d,
        new_registrations_30d=new_30d,
        verified_mobile_users=verified_mobile,
        verified_mobile_rate=verified_rate,
        total_transactions_count=tx_count,
        total_voice_entries_count=voice_count,
        total_screenshots_count=screenshot_count,
        total_reconciliations_count=recon_count,
        total_goals_count=goals_count,
        total_budgets_count=budgets_count,
        registration_trend=trend,
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users_for_admin(
    search: str | None = Query(default=None, max_length=120),
    status_filter: str | None = Query(default=None),  # active | inactive | verified
    limit: int = Query(default=100, ge=1, le=500),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if search and search.strip():
        pat = f"%{search.strip()}%"
        q = q.filter(
            or_(
                User.full_name.ilike(pat),
                User.mobile_number.ilike(pat),
                User.email.ilike(pat),
            )
        )
    if status_filter == "active":
        q = q.filter(User.is_active == True)  # noqa: E712
    elif status_filter == "inactive":
        q = q.filter(User.is_active == False)  # noqa: E712
    elif status_filter == "verified":
        q = q.filter(User.mobile_verified == True)  # noqa: E712

    users = q.order_by(User.created_at.desc()).limit(limit).all()
    return [AdminUserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}/status", response_model=AdminUserOut)
def update_user_status(
    user_id: str,
    payload: AdminUserStatusUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own admin account.",
        )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target.is_active = payload.is_active
    if not payload.is_active:
        target.token_version += 1

    _log_admin_action(
        db,
        admin_user.id,
        action="USER_ACTIVATED" if payload.is_active else "USER_DEACTIVATED",
        target_type="USER",
        target_id=target.id,
        details=f"Account set is_active={payload.is_active}",
    )
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)


@router.put("/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin_user.id and payload.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own ADMIN role.",
        )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target.role = payload.role
    _log_admin_action(
        db,
        admin_user.id,
        action="USER_ROLE_UPDATED",
        target_type="USER",
        target_id=target.id,
        details=f"Role updated to {payload.role}",
    )
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)


# ==============================================================================
# Global System Category Management
# ==============================================================================

@router.get("/categories", response_model=list[SystemCategoryOut])
def list_system_categories(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SystemCategory)
        .order_by(SystemCategory.type.asc(), SystemCategory.name.asc())
        .all()
    )
    return [SystemCategoryOut.model_validate(r) for r in rows]


@router.post("/categories", response_model=SystemCategoryOut, status_code=status.HTTP_201_CREATED)
def create_system_category(
    payload: SystemCategoryCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    dup = (
        db.query(SystemCategory)
        .filter(
            func.lower(SystemCategory.name) == payload.name.strip().lower(),
            SystemCategory.type == payload.type,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"System category '{payload.name}' already exists for {payload.type}.",
        )

    cat = SystemCategory(
        name=payload.name.strip(),
        type=payload.type,
        color=payload.color,
        icon=payload.icon,
        is_active=True,
    )
    db.add(cat)
    db.flush()
    _log_admin_action(
        db,
        admin_user.id,
        action="SYSTEM_CATEGORY_CREATED",
        target_type="SYSTEM_CATEGORY",
        target_id=cat.id,
        details=f"Created global {cat.type} category '{cat.name}'",
    )
    db.commit()
    db.refresh(cat)
    return SystemCategoryOut.model_validate(cat)


@router.put("/categories/{cat_id}", response_model=SystemCategoryOut)
def update_system_category(
    cat_id: str,
    payload: SystemCategoryUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cat = db.query(SystemCategory).filter(SystemCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System category not found.")

    if payload.name is not None:
        cat.name = payload.name.strip()
    if payload.color is not None:
        cat.color = payload.color
    if payload.icon is not None:
        cat.icon = payload.icon
    if payload.is_active is not None:
        cat.is_active = payload.is_active

    _log_admin_action(
        db,
        admin_user.id,
        action="SYSTEM_CATEGORY_UPDATED",
        target_type="SYSTEM_CATEGORY",
        target_id=cat.id,
        details=f"Updated global category '{cat.name}'",
    )
    db.commit()
    db.refresh(cat)
    return SystemCategoryOut.model_validate(cat)


@router.delete("/categories/{cat_id}")
def delete_system_category(
    cat_id: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cat = db.query(SystemCategory).filter(SystemCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System category not found.")
    if cat.name.lower() in ("other", "other income"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default fallback category cannot be deleted.",
        )

    cat_name = cat.name
    db.delete(cat)
    _log_admin_action(
        db,
        admin_user.id,
        action="SYSTEM_CATEGORY_DELETED",
        target_type="SYSTEM_CATEGORY",
        target_id=cat_id,
        details=f"Deleted global category '{cat_name}'",
    )
    db.commit()
    return {"message": f"Global category '{cat_name}' deleted."}


# ==============================================================================
# Announcements, Feature Configs & Activity Logs
# ==============================================================================

@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(AppAnnouncement).order_by(AppAnnouncement.created_at.desc()).limit(50).all()
    return [AnnouncementOut.model_validate(r) for r in rows]


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def broadcast_announcement(
    payload: AnnouncementCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    active_users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    ann = AppAnnouncement(
        created_by_admin_id=admin_user.id,
        title=payload.title.strip(),
        message=payload.message.strip(),
        severity=payload.severity,
        is_active=True,
        recipients_count=len(active_users),
    )
    db.add(ann)
    db.flush()

    for u in active_users:
        create_notification(
            db=db,
            user_id=u.id,
            title=ann.title,
            message=ann.message,
            notification_type="ANNOUNCEMENT",
            severity=ann.severity,
            action_url="/notifications",
            dedup_key=f"announcement:{ann.id}:{u.id}",
        )

    _log_admin_action(
        db,
        admin_user.id,
        action="ANNOUNCEMENT_BROADCAST",
        target_type="ANNOUNCEMENT",
        target_id=ann.id,
        details=f"Broadcast '{ann.title}' to {len(active_users)} active users",
    )
    db.commit()
    db.refresh(ann)
    return AnnouncementOut.model_validate(ann)


@router.get("/configs", response_model=list[AppConfigOut])
def list_app_configs(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(AppConfig).order_by(AppConfig.key.asc()).all()
    return [AppConfigOut.model_validate(r) for r in rows]


@router.put("/configs/{config_key}", response_model=AppConfigOut)
def update_app_config(
    config_key: str,
    payload: AppConfigUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    cfg = db.query(AppConfig).filter(AppConfig.key == config_key).first()
    if not cfg:
        cfg = AppConfig(key=config_key, value=payload.value.strip())
        db.add(cfg)
    else:
        cfg.value = payload.value.strip()

    _log_admin_action(
        db,
        admin_user.id,
        action="APP_CONFIG_UPDATED",
        target_type="APP_CONFIG",
        target_id=config_key,
        details=f"Set {config_key} = {cfg.value}",
    )
    db.commit()
    db.refresh(cfg)
    return AppConfigOut.model_validate(cfg)


@router.get("/logs")
def get_admin_and_system_logs(
    limit: int = Query(default=50, ge=1, le=200),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admin_logs = (
        db.query(AdminActivityLog)
        .order_by(AdminActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    sys_logs = (
        db.query(SystemActivityLog)
        .order_by(SystemActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "admin_logs": [AdminActivityLogOut.model_validate(a) for a in admin_logs],
        "system_logs": [SystemActivityLogOut.model_validate(s) for s in sys_logs],
    }
