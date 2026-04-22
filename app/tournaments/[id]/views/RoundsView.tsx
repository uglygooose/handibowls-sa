// app/tournaments/[id]/views/RoundsView.tsx
"use client";

import ScoreInput from "../../../components/ScoreInput";
import { theme } from "@/lib/theme";
import { matchStatusLabel } from "@/lib/tournaments/labels";
import { bool, isMatchBye, winnerTeamIdFromMatch } from "@/lib/tournaments/match";
import type { Labelers, MatchRow, TournamentRow } from "../page";

export type RoundsViewProps = {
  tournament: TournamentRow | null;
  matches: MatchRow[];
  matchesByRound: { round: number; matches: MatchRow[] }[];
  busy: boolean;

  fixturesOpen: boolean;
  setFixturesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openRounds: Record<number, boolean>;
  toggleRound: (round: number) => void;

  scoreDraftByMatchId: Record<string, { a: string; b: string }>;
  setScoreDraftByMatchId: React.Dispatch<
    React.SetStateAction<Record<string, { a: string; b: string }>>
  >;

  sideForCaptain: (m: MatchRow) => "A" | "B" | null;
  canSubmitScore: (m: MatchRow) => boolean;
  canConfirmScore: (m: MatchRow) => boolean;

  submitScore: (matchId: string) => Promise<void>;
  confirmScore: (matchId: string) => Promise<void>;

  labelers: Labelers;
};

