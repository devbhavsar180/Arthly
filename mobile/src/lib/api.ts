import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
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
  VoiceParseResponse,
} from "@/types";

const ACCESS_KEY = "met_access_token";
const REFRESH_KEY = "met_refresh_token";
const API_URL_KEY = "met_custom_api_url";

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  "http://10.0.2.2:8000/api/v1";

let cachedBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const saved = await AsyncStorage.getItem(API_URL_KEY);
  cachedBaseUrl = (saved || DEFAULT_API_URL).replace(/\/$/, "");
  return cachedBaseUrl;
}

export async function setApiBaseUrl(url: string): Promise<string> {
  const cleaned = url.trim().replace(/\/$/, "");
  cachedBaseUrl = cleaned;
  await AsyncStorage.setItem(API_URL_KEY, cleaned);
  return cleaned;
}

export async function storeTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
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
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
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
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retryOn401) {
    const ok = await tryRefreshToken();
    if (ok) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let msg = "Request failed";
    try {
      const err = await res.json();
      if (typeof err.detail === "string") msg = err.detail;
      else if (Array.isArray(err.detail)) {
        msg = err.detail.map((d: { msg?: string }) => d.msg).join(", ");
      }
    } catch {
      msg = `HTTP ${res.status}`;
    }
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const parts: string[] = [];
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  });
  return parts.length ? `?${parts.join("&")}` : "";
}

export async function downloadAndShareReport(
  endpoint: string,
  filename: string
): Promise<void> {
  const base = await getApiBaseUrl();
  const token = await getAccessToken();
  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(`${base}${endpoint}`, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status !== 200) {
    throw new ApiError("Could not download report file", result.status);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri);
  }
}

export const mobileApi = {
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

  getDashboard: (params: { month?: number; year?: number; category_id?: string }) =>
    request<DashboardResponse>(`/dashboard${buildQuery(params)}`),

  listCategories: (type?: TransactionType) =>
    request<Category[]>(`/categories${buildQuery({ type })}`),
  createCategory: (body: { name: string; type: TransactionType; color: string; icon?: string }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(body) }),
  deleteCategory: (id: string, reassign_to_other = true) =>
    request<{ message: string }>(
      `/categories/${id}${buildQuery({ reassign_to_other })}`,
      { method: "DELETE" }
    ),

  listTransactions: (params: {
    search?: string;
    transaction_type?: TransactionType | "";
    category_id?: string;
    payment_mode?: string;
    sort_by?: "date" | "amount";
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

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

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

  downloadReport: (
    kind: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv",
    params: { month: number; year: number; category_id?: string; payment_mode?: string }
  ) => {
    const ext = kind.startsWith("pdf") ? "pdf" : kind === "excel" ? "xlsx" : "csv";
    const safeKind = kind.replace("/", "_");
    const filename = `${safeKind}_${params.year}_${params.month}.${ext}`;
    return downloadAndShareReport(`/reports/${kind}${buildQuery(params)}`, filename);
  },

  updateProfile: (body: { full_name: string; email: string }) =>
    request<User>("/settings/profile", { method: "PUT", body: JSON.stringify(body) }),
  updateCurrency: (body: { currency_code: string; currency_symbol: string }) =>
    request<UserSettings>("/settings/currency", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body: { current_password: string; new_password: string }) =>
    request<{ message: string }>("/settings/change-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  exportBackup: () => downloadAndShareReport("/settings/export", "my_expense_tracker_backup.json"),
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
  confirmVoiceTransactions: (data: VoiceConfirmRequest) =>
    request<{ message: string; created_count: number; entry_id: string }>(
      "/voice/confirm",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

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
  deleteReconciliationSession: (id: string) =>
    request<{ message: string }>(`/reconciliation/sessions/${id}`, {
      method: "DELETE",
    }),
  downloadReconciliationReport: (
    sessionId: string,
    format: "pdf" | "excel" | "csv"
  ) => {
    const ext = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
    const filename = `reconciliation_report_${sessionId.slice(0, 8)}.${ext}`;
    return downloadAndShareReport(
      `/reconciliation/sessions/${sessionId}/report/${format}`,
      filename
    );
  },
};
