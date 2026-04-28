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

// Round-scoresheet PDF — per-round 6-column table.
// Columns: M# / RINK / HOME (SKIP) / SCORE / AWAY (SKIP) / STATUS

export type RoundScoresheetMatch = {
  match_no: number;
  rink: string | null;
  homeName: string;
  homeScore: number | null;
  awayName: string;
  awayScore: number | null;
  status: string;
  isFinal: boolean;
};

export type RoundScoresheetProps = {
  themePreset: ThemePreset;
  clubName: string;
  tournamentName: string;
  formatLabel: string;
  structureLabel: string;
  dateRange: string;
  rounds: { round: number; label: string; matches: RoundScoresheetMatch[] }[];
};

const styles = StyleSheet.create({
  roundBlock: { marginBottom: 22 },
  roundHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  roundLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    fontStyle: "italic",
    letterSpacing: -0.2,
  },
  matchCount: {
    fontSize: 9,
    letterSpacing: 0.6,
    color: "#666",
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A",
  },
  thead: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#0A0A0A",
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  td: { fontSize: 9.5 },
  colMatch: { width: 36 },
  colRink: { width: 42 },
  colHome: { flex: 1, paddingRight: 6 },
  colScore: { width: 60, textAlign: "center", fontFamily: "Helvetica-Bold" },
  colAway: { flex: 1, paddingLeft: 6 },
  colStatus: { width: 50, textAlign: "right" },
});

export function RoundScoresheet(props: RoundScoresheetProps) {
  const headerMeta = `${props.structureLabel.toUpperCase()} · ${props.formatLabel.toUpperCase()} · ${props.dateRange.toUpperCase()}`;

  return (
    <Document title={`${props.tournamentName} — Scoresheet`}>
      <Page size={A4.size} style={baseStyles.page} wrap>
        <PdfHeaderStripe
          title={`${props.tournamentName} — Scoresheet`}
          meta={headerMeta}
          themePreset={props.themePreset}
        />

        <View style={baseStyles.body}>
          {props.rounds.map((r) => (
            <View
              key={r.round}
              style={styles.roundBlock}
              wrap={false}
              minPresenceAhead={80}
            >
              <View style={styles.roundHead}>
                <Text style={styles.roundLabel}>{r.label}</Text>
                <Text style={styles.matchCount}>
                  {r.matches.length}{" "}
                  {r.matches.length === 1 ? "match" : "matches"}
                </Text>
              </View>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.th, styles.colMatch]}>M#</Text>
                  <Text style={[styles.th, styles.colRink]}>RINK</Text>
                  <Text style={[styles.th, styles.colHome]}>HOME (SKIP)</Text>
                  <Text style={[styles.th, styles.colScore]}>SCORE</Text>
                  <Text style={[styles.th, styles.colAway]}>AWAY (SKIP)</Text>
                  <Text style={[styles.th, styles.colStatus]}>STATUS</Text>
                </View>
                {r.matches.map((m) => (
                  <View key={m.match_no} style={styles.row}>
                    <Text
                      style={[
                        styles.td,
                        styles.colMatch,
                        { fontFamily: "Helvetica-Bold" },
                      ]}
                    >
                      M{String(m.match_no).padStart(2, "0")}
                    </Text>
                    <Text style={[styles.td, styles.colRink]}>
                      {m.rink ?? "—"}
                    </Text>
                    <Text style={[styles.td, styles.colHome]}>
                      {m.homeName}
                    </Text>
                    <Text style={[styles.td, styles.colScore]}>
                      {m.homeScore ?? "—"} : {m.awayScore ?? "—"}
                    </Text>
                    <Text style={[styles.td, styles.colAway]}>
                      {m.awayName}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        styles.colStatus,
                        m.isFinal ? { fontFamily: "Helvetica-Bold" } : {},
                      ]}
                    >
                      {m.status}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <PdfFooter footerLeft={`HANDIBOWLS · ${props.clubName.toUpperCase()}`} />
      </Page>
    </Document>
  );
}
