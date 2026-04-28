// components/brackets/BracketTree.tsx
//
// Knockout bracket viewer — tree + list views. Markup ported from the
// pre-rebuild app/tournaments/[id]/views/BracketView.tsx (Phase 6a).
// Logic preserved per §18 line 1030; the visual restyle to Phase 1
// tokens + speckle accent lands in Phase 6e — for now the deleted
// `theme.*` references are replaced with the literal RGB values they
// resolved to so the component compiles + renders in isolation.
//
// Geometry (computeTreeLayout, computeBracketLines) is imported from
// the relocated `lib/tournaments/brackets/matchHelpers.ts`.

"use client";

import { matchStatusLabel } from "@/lib/tournaments/labels";
import { isMatchBye, isMatchDone, winnerTeamIdFromMatch } from "@/lib/tournaments/match";
import {
  computeBracketLines,
  computeTreeLayout,
} from "@/lib/tournaments/brackets/matchHelpers";

// Phase-6a placeholder palette — bytewise equivalents of the deleted
// `theme.*` constants. Replaced with var(--color-*) tokens in 6e.
const TONE = {
  border: "#E5E7EB",
  muted: "#6B7280",
  text: "#111827",
  maroon: "#7A1F2B",
  feeder: "#CBBBA3",
  winnerGreen: "#16A34A",
  winnerGreenDeep: "#0F7A3D",
  surface: "#fff",
  selectedTint: "rgba(122,31,43,0.05)",
} as const;

// -------------------- structural types --------------------
//
// The pre-rebuild parent page exposed MatchRow / TeamRow / TournamentRow
// types that this component imported. With the parent gone, we redeclare
// them locally as the structural minimum the markup reads. Server-action
// callers in 6d will hand in DB rows that satisfy these via adapters
// (Phase 6b).

export type BracketTreeMatchRow = {
  id: string;
  round_no: number | null;
  match_no?: number | null;
  status?: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id?: string | null;
  finalized_by_admin?: boolean | null;
  score_a?: number | string | null;
  score_b?: number | string | null;
  slot_a_source_type?: string | null;
  slot_a_source_match_id?: string | null;
  slot_b_source_type?: string | null;
  slot_b_source_match_id?: string | null;
};

export type BracketTreeTeamRow = {
  id: string;
};

export type BracketTreeTournamentRow = {
  id: string;
  format: string | null;
};

export type BracketTreeLabelers = {
  slotLabel: (m: BracketTreeMatchRow, side: "A" | "B") => string;
  slotMembersLine: (m: BracketTreeMatchRow, side: "A" | "B") => string;
  singlesHandicapLine: (m: BracketTreeMatchRow) => string | null;
  roundLabel: (round: number) => string;
  isHandicapTournament: () => boolean;
};

export type BracketTreeProps = {
  tournament: BracketTreeTournamentRow | null;
  matches: BracketTreeMatchRow[];
  matchesByRound: { round: number; matches: BracketTreeMatchRow[] }[];
  matchesForUi: BracketTreeMatchRow[];
  myTeam: BracketTreeTeamRow | null;
  isViewerMode: boolean;
  bracketViewMode: "TREE" | "LIST";
  setBracketViewMode: (m: "TREE" | "LIST") => void;
  bracketRound: number | null;
  setBracketRound: (r: number) => void;
  treeFromRound: number | null;
  setTreeFromRound: (r: number) => void;
  labelers: BracketTreeLabelers;
};

