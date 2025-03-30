import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { PendingDomainsHandler } from "@/components/pending-domains-handler";
import { PostHogProvider } from "@/components/PostHogProvider";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import EmailVerificationBannerWrapper from "@/components/EmailVerificationBannerWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Domain Calendar",
  description: "Track your domain expiry dates",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const content = (
    <>
      <EmailVerificationBannerWrapper />
      {children}
      <PendingDomainsHandler />
      <Toaster />
      <Analytics />
      <SpeedInsights />
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {process.env.NODE_ENV === "production" ? (
            <PostHogProvider>
              <Providers>{content}</Providers>
            </PostHogProvider>
          ) : (
            <Providers>{content}</Providers>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
