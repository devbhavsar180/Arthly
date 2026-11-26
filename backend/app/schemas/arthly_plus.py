from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# Savings Dashboard & Savings Goals
# ==============================================================================

class SavingsPeriodCard(BaseModel):
    label: str
    income: float
    expenses: float
    savings: float
    savings_rate: float


class MonthlySavingsHistoryItem(BaseModel):
    month: int
    year: int
    label: str
    income: float
    expenses: float
    savings: float
    savings_rate: float


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_amount: Decimal = Field(..., gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    target_date: date
    icon: str = Field(default="target", max_length=40)
    color: str = Field(default="#059669", max_length=16)
    notes: str | None = Field(default=None, max_length=500)


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(default=None, gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    target_date: date | None = None
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=16)
    status: Literal["ACTIVE", "COMPLETED", "PAUSED"] | None = None
    notes: str | None = Field(default=None, max_length=500)


class SavingsGoalContributeRequest(BaseModel):
    amount: Decimal = Field(..., gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    contribution_date: date = Field(default_factory=date.today)
    notes: str | None = Field(default=None, max_length=300)


class SavingsGoalContributionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    goal_id: str
    amount: float
    contribution_date: date
    notes: str | None = None
    created_at: datetime


class SavingsGoalOut(BaseModel):
    id: str
    name: str
    target_amount: float
    current_amount: float
    remaining_amount: float
    completion_percentage: float
    target_date: date
    days_remaining: int
    required_monthly_saving: float
    required_weekly_saving: float
    pace_status: Literal["ON_TRACK", "BEHIND_SCHEDULE", "COMPLETED", "OVERDUE"]
    suggestion: str
    icon: str
    color: str
    status: str
    completed_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    contributions: list[SavingsGoalContributionOut] = []


class SavingsDashboardResponse(BaseModel):
    month: int
    year: int
    weekly: SavingsPeriodCard
    monthly: SavingsPeriodCard
    yearly: SavingsPeriodCard
    all_time: SavingsPeriodCard
    previous_month_savings: float
    savings_change_amount: float
    monthly_history: list[MonthlySavingsHistoryItem]
    goals_summary: dict[str, Any]
    goals: list[SavingsGoalOut]


# ==============================================================================
# Budgets & Expense Limit Alerts
# ==============================================================================

class BudgetUpsertRequest(BaseModel):
    category_id: str | None = Field(default=None, max_length=36)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    limit_amount: Decimal = Field(..., gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)


class BudgetOut(BaseModel):
    id: str
    category_id: str | None
    category_name: str
    category_color: str
    is_overall: bool
    month: int
    year: int
    limit_amount: float
    spent_amount: float
    remaining_amount: float
    utilization_percentage: float
    alert_status: Literal["OK", "WARNING_80", "WARNING_90", "REACHED_100", "EXCEEDED"]
    triggered_thresholds: list[int] = []


class BudgetPeriodSummary(BaseModel):
    month: int
    year: int
    month_label: str
    overall_budget: BudgetOut | None = None
    category_budgets: list[BudgetOut] = []
    total_budgeted_categories: float
    total_spent_in_budgeted_categories: float
    total_monthly_expenses: float
    alerts_triggered_count: int


class BudgetHistoryItem(BaseModel):
    month: int
    year: int
    label: str
    overall_limit: float
    total_spent: float
    utilization_percentage: float
    status: str


# ==============================================================================
# Notifications & Preferences
# ==============================================================================

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    message: str
    notification_type: str
    severity: str
    is_read: bool
    action_url: str | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    unread_count: int
    total_count: int


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    budget_alerts_enabled: bool
    goal_alerts_enabled: bool
    unusual_spending_enabled: bool
    monthly_summary_enabled: bool
    reminders_enabled: bool
    push_enabled: bool
    web_push_enabled: bool
    expo_push_token: str | None = None


class NotificationPreferenceUpdate(BaseModel):
    budget_alerts_enabled: bool | None = None
    goal_alerts_enabled: bool | None = None
    unusual_spending_enabled: bool | None = None
    monthly_summary_enabled: bool | None = None
    reminders_enabled: bool | None = None
    push_enabled: bool | None = None
    web_push_enabled: bool | None = None
    expo_push_token: str | None = Field(default=None, max_length=255)


# ==============================================================================
# Payment Screenshot Extraction & Verification
# ==============================================================================

class ScreenshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    upi_transaction_id: str | None = None
    payment_app: str | None = None
    merchant_name: str | None = None
    extracted_amount: float | None = None
    extracted_date: date | None = None
    extracted_category: str
    payment_description: str | None = None
    raw_ocr_text: str | None = None
    confidence_score: float
    is_duplicate: bool
    duplicate_reason: str | None = None
    status: str
    linked_transaction_id: str | None = None
    created_at: datetime


class ScreenshotAnalyzeResponse(BaseModel):
    screenshot: ScreenshotOut
    requires_attention: bool
    date_was_extracted: bool
    available_categories: list[str]


class ScreenshotConfirmRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    amount: Decimal = Field(..., gt=Decimal("0"), le=Decimal("9999999999.99"), decimal_places=2)
    category_name: str = Field(..., min_length=1, max_length=80)
    transaction_date: date
    payment_mode: Literal["Cash", "UPI", "Debit Card", "Credit Card", "Other"] = "UPI"
    transaction_id: str | None = Field(default=None, max_length=128)
    notes: str | None = Field(default=None, max_length=1000)


# ==============================================================================
# Enhanced Financial Analytics
# ==============================================================================

class WeeklySpendItem(BaseModel):
    week_label: str
    start_date: date
    end_date: date
    income: float
    expenses: float
    savings: float


class BudgetVsActualItem(BaseModel):
    category_name: str
    color: str
    budget_limit: float
    actual_spent: float
    utilization_percentage: float


class EnhancedAnalyticsResponse(BaseModel):
    month: int
    year: int
    weekly_analysis: list[WeeklySpendItem]
    budget_vs_actual: list[BudgetVsActualItem]
    yearly_income: float
    yearly_expenses: float
    yearly_savings: float
    yearly_savings_rate: float
    top_spending_categories: list[dict[str, Any]]
    monthly_savings_trend: list[MonthlySavingsHistoryItem]
    goals_progress: list[dict[str, Any]]


# ==============================================================================
# Admin Panel (Privacy-First: NO raw financial records, passwords, OTPs, screenshots)
# ==============================================================================

class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    active_last_30d: int
    new_registrations_today: int
    new_registrations_7d: int
    new_registrations_30d: int
    verified_mobile_users: int
    verified_mobile_rate: float
    total_transactions_count: int
    total_voice_entries_count: int
    total_screenshots_count: int
    total_reconciliations_count: int
    total_goals_count: int
    total_budgets_count: int
    registration_trend: list[dict[str, Any]]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    mobile_number: str | None = None
    mobile_verified: bool
    role: str
    is_active: bool
    last_active_at: datetime | None = None
    created_at: datetime


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserRoleUpdate(BaseModel):
    role: Literal["USER", "ADMIN"]


class SystemCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    type: Literal["INCOME", "EXPENSE"]
    color: str = Field(default="#2563EB", max_length=16)
    icon: str = Field(default="tag", max_length=40)


class SystemCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=16)
    icon: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class SystemCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    color: str
    icon: str
    is_active: bool
    created_at: datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    message: str = Field(..., min_length=2, max_length=2000)
    severity: Literal["info", "success", "warning", "danger"] = "info"


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    message: str
    severity: str
    is_active: bool
    recipients_count: int
    created_at: datetime


class AppConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    description: str | None = None
    updated_at: datetime


class AppConfigUpdate(BaseModel):
    value: str = Field(..., min_length=1, max_length=255)


class AdminActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    admin_user_id: str | None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    details: str | None = None
    created_at: datetime


class SystemActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    level: str
    component: str
    message: str
    created_at: datetime
