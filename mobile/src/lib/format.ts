import { PaymentMode } from "@/types";

export const COLORS = {
  ivory: "#FAF9F6",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  brand: "#2563EB",
  brandSoft: "#EFF6FF",
  sage: "#059669",
  sageSoft: "#ECFDF5",
  rose: "#E11D48",
  roseSoft: "#FFF1F2",
  amber: "#D97706",
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

export function formatCurrency(amount: number, symbol: string = "₹"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  let formattedInt = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) groups.unshift(rest);
    formattedInt = `${groups.join(",")},${last3}`;
  }
  return `${negative ? "-" : ""}${symbol}${formattedInt}.${decPart}`;
}

export function formatCompact(amount: number, symbol: string = "₹"): string {
  const abs = Math.abs(amount);
  if (abs >= 100000) return `${symbol}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${symbol}${abs.toFixed(0)}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}
