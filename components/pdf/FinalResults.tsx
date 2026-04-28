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

// FinalResults PDF — winner announcement + per-round path-to-victory.

export type FinalResultsRow = {
  placement: string;
  teamName: string;
  seed: number | null;
  notes?: string | null;
};

export type FinalResultsProps = {
  themePreset: ThemePreset;
  clubName: string;
  tournamentName: string;
  formatLabel: string;
  structureLabel: string;
  dateRange: string;
  championName: string | null;
  championSeed: number | null;
  runnerUpName: string | null;
  runnerUpSeed: number | null;
  /** Optional placements beyond winner / runner-up (semis, etc). */
  podium: FinalResultsRow[];
  /** Final-round score for the trophy line. */
  finalScore: { home: number; away: number } | null;
};

const styles = StyleSheet.create({
  championBlock: {
    marginTop: 18,
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#0A0A0A",
    borderRadius: 6,
    alignItems: "center",
  },
  trophyEyebrow: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 6,
  },
  championName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  championMeta: {
    fontSize: 11,
    color: "#444",
  },
  finalScore: {
    marginTop: 14,
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    letterSpacing: -0.2,
  },
  runnerUpRow: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  runnerUpName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
  },
  podiumTable: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A",
  },
  podiumThead: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#0A0A0A",
  },
  podiumRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  td: { fontSize: 10 },
  colPlacement: { width: 90 },
  colTeam: { flex: 1 },
  colSeed: { width: 50, textAlign: "right" },
  colNotes: { width: 140, textAlign: "right" },
});

export function FinalResults(props: FinalResultsProps) {
  const headerMeta = `${props.structureLabel.toUpperCase()} · ${props.formatLabel.toUpperCase()} · ${props.dateRange.toUpperCase()}`;
  const champion = props.championName ?? "Pending — tournament not yet complete";

  return (
    <Document title={`${props.tournamentName} — Final results`}>
      <Page size={A4.size} style={baseStyles.page}>
        <PdfHeaderStripe
          title={`${props.tournamentName} — Final results`}
          meta={headerMeta}
          themePreset={props.themePreset}
        />

        <View style={baseStyles.body}>
          <View style={styles.championBlock}>
            <Text style={styles.trophyEyebrow}>Champion</Text>
            <Text style={styles.championName}>{champion}</Text>
            <Text style={styles.championMeta}>
              {props.championSeed != null ? `Seed ${props.championSeed} · ` : ""}
              {props.clubName}
            </Text>
            {props.finalScore && (
              <Text style={styles.finalScore}>
                Final {props.finalScore.home} – {props.finalScore.away}
              </Text>
            )}
            {props.runnerUpName && (
              <View style={styles.runnerUpRow}>
                <View>
                  <Text style={styles.trophyEyebrow}>Runner-up</Text>
                  <Text style={styles.runnerUpName}>{props.runnerUpName}</Text>
                </View>
                <View>
                  <Text style={styles.trophyEyebrow}>Seed</Text>
                  <Text style={styles.runnerUpName}>
                    {props.runnerUpSeed ?? "—"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {props.podium.length > 0 && (
            <View style={styles.podiumTable}>
              <View style={styles.podiumThead}>
                <Text style={[styles.th, styles.colPlacement]}>Placement</Text>
                <Text style={[styles.th, styles.colTeam]}>Team / Skip</Text>
                <Text style={[styles.th, styles.colSeed]}>Seed</Text>
                <Text style={[styles.th, styles.colNotes]}>Notes</Text>
              </View>
              {props.podium.map((row, i) => (
                <View key={`${row.placement}-${i}`} style={styles.podiumRow}>
                  <Text
                    style={[
                      styles.td,
                      styles.colPlacement,
                      { fontFamily: "Helvetica-Bold" },
                    ]}
                  >
                    {row.placement}
                  </Text>
                  <Text style={[styles.td, styles.colTeam]}>{row.teamName}</Text>
                  <Text style={[styles.td, styles.colSeed]}>
                    {row.seed ?? "—"}
                  </Text>
                  <Text style={[styles.td, styles.colNotes]}>
                    {row.notes ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <PdfFooter footerLeft={`HANDIBOWLS · ${props.clubName.toUpperCase()}`} />
      </Page>
    </Document>
  );
}
