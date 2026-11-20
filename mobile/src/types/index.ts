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
  full_name: string;
  created_at: string;
  settings: UserSettings | null;
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
  highest_single_transaction: {
    id: string;
    title: string;
    amount: number;
    category_name: string;
    transaction_date: string;
  } | null;
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

export interface ReconciliationMatch {
  id: string;
  session_id: string;
  status: "MATCHED" | "MISSING_IN_APP" | "NOT_FOUND_IN_BANK" | "MISMATCH" | "NEEDS_REVIEW";
  match_score: number;
  review_action: string;
  notes: string | null;
  bank_transaction: BankStatementTransaction | null;
  app_transaction: {
    id: string;
    transaction_type: TransactionType;
    title: string;
    amount: number;
    payment_mode: PaymentMode | null;
    transaction_date: string;
    notes: string | null;
    category_name: string | null;
  } | null;
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

