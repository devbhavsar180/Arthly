import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.finance_plus import OtpVerification
from app.models.user import User

logger = logging.getLogger("arthly.otp")


def normalize_mobile_number(raw: str) -> str:
    """Normalize mobile number into consistent E.164 format (defaults 10-digit Indian numbers to +91)."""
    if not raw:
        raise ValueError("Mobile number is required.")
    cleaned = re.sub(r"[\s\-().]", "", raw.strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if cleaned.startswith("+"):
        digits = cleaned[1:]
        if not digits.isdigit() or not (8 <= len(digits) <= 15):
            raise ValueError("Enter a valid mobile number with country code (e.g. +919876543210).")
        return f"+{digits}"

    if not cleaned.isdigit():
        raise ValueError("Mobile number must contain digits only.")

    if len(cleaned) == 11 and cleaned.startswith("0"):
        cleaned = cleaned[1:]

    if len(cleaned) == 10 and cleaned[0] in "6789":
        return f"+91{cleaned}"

    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"

    if 8 <= len(cleaned) <= 15:
        return f"+{cleaned}"

    raise ValueError("Enter a valid 10-digit mobile number.")


def _hash_otp(mobile_number: str, otp: str, purpose: str) -> str:
    settings = get_settings()
    msg = f"{mobile_number}:{purpose}:{otp}".encode("utf-8")
    return hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _dispatch_sms(mobile_number: str, otp: str, purpose: str) -> tuple[bool, str]:
    """Dispatch OTP via configured SMS provider (Twilio, Fast2SMS, MSG91) or local console sandbox."""
    settings = get_settings()
    provider = (settings.SMS_PROVIDER or "console").strip().lower()
    message_text = f"Your Arthly verification code is {otp}. Valid for {settings.OTP_EXPIRE_MINUTES} minutes. Do not share."

    try:
        if provider == "twilio" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={"From": settings.TWILIO_FROM_NUMBER, "To": mobile_number, "Body": message_text},
                )
            return resp.status_code in (200, 201), "twilio"

        if provider == "fast2sms" and settings.FAST2SMS_API_KEY:
            local_10 = mobile_number[-10:]
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": settings.FAST2SMS_API_KEY},
                    json={"route": "otp", "variables_values": otp, "numbers": local_10},
                )
            return resp.status_code == 200, "fast2sms"

        if provider == "msg91" and settings.MSG91_AUTH_KEY and settings.MSG91_TEMPLATE_ID:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    "https://control.msg91.com/api/v5/otp",
                    headers={"authkey": settings.MSG91_AUTH_KEY},
                    params={"template_id": settings.MSG91_TEMPLATE_ID, "mobile": mobile_number.lstrip("+"), "otp": otp},
                )
            return resp.status_code == 200, "msg91"
    except Exception:
        logger.warning("SMS provider '%s' dispatch error for purpose=%s", provider, purpose)
        return False, provider

    # Console / dev sandbox mode — never log the raw OTP to stdout/log files
    logger.info("OTP generated in sandbox console mode for purpose=%s", purpose)
    return True, "console"


