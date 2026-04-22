// app/tournaments/[id]/views/SummaryView.tsx
"use client";

import { theme } from "@/lib/theme";
import { formatLabel, matchStatusLabel, ruleLabel, statusLabel, type TournamentStatus } from "@/lib/tournaments/labels";
import { isMatchBye } from "@/lib/tournaments/match";
import type { FinishSummary } from "../utils/matchHelpers";
import type { Labelers, MatchRow, TeamRow, TournamentRow } from "../page";

export type SummaryViewProps = {
  tournament: TournamentRow | null;
  myTeam: TeamRow | null;
  nextMatch: MatchRow | null;
  isViewerMode: boolean;
  effectiveStatus: TournamentStatus | null;
  winnerName: string | null;
  finish: FinishSummary | null;
  labelers: Labelers;
};

export default function SummaryView(props: SummaryViewProps) {
  const {
    tournament,
    myTeam,
    nextMatch,
    isViewerMode,
    effectiveStatus,
    winnerName,
    finish,
    labelers,
  } = props;
  const {
    slotLabel,
    slotMembersLine,
    singlesHandicapLine,
    roundLabel,
    isHandicapTournament,
  } = labelers;

  if (!isViewerMode) {
    return (
      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Your next match</div>
        <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
          Knockout bracket - winners advance.
        </div>

        <div style={{ marginTop: 10 }}>
          {!nextMatch ? (
            <div style={{ color: theme.muted, fontSize: 13 }}>
              {myTeam ? "No upcoming match found yet." : "Join the tournament to see your next match."}
            </div>
          ) : (
            (() => {
              const isBye = isMatchBye(nextMatch);
              const scoreLine =
                nextMatch.score_a == null || nextMatch.score_b == null
                  ? "-"
                  : `${nextMatch.score_a} - ${nextMatch.score_b}`;

              return (
                <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>
                    {isBye
                      ? `${slotLabel(nextMatch, "A")} - Auto-advance (BYE)`
                      : `${slotLabel(nextMatch, "A")} vs ${slotLabel(nextMatch, "B")}`}
                  </div>
                  {tournament?.format !== "SINGLES" && !isBye ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                      {slotMembersLine(nextMatch, "A")} * {slotMembersLine(nextMatch, "B")}
                    </div>
                  ) : null}
                  {tournament?.format === "SINGLES" && !isBye && isHandicapTournament() ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                      {singlesHandicapLine(nextMatch)}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 900,
                        background: "#fff",
                        color: theme.text,
                      }}
                    >
                      {roundLabel(nextMatch.round_no)}
                    </div>
                    <div
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 900,
                        background: "#fff",
                        color: theme.text,
                      }}
                    >
                      Score: {scoreLine}
                    </div>
                    <div
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 900,
                        background: "#fff",
                        color: theme.text,
                      }}
                    >
                      {matchStatusLabel(nextMatch.status)}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        background: "#fff",
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>Tournament summary</div>
      <div style={{ marginTop: 6, fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
        {myTeam ? "You are viewing as a past participant." : "You are viewing as a spectator."}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13, color: theme.muted }}>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Type</span>{" "}
          {formatLabel(tournament?.format ?? "SINGLES")} knockout
        </div>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Rule</span>{" "}
          {tournament ? ruleLabel(tournament.rule_type ?? "HANDICAP_START") : "-"}
        </div>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Status</span>{" "}
          {effectiveStatus ? statusLabel(effectiveStatus) : "-"}
        </div>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Starts</span>{" "}
          {tournament?.starts_at ? new Date(tournament.starts_at).toLocaleString() : "TBC"}
        </div>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Ends</span>{" "}
          {tournament?.ends_at ? new Date(tournament.ends_at).toLocaleString() : "TBC"}
        </div>
      </div>

      {winnerName && effectiveStatus === "COMPLETED" ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <span style={{ fontWeight: 900 }}>Winner:</span> {winnerName}
        </div>
      ) : null}

      {finish ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 900 }}>{finish.label}</div>
          {finish.detail ? <div style={{ color: theme.muted }}>{finish.detail}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
