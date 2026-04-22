import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HandiBowls",
  description: "HandiBowls — tournaments, scores, and skills in your pocket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
