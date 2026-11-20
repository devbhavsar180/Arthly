from datetime import date

from pydantic import BaseModel

from app.schemas.transaction import TransactionOut


class DashboardCards(BaseModel):
    total_income: float
    total_expenses: float
    remaining_balance: float
    total_savings: float
    this_month_expenses: float
    previous_month_expenses: float


class HighestTransactionSummary(BaseModel):
    id: str
    title: str
    amount: float
    category_name: str
    transaction_date: date


class MonthlyFinancialSummary(BaseModel):
    month: int
    year: int
    month_label: str
    total_monthly_income: float
    total_monthly_expenses: float
    remaining_balance: float
    total_savings: float
    highest_expense_category: str | None
    highest_expense_category_amount: float
    highest_single_transaction: HighestTransactionSummary | None
    average_daily_expense: float
    transaction_count: int


class CategoryBreakdownItem(BaseModel):
    category_id: str
    category_name: str
    color: str
    amount: float
    percentage: float
    transaction_count: int


class MonthlyTrendItem(BaseModel):
    month: int
    year: int
    label: str
    income: float
    expenses: float
    savings: float


class DailyTrendItem(BaseModel):
    date: date
    label: str
    expenses: float
    income: float


class DashboardResponse(BaseModel):
    cards: DashboardCards
    monthly_summary: MonthlyFinancialSummary
    expense_breakdown: list[CategoryBreakdownItem]
    monthly_trend: list[MonthlyTrendItem]
    income_vs_expense: list[MonthlyTrendItem]
    category_analysis: list[CategoryBreakdownItem]
    daily_expense_trend: list[DailyTrendItem]
    recent_transactions: list[TransactionOut]
