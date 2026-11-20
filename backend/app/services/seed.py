from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.user import UserSettings

DEFAULT_EXPENSE_CATEGORIES: list[tuple[str, str, str]] = [
    ("Food", "#F97316", "utensils"),
    ("Travel", "#0EA5E9", "car"),
    ("Rent", "#6366F1", "home"),
    ("Shopping", "#EC4899", "shopping-bag"),
    ("Groceries", "#10B981", "shopping-cart"),
    ("Medical", "#EF4444", "heart-pulse"),
    ("Electricity", "#EAB308", "zap"),
    ("Mobile Recharge", "#14B8A6", "smartphone"),
    ("Internet", "#3B82F6", "wifi"),
    ("Entertainment", "#8B5CF6", "film"),
    ("Personal", "#64748B", "user"),
    ("Other", "#94A3B8", "tag"),
]

DEFAULT_INCOME_CATEGORIES: list[tuple[str, str, str]] = [
    ("Monthly Salary", "#059669", "briefcase"),
    ("Freelancing", "#0D9488", "laptop"),
    ("Business Income", "#2563EB", "building"),
    ("Bonus", "#16A34A", "award"),
    ("Other Income", "#65A30D", "wallet"),
]


def seed_user_defaults(db: Session, user_id: str) -> None:
    """Create default settings and predefined expense/income categories for a new user."""
    existing_settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not existing_settings:
        db.add(
            UserSettings(
                user_id=user_id,
                currency_code="INR",
                currency_symbol="₹",
                theme="light",
            )
        )

    existing_cats = {
        (c.name.lower(), c.type)
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    }

    for name, color, icon in DEFAULT_EXPENSE_CATEGORIES:
        if (name.lower(), "EXPENSE") not in existing_cats:
            db.add(
                Category(
                    user_id=user_id,
                    name=name,
                    type="EXPENSE",
                    color=color,
                    icon=icon,
                    is_default=True,
                )
            )

    for name, color, icon in DEFAULT_INCOME_CATEGORIES:
        if (name.lower(), "INCOME") not in existing_cats:
            db.add(
                Category(
                    user_id=user_id,
                    name=name,
                    type="INCOME",
                    color=color,
                    icon=icon,
                    is_default=True,
                )
            )

    db.flush()
