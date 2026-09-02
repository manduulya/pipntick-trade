import type { Metadata } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Providers from "./providers";
import { ThemeProvider } from "../lib/theme-context";
import { THEME_INIT_SCRIPT } from "../lib/theme";
import { TimeFormatProvider } from "../lib/time-format-context";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pipntick.trade";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "pipntick — Trading journal & performance analytics",
    template: "%s — pipntick",
  },
  description:
    "pipntick is a trading journal that helps you log every trade, review them on a calendar, and analyse your win rate, profit factor, and P&L over time.",
  applicationName: "pipntick",
  keywords: ["trading journal", "trade log", "forex journal", "trading analytics", "performance tracking", "MT4", "MT5"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "pipntick",
    title: "pipntick — Trading journal & performance analytics",
    description:
      "Log every trade, see your month at a glance, and understand what's actually working in your trading.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: THEME_INIT_SCRIPT below sets data-theme on this element before
          React hydrates, which is an intentional, expected difference from what was
          server-rendered (the server has no way to know the client's stored theme) — without
          this, React logs a hydration-mismatch warning for an attribute that's supposed to
          differ. Scoped to just this element, doesn't suppress mismatches anywhere else. */}
      <html lang="en" suppressHydrationWarning>
        <body>
          {/* AdSense site-wide loader — only rendered when a publisher ID is actually configured,
              same env-gated graceful-degradation pattern as Clerk's DEV_AUTH_BYPASS. Required
              once for the account, regardless of how many AdSlot units are placed on the page. */}
          {ADSENSE_CLIENT_ID && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
          {/* Blocking script, runs before anything else in <body> paints — sets data-theme on
              <html> synchronously so there's no flash of the wrong theme on load. Can't import
              resolveInitialTheme() here (this has to be a plain inline script), so the same
              stored → dark fallback logic is duplicated as a string in THEME_INIT_SCRIPT — kept
              in sync by hand, see lib/theme.ts. */}
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <ThemeProvider>
            <TimeFormatProvider>
              <Providers>{children}</Providers>
            </TimeFormatProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