export default function BracketTree(props: BracketTreeProps) {
  const {
    tournament,
    matches,
    matchesByRound,
    matchesForUi,
    myTeam,
    isViewerMode,
    bracketViewMode,
    setBracketViewMode,
    bracketRound,
    setBracketRound,
    treeFromRound,
    setTreeFromRound,
    labelers,
  } = props;
  const {
    slotLabel,
    slotMembersLine,
    singlesHandicapLine,
    roundLabel,
    isHandicapTournament,
  } = labelers;

  function renderTreeView() {
    if (!matchesByRound.length) {
      return (
        <div style={{ marginTop: 12, background: TONE.surface, border: `1px solid ${TONE.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: TONE.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const roundMeta = (() => {
      const byRound: Record<number, { total: number; completed: number }> = {};
      for (const m of matchesForUi) {
        const rn = Number(m.round_no ?? 0);
        if (!rn) continue;
        byRound[rn] = byRound[rn] ?? { total: 0, completed: 0 };
        byRound[rn].total += 1;
        if (isMatchDone(m)) byRound[rn].completed += 1;
      }

      const rounds = Object.keys(byRound)
        .map((n) => Number(n))
        .filter((n) => n && !Number.isNaN(n))
        .sort((a, b) => a - b);

      const selectedRound = treeFromRound ?? (rounds[rounds.length - 1] ?? null);
      return { byRound, rounds, selectedRound };
    })();

    if (!roundMeta.rounds.length) {
      return (
        <div style={{ marginTop: 12, background: TONE.surface, border: `1px solid ${TONE.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: TONE.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const roundsToShow = roundMeta.selectedRound
      ? matchesByRound.filter((r) => r.round >= roundMeta.selectedRound!)
      : matchesByRound;
    const roundsDisplay = roundsToShow.filter((r) => roundLabel(r.round) !== "Pre-Rd");
    if (!roundsDisplay.length) {
      return (
        <div style={{ marginTop: 12, background: TONE.surface, border: `1px solid ${TONE.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: TONE.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const preRound = matchesByRound.find((r) => roundLabel(r.round) === "Pre-Rd");
    const selectedRound = roundMeta.selectedRound ?? roundsDisplay[0]?.round ?? null;
    const selectedLabel = selectedRound ? roundLabel(selectedRound) : null;
    const selectedIsPre = selectedLabel === "Pre-Rd";
    const displayRounds = matchesByRound.filter((r) => roundLabel(r.round) !== "Pre-Rd");
    const selectedIndex = selectedIsPre
      ? -1
      : selectedRound
        ? displayRounds.findIndex((r) => r.round === selectedRound)
        : -1;
    const nextRound = selectedIsPre
      ? (displayRounds[0] ?? null)
      : selectedIndex >= 0 && selectedIndex < displayRounds.length - 1
        ? displayRounds[selectedIndex + 1]
        : null;

    const feederSourceIds = new Set<string>();
    const collectFeederIds = (roundMatches: BracketTreeMatchRow[] | undefined) => {
      (roundMatches ?? []).forEach((m) => {
        if (m.slot_a_source_match_id) feederSourceIds.add(String(m.slot_a_source_match_id));
        if (m.slot_b_source_match_id) feederSourceIds.add(String(m.slot_b_source_match_id));
      });
    };
    if (nextRound) {
      collectFeederIds(nextRound.matches);
    }

    const roundsForTree = (() => {
      const selectedMatchesRaw = selectedIsPre
        ? (preRound?.matches ?? [])
        : selectedRound
          ? (displayRounds.find((r) => r.round === selectedRound)?.matches ?? [])
          : [];
      const nextMatches = nextRound?.matches ?? [];
      const filteredNextMatches = feederSourceIds.size
        ? nextMatches.filter(
            (m) =>
              (m.slot_a_source_match_id && feederSourceIds.has(String(m.slot_a_source_match_id))) ||
              (m.slot_b_source_match_id && feederSourceIds.has(String(m.slot_b_source_match_id))),
          )
        : nextMatches;
      const selectedMatches = feederSourceIds.size
        ? selectedMatchesRaw.filter((m) => feederSourceIds.has(String(m.id)))
        : selectedMatchesRaw;

      if (selectedRound && nextRound) {
        return [
          { round: selectedRound, matches: selectedMatches },
          { round: nextRound.round, matches: filteredNextMatches },
        ];
      }

      return selectedRound ? [{ round: selectedRound, matches: selectedMatches }] : roundsDisplay;
    })();

    const fromLabelRaw = roundMeta.selectedRound ? roundLabel(roundMeta.selectedRound) : null;
    const fromLabel =
      fromLabelRaw === "Pre-Rd" && roundsForTree.length ? roundLabel(roundsForTree[0].round) : fromLabelRaw;

    const cardW = 230;
    const cardH = 44;
    const baseGap = 18;
    const colGap = 110;
    const headerOffset = 28;

    const layout = computeTreeLayout<BracketTreeMatchRow>(roundsForTree, {
      cardW,
      cardH,
      baseGap,
      colGap,
      headerOffset,
    });
    const { roundLayouts, posById, roundPositions, width, height } = layout;
    const positionsByRoundIndex = new Map(
      roundPositions.map((r) => [r.roundIndex, r.matches]),
    );
    const lines = computeBracketLines(roundLayouts, posById, positionsByRoundIndex, cardW);

    return (
      <div style={{ marginTop: 12, background: TONE.surface, border: `1px solid ${TONE.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${TONE.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: TONE.muted, marginBottom: 6 }}>Show rounds from</div>
          <div style={{ marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {roundMeta.rounds.map((r) => {
              const p = roundMeta.byRound[r];
              const done = p?.completed ?? 0;
              const total = p?.total ?? 0;
              const active = (roundMeta.selectedRound ?? roundMeta.rounds[0]) === r;

              return (
                <button
                  key={`tree-from-${r}`}
                  type="button"
                  onClick={() => setTreeFromRound(r)}
                  style={{
                    border: `1px solid ${TONE.border}`,
                    background: active ? TONE.maroon : TONE.surface,
                    color: active ? "#fff" : TONE.text,
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  title={`${done}/${total} complete`}
                >
                  <span>{roundLabel(r)}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, opacity: active ? 0.95 : 0.8, whiteSpace: "nowrap" }}>
                    {done}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            Bracket view{fromLabel ? ` • from ${fromLabel}` : ""}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: TONE.muted }}>
            {roundsForTree.reduce((acc, r) => acc + (r.matches?.length ?? 0), 0)} matches
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${TONE.border}`, padding: 14, overflowX: "auto" }}>
          <div style={{ position: "relative", width, height }}>
            <svg
              width={width}
              height={height}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {lines.map((d, idx) => (
                <path key={`path-${idx}`} d={d} stroke={TONE.feeder} strokeWidth={2.5} strokeLinecap="round" fill="none" />
              ))}
            </svg>

            {roundLayouts.map((rl) => {
              const meta = roundMeta.byRound[rl.round.round];
              const total = meta?.total ?? rl.list.length;
              const completed = meta?.completed ?? 0;
              const focused = roundMeta.selectedRound ? rl.round.round === roundMeta.selectedRound : true;
              const colX = rl.roundIndex * (cardW + colGap);
              const positioned = roundPositions.find((r) => r.roundIndex === rl.roundIndex)?.matches ?? [];
              const matchPos = new Map(positioned.map((p) => [p.id, p]));

              return (
                <div
                  key={`tree-round-${rl.round.round}`}
                  style={{
                    position: "absolute",
                    left: colX,
                    top: 0,
                    width: cardW,
                    opacity: focused ? 1 : 0.8,
                    transition: "opacity 160ms ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontWeight: 900,
                      fontSize: 14,
                      color: TONE.text,
                      paddingBottom: 6,
                    }}
                  >
                    <div>{roundLabel(rl.round.round)}</div>
                    <div style={{ fontSize: 11, color: TONE.muted, fontWeight: 900 }}>{completed}/{total}</div>
                  </div>

                  {rl.list.map((m) => {
                    const pos = matchPos.get(m.id);
                    const y = pos ? pos.top : headerOffset;
                    const left = slotLabel(m, "A");
                    const right = slotLabel(m, "B");
                    const winnerId = winnerTeamIdFromMatch(m);
                    const winA = winnerId && m.team_a_id && String(m.team_a_id) === winnerId;
                    const winB = winnerId && m.team_b_id && String(m.team_b_id) === winnerId;

                    return (
                      <div
                        key={`tree-match-${m.id}`}
                        style={{
                          position: "absolute",
                          top: y,
                          left: 0,
                          width: cardW,
                          border: `1px solid ${TONE.border}`,
                          borderRadius: 10,
                          background: TONE.surface,
                          padding: "6px 10px",
                          display: "grid",
                          alignContent: "center",
                          gap: 2,
                          fontSize: 12,
                          fontWeight: 900,
                          overflow: "hidden",
                          zIndex: 2,
                        }}
                      >
                        <div
                          style={{
                            color: winA ? TONE.winnerGreen : left === "TBD" ? TONE.muted : TONE.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {left}
                        </div>
                        <div
                          style={{
                            color: winB ? TONE.winnerGreen : right === "TBD" ? TONE.muted : TONE.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {right}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        background: TONE.surface,
        border: `1px solid ${TONE.border}`,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket</div>
      <div style={{ marginTop: 6, fontSize: 13, color: TONE.muted, lineHeight: 1.35 }}>
        Follow the knockout path. Winners advance to the next round.
      </div>
      {isViewerMode ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setBracketViewMode(bracketViewMode === "TREE" ? "LIST" : "TREE")}
            style={{
              border: `1px solid ${TONE.border}`,
              background: TONE.surface,
              color: TONE.text,
              padding: "8px 10px",
              borderRadius: 999,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {bracketViewMode === "TREE" ? "View brackets" : "View tree"}
          </button>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        {isViewerMode && bracketViewMode === "TREE" ? (
          renderTreeView()
        ) : !matches.length ? (
          <div style={{ color: TONE.muted, fontSize: 13 }}>No fixtures yet.</div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {matchesByRound.map(({ round }) => {
                const active = round === bracketRound;
                return (
                  <button
                    key={`bracket-tab-${round}`}
                    type="button"
                    onClick={() => setBracketRound(round)}
                    style={{
                      border: `1px solid ${TONE.border}`,
                      background: active ? TONE.maroon : TONE.surface,
                      color: active ? "#fff" : TONE.text,
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {roundLabel(round)}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {(matchesByRound.find((r) => r.round === bracketRound)?.matches ?? []).map((m) => {
                const isBye = isMatchBye(m);
                const scoreLine = m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;
                const isMine = myTeam && (m.team_a_id === myTeam.id || m.team_b_id === myTeam.id);
                const winnerId = winnerTeamIdFromMatch(m);
                const winA = winnerId && m.team_a_id === winnerId;
                const winB = winnerId && m.team_b_id === winnerId;
                const cardBorder = isMine ? TONE.maroon : TONE.border;
                const cardBg = isMine ? TONE.selectedTint : TONE.surface;

                return (
                  <div
                    key={`bracket-match-${m.id}`}
                    style={{
                      border: `1px solid ${cardBorder}`,
                      borderRadius: 14,
                      padding: 10,
                      background: cardBg,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 14, minWidth: 0 }}>
                      {isBye ? (
                        `${slotLabel(m, "A")} - Auto-advance (BYE)`
                      ) : (
                        <>
                          <span style={{ color: winA ? TONE.winnerGreenDeep : TONE.text }}>{slotLabel(m, "A")}</span>{" "}
                          <span style={{ color: TONE.muted, fontWeight: 900 }}>vs</span>{" "}
                          <span style={{ color: winB ? TONE.winnerGreenDeep : TONE.text }}>{slotLabel(m, "B")}</span>
                        </>
                      )}
                    </div>
                    {tournament?.format !== "SINGLES" && !isBye ? (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: TONE.muted,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {slotMembersLine(m, "A")} * {slotMembersLine(m, "B")}
                      </div>
                    ) : null}
                    {tournament?.format === "SINGLES" && !isBye && isHandicapTournament() ? (
                      <div style={{ marginTop: 4, fontSize: 12, color: TONE.muted, fontWeight: 800 }}>
                        {singlesHandicapLine(m)}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <div
                        style={{
                          border: `1px solid ${TONE.border}`,
                          borderRadius: 999,
                          padding: "3px 8px",
                          fontSize: 11,
                          fontWeight: 900,
                          background: TONE.surface,
                          color: TONE.text,
                        }}
                      >
                        {matchStatusLabel(m.status)}
                      </div>
                      <div
                        style={{
                          border: `1px solid ${TONE.border}`,
                          borderRadius: 999,
                          padding: "3px 8px",
                          fontSize: 11,
                          fontWeight: 900,
                          background: TONE.surface,
                          color: TONE.text,
                        }}
                      >
                        {scoreLine}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
