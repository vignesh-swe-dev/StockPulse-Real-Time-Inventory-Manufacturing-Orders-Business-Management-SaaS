import "./globals.css";
import React from "react";
import { AuthProvider } from "../lib/auth-context";
import { AppShell } from "../components/AppShell";

export const viewport = { themeColor: "#0369a1" };

export const metadata = {
  title: "StockPulse — Real-Time Inventory, Manufacturing & Business Management",
  description: "Enterprise multi-tenant inventory, manufacturing BOM, sales orders, GST invoicing and payments for Indian SMEs"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Sora:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
