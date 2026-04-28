"use client";

import {
  A4,
  Document,
  Page,
  PdfFooter,
  PdfHeaderStripe,
  StyleSheet,
  Text,
  View,
  baseStyles,
} from "./_chrome";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

// DrawSheet PDF — cover info grid + 4-column bracket per the design source.
// Shipped as <Document> so callers can hand straight to pdf() / PDFDownloadLink.

export type DrawSheetMatch = {
  match_no: number;
  round: number;
  rink: string | null;
  homeName: string;
  homeScore: number | null;
  homeIsWinner: boolean;
  awayName: string;
  awayScore: number | null;
  awayIsWinner: boolean;
};

export type DrawSheetProps = {
  themePreset: ThemePreset;
  clubName: string;
  tournamentName: string;
  formatLabel: string;
  structureLabel: string;
  scopeLabel: string;
  dateRange: string;
  entryCount: number;
  seedingMethod: string;
  handicapRule: string;
  rounds: { round: number; label: string; matches: DrawSheetMatch[] }[];
};

const styles = StyleSheet.create({
  notesBox: {
    marginTop: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.4,
  },
  bracketRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  roundCol: {
    flex: 1,
    minWidth: 110,
  },
  roundLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 6,
  },
  matchCell: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
  },
  matchHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#888",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    paddingVertical: 1,
  },
  slotName: { flex: 1, paddingRight: 4 },
  slotScore: { fontFamily: "Helvetica-Bold", textAlign: "right", minWidth: 18 },
});

export function DrawSheet(props: DrawSheetProps) {
  const headerMeta = `${props.structureLabel.toUpperCase()} · ${props.formatLabel.toUpperCase()} · ${props.dateRange.toUpperCase()} · ${props.entryCount} ENTRIES`;

  return (
    <Document title={`${props.tournamentName} — Draw sheet`}>
      <Page size={A4.size} style={baseStyles.page}>
        <PdfHeaderStripe
          title={`${props.tournamentName} — Draw sheet`}
          meta={headerMeta}
          themePreset={props.themePreset}
        />

        <View style={baseStyles.body}>
          {/* Cover info grid — 4 columns */}
          <View style={baseStyles.infoGrid}>
            <View style={baseStyles.infoCell}>
              <Text style={baseStyles.infoLabel}>Format</Text>
              <Text style={baseStyles.infoValue}>{props.formatLabel}</Text>
            </View>
            <View style={baseStyles.infoCell}>
              <Text style={baseStyles.infoLabel}>Structure</Text>
              <Text style={baseStyles.infoValue}>{props.structureLabel}</Text>
            </View>
            <View style={baseStyles.infoCell}>
              <Text style={baseStyles.infoLabel}>Seeding</Text>
              <Text style={baseStyles.infoValue}>{props.seedingMethod}</Text>
            </View>
            <View style={baseStyles.infoCell}>
              <Text style={baseStyles.infoLabel}>Handicap</Text>
              <Text style={baseStyles.infoValue}>{props.handicapRule}</Text>
            </View>
          </View>

          {/* Bracket — rounds laid out left-to-right */}
          <View style={styles.bracketRow}>
            {props.rounds.map((r) => (
              <View key={r.round} style={styles.roundCol}>
                <Text style={styles.roundLabel}>{r.label}</Text>
                {r.matches.map((m) => (
                  <View key={m.match_no} style={styles.matchCell}>
                    <View style={styles.matchHead}>
                      <Text>M{String(m.match_no).padStart(2, "0")}</Text>
                      <Text>RINK {m.rink ?? "—"}</Text>
                    </View>
                    <View style={styles.slotRow}>
                      <Text
                        style={[
                          styles.slotName,
                          m.homeIsWinner ? { fontFamily: "Helvetica-Bold" } : {},
                        ]}
                      >
                        {m.homeName}
                      </Text>
                      <Text style={styles.slotScore}>
                        {m.homeScore ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.slotRow}>
                      <Text
                        style={[
                          styles.slotName,
                          m.awayIsWinner ? { fontFamily: "Helvetica-Bold" } : {},
                        ]}
                      >
                        {m.awayName}
                      </Text>
                      <Text style={styles.slotScore}>
                        {m.awayScore ?? "—"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>NOTES.</Text>
            <Text style={styles.notesText}>
              Draw is locked at print time. Score adjustments after this
              sheet is generated should be requested via the tournament
              admin and re-printed when verified.
            </Text>
          </View>
        </View>

        <PdfFooter footerLeft={`HANDIBOWLS · ${props.clubName.toUpperCase()}`} />
      </Page>
    </Document>
  );
}
