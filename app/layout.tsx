import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";

import { cn } from "@/lib/utils";
import { ThemeApplier } from "@/components/brand/ThemeApplier";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SwRegistration } from "@/components/providers/SwRegistration";
import { AuthListener } from "@/components/auth/AuthListener";
import { SkipLink } from "@/components/layout/SkipLink";
import { Toaster } from "@/components/ui/sonner";
import { resolveActiveTheme } from "@/lib/brand/theme-from-user";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  weight: ["700", "900"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  // Resolves OG/manifest URLs absolutely. Operator-side: domain pointing
  // to Vercel happens at Phase 13 / 13-7; until then social previews
  // reference a host that doesn't yet resolve (non-blocking).
  metadataBase: new URL("https://app.handibowls.co.za"),
  title: "HandiBowls",
  description: "HandiBowls — tournaments, scores, and skills in your pocket.",
  manifest: "/manifest.webmanifest",
  applicationName: "HandiBowls",
  appleWebApp: {
    capable: true,
    title: "HandiBowls",
    statusBarStyle: "black-translucent",
  },
  // SVG primary + PNG fallbacks for legacy browsers; apple-icon.png at
  // app/ root is auto-emitted by Next.js conventional file routing.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
  },
  openGraph: {
    title: "HandiBowls",
    description:
      "Tournaments, scores, and skills in your pocket — for South African lawn bowls.",
    url: "https://app.handibowls.co.za",
    siteName: "HandiBowls",
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HandiBowls",
    description:
      "Tournaments, scores, and skills in your pocket — for South African lawn bowls.",
  },
};

export const viewport: Viewport = {
  themeColor: "#D7261E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the user's theme server-side so the very first paint is correct
  // — avoids a flash of unthemed content. ThemeApplier keeps it in sync with
  // later client-side auth state changes.
  const theme = await resolveActiveTheme();

  return (
    <html
      lang="en"
      data-theme={theme}
      className={cn(
        inter.variable,
        barlowCondensed.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="font-sans">
        {/* WCAG 2.1 / 2.4.1: skip link must be the first focusable element
            on the page so keyboard users can bypass repeated nav chrome.
            Each role layout's `<main>` carries id="main-content". */}
        <SkipLink />
        <QueryProvider>
          <AuthListener />
          <ThemeApplier theme={theme} />
          {/* Phase 13 / 13-3 / Batch I — service-worker registration.
              Mounts after ThemeApplier so SW caching kicks in only
              after theme tokens are stable in the document; the SW
              caches Tailwind's CSS bundle which carries theme-token
              custom properties, so a pre-theme cache hit could ship
              stale tokens. SwRegistration is a "use client" shim
              wrapping @serwist/next/react's SerwistProvider — the
              shim is required because @serwist/next/react ships
              without a "use client" directive of its own + Next 16
              + Turbopack would otherwise bundle createContext()
              into the server runtime. Closes DRIFT
              sw-registration-missing (Phase 8d–8f offline-first
              contract now actually honoured — reload-while-offline
              serves from SW cache instead of the browser's cache
              fallback). */}
          <SwRegistration />
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
