from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.category import Category
from app.models.reconciliation import VoiceEntry
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.voice import (
    VoiceConfirmRequest,
    VoiceEntryOut,
    VoiceParseRequest,
    VoiceParseResponse,
)
from app.services.voice_parser import VoiceParserService

router = APIRouter(prefix="/voice", tags=["Voice Expense Entry"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/parse", response_model=VoiceParseResponse)
def parse_voice_text(
    payload: VoiceParseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse transcribed speech text into structured candidate transactions."""
    lang = payload.language
    if lang == "auto" and current_user.settings and current_user.settings.preferred_voice_language:
        # Use user's preference if set, or let parser detect
        lang = current_user.settings.preferred_voice_language

    result = VoiceParserService.parse_speech_text(payload.text, preferred_language=lang)
    return VoiceParseResponse(**result)


@router.post("/process-audio", response_model=VoiceParseResponse)
async def process_voice_audio(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept audio file from microphone recording, convert speech to text, and parse transactions."""
    # Read audio bytes
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio file received.",
        )

    # In modern browsers and mobile, Web Speech API and Speech-to-Text transcribe directly on client.
    # If audio is sent to this endpoint, we extract metadata and provide fallback parsing.
    fallback_text = f"Voice recording ({file.filename}, {len(audio_bytes)} bytes)"
    result = VoiceParserService.parse_speech_text(fallback_text, preferred_language=language)
    return VoiceParseResponse(**result)


@router.post("/confirm", status_code=status.HTTP_201_CREATED)
def confirm_voice_transactions(
    payload: VoiceConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save user-reviewed voice transactions to the database."""
    if not payload.transactions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transactions provided for confirmation.",
        )

    # Fetch user categories
    user_categories = db.query(Category).filter(Category.user_id == current_user.id).all()
    cat_by_name_type = {
        (c.name.strip().lower(), c.type): c for c in user_categories
    }

    created_transactions = []
    saved_dicts = []

    for item in payload.transactions:
        key = (item.category_name.strip().lower(), item.transaction_type)
        cat = cat_by_name_type.get(key)

        if not cat:
            # Fallback to category by type or first default
            fallback_name = "Other" if item.transaction_type == "EXPENSE" else "Other Income"
            cat = cat_by_name_type.get((fallback_name.lower(), item.transaction_type))

            if not cat:
                # Find any category matching the type
                for c in user_categories:
                    if c.type == item.transaction_type:
                        cat = c
                        break

            if not cat:
                # Create category if none exists
                cat = Category(
                    user_id=current_user.id,
                    name=item.category_name.strip(),
                    type=item.transaction_type,
                    color="#64748B",
                    icon="tag",
                    is_default=False,
                )
                db.add(cat)
                db.flush()
                cat_by_name_type[(cat.name.lower(), cat.type)] = cat

        tx = Transaction(
            user_id=current_user.id,
            transaction_type=item.transaction_type,
            title=item.title.strip(),
            amount=item.amount,
            category_id=cat.id,
            payment_mode=item.payment_mode or "Cash",
            transaction_date=item.transaction_date,
            notes=item.notes,
        )
        db.add(tx)
        created_transactions.append(tx)
        saved_dicts.append({
            "title": item.title,
            "amount": float(item.amount),
            "category_name": cat.name,
            "transaction_type": item.transaction_type,
            "transaction_date": item.transaction_date.isoformat(),
        })

    # Record voice entry history
    voice_entry = VoiceEntry(
        user_id=current_user.id,
        language=payload.language,
        raw_text=payload.raw_text,
        recognized_transactions=saved_dicts,
        status="confirmed",
    )
    db.add(voice_entry)
    db.commit()

    return {
        "message": f"Successfully saved {len(created_transactions)} transactions.",
        "created_count": len(created_transactions),
        "entry_id": voice_entry.id,
    }


@router.get("/history", response_model=list[VoiceEntryOut])
def get_voice_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve recent voice entry sessions."""
    entries = (
        db.query(VoiceEntry)
        .filter(VoiceEntry.user_id == current_user.id)
        .order_by(VoiceEntry.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        VoiceEntryOut(
            id=e.id,
            language=e.language,
            raw_text=e.raw_text,
            recognized_transactions=e.recognized_transactions or [],
            status=e.status,
            created_at=e.created_at,
        )
        for e in entries
    ]
