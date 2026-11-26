from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.finance_plus import Notification
from app.models.user import User
from app.schemas.arthly_plus import (
    NotificationListResponse,
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
)
from app.services.notification_service import check_smart_reminders, get_or_create_preferences

router = APIRouter(prefix="/notifications", tags=["Notifications & Reminders"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_q = db.query(Notification).filter(Notification.user_id == current_user.id)
    unread_count = base_q.filter(Notification.is_read == False).count()  # noqa: E712
    total_count = base_q.count()

    q = base_q
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712

    items = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return NotificationListResponse(
        items=[NotificationOut.model_validate(i) for i in items],
        unread_count=unread_count,
        total_count=total_count,
    )


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return NotificationOut.model_validate(notif)


@router.put("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .update({"is_read": True})
    )
    db.commit()
    return {"message": f"Marked {updated} notification(s) as read.", "updated": updated}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted."}


@router.get("/preferences", response_model=NotificationPreferenceOut)
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = get_or_create_preferences(db, current_user.id)
    db.commit()
    return NotificationPreferenceOut.model_validate(prefs)


@router.put("/preferences", response_model=NotificationPreferenceOut)
def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = get_or_create_preferences(db, current_user.id)
    for field in (
        "budget_alerts_enabled",
        "goal_alerts_enabled",
        "unusual_spending_enabled",
        "monthly_summary_enabled",
        "reminders_enabled",
        "push_enabled",
        "web_push_enabled",
        "expo_push_token",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(prefs, field, val)
    db.commit()
    db.refresh(prefs)
    return NotificationPreferenceOut.model_validate(prefs)


@router.post("/check-reminders")
def run_smart_reminders_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    created = check_smart_reminders(db, current_user.id)
    return {
        "new_reminders_count": len(created),
        "notifications": [NotificationOut.model_validate(n) for n in created],
    }
