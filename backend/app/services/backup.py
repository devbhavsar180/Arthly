from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User, UserSettings
from app.schemas.settings import BackupPayload


def export_user_backup(db: Session, user: User) -> dict:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    categories = (
        db.query(Category)
        .filter(Category.user_id == user.id)
        .order_by(Category.type.asc(), Category.name.asc())
        .all()
    )
    transactions = (
        db.query(Transaction)
        .options(joinedload(Transaction.category))
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .all()
    )

    return {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "full_name": user.full_name,
            "email": user.email,
        },
        "settings": {
            "currency_code": settings.currency_code if settings else "INR",
            "currency_symbol": settings.currency_symbol if settings else "₹",
            "theme": settings.theme if settings else "light",
        },
        "categories": [
            {
                "name": c.name,
                "type": c.type,
                "color": c.color,
                "icon": c.icon,
                "is_default": c.is_default,
            }
            for c in categories
        ],
        "transactions": [
            {
                "transaction_type": t.transaction_type,
                "title": t.title,
                "amount": str(Decimal(t.amount).quantize(Decimal("0.01"))),
                "category_name": t.category.name if t.category else "Other",
                "payment_mode": t.payment_mode,
                "transaction_date": t.transaction_date.isoformat(),
                "notes": t.notes,
            }
            for t in transactions
        ],
    }


def restore_user_backup(db: Session, user: User, payload: BackupPayload) -> dict:
    if payload.replace_existing:
        db.query(Transaction).filter(Transaction.user_id == user.id).delete()
        db.flush()

    if payload.settings:
        settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
        if not settings:
            settings = UserSettings(user_id=user.id)
            db.add(settings)
        if "currency_code" in payload.settings and payload.settings["currency_code"]:
            settings.currency_code = str(payload.settings["currency_code"])[:10]
        if "currency_symbol" in payload.settings and payload.settings["currency_symbol"]:
            settings.currency_symbol = str(payload.settings["currency_symbol"])[:8]

    existing_cats = db.query(Category).filter(Category.user_id == user.id).all()
    cat_lookup: dict[tuple[str, str], Category] = {
        (c.name.strip().lower(), c.type): c for c in existing_cats
    }

    categories_added = 0
    for cat_item in payload.categories:
        key = (cat_item.name.strip().lower(), cat_item.type)
        if key not in cat_lookup:
            new_cat = Category(
                user_id=user.id,
                name=cat_item.name.strip(),
                type=cat_item.type,
                color=cat_item.color or "#2563EB",
                icon=cat_item.icon or "tag",
                is_default=cat_item.is_default,
            )
            db.add(new_cat)
            db.flush()
            cat_lookup[key] = new_cat
            categories_added += 1

    transactions_added = 0
    for tx_item in payload.transactions:
        key = (tx_item.category_name.strip().lower(), tx_item.transaction_type)
        cat = cat_lookup.get(key)
        if not cat:
            cat = Category(
                user_id=user.id,
                name=tx_item.category_name.strip(),
                type=tx_item.transaction_type,
                color="#2563EB" if tx_item.transaction_type == "EXPENSE" else "#059669",
                icon="tag",
                is_default=False,
            )
            db.add(cat)
            db.flush()
            cat_lookup[key] = cat
            categories_added += 1

        payment_mode = tx_item.payment_mode
        if tx_item.transaction_type == "EXPENSE" and not payment_mode:
            payment_mode = "Other"

        db.add(
            Transaction(
                user_id=user.id,
                transaction_type=tx_item.transaction_type,
                title=tx_item.title.strip(),
                amount=Decimal(tx_item.amount).quantize(Decimal("0.01")),
                category_id=cat.id,
                payment_mode=payment_mode,
                transaction_date=tx_item.transaction_date,
                notes=tx_item.notes,
            )
        )
        transactions_added += 1

    db.commit()
    return {
        "categories_added": categories_added,
        "transactions_restored": transactions_added,
        "replaced_existing": payload.replace_existing,
    }
