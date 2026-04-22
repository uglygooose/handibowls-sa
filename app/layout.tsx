import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, JetBrains_Mono } from "next/font/google";

import { cn } from "@/lib/utils";
import { ThemeApplier } from "@/components/brand/ThemeApplier";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthListener } from "@/components/auth/AuthListener";
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
  title: "HandiBowls",
  description: "HandiBowls — tournaments, scores, and skills in your pocket.",
  manifest: "/manifest.webmanifest",
  applicationName: "HandiBowls",
  appleWebApp: {
    capable: true,
    title: "HandiBowls",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
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
        <QueryProvider>
          <AuthListener />
          <ThemeApplier theme={theme} />
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
