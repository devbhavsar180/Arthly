export type TransactionType = "INCOME" | "EXPENSE";
export type PaymentMode = "Cash" | "UPI" | "Debit Card" | "Credit Card" | "Other";

export interface UserSettings {
  currency_code: string;
  currency_symbol: string;
  theme: string;
  preferred_voice_language?: "gu" | "en" | "hi" | "auto";
}

export interface User {
  id: string;
  email: string;
  mobile_number: string | null;
  mobile_verified: boolean;
  role: "USER" | "ADMIN";
  full_name: string;
  is_active: boolean;
  created_at: string;
  settings: UserSettings | null;
}

export interface OtpSendResponse {
  message: string;
  mobile_number: string;
  expires_in_seconds: number;
  cooldown_seconds: number;
  dev_otp?: string | null;
}

export interface OtpVerifyResponse {
  verified: boolean;
  message: string;
  mobile_number: string;
  verification_token?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
  transaction_count: number;
}

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  title: string;
  amount: number;
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  payment_mode: PaymentMode | null;
  transaction_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total_count: number;
  total_income: number;
  total_expenses: number;
  net_balance: number;
  page: number;
  page_size: number;
}

export interface DashboardCards {
  total_income: number;
  total_expenses: number;
  remaining_balance: number;
  total_savings: number;
  this_month_expenses: number;
  previous_month_expenses: number;
}

export interface HighestTransactionSummary {
  id: string;
  title: string;
  amount: number;
  category_name: string;
  transaction_date: string;
}

export interface MonthlyFinancialSummary {
  month: number;
  year: number;
  month_label: string;
  total_monthly_income: number;
  total_monthly_expenses: number;
  remaining_balance: number;
  total_savings: number;
  highest_expense_category: string | null;
  highest_expense_category_amount: number;
  highest_single_transaction: HighestTransactionSummary | null;
  average_daily_expense: number;
  transaction_count: number;
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  color: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface MonthlyTrendItem {
  month: number;
  year: number;
  label: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface DailyTrendItem {
  date: string;
  label: string;
  expenses: number;
  income: number;
}

export interface DashboardResponse {
  cards: DashboardCards;
  monthly_summary: MonthlyFinancialSummary;
  expense_breakdown: CategoryBreakdownItem[];
  monthly_trend: MonthlyTrendItem[];
  income_vs_expense: MonthlyTrendItem[];
  category_analysis: CategoryBreakdownItem[];
  daily_expense_trend: DailyTrendItem[];
  recent_transactions: Transaction[];
}

export interface CandidateTransaction {
  title: string;
  amount: number | null;
  category_name: string;
  transaction_type: TransactionType;
  transaction_date: string;
  payment_mode: PaymentMode;
  notes?: string | null;
  confidence: number;
  requires_attention: boolean;
  warning?: string | null;
}

export interface VoiceParseResponse {
  raw_text: string;
  detected_language: string;
  preferred_language: string;
  transactions: CandidateTransaction[];
  warnings: string[];
}

export interface VoiceConfirmItem {
  title: string;
  amount: number;
  category_name: string;
  transaction_type: TransactionType;
  transaction_date: string;
  payment_mode: PaymentMode;
  notes?: string | null;
}

export interface VoiceConfirmRequest {
  raw_text: string;
  language: string;
  transactions: VoiceConfirmItem[];
}

export interface VoiceEntryHistory {
  id: string;
  language: string;
  raw_text: string;
  recognized_transactions: any[];
  status: string;
  created_at: string;
}

export interface BankStatement {
  id: string;
  filename: string;
  file_format: string;
  month: number;
  year: number;
  opening_balance: number | null;
  closing_balance: number | null;
  total_debits: number;
  total_credits: number;
  total_transactions: number;
  created_at: string;
}

export interface BankStatementTransaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_no: string | null;
  debit_amount: number;
  credit_amount: number;
  raw_type: "DEBIT" | "CREDIT";
  balance: number | null;
}

export interface AppTransactionBrief {
  id: string;
  transaction_type: TransactionType;
  title: string;
  amount: number;
  payment_mode: PaymentMode | null;
  transaction_date: string;
  notes: string | null;
  category_name: string | null;
}

export type ReconciliationMatchStatus =
  | "MATCHED"
  | "MISSING_IN_APP"
  | "NOT_FOUND_IN_BANK"
  | "MISMATCH"
  | "NEEDS_REVIEW";

export type ReconciliationReviewAction =
  | "NONE"
  | "CONFIRMED"
  | "REJECTED"
  | "CREATED_EXPENSE"
  | "CREATED_INCOME"
  | "IGNORED";

export interface ReconciliationMatch {
  id: string;
  session_id: string;
  status: ReconciliationMatchStatus;
  match_score: number;
  review_action: ReconciliationReviewAction;
  notes: string | null;
  bank_transaction: BankStatementTransaction | null;
  app_transaction: AppTransactionBrief | null;
}

export interface ReconciliationSession {
  id: string;
  month: number;
  year: number;
  status: string;
  summary_stats: {
    total_bank_transactions?: number;
    total_app_transactions?: number;
    matched_count?: number;
    missing_in_app_count?: number;
    not_found_in_bank_count?: number;
    mismatch_count?: number;
    needs_review_count?: number;
    total_bank_debits?: number;
    total_bank_credits?: number;
    date_tolerance_days?: number;
    [key: string]: any;
  };
  date_tolerance_days: number;
  created_at: string;
  statement: BankStatement | null;
  matches: ReconciliationMatch[];
}

export interface SavingsPeriodCard {
  label: string;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
}

export interface MonthlySavingsHistoryItem {
  month: number;
  year: number;
  label: string;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
}

export interface SavingsGoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  contribution_date: string;
  notes?: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  completion_percentage: number;
  target_date: string;
  days_remaining: number;
  required_monthly_saving: number;
  required_weekly_saving: number;
  pace_status: "ON_TRACK" | "BEHIND_SCHEDULE" | "COMPLETED" | "OVERDUE";
  suggestion: string;
  icon: string;
  color: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  contributions: SavingsGoalContribution[];
}

