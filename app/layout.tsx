import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { AuthSessionProvider } from "@/components/session-provider";
import { SessionTimeout } from "@/components/session-timeout";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/hooks/use-toast";
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
  title: "BettorOS",
  description: "Financial management terminal for professional bettors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <ToastProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
            <SessionTimeout />
            <Toaster />
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