export default function RoundsView(props: RoundsViewProps) {
  const {
    tournament,
    matches,
    matchesByRound,
    busy,
    fixturesOpen,
    setFixturesOpen,
    openRounds,
    toggleRound,
    scoreDraftByMatchId,
    setScoreDraftByMatchId,
    sideForCaptain,
    canSubmitScore,
    canConfirmScore,
    submitScore,
    confirmScore,
    labelers,
  } = props;
  const {
    slotLabel,
    slotMembersLine,
    singlesHandicapLine,
    roundLabel,
    isHandicapTournament,
  } = labelers;

  return (
    <div
      style={{
        marginTop: 14,
        background: "#fff",
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setFixturesOpen((v) => !v)}
        style={{
          width: "100%",
          border: "none",
          background: "#fff",
          color: theme.text,
          padding: "12px 14px",
          fontWeight: 900,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
        title="Toggle fixtures"
      >
        <span style={{ fontSize: 16 }}>All rounds</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: theme.muted, whiteSpace: "nowrap" }}>
          {matches.length ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}` : "No fixtures"}{" "}
          <span style={{ marginLeft: 8 }}>{fixturesOpen ? "▾" : "▸"}</span>
        </span>
      </button>

      {fixturesOpen ? (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14 }}>
          <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.35 }}>
            Matches follow a knockout bracket. Home/away has no special meaning.
          </div>

          <div style={{ marginTop: 10 }}>
            {!matches.length ? (
              <div style={{ color: theme.muted, fontSize: 13 }}>No fixtures yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {matchesByRound.map(({ round, matches: ms }) => {
                  const open = !!openRounds[round];

                  return (
                    <div
                      key={`round-${round}`}
                      style={{
                        border: `1px solid ${theme.border}`,
                        borderRadius: 16,
                        background: "#fff",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRound(round)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "#F3F8F3",
                          padding: "10px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                        title={`Toggle ${roundLabel(round)}`}
                      >
                        <div style={{ fontWeight: 900 }}>{roundLabel(round)}</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                          {ms.length} {ms.length === 1 ? "match" : "matches"}{" "}
                          <span style={{ marginLeft: 8 }}>{open ? "▾" : "▸"}</span>
                        </div>
                      </button>

                      {open ? (
                        <div style={{ display: "grid", borderTop: `1px solid ${theme.border}` }}>
                          {ms.map((m, idx) => {
                            const mySide = sideForCaptain(m);
                            const showSubmit = canSubmitScore(m);
                            const showConfirm = canConfirmScore(m);

                            const confirmedA = bool(m.confirmed_by_a);
                            const confirmedB = bool(m.confirmed_by_b);

                            const scoreLine =
                              m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;

                            const isFinal = bool(m.finalized_by_admin);
                            const winnerId = winnerTeamIdFromMatch(m);
                            const winA = winnerId && m.team_a_id === winnerId;
                            const winB = winnerId && m.team_b_id === winnerId;

                            const draft = scoreDraftByMatchId[m.id] ?? { a: "", b: "" };

                            return (
                              <div
                                key={m.id}
                                style={{
                                  padding: "10px 12px",
                                  borderBottom: idx === ms.length - 1 ? "none" : `1px dashed ${theme.border}`,
                                  background: "#fff",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 900, fontSize: 14 }}>
                                      <span style={{ color: winA ? "#0F7A3D" : theme.text }}>{slotLabel(m, "A")}</span>{" "}
                                      <span style={{ color: theme.muted, fontWeight: 900 }}>vs</span>{" "}
                                      <span style={{ color: winB ? "#0F7A3D" : theme.text }}>{slotLabel(m, "B")}</span>
                                    </div>
                                    {tournament?.format === "SINGLES" ? null : (
                                      <div
                                        style={{
                                          marginTop: 2,
                                          fontSize: 12,
                                          color: theme.muted,
                                          fontWeight: 800,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                        title={`${slotMembersLine(m, "A")} * ${slotMembersLine(m, "B")}`}
                                      >
                                        {slotMembersLine(m, "A")} * {slotMembersLine(m, "B")}
                                      </div>
                                    )}
                                    {tournament?.format === "SINGLES" && !isMatchBye(m) && isHandicapTournament() ? (
                                      <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
                                        {singlesHandicapLine(m)}
                                      </div>
                                    ) : null}
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
                                      whiteSpace: "nowrap",
                                    }}
                                    title="Match status"
                                  >
                                    {matchStatusLabel(m.status)}
                                  </div>
                                </div>

                                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                  <div
                                    style={{
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: 999,
                                      padding: "5px 10px",
                                      fontSize: 12,
                                      fontWeight: 900,
                                      background: "#fff",
                                      color: theme.text,
                                      whiteSpace: "nowrap",
                                    }}
                                    title="Score"
                                  >
                                    Score: {scoreLine}
                                  </div>

                                  <div
                                    style={{
                                      border: `1px solid ${theme.border}`,
                                      borderRadius: 999,
                                      padding: "5px 10px",
                                      fontSize: 12,
                                      fontWeight: 900,
                                      background: "#fff",
                                      color: theme.muted,
                                      whiteSpace: "nowrap",
                                    }}
                                    title="Confirmations"
                                  >
                                    Conf: A {confirmedA ? "✓" : "-"} * B {confirmedB ? "✓" : "-"}
                                    {isFinal ? <span style={{ marginLeft: 8, color: theme.danger }}>Admin final</span> : null}
                                  </div>

                                  {mySide ? (
                                    <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                                      You are captain ({mySide})
                                    </div>
                                  ) : null}
                                </div>

                                {showSubmit ? (
                                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                                      Enter score (captain only)
                                    </div>

                                    <ScoreInput
                                      valueA={draft.a}
                                      valueB={draft.b}
                                      onChangeA={(next) =>
                                        setScoreDraftByMatchId((p) => ({ ...p, [m.id]: { ...draft, a: next } }))
                                      }
                                      onChangeB={(next) =>
                                        setScoreDraftByMatchId((p) => ({ ...p, [m.id]: { ...draft, b: next } }))
                                      }
                                      disabled={busy}
                                      separatorWidth={40}
                                    />

                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => submitScore(m.id)}
                                      style={{
                                        width: "100%",
                                        border: "none",
                                        background: theme.maroon,
                                        color: "#fff",
                                        padding: "10px 12px",
                                        borderRadius: 12,
                                        fontWeight: 900,
                                        cursor: busy ? "not-allowed" : "pointer",
                                      }}
                                      title="Submit score"
                                    >
                                      {busy ? "Working..." : "Submit score"}
                                    </button>
                                  </div>
                                ) : null}

                                {showConfirm ? (
                                  <div style={{ marginTop: 10 }}>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => confirmScore(m.id)}
                                      style={{
                                        width: "100%",
                                        border: `1px solid ${theme.border}`,
                                        background: "#fff",
                                        color: theme.text,
                                        padding: "10px 12px",
                                        borderRadius: 12,
                                        fontWeight: 900,
                                        cursor: busy ? "not-allowed" : "pointer",
                                      }}
                                      title="Confirm submitted score"
                                    >
                                      {busy ? "Working..." : "Confirm score"}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
