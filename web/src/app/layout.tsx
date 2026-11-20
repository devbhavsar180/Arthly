import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "My Expense Tracker — Personal Finance & Income Manager",
  description:
    "Simple, fast, private personal expense and monthly income tracker with interactive dashboards and financial reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-ivory text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
