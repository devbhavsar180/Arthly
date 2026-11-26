import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Arthly — AI Personal Finance, Budgets & Savings Manager",
  description:
    "Modern, private AI-powered personal expense, savings goals, smart budgets, screenshot OCR, and multi-device financial platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-[#F8FAFC] text-slate-900 selection:bg-brand-100 selection:text-brand-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
