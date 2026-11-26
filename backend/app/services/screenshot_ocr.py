import base64
import hashlib
import io
import json
import re
import shutil
import subprocess
import tempfile
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import httpx
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.finance_plus import PaymentScreenshot
from app.models.transaction import Transaction

SCREENSHOT_CATEGORIES = [
    "Food",
    "Travel",
    "Shopping",
    "Groceries",
    "Entertainment",
    "Bills",
    "Healthcare",
    "Education",
    "Others",
]

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Food": [
        "swiggy", "zomato", "dominos", "domino", "pizza", "mcdonald", "kfc", "burger",
        "starbucks", "cafe", "coffee", "chai", "tea", "restaurant", "dining", "biryani",
        "hotel", "bakery", "sweets", "snacks", "haldiram", "dhaba", "bistro", "eats",
    ],
    "Groceries": [
        "blinkit", "zepto", "instamart", "bigbasket", "dmart", "d-mart", "jiomart",
        "reliance fresh", "spencer", "more supermarket", "grocery", "groceries",
        "kirana", "vegetables", "fruits", "milk", "amul", "dairy", "nature's basket",
    ],
    "Travel": [
        "uber", "ola", "rapido", "indrive", "metro", "irctc", "rail", "makemytrip",
        "goibibo", "redbus", "indigo", "air india", "vistara", "spicejet", "petrol",
        "diesel", "fuel", "shell", "hpcl", "bpcl", "indianoil", "fastag", "toll",
        "cab", "auto", "rickshaw", "parking", "flight", "bus",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "tatacliq",
        "decathlon", "westside", "zudio", "trends", "pantaloons", "croma", "vijay sales",
        "apple store", "ikea", "clothing", "fashion", "electronics", "mall",
    ],
    "Entertainment": [
        "bookmyshow", "pvr", "inox", "cinepolis", "netflix", "prime video", "hotstar",
        "spotify", "youtube", "sony liv", "zee5", "gaming", "playstation", "steam",
        "cinema", "movie", "concert", "event",
    ],
    "Bills": [
        "jio", "airtel", "vodafone", "vi ", "bsnl", "electricity", "torrent power",
        "adani electricity", "bescom", "msedcl", "tata power", "mahavitaran",
        "gas", "mahanagar gas", "indane", "hp gas", "bharat gas", "broadband",
        "act fibernet", "recharge", "dth", "tata play", "water bill", "utility",
        "rent", "maintenance", "credit card bill", "emi", "insurance", "lic",
    ],
    "Healthcare": [
        "apollo", "pharmeasy", "1mg", "tata 1mg", "netmeds", "medplus", "hospital",
        "clinic", "pharmacy", "medical", "chemist", "doctor", "dr.", "pathology",
        "diagnostics", "thyrocare", "lal pathlabs", "dental", "health", "medicine",
    ],
    "Education": [
        "udemy", "coursera", "upgrad", "byju", "unacademy", "physics wallah", "school",
        "college", "university", "tuition", "coaching", "exam", "book", "stationery",
        "library", "course", "fees", "workshop",
    ],
}


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _detect_payment_app(text: str, filename: str = "") -> str:
    combined = f"{text}\n{filename}".lower()
    if "google pay" in combined or "gpay" in combined or "tez" in combined or "cicag" in combined:
        return "Google Pay"
    if "phonepe" in combined or "utr" in combined and "phonepe" in combined:
        return "PhonePe"
    if "paytm" in combined:
        return "Paytm"
    if "bhim" in combined:
        return "BHIM UPI"
    if "amazon pay" in combined:
        return "Amazon Pay"
    if "cred" in combined:
        return "CRED"
    return "UPI"


def classify_category(merchant_or_desc: str, raw_text: str = "") -> str:
    combined = f"{merchant_or_desc} {raw_text}".lower()
    for cat_name, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in combined:
                return cat_name
    return "Others"


