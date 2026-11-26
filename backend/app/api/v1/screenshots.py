from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.finance_plus import PaymentScreenshot
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.arthly_plus import (
    ScreenshotAnalyzeResponse,
    ScreenshotConfirmRequest,
    ScreenshotOut,
)
from app.schemas.transaction import TransactionOut
from app.services.analytics import serialize_transaction
from app.services.notification_service import check_unusual_spending, evaluate_budgets_for_user
from app.services.screenshot_ocr import (
    SCREENSHOT_CATEGORIES,
    analyze_screenshot_and_check_duplicates,
)

router = APIRouter(prefix="/screenshots", tags=["Payment Screenshot AI/OCR"])


def _to_screenshot_out(rec: PaymentScreenshot) -> ScreenshotOut:
    return ScreenshotOut(
        id=rec.id,
        filename=rec.filename,
        upi_transaction_id=rec.upi_transaction_id,
        payment_app=rec.payment_app,
        merchant_name=rec.merchant_name,
        extracted_amount=round(float(rec.extracted_amount), 2) if rec.extracted_amount is not None else None,
        extracted_date=rec.extracted_date,
        extracted_category=rec.extracted_category,
        payment_description=rec.payment_description,
        raw_ocr_text=rec.raw_ocr_text,
        confidence_score=float(rec.confidence_score),
        is_duplicate=rec.is_duplicate,
        duplicate_reason=rec.duplicate_reason,
        status=rec.status,
        linked_transaction_id=rec.linked_transaction_id,
        created_at=rec.created_at,
    )


@router.post("/analyze", response_model=ScreenshotAnalyzeResponse, status_code=status.HTTP_201_CREATED)
async def analyze_payment_screenshot(
    file: UploadFile = File(...),
    ocr_text: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or share a UPI payment screenshot for AI/OCR extraction & duplicate check.
    Never saves the transaction automatically; user confirmation is strictly required.
    """
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded screenshot file is empty.",
        )
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screenshot exceeds maximum 12 MB limit.",
        )

    try:
        res = analyze_screenshot_and_check_duplicates(
            db=db,
            user_id=current_user.id,
            filename=file.filename or "payment_screenshot.png",
            mime_type=file.content_type or "image/png",
            image_bytes=content,
            client_ocr_text=ocr_text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return ScreenshotAnalyzeResponse(
        screenshot=_to_screenshot_out(res["screenshot"]),
        requires_attention=res["requires_attention"],
        date_was_extracted=res["date_was_extracted"],
        available_categories=SCREENSHOT_CATEGORIES,
    )


@router.post("/{screenshot_id}/confirm", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def confirm_screenshot_transaction(
    screenshot_id: str,
    payload: ScreenshotConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm user-reviewed extracted fields and save as a real expense transaction."""
    shot = (
        db.query(PaymentScreenshot)
        .filter(
            PaymentScreenshot.id == screenshot_id,
            PaymentScreenshot.user_id == current_user.id,
        )
        .first()
    )
    if not shot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot record not found.")

    if shot.status == "CONFIRMED" and shot.linked_transaction_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This screenshot has already been confirmed and saved.",
        )

    # Resolve category cleanly against user's EXPENSE categories (mapping Others <-> Other, etc.)
    requested_name = payload.category_name.strip()
    alias_map = {
        "others": ["Others", "Other"],
        "healthcare": ["Healthcare", "Medical"],
        "bills": ["Bills", "Electricity", "Internet", "Mobile Recharge"],
    }
    candidates_to_try = [requested_name] + alias_map.get(requested_name.lower(), [])

    user_cats = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.type == "EXPENSE")
        .all()
    )
    by_lower = {c.name.strip().lower(): c for c in user_cats}
    cat = None
    for cand in candidates_to_try:
        if cand.lower() in by_lower:
            cat = by_lower[cand.lower()]
            break

    if not cat:
        cat = Category(
            user_id=current_user.id,
            name=requested_name,
            type="EXPENSE",
            color="#2563EB",
            icon="tag",
            is_default=False,
        )
        db.add(cat)
        db.flush()

    ref_id = (payload.transaction_id or shot.upi_transaction_id or "").strip() or None

    tx = Transaction(
        user_id=current_user.id,
        transaction_type="EXPENSE",
        title=payload.title.strip(),
        amount=payload.amount,
        category_id=cat.id,
        payment_mode=payload.payment_mode,
        transaction_date=payload.transaction_date,
        notes=payload.notes.strip() if payload.notes else shot.payment_description,
        external_ref_id=ref_id,
        source="SCREENSHOT",
    )
    db.add(tx)
    db.flush()

    shot.status = "CONFIRMED"
    shot.linked_transaction_id = tx.id
    if ref_id:
        shot.upi_transaction_id = ref_id

    evaluate_budgets_for_user(db, current_user.id, payload.transaction_date.month, payload.transaction_date.year)
    tx_loaded = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.id == tx.id)
        .first()
    )
    check_unusual_spending(db, tx_loaded)
    db.commit()
    return serialize_transaction(tx_loaded)


@router.post("/{screenshot_id}/discard")
def discard_screenshot(
    screenshot_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shot = (
        db.query(PaymentScreenshot)
        .filter(
            PaymentScreenshot.id == screenshot_id,
            PaymentScreenshot.user_id == current_user.id,
        )
        .first()
    )
    if not shot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screenshot record not found.")
    shot.status = "DISCARDED"
    db.commit()
    return {"message": "Screenshot discarded."}


@router.get("/history", response_model=list[ScreenshotOut])
def get_screenshot_history(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PaymentScreenshot)
        .filter(PaymentScreenshot.user_id == current_user.id)
        .order_by(PaymentScreenshot.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_screenshot_out(r) for r in rows]