export interface SavingsDashboardResponse {
  month: number;
  year: number;
  weekly: SavingsPeriodCard;
  monthly: SavingsPeriodCard;
  yearly: SavingsPeriodCard;
  all_time: SavingsPeriodCard;
  previous_month_savings: number;
  savings_change_amount: number;
  monthly_history: MonthlySavingsHistoryItem[];
  goals_summary: {
    total_goals: number;
    active_goals: number;
    completed_goals: number;
    total_target_amount: number;
    total_saved_in_goals: number;
    overall_goal_progress: number;
  };
  goals: SavingsGoal[];
}

export interface BudgetItem {
  id: string;
  category_id: string | null;
  category_name: string;
  category_color: string;
  is_overall: boolean;
  month: number;
  year: number;
  limit_amount: number;
  spent_amount: number;
  remaining_amount: number;
  utilization_percentage: number;
  alert_status: "OK" | "WARNING_80" | "WARNING_90" | "REACHED_100" | "EXCEEDED";
  triggered_thresholds: number[];
}

export interface BudgetPeriodSummary {
  month: number;
  year: number;
  month_label: string;
  overall_budget: BudgetItem | null;
  category_budgets: BudgetItem[];
  total_budgeted_categories: number;
  total_spent_in_budgeted_categories: number;
  total_monthly_expenses: number;
  alerts_triggered_count: number;
}

export interface BudgetHistoryItem {
  month: number;
  year: number;
  label: string;
  overall_limit: number;
  total_spent: number;
  utilization_percentage: number;
  status: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  severity: "info" | "success" | "warning" | "danger";
  is_read: boolean;
  action_url?: string | null;
  metadata_json?: Record<string, any> | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  unread_count: number;
  total_count: number;
}

export interface NotificationPreferences {
  budget_alerts_enabled: boolean;
  goal_alerts_enabled: boolean;
  unusual_spending_enabled: boolean;
  monthly_summary_enabled: boolean;
  reminders_enabled: boolean;
  push_enabled: boolean;
  web_push_enabled: boolean;
  expo_push_token?: string | null;
}

export interface PaymentScreenshotRecord {
  id: string;
  filename: string;
  upi_transaction_id?: string | null;
  payment_app?: string | null;
  merchant_name?: string | null;
  extracted_amount?: number | null;
  extracted_date?: string | null;
  extracted_category: string;
  payment_description?: string | null;
  raw_ocr_text?: string | null;
  confidence_score: number;
  is_duplicate: boolean;
  duplicate_reason?: string | null;
  status: string;
  linked_transaction_id?: string | null;
  created_at: string;
}

export interface ScreenshotAnalyzeResponse {
  screenshot: PaymentScreenshotRecord;
  requires_attention: boolean;
  date_was_extracted: boolean;
  available_categories: string[];
}

export interface EnhancedAnalyticsResponse {
  month: number;
  year: number;
  weekly_analysis: {
    week_label: string;
    start_date: string;
    end_date: string;
    income: number;
    expenses: number;
    savings: number;
  }[];
  budget_vs_actual: {
    category_name: string;
    color: string;
    budget_limit: number;
    actual_spent: number;
    utilization_percentage: number;
  }[];
  yearly_income: number;
  yearly_expenses: number;
  yearly_savings: number;
  yearly_savings_rate: number;
  top_spending_categories: {
    category_name: string;
    color: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  monthly_savings_trend: MonthlySavingsHistoryItem[];
  goals_progress: {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    percentage: number;
    status: string;
    color: string;
  }[];
}

export interface AdminDashboardStats {
  total_users: number;
  active_users: number;
  active_last_30d: number;
  new_registrations_today: number;
  new_registrations_7d: number;
  new_registrations_30d: number;
  verified_mobile_users: number;
  verified_mobile_rate: number;
  total_transactions_count: number;
  total_voice_entries_count: number;
  total_screenshots_count: number;
  total_reconciliations_count: number;
  total_goals_count: number;
  total_budgets_count: number;
  registration_trend: { date: string; count: number }[];
}

export interface AdminUserItem {
  id: string;
  full_name: string;
  email: string;
  mobile_number?: string | null;
  mobile_verified: boolean;
  role: "USER" | "ADMIN";
  is_active: boolean;
  last_active_at?: string | null;
  created_at: string;
}

export interface SystemCategoryItem {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminAnnouncementItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_active: boolean;
  recipients_count: number;
  created_at: string;
}

export interface AppConfigItem {
  key: string;
  value: string;
  description?: string | null;
  updated_at: string;
}