def _extract_png_text_metadata(image_bytes: bytes) -> str:
    """Extract embedded text metadata from PNG/JPEG info dictionaries if present."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            parts = []
            for k, v in (img.info or {}).items():
                if isinstance(v, str) and len(v) > 2:
                    parts.append(f"{k}: {v}")
            return "\n".join(parts)
    except Exception:
        return ""


def _run_local_tesseract(image_bytes: bytes) -> str | None:
    """Run local Tesseract CLI if installed on the host/container."""
    tess_bin = shutil.which("tesseract")
    if not tess_bin:
        return None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            tf.write(image_bytes)
            tmp_path = tf.name
        proc = subprocess.run(
            [tess_bin, tmp_path, "stdout", "--psm", "6"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        return None
    finally:
        if tmp_path:
            try:
                import os
                os.remove(tmp_path)
            except OSError:
                pass
    return None


def _run_ocr_space_api(image_bytes: bytes, filename: str, api_key: str) -> str | None:
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                "https://api.ocr.space/parse/image",
                data={"apikey": api_key, "language": "eng", "OCREngine": "2"},
                files={"file": (filename or "receipt.png", image_bytes)},
            )
        if resp.status_code == 200:
            data = resp.json()
            parsed = data.get("ParsedResults") or []
            texts = [p.get("ParsedText", "") for p in parsed if p.get("ParsedText")]
            return "\n".join(texts).strip() or None
    except Exception:
        return None
    return None


def _run_gemini_vision(image_bytes: bytes, mime_type: str, api_key: str) -> dict[str, Any] | None:
    prompt = (
        "Analyze this UPI / bank payment screenshot (Google Pay, PhonePe, Paytm, etc.) and return ONLY valid JSON "
        "with keys: amount (number or null), transaction_date (YYYY-MM-DD or null), merchant_name (string or null), "
        "transaction_id (string or null), payment_app (string), payment_description (string), "
        "category (one of: Food, Travel, Shopping, Groceries, Entertainment, Bills, Healthcare, Education, Others), "
        "raw_ocr_text (string), confidence (number 0 to 1). Do not guess numbers not visible on screen."
    )
    b64 = base64.b64encode(image_bytes).decode("ascii")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type or "image/png", "data": b64}},
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, json=payload)
        if resp.status_code == 200:
            body = resp.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
    except Exception:
        return None
    return None


def _run_openai_vision(image_bytes: bytes, mime_type: str, api_key: str) -> dict[str, Any] | None:
    prompt = (
        "Extract payment transaction details from this UPI payment screenshot and return ONLY valid JSON: "
        "{amount: number|null, transaction_date: YYYY-MM-DD|null, merchant_name: string|null, "
        "transaction_id: string|null, payment_app: string, payment_description: string, "
        "category: 'Food'|'Travel'|'Shopping'|'Groceries'|'Entertainment'|'Bills'|'Healthcare'|'Education'|'Others', "
        "raw_ocr_text: string, confidence: number}."
    )
    b64 = base64.b64encode(image_bytes).decode("ascii")
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:{mime_type or 'image/png'};base64,{b64}"},
                                },
                            ],
                        }
                    ],
                },
            )
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception:
        return None
    return None


def parse_upi_ocr_text(raw_text: str, filename: str = "") -> dict[str, Any]:
    """Extract structured payment fields from raw UPI / GPay / PhonePe / Paytm receipt text."""
    text = (raw_text or "").strip()
    payment_app = _detect_payment_app(text, filename)

    # 1. Extract Transaction ID / UTR / UPI Ref
    tx_id = None
    id_patterns = [
        r"(?:upi\s*(?:transaction|txn)?\s*(?:id|ref(?:erence)?(?:\s*no\.?)?)|utr(?:\s*no\.?)?|transaction\s*id|ref(?:erence)?\s*(?:no|number|id))\s*[:\-]?\s*([A-Za-z0-9]{8,36})",
        r"\b([0-9]{12})\b",  # Standard 12-digit Indian UPI UTR
        r"\b(CICAg[A-Za-z0-9_-]{6,30})\b",  # Google Pay ID format
    ]
    for pat in id_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            tx_id = m.group(1).strip()
            break

    # 2. Extract Amount (prioritize ₹ / Rs. / INR markers, exclude long ref numbers)
    amount: float | None = None
    amt_patterns = [
        r"(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
        r"(?:paid|amount|debited|sent)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)",
    ]
    for pat in amt_patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            val_str = m.group(1).replace(",", "")
            try:
                val = float(val_str)
                if 0 < val <= 10_000_000:
                    amount = round(val, 2)
                    break
            except ValueError:
                continue
        if amount is not None:
            break

    # 3. Extract Transaction Date
    tx_date: date | None = None
    date_patterns = [
        (r"\b(\d{4}-\d{2}-\d{2})\b", ["%Y-%m-%d"]),
        (r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"]),
        (
            r"\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b",
            ["%d %b %Y", "%d %B %Y", "%d %b %y", "%d %B %y"],
        ),
        (
            r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
            ["%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y"],
        ),
    ]
    for pat, fmts in date_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            raw_d = re.sub(r"\s+", " ", m.group(1).strip())
            for f in fmts:
                try:
                    tx_date = datetime.strptime(raw_d, f).date()
                    break
                except ValueError:
                    continue
        if tx_date:
            break

    # 4. Extract Merchant / Receiver Name
    merchant = None
    merchant_patterns = [
        r"(?:paid\s+to|sent\s+to|payment\s+to|transferred\s+to|merchant\s*name|to)\s*[:\-]?\s*([A-Za-z0-9 &._'-]{2,50})",
    ]
    for pat in merchant_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            cand = m.group(1).strip().split("\n")[0].strip(" -.,:")
            # Ignore generic words like "bank account" or "upi"
            if cand and cand.lower() not in {"bank", "account", "upi", "you", "your bank"}:
                merchant = cand[:120]
                break

    if not merchant and text:
        # Look for lines mentioning known merchants
        for line in text.splitlines():
            clean_line = line.strip()
            if 3 <= len(clean_line) <= 60 and not re.search(r"(paid|successful|completed|upi|utr|bank|₹|\d{6,})", clean_line, re.I):
                merchant = clean_line
                break

    category = classify_category(merchant or "", text)

    description_parts = [f"Paid via {payment_app}"]
    if merchant:
        description_parts.append(f"to {merchant}")
    if tx_id:
        description_parts.append(f"(Ref: {tx_id})")
    description = " ".join(description_parts)

    # Confidence calculation
    score = 0.2 if text else 0.0
    if amount is not None:
        score += 0.35
    if merchant:
        score += 0.2
    if tx_date:
        score += 0.15
    if tx_id:
        score += 0.1

    return {
        "amount": amount,
        "transaction_date": tx_date or date.today(),
        "date_was_extracted": tx_date is not None,
        "merchant_name": merchant,
        "transaction_id": tx_id,
        "payment_app": payment_app,
        "payment_description": description,
        "category": category,
        "raw_ocr_text": text,
        "confidence": round(min(1.0, score), 2),
    }


def analyze_screenshot_and_check_duplicates(
    db: Session,
    user_id: str,
    filename: str,
    mime_type: str,
    image_bytes: bytes,
    client_ocr_text: str | None = None,
) -> dict[str, Any]:
    """Run AI/OCR extraction on payment screenshot, detect duplicates, and save PENDING_REVIEW record."""
    settings = get_settings()
    file_hash = compute_sha256(image_bytes)

    # Verify image can be opened safely with Pillow
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
    except Exception:
        raise ValueError("Uploaded file is not a valid image (PNG, JPG, WEBP supported).")

    extracted: dict[str, Any] | None = None
    vision_raw: dict[str, Any] | None = None

    if settings.GEMINI_API_KEY:
        vision_raw = _run_gemini_vision(image_bytes, mime_type, settings.GEMINI_API_KEY)
    elif settings.OPENAI_API_KEY:
        vision_raw = _run_openai_vision(image_bytes, mime_type, settings.OPENAI_API_KEY)

    if vision_raw:
        parsed_date = None
        if vision_raw.get("transaction_date"):
            try:
                parsed_date = date.fromisoformat(str(vision_raw["transaction_date"])[:10])
            except ValueError:
                parsed_date = None

        raw_cat = str(vision_raw.get("category") or "Others")
        if raw_cat not in SCREENSHOT_CATEGORIES:
            raw_cat = classify_category(str(vision_raw.get("merchant_name") or ""), raw_cat)

        extracted = {
            "amount": float(vision_raw["amount"]) if vision_raw.get("amount") else None,
            "transaction_date": parsed_date or date.today(),
            "date_was_extracted": parsed_date is not None,
            "merchant_name": vision_raw.get("merchant_name"),
            "transaction_id": vision_raw.get("transaction_id"),
            "payment_app": vision_raw.get("payment_app") or "UPI",
            "payment_description": vision_raw.get("payment_description")
            or f"Paid via {vision_raw.get('payment_app') or 'UPI'}",
            "category": raw_cat,
            "raw_ocr_text": vision_raw.get("raw_ocr_text") or "",
            "confidence": float(vision_raw.get("confidence") or 0.85),
        }
    else:
        ocr_chunks = []
        if client_ocr_text and client_ocr_text.strip():
            ocr_chunks.append(client_ocr_text.strip())
        if settings.OCR_SPACE_API_KEY:
            api_text = _run_ocr_space_api(image_bytes, filename, settings.OCR_SPACE_API_KEY)
            if api_text:
                ocr_chunks.append(api_text)
        local_tess = _run_local_tesseract(image_bytes)
        if local_tess:
            ocr_chunks.append(local_tess)
        png_meta = _extract_png_text_metadata(image_bytes)
        if png_meta:
            ocr_chunks.append(png_meta)

        combined_text = "\n".join(ocr_chunks).strip()
        extracted = parse_upi_ocr_text(combined_text, filename=filename)

    # Duplicate detection
    is_duplicate = False
    duplicate_reason = None

    dup_file = (
        db.query(PaymentScreenshot)
        .filter(
            PaymentScreenshot.user_id == user_id,
            PaymentScreenshot.file_hash == file_hash,
            PaymentScreenshot.status == "CONFIRMED",
        )
        .first()
    )
    if dup_file:
        is_duplicate = True
        duplicate_reason = "This exact payment screenshot was already imported and confirmed."

    tx_ref = extracted.get("transaction_id")
    if not is_duplicate and tx_ref:
        dup_ref = (
            db.query(Transaction)
            .filter(Transaction.user_id == user_id, Transaction.external_ref_id == tx_ref)
            .first()
        )
        if dup_ref:
            is_duplicate = True
            duplicate_reason = f"A transaction with UPI Reference / ID '{tx_ref}' already exists ({dup_ref.title})."

    if not is_duplicate and extracted.get("amount") and extracted.get("transaction_date"):
        amt_dec = Decimal(str(extracted["amount"])).quantize(Decimal("0.01"))
        possible_same = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.transaction_type == "EXPENSE",
                Transaction.amount == amt_dec,
                Transaction.transaction_date == extracted["transaction_date"],
            )
            .first()
        )
        if possible_same:
            is_duplicate = True
            duplicate_reason = (
                f"Possible duplicate: an expense '{possible_same.title}' for ₹{float(amt_dec):,.2f} "
                f"already exists on {extracted['transaction_date'].isoformat()}."
            )

    requires_attention = extracted.get("amount") is None or float(extracted.get("confidence") or 0) < 0.6

    record = PaymentScreenshot(
        user_id=user_id,
        filename=filename[:255],
        file_hash=file_hash,
        upi_transaction_id=tx_ref[:128] if tx_ref else None,
        payment_app=extracted.get("payment_app"),
        merchant_name=extracted.get("merchant_name"),
        extracted_amount=Decimal(str(extracted["amount"])).quantize(Decimal("0.01")) if extracted.get("amount") else None,
        extracted_date=extracted.get("transaction_date"),
        extracted_category=extracted.get("category") or "Others",
        payment_description=extracted.get("payment_description"),
        raw_ocr_text=extracted.get("raw_ocr_text") or None,
        confidence_score=float(extracted.get("confidence") or 0.0),
        is_duplicate=is_duplicate,
        duplicate_reason=duplicate_reason,
        status="PENDING_REVIEW",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "screenshot": record,
        "requires_attention": requires_attention,
        "date_was_extracted": bool(extracted.get("date_was_extracted")),
    }
