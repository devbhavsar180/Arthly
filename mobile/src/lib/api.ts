import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import {
  AdminAnnouncementItem,
  AdminDashboardStats,
  AdminUserItem,
  AppConfigItem,
  AppNotification,
  BudgetHistoryItem,
  BudgetItem,
  BudgetPeriodSummary,
  Category,
  DashboardResponse,
  EnhancedAnalyticsResponse,
  NotificationListResponse,
  NotificationPreferences,
  OtpSendResponse,
  OtpVerifyResponse,
  PaymentScreenshotRecord,
  ReconciliationMatch,
  ReconciliationSession,
  SavingsDashboardResponse,
  SavingsGoal,
  ScreenshotAnalyzeResponse,
  SystemCategoryItem,
  TokenResponse,
  Transaction,
  TransactionListResponse,
  TransactionType,
  User,
  UserSettings,
  VoiceConfirmRequest,
  VoiceEntryHistory,
  VoiceParseResponse,
} from "@/types";

const ACCESS_KEY = "met_access_token";
const REFRESH_KEY = "met_refresh_token";
const API_URL_KEY = "met_custom_api_url";

const DEFAULT_API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:8000/api/v1"
    : "http://localhost:8000/api/v1");

let cachedApiBase: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedApiBase) return cachedApiBase;
  const stored = await SecureStore.getItemAsync(API_URL_KEY);
  cachedApiBase = stored ? stored.replace(/\/$/, "") : DEFAULT_API_BASE;
  return cachedApiBase;
}

export async function setApiBaseUrl(url: string): Promise<string> {
  const cleaned = url.trim().replace(/\/$/, "");
  if (!cleaned) {
    await SecureStore.deleteItemAsync(API_URL_KEY);
    cachedApiBase = DEFAULT_API_BASE;
    return cachedApiBase;
  }
  const normalized = cleaned.endsWith("/api/v1") ? cleaned : `${cleaned}/api/v1`;
  await SecureStore.setItemAsync(API_URL_KEY, normalized);
  cachedApiBase = normalized;
  return normalized;
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function storeTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const base = await getApiBaseUrl();
    const res = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return false;
    }
    const data: TokenResponse = await res.json();
    await storeTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const base = await getApiBaseUrl();
  const token = await getAccessToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      `Cannot connect to Arthly server at ${base}. Update Server URL in Login or Profile.`,
      0
    );
  }

  if (res.status === 401 && retryOn401 && (await getRefreshToken())) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = await res.json();
      if (typeof payload.detail === "string") {
        message = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        message = payload.detail.map((d: any) => d.msg).join(", ");
      }
    } catch {
      // ignore non-json errors
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      qs.append(key, String(val));
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : "";
}

