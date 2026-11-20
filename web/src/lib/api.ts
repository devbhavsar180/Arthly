import {
  Category,
  DashboardResponse,
  ReconciliationMatch,
  ReconciliationSession,
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000/api/v1";

const ACCESS_KEY = "met_access_token";
const REFRESH_KEY = "met_refresh_token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function storeTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data: TokenResponse = await res.json();
    storeTokens(data.access_token, data.refresh_token);
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
  const token = getStoredAccessToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retryOn401 && getStoredRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let msg = "Request failed";
    try {
      const errBody = await res.json();
      if (typeof errBody.detail === "string") {
        msg = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        msg = errBody.detail.map((d: { msg?: string }) => d.msg).join(", ");
      }
    } catch {
      msg = res.statusText || msg;
    }
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, String(v));
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export async function downloadProtectedFile(path: string, fallbackFilename: string) {
  let token = getStoredAccessToken();
  let res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && getStoredRefreshToken()) {
    const ok = await tryRefreshToken();
    if (ok) {
      token = getStoredAccessToken();
      res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    }
  }

  if (!res.ok) {
    throw new ApiError("Failed to download report", res.status);
  }

  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  register: (body: { full_name: string; email: string; password: string }) =>
    request<TokenResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }, false),
  login: (body: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }, false),
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

  // Dashboard
  getDashboard: (params: {
    month?: number;
    year?: number;
    start_date?: string;
    end_date?: string;
    category_id?: string;
  }) => request<DashboardResponse>(`/dashboard${buildQuery(params)}`),

  // Categories
  listCategories: (type?: TransactionType) =>
    request<Category[]>(`/categories${buildQuery({ type })}`),
  createCategory: (body: { name: string; type: TransactionType; color: string; icon?: string }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id: string, body: { name?: string; color?: string; icon?: string }) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
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

  // Reports
  downloadReport: (
    type: "pdf/expense" | "pdf/income" | "pdf/summary" | "excel" | "csv",
    params: {
      month?: number;
      year?: number;
      start_date?: string;
      end_date?: string;
      category_id?: string;
      payment_mode?: string;
    }
  ) => {
    const ext = type.startsWith("pdf") ? "pdf" : type === "excel" ? "xlsx" : "csv";
    return downloadProtectedFile(
      `/reports/${type}${buildQuery(params)}`,
      `report.${ext}`
    );
  },

  // Settings
  updateProfile: (body: { full_name: string; email: string }) =>
    request<User>("/settings/profile", { method: "PUT", body: JSON.stringify(body) }),
  updateCurrency: (body: { currency_code: string; currency_symbol: string }) =>
    request<UserSettings>("/settings/currency", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ message: string }>("/settings/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  exportAllData: () => downloadProtectedFile("/settings/export", "my_expense_tracker_backup.json"),
  restoreBackup: (payload: Record<string, unknown>) =>
    request<{ message: string; categories_added: number; transactions_restored: number }>(
      "/settings/restore",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  deleteAccount: (body: { password: string; confirmation: string }) =>
    request<{ message: string }>("/settings/account", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
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
    request<{ message: string; created_count: number; entry_id: string }>(
      "/voice/confirm",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),
  getVoiceHistory: (limit = 20) =>
    request<VoiceEntryHistory[]>(`/voice/history?limit=${limit}`),

  // Bank Statement Reconciliation
  uploadBankStatement: (formData: FormData) =>
    request<ReconciliationSession>("/reconciliation/upload", {
      method: "POST",
      body: formData,
    }),
  getReconciliationSessions: () =>
    request<ReconciliationSession[]>("/reconciliation/sessions"),
  getReconciliationSession: (id: string) =>
    request<ReconciliationSession>(`/reconciliation/sessions/${id}`),
  updateMatchAction: (
    matchId: string,
    body: { action: string; category_id?: string; notes?: string }
  ) =>
    request<ReconciliationMatch>(`/reconciliation/matches/${matchId}/action`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  downloadReconciliationReport: (
    sessionId: string,
    format: "pdf" | "excel" | "csv"
  ) => {
    const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
    return downloadProtectedFile(
      `/reconciliation/sessions/${sessionId}/report/${format}`,
      `reconciliation_report.${ext}`
    );
  },
  deleteReconciliationSession: (id: string) =>
    request<{ message: string }>(`/reconciliation/sessions/${id}`, {
      method: "DELETE",
    }),
};
