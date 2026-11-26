import re
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.models.finance_plus import SystemActivityLog
from app.models.user import PasswordResetToken, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginOtpRequest,
    LoginRequest,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterWithOtpRequest,
    ResetPasswordOtpRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    VerifyMobileRequest,
)
from app.services.notification_service import create_notification
from app.services.otp_service import (
    consume_verification_token,
    normalize_mobile_number,
    request_otp,
    verify_otp_code,
)
from app.services.seed import seed_user_defaults

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _send_reset_email(to_email: str, raw_token: str) -> bool:
    settings = get_settings()
    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        return False
    msg = EmailMessage()
    msg["Subject"] = "Password Reset — Arthly Personal Finance"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Use the following one-time reset token to reset your password:\n\n{raw_token}\n\n"
        f"This token expires in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes."
    )
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
    return True


def _build_token_response(db: Session, user_id: str) -> TokenResponse:
    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == user_id)
        .first()
    )
    user.last_active_at = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id, user.token_version),
        refresh_token=create_refresh_token(user.id, user.token_version),
        user=UserOut.model_validate(user),
    )


# ==============================================================================
# Mobile OTP Endpoints
# ==============================================================================

@router.post("/otp/send", response_model=OtpSendResponse)
def send_mobile_otp(payload: OtpSendRequest, db: Session = Depends(get_db)):
    res = request_otp(db, payload.mobile_number, payload.purpose)
    return OtpSendResponse(**res)


@router.post("/otp/verify", response_model=OtpVerifyResponse)
def verify_mobile_otp(payload: OtpVerifyRequest, db: Session = Depends(get_db)):
    record, token = verify_otp_code(
        db,
        payload.mobile_number,
        payload.otp,
        payload.purpose,
        consume_immediately=False,
    )
    return OtpVerifyResponse(
        verified=True,
        message="OTP verified successfully.",
        mobile_number=record.mobile_number,
        verification_token=token,
    )


