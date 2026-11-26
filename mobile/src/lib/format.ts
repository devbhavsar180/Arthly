import { PaymentMode } from "@/types";

export const COLORS = {
  ivory: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  brand: "#2563EB",
  brandDark: "#1E3A8A",
  brandSoft: "#EFF6FF",
  indigo: "#4F46E5",
  sage: "#10B981",
  sageSoft: "#ECFDF5",
  rose: "#E11D48",
  roseSoft: "#FFF1F2",
  amber: "#D97706",
  amberSoft: "#FFFBEB",
};

export const PAYMENT_MODES: PaymentMode[] = [
  "UPI",
  "Cash",
  "Debit Card",
  "Credit Card",
  "Other",
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatCurrency(
  amount: number,
  symbol: string = "₹",
  currencyCode: string = "INR"
): string {
  const safeVal = Number.isFinite(amount) ? amount : 0;
  const locale = currencyCode === "INR" ? "en-IN" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(safeVal));
  return `${safeVal < 0 ? "-" : ""}${symbol}${formatted}`;
}

export function formatCompact(amount: number, symbol: string = "₹"): string {
  const abs = Math.abs(amount || 0);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}${symbol}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}${symbol}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
