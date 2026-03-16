import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppTabs } from "./components/app-tabs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backtest Journal",
  description: "Backtest and live trading journal with Supabase storage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppTabs />
        {children}
      </body>
    </html>
  );
}