@router.post("/register-otp", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_with_mobile_otp(payload: RegisterWithOtpRequest, db: Session = Depends(get_db)):
    try:
        mobile = normalize_mobile_number(payload.mobile_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # Prevent duplicate mobile registrations
    if db.query(User).filter(User.mobile_number == mobile).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this mobile number already exists.",
        )

    digits_only = re.sub(r"[^0-9]", "", mobile)
    normalized_email = (
        payload.email.strip().lower()
        if payload.email
        else f"user_{digits_only}@mobile.arthly.app"
    )
    if db.query(User).filter(User.email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Enforce OTP verification BEFORE creating the account
    consume_verification_token(
        db=db,
        raw_mobile=mobile,
        purpose="REGISTER",
        verification_token=payload.verification_token,
        otp_code=payload.otp,
    )

    user = User(
        email=normalized_email,
        mobile_number=mobile,
        mobile_verified=True,
        role="USER",
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        token_version=1,
        is_active=True,
    )
    db.add(user)
    db.flush()

    seed_user_defaults(db, user.id)
    create_notification(
        db=db,
        user_id=user.id,
        title="Welcome to Arthly!",
        message="Your mobile number is verified. Start tracking expenses, budgets, and savings goals.",
        notification_type="SYSTEM",
        severity="success",
        action_url="/dashboard",
    )
    db.add(
        SystemActivityLog(
            level="INFO",
            component="auth",
            message="New user registered via mobile OTP verification.",
        )
    )
    db.commit()
    return _build_token_response(db, user.id)


@router.post("/login-otp", response_model=TokenResponse)
def login_with_mobile_otp(payload: LoginOtpRequest, db: Session = Depends(get_db)):
    try:
        mobile = normalize_mobile_number(payload.mobile_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user = db.query(User).filter(User.mobile_number == mobile).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number or account is inactive.",
        )

    consume_verification_token(
        db=db,
        raw_mobile=mobile,
        purpose="LOGIN",
        verification_token=payload.verification_token,
        otp_code=payload.otp,
    )
    if not user.mobile_verified:
        user.mobile_verified = True
        db.commit()

    return _build_token_response(db, user.id)


@router.post("/reset-password-otp")
def reset_password_with_otp(payload: ResetPasswordOtpRequest, db: Session = Depends(get_db)):
    try:
        mobile = normalize_mobile_number(payload.mobile_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    consume_verification_token(
        db=db,
        raw_mobile=mobile,
        purpose="FORGOT_PASSWORD",
        verification_token=payload.verification_token,
        otp_code=payload.otp,
    )

    user = db.query(User).filter(User.mobile_number == mobile).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to reset password for this request.",
        )

    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    user.mobile_verified = True
    create_notification(
        db=db,
        user_id=user.id,
        title="Password Reset Successful",
        message="Your Arthly account password was reset using mobile OTP verification.",
        notification_type="OTP_SECURITY",
        severity="info",
        action_url="/settings",
    )
    db.commit()
    return {"message": "Password has been reset successfully. Please sign in with your new password."}


@router.post("/verify-mobile", response_model=UserOut)
def verify_and_link_mobile(
    payload: VerifyMobileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        mobile = normalize_mobile_number(payload.mobile_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    duplicate = (
        db.query(User)
        .filter(User.mobile_number == mobile, User.id != current_user.id)
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mobile number is already registered to another account.",
        )

    consume_verification_token(
        db=db,
        raw_mobile=mobile,
        purpose="VERIFY_MOBILE",
        verification_token=payload.verification_token,
        otp_code=payload.otp,
    )

    current_user.mobile_number = mobile
    current_user.mobile_verified = True
    db.commit()

    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == current_user.id)
        .first()
    )
    return UserOut.model_validate(user)


# ==============================================================================
# Legacy & Core Email/Mobile Password Auth Endpoints (Preserved)
# ==============================================================================

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    norm_mobile = None
    if payload.mobile_number and payload.mobile_number.strip():
        try:
            norm_mobile = normalize_mobile_number(payload.mobile_number)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        if db.query(User).filter(User.mobile_number == norm_mobile).first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this mobile number already exists.",
            )

    user = User(
        email=normalized_email,
        mobile_number=norm_mobile,
        mobile_verified=False,
        role="USER",
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        token_version=1,
        is_active=True,
    )
    db.add(user)
    db.flush()

    seed_user_defaults(db, user.id)
    db.commit()
    return _build_token_response(db, user.id)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    raw_ident = (payload.identifier or payload.email or payload.mobile_number or "").strip()
    user = None

    if "@" in raw_ident:
        user = (
            db.query(User)
            .options(joinedload(User.settings))
            .filter(User.email == raw_ident.lower())
            .first()
        )
    else:
        try:
            norm_mobile = normalize_mobile_number(raw_ident)
            user = (
                db.query(User)
                .options(joinedload(User.settings))
                .filter(User.mobile_number == norm_mobile)
                .first()
            )
        except ValueError:
            user = None

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    return _build_token_response(db, user.id)


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == decoded.get("sub"))
        .first()
    )
    if not user or not user.is_active or user.token_version != decoded.get("ver"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is no longer valid. Please log in again.",
        )

    return _build_token_response(db, user.id)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.token_version += 1
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.settings))
        .filter(User.id == current_user.id)
        .first()
    )
    return UserOut.model_validate(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    generic_msg = "If an account exists for this email, password reset instructions have been prepared."
    if not user:
        return ForgotPasswordResponse(message=generic_msg)

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})

    raw_token, token_hash = generate_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            used=False,
        )
    )
    db.commit()

    email_sent = False
    try:
        email_sent = _send_reset_email(user.email, raw_token)
    except Exception:
        email_sent = False

    if email_sent:
        return ForgotPasswordResponse(message="Password reset token has been sent to your email.")

    if settings.APP_ENV != "production":
        return ForgotPasswordResponse(
            message="Reset token generated (local mode — SMTP not configured). Use the token below to set a new password.",
            reset_token=raw_token,
        )

    return ForgotPasswordResponse(message=generic_msg)


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_reset_token(payload.token.strip())
    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,  # noqa: E712
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used reset token.",
        )

    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    record.used = True
    db.commit()
    return {"message": "Password has been reset successfully. Please sign in with your new password."}
