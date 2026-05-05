import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/dashboards.css";
import { Toaster } from "@/components/ui/toaster";
import AppProviders from "@/components/providers/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CONGCHAIN — Verifiable AI Memory Layer",
  description: "Sua camada de memoria IA verificavel na blockchain Solana. Chat inteligente com CONGCHAIN.",
  keywords: ["CONGCHAIN", "AI", "Memory Layer", "Solana", "Blockchain", "Verifiable AI"],
  authors: [{ name: "CONGCHAIN Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='g' cx='40%25' cy='40%25' r='60%25'><stop offset='0%25' stop-color='%23fff'/><stop offset='15%25' stop-color='%239945FF'/><stop offset='60%25' stop-color='%239945FF'/><stop offset='100%25' stop-color='%2314F195'/></radialGradient></defs><circle cx='50' cy='50' r='45' fill='url(%23g)'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: '#06060e', color: '#f0f0f5' }}
      >
        <AppProviders>
          {children}
        </AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
