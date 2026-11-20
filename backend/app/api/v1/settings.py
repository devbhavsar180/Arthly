import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models.category import Category
from app.models.reconciliation import (
    BankStatement,
    BankStatementTransaction,
    ReconciliationMatch,
    ReconciliationSession,
    VoiceEntry,
)
from app.models.transaction import Transaction
from app.models.user import PasswordResetToken, User, UserSettings
from app.schemas.auth import UserOut, UserSettingsOut
from app.schemas.settings import (
    BackupPayload,
    ChangePasswordRequest,
    CurrencyUpdateRequest,
    DeleteAccountRequest,
    ProfileUpdateRequest,
    VoiceLanguageUpdateRequest,
)
from app.services.backup import export_user_backup, restore_user_backup

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=UserOut)
def get_settings_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == current_user.id)
        .first()
    )
    return UserOut.model_validate(user)


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_email = payload.email.strip().lower()
    if new_email != current_user.email:
        exists = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email address is already in use.",
            )
        current_user.email = new_email

    current_user.full_name = payload.full_name.strip()
    db.commit()

    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == current_user.id)
        .first()
    )
    return UserOut.model_validate(user)


@router.put("/currency", response_model=UserSettingsOut)
def update_currency(
    payload: CurrencyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    settings.currency_code = payload.currency_code.strip().upper()
    settings.currency_symbol = payload.currency_symbol.strip()
    db.commit()
    db.refresh(settings)
    return UserSettingsOut.model_validate(settings)


@router.put("/voice-language", response_model=UserSettingsOut)
def update_voice_language(
    payload: VoiceLanguageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    settings.preferred_voice_language = payload.preferred_voice_language
    db.commit()
    db.refresh(settings)
    return UserSettingsOut.model_validate(settings)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.token_version += 1
    db.commit()
    return {"message": "Password changed successfully. Please sign in again."}


@router.get("/export")
def export_all_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    backup = export_user_backup(db, current_user)
    raw = json.dumps(backup, indent=2, ensure_ascii=False).encode("utf-8")
    return Response(
        content=raw,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="my_expense_tracker_backup.json"'},
    )


@router.post("/restore")
def restore_data(
    payload: BackupPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    summary = restore_user_backup(db, current_user, payload)
    return {"message": "Backup restored successfully.", **summary}


@router.delete("/account")
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.confirmation.strip().upper() != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation must be 'DELETE'.",
        )
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password verification failed.",
        )

    # Delete child tables in safe FK order
    db.query(ReconciliationMatch).filter(ReconciliationMatch.user_id == current_user.id).delete()
    db.query(ReconciliationSession).filter(ReconciliationSession.user_id == current_user.id).delete()
    db.query(BankStatementTransaction).filter(BankStatementTransaction.user_id == current_user.id).delete()
    db.query(BankStatement).filter(BankStatement.user_id == current_user.id).delete()
    db.query(VoiceEntry).filter(VoiceEntry.user_id == current_user.id).delete()
    db.query(Transaction).filter(Transaction.user_id == current_user.id).delete()
    db.query(Category).filter(Category.user_id == current_user.id).delete()
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == current_user.id).delete()
    db.query(UserSettings).filter(UserSettings.user_id == current_user.id).delete()
    db.query(User).filter(User.id == current_user.id).delete()
    db.commit()
    return {"message": "Your account and all personal financial data have been permanently deleted."}