def request_otp(
    db: Session,
    raw_mobile: str,
    purpose: str,
    current_user: User | None = None,
) -> dict:
    settings = get_settings()
    try:
        mobile = normalize_mobile_number(raw_mobile)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    existing_user = db.query(User).filter(User.mobile_number == mobile).first()

    if purpose == "REGISTER" and existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this mobile number already exists.",
        )
    if purpose == "VERIFY_MOBILE" and existing_user and (not current_user or existing_user.id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mobile number is already linked to another account.",
        )

    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    # Check hourly rate limit per mobile + purpose
    recent_records = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.mobile_number == mobile,
            OtpVerification.purpose == purpose,
            OtpVerification.created_at >= one_hour_ago,
        )
        .order_by(OtpVerification.created_at.desc())
        .all()
    )

    if len(recent_records) >= settings.OTP_RATE_LIMIT_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please try again after 1 hour.",
        )

    # Check resend cooldown
    if recent_records:
        latest = recent_records[0]
        last_sent = latest.last_sent_at
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (now - last_sent).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            wait_sec = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_sec} seconds before requesting another OTP.",
            )

    if purpose in ("FORGOT_PASSWORD", "LOGIN"):
        # Security: Do NOT reveal whether an account exists for FORGOT_PASSWORD
        if not existing_user or not existing_user.is_active:
            if purpose == "FORGOT_PASSWORD":
                return {
                    "message": "If this mobile number is registered, a 6-digit OTP has been sent.",
                    "mobile_number": mobile,
                    "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
                    "cooldown_seconds": settings.OTP_RESEND_COOLDOWN_SECONDS,
                    "dev_otp": None,
                }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mobile number or account is unavailable.",
            )

    # Invalidate older active OTPs for this mobile & purpose
    db.query(OtpVerification).filter(
        OtpVerification.mobile_number == mobile,
        OtpVerification.purpose == purpose,
        OtpVerification.used == False,  # noqa: E712
    ).update({"used": True})

    otp_code = str(secrets.randbelow(900000) + 100000)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    target_user_id = current_user.id if current_user else (existing_user.id if existing_user else None)

    record = OtpVerification(
        user_id=target_user_id,
        mobile_number=mobile,
        purpose=purpose,
        otp_hash=_hash_otp(mobile, otp_code, purpose),
        expires_at=expires_at,
        attempts=0,
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        resend_count=len(recent_records),
        last_sent_at=now,
        is_verified=False,
        used=False,
    )
    db.add(record)
    db.commit()

    sent_ok, provider = _dispatch_sms(mobile, otp_code, purpose)
    if not sent_ok and settings.APP_ENV == "production":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification SMS right now. Please try again shortly.",
        )

    # Informative in-app OTP notice (only for existing users, never storing raw OTP)
    if target_user_id:
        from app.services.notification_service import create_notification

        create_notification(
            db=db,
            user_id=target_user_id,
            title="Security OTP Requested",
            message=f"A 6-digit OTP was requested for {purpose.replace('_', ' ').lower()} on your mobile number.",
            notification_type="OTP_SECURITY",
            severity="info",
            action_url="/settings",
        )
        db.commit()

    show_dev_otp = (
        otp_code
        if (settings.APP_ENV != "production" and provider == "console")
        else None
    )

    generic_msg = (
        "If this mobile number is registered, a 6-digit OTP has been sent."
        if purpose == "FORGOT_PASSWORD"
        else f"A 6-digit verification OTP has been sent to {mobile}."
    )

    return {
        "message": generic_msg,
        "mobile_number": mobile,
        "expires_in_seconds": settings.OTP_EXPIRE_MINUTES * 60,
        "cooldown_seconds": settings.OTP_RESEND_COOLDOWN_SECONDS,
        "dev_otp": show_dev_otp,
    }


def verify_otp_code(
    db: Session,
    raw_mobile: str,
    otp_code: str,
    purpose: str,
    consume_immediately: bool = False,
) -> tuple[OtpVerification, str | None]:
    """Verify a 6-digit OTP with attempt limits and expiry check.
    Returns (OtpVerification record, raw verification_token if not consumed immediately).
    """
    try:
        mobile = normalize_mobile_number(raw_mobile)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    clean_otp = otp_code.strip()
    if not clean_otp.isdigit() or len(clean_otp) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP must be a 6-digit code.",
        )

    record = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.mobile_number == mobile,
            OtpVerification.purpose == purpose,
            OtpVerification.used == False,  # noqa: E712
        )
        .order_by(OtpVerification.created_at.desc())
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found. Please request a new OTP.",
        )

    now = datetime.now(timezone.utc)
    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    if exp < now:
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP.",
        )

    if record.attempts >= record.max_attempts:
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum OTP verification attempts exceeded. Please request a new OTP.",
        )

    expected_hash = _hash_otp(mobile, clean_otp, purpose)
    if not hmac.compare_digest(record.otp_hash, expected_hash):
        record.attempts += 1
        remaining = max(0, record.max_attempts - record.attempts)
        if remaining == 0:
            record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP code. {remaining} attempt(s) remaining.",
        )

    record.is_verified = True
    raw_token: str | None = None
    if consume_immediately:
        record.used = True
    else:
        raw_token = secrets.token_urlsafe(32)
        record.verification_token_hash = _hash_token(raw_token)
    db.commit()
    return record, raw_token


def consume_verification_token(
    db: Session,
    raw_mobile: str,
    purpose: str,
    verification_token: str | None = None,
    otp_code: str | None = None,
) -> OtpVerification:
    """Validate and consume either a pre-verified verification_token or an OTP code directly."""
    if otp_code and not verification_token:
        rec, _ = verify_otp_code(db, raw_mobile, otp_code, purpose, consume_immediately=True)
        return rec

    if not verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP verification is required.",
        )

    try:
        mobile = normalize_mobile_number(raw_mobile)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    tok_hash = _hash_token(verification_token.strip())
    record = (
        db.query(OtpVerification)
        .filter(
            OtpVerification.mobile_number == mobile,
            OtpVerification.purpose == purpose,
            OtpVerification.verification_token_hash == tok_hash,
            OtpVerification.is_verified == True,  # noqa: E712
            OtpVerification.used == False,  # noqa: E712
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP verification session. Please verify OTP again.",
        )

    now = datetime.now(timezone.utc)
    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    # Give a 10-minute completion grace window once OTP is verified
    if exp + timedelta(minutes=10) < now:
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session expired. Please request a new OTP.",
        )

    record.used = True
    db.flush()
    return record
