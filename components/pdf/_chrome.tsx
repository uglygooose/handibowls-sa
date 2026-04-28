"use client";

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { PRESET_BY_ID } from "@/lib/brand/presets";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

// Shared chrome (header stripe, footer stamp, page wrapper) for all 3
// PDF templates. Per the brief's locked decision: solid theme-primary
// stripe (NOT SVG speckle), solid corner blocks (NOT splatter). The
// decorative SVG patterns from the design source don't render reliably
// across PDF readers; the print variants substitute solid fills.
//
// @react-pdf/renderer renders to PDF, not the DOM, so CSS variables
// don't reach it. Each template resolves the active club's preset to
// a literal hex via `PRESET_BY_ID[preset].base` and threads it into
// the chrome.

// Use system fonts. Custom-font registration via Font.register would
// be next-level polish; system Helvetica is reliable across viewers
// and matches the design's letter spacing closely enough for v1.
Font.register({
  family: "Helvetica",
  src: "Helvetica",
});

export const A4 = { size: "A4" as const };

export const baseStyles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 30,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#0A0A0A",
  },
  headerStripe: {
    height: 68,
    paddingHorizontal: 28,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cornerBlock: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 32,
    height: 68,
    backgroundColor: "#0A0A0A",
    opacity: 0.18,
  },
  headerLeft: { flexDirection: "column" },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerWordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 18,
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#888888",
    letterSpacing: 0.4,
  },
  infoGrid: {
    flexDirection: "row",
    marginTop: 14,
    marginBottom: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  infoCell: { flex: 1, paddingRight: 8 },
  infoLabel: {
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#888888",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 10,
    color: "#0A0A0A",
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontSize: 8,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    color: "#888888",
    marginBottom: 8,
  },
});

export type PdfChromeProps = {
  title: string;
  meta: string;
  themePreset: ThemePreset;
  clubName: string;
  /** Footer-left text — defaults to clubName uppercased. */
  footerLeft?: string;
  /** Optional middle footer (e.g. generation timestamp). */
  footerCenter?: string;
};

export function PdfHeaderStripe({
  title,
  meta,
  themePreset,
}: Pick<PdfChromeProps, "title" | "meta" | "themePreset">) {
  const swatch = PRESET_BY_ID[themePreset];
  const stripeColor = swatch?.base ?? "#0A0A0A";
  const onStripe = swatch?.on ?? "#FFFFFF";

  return (
    <View
      style={[baseStyles.headerStripe, { backgroundColor: stripeColor }]}
      fixed
    >
      <View style={baseStyles.headerLeft}>
        <Text style={[baseStyles.headerTitle, { color: onStripe }]}>
          {title.toUpperCase()}
        </Text>
        <Text style={[baseStyles.headerMeta, { color: onStripe, opacity: 0.85 }]}>
          {meta}
        </Text>
      </View>
      <Text style={[baseStyles.headerWordmark, { color: onStripe }]}>
        HANDIBOWLS
      </Text>
      {/* Solid corner block — replaces the design's SVG splatter for PDF
          safety. Uses ink-on-stripe at 18% so it reads as a tonal accent
          regardless of the underlying preset. */}
      <View style={baseStyles.cornerBlock} fixed />
    </View>
  );
}

export function PdfFooter({
  footerLeft,
  footerCenter,
}: Pick<PdfChromeProps, "footerLeft" | "footerCenter">) {
  return (
    <View style={baseStyles.footer} fixed>
      <Text>{footerLeft ?? "HANDIBOWLS"}</Text>
      <Text>{footerCenter ?? `Generated ${formatStamp()}`}</Text>
      <Text
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function formatStamp(): string {
  // Africa/Johannesburg — same convention as the rest of the app.
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
}

// Re-export the top-level @react-pdf primitives so templates only
// import from this file (single dependency surface for the chrome).
export { Document, Page, StyleSheet, Text, View };