async function downloadAndShareReport(path: string, fallbackName: string) {
  const base = await getApiBaseUrl();
  let token = await getAccessToken();
  const targetUri = `${FileSystem.documentDirectory}${fallbackName}`;

  let result = await FileSystem.downloadAsync(`${base}${path}`, targetUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status === 401 && (await tryRefreshToken())) {
    token = await getAccessToken();
    result = await FileSystem.downloadAsync(`${base}${path}`, targetUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  if (result.status !== 200) {
    throw new ApiError("Could not download report file", result.status);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri);
  }
  return result.uri;
}

export const mobileApi = {
  // Auth & Mobile OTP
  sendOtp: (body: {
    mobile_number: string;
    purpose: "REGISTER" | "LOGIN" | "FORGOT_PASSWORD" | "VERIFY_MOBILE";
  }) => request<OtpSendResponse>("/auth/otp/send", { method: "POST", body: JSON.stringify(body) }, false),
  verifyOtp: (body: {
    mobile_number: string;
    otp: string;
    purpose: "REGISTER" | "LOGIN" | "FORGOT_PASSWORD" | "VERIFY_MOBILE";
  }) => request<OtpVerifyResponse>("/auth/otp/verify", { method: "POST", body: JSON.stringify(body) }, false),
  registerWithOtp: (body: {
    full_name: string;
    mobile_number: string;
    email?: string;
    password: string;
    verification_token?: string;
    otp?: string;
  }) => request<TokenResponse>("/auth/register-otp", { method: "POST", body: JSON.stringify(body) }, false),
  register: (body: { full_name: string; email: string; password: string; mobile_number?: string }) =>
    request<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }, false),
  login: (body: { email?: string; mobile_number?: string; identifier?: string; password: string }) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }, false),
  loginWithOtp: (body: { mobile_number: string; otp?: string; verification_token?: string }) =>
    request<TokenResponse>("/auth/login-otp", { method: "POST", body: JSON.stringify(body) }, false),
  resetPasswordWithOtp: (body: {
    mobile_number: string;
    verification_token?: string;
    otp?: string;
    new_password: string;
    confirm_password: string;
  }) =>
    request<{ message: string }>(
      "/auth/reset-password-otp",
      { method: "POST", body: JSON.stringify(body) },
      false
    ),
  verifyMobile: (body: { mobile_number: string; otp?: string; verification_token?: string }) =>
    request<User>("/auth/verify-mobile", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  forgotPassword: (email: string) =>
    request<{ message: string; reset_token?: string | null }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false
    ),
  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, new_password }) },
      false
    ),

  // Dashboard & Categories
  getDashboard: (params: {
    month?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    category_id?: string;
  }) => request<DashboardResponse>(`/dashboard${buildQuery(params)}`),

  listCategories: (type?: TransactionType) =>
    request<Category[]>(`/categories${buildQuery({ type })}`),
  createCategory: (body: { name: string; type: TransactionType; color: string; icon?: string }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(body) }),
  deleteCategory: (id: string, reassign_to_other = false) =>
    request<{ message: string }>(
      `/categories/${id}${buildQuery({ reassign_to_other })}`,
      { method: "DELETE" }
    ),

  // Transactions
  listTransactions: (params: {
    search?: string;
    transaction_type?: TransactionType | "";
    category_id?: string;
    payment_mode?: string;
    start_date?: string;
    end_date?: string;
    month?: number;
    year?: number;
    sort_by?: "date" | "amount" | "created_at";
    sort_order?: "asc" | "desc";
    page?: number;
    page_size?: number;
  }) => request<TransactionListResponse>(`/transactions${buildQuery(params)}`),
  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),
  createTransaction: (body: {
    transaction_type: TransactionType;
    title: string;
    amount: number;
    category_id: string;
    payment_mode?: string | null;
    transaction_date: string;
    notes?: string | null;
  }) => request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(body) }),
  updateTransaction: (
    id: string,
    body: {
      transaction_type?: TransactionType;
      title?: string;
      amount?: number;
      category_id?: string;
      payment_mode?: string | null;
      transaction_date?: string;
      notes?: string | null;
    }
  ) => request<Transaction>(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTransaction: (id: string) =>
    request<{ message: string }>(`/transactions/${id}`, { method: "DELETE" }),

  // Reports & Analytics
  getEnhancedAnalytics: (params: { month?: number; year?: number }) =>
    request<EnhancedAnalyticsResponse>(`/reports/analytics${buildQuery(params)}`),
  downloadReport: (
    type: "pdf/expense" | "pdf/income" | "pdf/summary" | "excel" | "csv",
    params: { month?: number; year?: number }
  ) => {
    const ext = type.startsWith("pdf") ? "pdf" : type === "excel" ? "xlsx" : "csv";
    const cleanType = type.replace("/", "_");
    return downloadAndShareReport(
      `/reports/${type}${buildQuery(params)}`,
      `arthly_${cleanType}_${Date.now()}.${ext}`
    );
  },

  // Settings & Backups
  updateProfile: (body: { full_name: string; email: string }) =>
    request<User>("/settings/profile", { method: "PUT", body: JSON.stringify(body) }),
  updateCurrency: (body: { currency_code: string; currency_symbol: string }) =>
    request<UserSettings>("/settings/currency", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ message: string }>("/settings/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  exportBackup: () =>
    downloadAndShareReport("/settings/export", `arthly_backup_${Date.now()}.json`),
  updateVoiceLanguage: (preferred_voice_language: "gu" | "en" | "hi" | "auto") =>
    request<UserSettings>("/settings/voice-language", {
      method: "PUT",
      body: JSON.stringify({ preferred_voice_language }),
    }),

  // Voice Expense Entry
  parseVoiceText: (data: { text: string; language?: string }) =>
    request<VoiceParseResponse>("/voice/parse", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  processVoiceAudio: (formData: FormData) =>
    request<VoiceParseResponse>("/voice/process-audio", {
      method: "POST",
      body: formData,
    }),
  confirmVoiceTransactions: (data: VoiceConfirmRequest) =>
    request<{ message: string; created_count: number; entry_id: string }>("/voice/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getVoiceHistory: (limit = 20) => request<VoiceEntryHistory[]>(`/voice/history?limit=${limit}`),

  // Bank Statement Reconciliation
  uploadBankStatement: (formData: FormData) =>
    request<ReconciliationSession>("/reconciliation/upload", {
      method: "POST",
      body: formData,
    }),
  getReconciliationSessions: () => request<ReconciliationSession[]>("/reconciliation/sessions"),
  updateMatchAction: (
    matchId: string,
    body: { action: string; category_id?: string; notes?: string }
  ) =>
    request<ReconciliationMatch>(`/reconciliation/matches/${matchId}/action`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadReconciliationReport: (sessionId: string, format: "pdf" | "excel" | "csv") => {
    const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
    return downloadAndShareReport(
      `/reconciliation/sessions/${sessionId}/report/${format}`,
      `reconciliation_${Date.now()}.${ext}`
    );
  },

  // Savings Dashboard & Goals
  getSavingsDashboard: (params: { month?: number; year?: number }) =>
    request<SavingsDashboardResponse>(`/savings/dashboard${buildQuery(params)}`),
  listSavingsGoals: () => request<SavingsGoal[]>("/savings/goals"),
  createSavingsGoal: (body: {
    name: string;
    target_amount: number;
    current_amount?: number;
    target_date: string;
    icon?: string;
    color?: string;
    notes?: string;
  }) => request<SavingsGoal>("/savings/goals", { method: "POST", body: JSON.stringify(body) }),
  updateSavingsGoal: (
    goalId: string,
    body: {
      name?: string;
      target_amount?: number;
      target_date?: string;
      status?: "ACTIVE" | "COMPLETED" | "PAUSED";
      color?: string;
      notes?: string;
    }
  ) =>
    request<SavingsGoal>(`/savings/goals/${goalId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  contributeToGoal: (
    goalId: string,
    body: { amount: number; contribution_date?: string; notes?: string }
  ) =>
    request<SavingsGoal>(`/savings/goals/${goalId}/contribute`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteSavingsGoal: (goalId: string) =>
    request<{ message: string }>(`/savings/goals/${goalId}`, { method: "DELETE" }),

  // Budgets & Expense Limit Alerts
  getBudgets: (params: { month?: number; year?: number }) =>
    request<BudgetPeriodSummary>(`/budgets${buildQuery(params)}`),
  upsertBudget: (body: {
    category_id: string | null;
    month: number;
    year: number;
    limit_amount: number;
  }) => request<BudgetItem>("/budgets", { method: "POST", body: JSON.stringify(body) }),
  deleteBudget: (budgetId: string) =>
    request<{ message: string }>(`/budgets/${budgetId}`, { method: "DELETE" }),
  getBudgetHistory: (months = 6) =>
    request<BudgetHistoryItem[]>(`/budgets/history?months=${months}`),
  copyPreviousBudgets: (month: number, year: number) =>
    request<{ message: string; copied: number }>(
      `/budgets/copy-previous${buildQuery({ month, year })}`,
      { method: "POST" }
    ),

  // Notifications & Preferences
  listNotifications: (unreadOnly = false) =>
    request<NotificationListResponse>(`/notifications${buildQuery({ unread_only: unreadOnly })}`),
  markNotificationRead: (id: string) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () =>
    request<{ message: string; updated: number }>("/notifications/read-all", { method: "PUT" }),
  deleteNotification: (id: string) =>
    request<{ message: string }>(`/notifications/${id}`, { method: "DELETE" }),
  getNotificationPreferences: () => request<NotificationPreferences>("/notifications/preferences"),
  updateNotificationPreferences: (body: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  checkSmartReminders: () =>
    request<{ new_reminders_count: number; notifications: AppNotification[] }>(
      "/notifications/check-reminders",
      { method: "POST" }
    ),

  // Payment Screenshot AI/OCR
  analyzeScreenshot: (formData: FormData) =>
    request<ScreenshotAnalyzeResponse>("/screenshots/analyze", {
      method: "POST",
      body: formData,
    }),
  confirmScreenshot: (
    screenshotId: string,
    body: {
      title: string;
      amount: number;
      category_name: string;
      transaction_date: string;
      payment_mode: string;
      transaction_id?: string | null;
      notes?: string | null;
    }
  ) =>
    request<Transaction>(`/screenshots/${screenshotId}/confirm`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  discardScreenshot: (screenshotId: string) =>
    request<{ message: string }>(`/screenshots/${screenshotId}/discard`, { method: "POST" }),
  getScreenshotHistory: () => request<PaymentScreenshotRecord[]>("/screenshots/history"),

  // Admin Panel
  getAdminDashboard: () => request<AdminDashboardStats>("/admin/dashboard"),
  getAdminUsers: (params?: { search?: string; status_filter?: string }) =>
    request<AdminUserItem[]>(`/admin/users${buildQuery(params || {})}`),
  updateAdminUserStatus: (userId: string, is_active: boolean) =>
    request<AdminUserItem>(`/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active }),
    }),
  updateAdminUserRole: (userId: string, role: "USER" | "ADMIN") =>
    request<AdminUserItem>(`/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  listSystemCategories: () => request<SystemCategoryItem[]>("/admin/categories"),
  createSystemCategory: (body: { name: string; type: TransactionType; color: string; icon?: string }) =>
    request<SystemCategoryItem>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteSystemCategory: (id: string) =>
    request<{ message: string }>(`/admin/categories/${id}`, { method: "DELETE" }),
  listAdminAnnouncements: () => request<AdminAnnouncementItem[]>("/admin/announcements"),
  createAdminAnnouncement: (body: { title: string; message: string; severity: string }) =>
    request<AdminAnnouncementItem>("/admin/announcements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAdminConfigs: () => request<AppConfigItem[]>("/admin/configs"),
  updateAdminConfig: (key: string, value: string) =>
    request<AppConfigItem>(`/admin/configs/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
