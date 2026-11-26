from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.category import Category
from app.models.finance_plus import AppConfig, NotificationPreference, SystemCategory
from app.models.user import User, UserSettings

DEFAULT_EXPENSE_CATEGORIES: list[tuple[str, str, str]] = [
    ("Food", "#F97316", "utensils"),
    ("Travel", "#0EA5E9", "car"),
    ("Rent", "#6366F1", "home"),
    ("Shopping", "#EC4899", "shopping-bag"),
    ("Groceries", "#10B981", "shopping-cart"),
    ("Medical", "#EF4444", "heart-pulse"),
    ("Healthcare", "#DC2626", "stethoscope"),
    ("Electricity", "#EAB308", "zap"),
    ("Mobile Recharge", "#14B8A6", "smartphone"),
    ("Internet", "#3B82F6", "wifi"),
    ("Bills", "#0284C7", "receipt"),
    ("Entertainment", "#8B5CF6", "film"),
    ("Education", "#7C3AED", "graduation-cap"),
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

DEFAULT_APP_CONFIGS: list[tuple[str, str, str]] = [
    ("enable_mobile_otp", "true", "Enable mobile number OTP verification and login"),
    ("enable_screenshot_ocr", "true", "Enable payment screenshot auto-detection & Android share import"),
    ("enable_voice_entry", "true", "Enable multilingual voice expense entry"),
    ("enable_bank_reconciliation", "true", "Enable manual bank statement reconciliation"),
    ("enable_savings_goals", "true", "Enable savings dashboard and goal tracking"),
    ("enable_budget_alerts", "true", "Enable category and monthly budget limit alerts"),
    ("maintenance_mode", "false", "Display maintenance notice across client apps"),
]


def seed_system_defaults(db: Session) -> None:
    """Seed global system category templates and default feature flags idempotently."""
    existing_sys = {
        (c.name.lower(), c.type) for c in db.query(SystemCategory).all()
    }
    for name, color, icon in DEFAULT_EXPENSE_CATEGORIES:
        if (name.lower(), "EXPENSE") not in existing_sys:
            db.add(
                SystemCategory(
                    name=name,
                    type="EXPENSE",
                    color=color,
                    icon=icon,
                    is_active=True,
                )
            )
    for name, color, icon in DEFAULT_INCOME_CATEGORIES:
        if (name.lower(), "INCOME") not in existing_sys:
            db.add(
                SystemCategory(
                    name=name,
                    type="INCOME",
                    color=color,
                    icon=icon,
                    is_active=True,
                )
            )

    existing_cfg = {cfg.key for cfg in db.query(AppConfig).all()}
    for key, val, desc in DEFAULT_APP_CONFIGS:
        if key not in existing_cfg:
            db.add(AppConfig(key=key, value=val, description=desc))

    db.flush()


def seed_admin_from_env(db: Session) -> None:
    """Optionally bootstrap an Admin user strictly from environment variables (never hardcoded)."""
    settings = get_settings()
    if not settings.ADMIN_BOOTSTRAP_EMAIL or not settings.ADMIN_BOOTSTRAP_PASSWORD:
        return

    norm_email = settings.ADMIN_BOOTSTRAP_EMAIL.strip().lower()
    user = db.query(User).filter(User.email == norm_email).first()
    if user:
        if user.role != "ADMIN":
            user.role = "ADMIN"
            db.flush()
        return

    admin = User(
        email=norm_email,
        mobile_number=settings.ADMIN_BOOTSTRAP_MOBILE.strip() or None,
        mobile_verified=bool(settings.ADMIN_BOOTSTRAP_MOBILE.strip()),
        role="ADMIN",
        full_name=settings.ADMIN_BOOTSTRAP_NAME.strip() or "Arthly Admin",
        password_hash=hash_password(settings.ADMIN_BOOTSTRAP_PASSWORD),
        token_version=1,
        is_active=True,
    )
    db.add(admin)
    db.flush()
    seed_user_defaults(db, admin.id)


def seed_user_defaults(db: Session, user_id: str) -> None:
    """Create default settings, notification preferences, and predefined categories for a new user."""
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

    existing_prefs = (
        db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    )
    if not existing_prefs:
        db.add(NotificationPreference(user_id=user_id))

    existing_cats = {
        (c.name.lower(), c.type)
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    }

    sys_cats = db.query(SystemCategory).filter(SystemCategory.is_active == True).all()  # noqa: E712
    if sys_cats:
        template_rows = [(c.name, c.type, c.color, c.icon) for c in sys_cats]
    else:
        template_rows = [(n, "EXPENSE", c, i) for n, c, i in DEFAULT_EXPENSE_CATEGORIES] + [
            (n, "INCOME", c, i) for n, c, i in DEFAULT_INCOME_CATEGORIES
        ]

    for name, ctype, color, icon in template_rows:
        if (name.lower(), ctype) not in existing_cats:
            db.add(
                Category(
                    user_id=user_id,
                    name=name,
                    type=ctype,
                    color=color,
                    icon=icon,
                    is_default=True,
                )
            )
            existing_cats.add((name.lower(), ctype))

    db.flush()
