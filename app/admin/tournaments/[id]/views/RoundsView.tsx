// app/admin/tournaments/[id]/views/RoundsView.tsx
"use client";

import ScoreInput from "../../../../components/ScoreInput";
import SectionCard from "../../../../components/SectionCard";
import StatusPill from "../../../../components/StatusPill";
import { theme } from "@/lib/theme";
import { matchStatusLabel } from "@/lib/tournaments/labels";
import { bool, isMatchBye, isMatchDone, winnerTeamIdFromMatch } from "@/lib/tournaments/match";
import {
  computeTreeLayout,
  computeBracketLines,
  getMatchCardTone,
  treeSlotLabel,
} from "@/lib/tournaments/matchHelpers";
import type {
  Labelers,
  MatchRow,
  RoundMeta,
  ScrollHelpers,
  TournamentRow,
} from "../page";

type MatchStatus = "OPEN" | "FINAL" | "SCHEDULED" | "IN_PLAY" | "COMPLETED" | "BYE";

export type RoundsViewProps = {
  // data
  tournament: TournamentRow | null;
  tournamentId: string | null | undefined;
  matches: MatchRow[];
  matchesByRound: { round: number; matches: MatchRow[] }[];
  busy: boolean;
  maxPlayableRound: number | null;
  roundMeta: RoundMeta;
  roundsViewMode: "LIST" | "TREE";
  treeRoundsDisplay: { round: number; matches: MatchRow[] }[];
  matchNoById: Record<string, number | null>;
  teamMembersByTeamId: Record<string, string[]>;
  handicapByPlayerId: Record<string, number | null>;
  // drafts + UI toggles
  scoreDraftByMatchId: Record<string, { a: string; b: string }>;
  bulkOpen: boolean;
  bulkDraftByMatchId: Record<string, { a: string; b: string }>;
  adminFinalOpenByMatchId: Record<string, boolean>;
  showProblemsOnly: boolean;
  attentionOpen: boolean;
  inPlayOpen: boolean;
  completedOpen: boolean;
  // setters
  setScoreDraftByMatchId: React.Dispatch<React.SetStateAction<Record<string, { a: string; b: string }>>>;
  setBulkOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBulkDraftByMatchId: React.Dispatch<React.SetStateAction<Record<string, { a: string; b: string }>>>;
  setAdminFinalOpenByMatchId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setShowProblemsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setRoundsViewMode: React.Dispatch<React.SetStateAction<"LIST" | "TREE">>;
  setAttentionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setInPlayOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCompletedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  // actions
  selectRound: (r: number) => void;
  startAllInSelectedRound: () => Promise<void>;
  completeAllWithScoresInSelectedRound: () => Promise<void>;
  advanceSelectedRound: () => Promise<void>;
  endTournament: () => Promise<void>;
  adminFinalScore: (matchId: string) => void;
  updateMatchStatus: (matchId: string, status: MatchStatus) => Promise<void>;
  reload: (opts?: { preserveScroll?: boolean }) => Promise<void>;
  // refs + labelers + scroll helpers
  treeRoundRefsSetter: (round: number) => (el: HTMLDivElement | null) => void;
  labelers: Labelers;
  scrollHelpers: ScrollHelpers;
};

function RoundSelector(props: RoundsViewProps) {
  const { roundMeta, selectRound, labelers } = props;
  const { roundLabel } = labelers;

  if (!roundMeta.rounds.length) return null;

  const rounds = roundMeta.rounds;
  if (!rounds.length) return null;

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
      {rounds.map((r) => {
        const p = roundMeta.byRound[r];
        const done = p?.completed ?? 0;
        const total = p?.total ?? 0;
        const active = (roundMeta.selectedRound ?? rounds[rounds.length - 1]) === r;

        return (
          <button
            key={`chip-${r}`}
            type="button"
            onClick={() => selectRound(r)}
            style={{
              border: `1px solid ${theme.border}`,
              background: active ? theme.maroon : "#fff",
              color: active ? "#fff" : theme.text,
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
  );
}

function RoundAdminBar(props: RoundsViewProps) {
  const {
    tournament,
    matches,
    matchesByRound,
    busy,
    maxPlayableRound,
    roundMeta,
    startAllInSelectedRound,
    completeAllWithScoresInSelectedRound,
    advanceSelectedRound,
    endTournament,
    labelers,
  } = props;
  const { roundLabel, teamDisplayName } = labelers;

  const r = roundMeta.selectedRound;
  if (!r) return null;

  const p = roundMeta.byRound[r];
  const total = p?.total ?? 0;
  const done = p?.completed ?? 0;
  const byesPending = p?.byesPending ?? 0;

  const isComplete = roundMeta.roundIsComplete;

  // Guardrails
  const nextRoundNo = r + 1;
  const nextRoundExists = matches.some((m) => Number(m.round_no ?? 0) === nextRoundNo);

  const latestRound = roundMeta.rounds[roundMeta.rounds.length - 1] ?? r;
  const latestActionableRound = maxPlayableRound ?? latestRound;
  const isLatestRound = r === latestActionableRound;
  const isFinalRound = maxPlayableRound != null && r === maxPlayableRound;
  const hasIncompleteEarlierRound = roundMeta.rounds.some((rn) => {
    if (rn >= r) return false;
    const meta = roundMeta.byRound[rn];
    if (!meta) return false;
    return meta.total > 0 && (meta.completed < meta.total || meta.byesPending > 0);
  });

  const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
  const playableRoundMatches = roundMatches.filter((m) => !isMatchBye(m));
  const finalMatch = isFinalRound ? playableRoundMatches[0] ?? null : null;
  const finalWinnerId = finalMatch ? winnerTeamIdFromMatch(finalMatch) : null;
  const finalWinnerName = finalWinnerId ? teamDisplayName(finalWinnerId) : null;

  const canAdvance =
    !!tournament &&
    tournament.status !== "COMPLETED" &&
    isLatestRound &&
    !isFinalRound &&
    !hasIncompleteEarlierRound &&
    !nextRoundExists &&
    !busy;

  const canCompleteTournament =
    !!tournament &&
    tournament.status !== "COMPLETED" &&
    isLatestRound &&
    isFinalRound &&
    isComplete &&
    !!finalWinnerId &&
    !busy;

  const advanceTitle = nextRoundExists
    ? `${roundLabel(nextRoundNo)} fixtures already exist`
    : !tournament
    ? "Tournament not loaded"
    : tournament.status === "COMPLETED"
    ? "Tournament is completed"
    : isFinalRound
    ? "This is the final round"
    : !isLatestRound
    ? "Only the latest round can be advanced"
    : hasIncompleteEarlierRound
    ? "Finish earlier rounds before advancing"
    : byesPending > 0
    ? "BYEs are being auto-processed"
    : "Advance to the next round";

  const advanceHint = nextRoundExists
    ? `Next round (${roundLabel(nextRoundNo)}) already exists.`
    : tournament?.status === "COMPLETED"
    ? "Tournament is completed."
    : isFinalRound && isComplete
    ? "Final complete - complete the tournament to publish the winner."
    : isFinalRound
    ? "Final round - complete the match to determine a winner."
    : !isLatestRound
    ? "Select the latest round to advance (only one round ahead)."
    : hasIncompleteEarlierRound
    ? "Complete earlier rounds (including Pre-Rd) before advancing."
    : byesPending > 0
    ? "BYEs still pending — auto-processing now."
    : "Advance now (next round will use placeholders if needed).";

  const scheduledCount = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m) && String(m.status ?? "") === "SCHEDULED").length;

  const withScoresCount = roundMatches.filter((m) => {
    if (isMatchBye(m)) return false;
    if (isMatchDone(m)) return false;
    return m.score_a != null && m.score_b != null;
  }).length;

  // Optional strictness applied: only allow these bulk ops while tournament is IN_PLAY
  const canStartAll = !!tournament && tournament.status === "IN_PLAY" && scheduledCount > 0 && !busy;
  const canCompleteWithScores = !!tournament && tournament.status === "IN_PLAY" && withScoresCount > 0 && !busy;

  return (
    <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{roundLabel(r)}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusPill label={isComplete ? "Complete" : "In progress"} tone={isComplete ? "good" : "warn"} />
          <StatusPill label={`${done}/${total} complete${byesPending ? ` • ${byesPending} BYE pending` : ""}`} tone={byesPending ? "warn" : "neutral"} />
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {isFinalRound && isComplete && finalWinnerName ? (
          <div style={{ fontSize: 13, color: theme.text, fontWeight: 900 }}>
            Winner: <span style={{ color: "#0F7A3D" }}>{finalWinnerName}</span>
          </div>
        ) : null}
        {scheduledCount > 0 ? (
          <button
            type="button"
            disabled={!canStartAll}
            onClick={startAllInSelectedRound}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canStartAll ? "pointer" : "not-allowed",
            }}
            title={`Start ${scheduledCount} scheduled match(es)`}
          >
            {busy ? "Working..." : `Start all matches${scheduledCount ? ` (${scheduledCount})` : ""}`}
          </button>
        ) : null}

        {withScoresCount > 0 ? (
          <button
            type="button"
            disabled={!canCompleteWithScores}
            onClick={completeAllWithScoresInSelectedRound}
            style={{
              width: "100%",
              border: `1px solid ${theme.border}`,
              background: "#fff",
              color: theme.text,
              padding: "10px 12px",
              borderRadius: 12,
              fontWeight: 900,
              cursor: canCompleteWithScores ? "pointer" : "not-allowed",
            }}
            title={`Complete ${withScoresCount} match(es) that already have scores`}
          >
            {busy ? "Working..." : `Complete all with scores${withScoresCount ? ` (${withScoresCount})` : ""}`}
          </button>
        ) : null}

        {isLatestRound ? (
          isFinalRound ? (
            tournament?.status === "COMPLETED" ? null : (
              <button
                type="button"
                disabled={!canCompleteTournament}
                onClick={endTournament}
                style={{
                  width: "100%",
                  border: "none",
                  background: canCompleteTournament ? theme.maroon : "#9CA3AF",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: canCompleteTournament ? "pointer" : "not-allowed",
                }}
                title={
                  !isComplete
                    ? "Final is not complete yet"
                    : !finalWinnerId
                    ? "Final needs a winner to complete the tournament"
                    : "Complete tournament"
                }
              >
                {busy ? "Working..." : "Complete tournament"}
              </button>
            )
          ) : (
            !nextRoundExists ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={advanceSelectedRound}
                style={{
                  width: "100%",
                  border: "none",
                  background: canAdvance ? theme.maroon : "#9CA3AF",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: canAdvance ? "pointer" : "not-allowed",
                }}
                title={advanceTitle}
              >
                {busy ? "Working..." : "Advance round"}
              </button>
            ) : null
          )
        ) : null}

        {!isLatestRound ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.danger }}>
            Select the latest round to enable advancing.
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
        {advanceHint} Tip: keep match edits minimal. Use <span style={{ fontWeight: 900, color: theme.text }}>Admin final</span> only if captains can’t resolve.
      </div>
    </div>
  );
}

export default function RoundsView(props: RoundsViewProps) {
  const {
    tournament,
    tournamentId,
    matches,
    matchesByRound,
    busy,
    maxPlayableRound,
    roundMeta,
    roundsViewMode,
    treeRoundsDisplay,
    matchNoById,
    teamMembersByTeamId,
    handicapByPlayerId,
    scoreDraftByMatchId,
    bulkOpen,
    bulkDraftByMatchId,
    adminFinalOpenByMatchId,
    showProblemsOnly,
    attentionOpen,
    inPlayOpen,
    completedOpen,
    setScoreDraftByMatchId,
    setBulkOpen,
    setBulkDraftByMatchId,
    setAdminFinalOpenByMatchId,
    setShowProblemsOnly,
    setRoundsViewMode,
    setAttentionOpen,
    setInPlayOpen,
    setCompletedOpen,
    setBusy,
    setError,
    adminFinalScore,
    updateMatchStatus,
    reload,
    treeRoundRefsSetter,
    labelers,
    scrollHelpers,
  } = props;
  const {
    teamDisplayName,
    teamLabel,
    slotLabel,
    roundLabel,
    singlesHandicapLine,
    isHandicapTournament,
  } = labelers;
  const { pinScrollForInput, restorePinnedScrollForInput } = scrollHelpers;

  const selectedRound = roundMeta.selectedRound;

  const roundMatches = matchesByRound.find((x) => x.round === selectedRound)?.matches ?? (selectedRound == null ? matches : []);

  const playable = roundMatches.filter((m) => !isMatchBye(m));

  const inPlay = playable.filter((m) => String(m.status ?? "") === "IN_PLAY" && !isMatchDone(m));
  const completed = playable.filter((m) => isMatchDone(m));
  const attention = playable.filter((m) => !isMatchDone(m) && String(m.status ?? "") !== "IN_PLAY");
  const attentionList = showProblemsOnly ? attention : attention;
  const inPlayList = showProblemsOnly ? inPlay : inPlay;
  const completedList = showProblemsOnly ? [] : completed;

  function renderBulkRoundScoring() {
    const r = roundMeta.selectedRound;
    if (!r) return null;

    const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
    const editable = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m) && !!m.team_a_id && !!m.team_b_id);

    if (!editable.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Bulk scoring</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No editable matches in this round.</div>
        </div>
      );
    }

    async function saveOnly() {
      if (!tournamentId || typeof tournamentId !== "string") return;

      // Local pre-validation so the old error copy is preserved.
      const entries: { match_id: string; score_a: number | null; score_b: number | null }[] = [];
      for (const m of editable) {
        const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
        const aRaw = (d.a ?? "").trim();
        const bRaw = (d.b ?? "").trim();
        if (!aRaw || !bRaw) {
          // Partial saves allowed: skip rows without a full pair.
          continue;
        }

        const a = Number(aRaw);
        const b = Number(bRaw);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
          setError("Bulk scoring: scores must be whole numbers >= 0.");
          return;
        }
        entries.push({ match_id: m.id, score_a: a, score_b: b });
      }

      if (!entries.length) {
        // Nothing to save — early-out without touching busy state.
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const res = await fetch("/api/tournaments/matches/bulk-save-scores/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournament_id: tournamentId, matches: entries }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error ?? "Could not save scores.");
          setBusy(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error.");
        setBusy(false);
        return;
      }

      await reload({ preserveScroll: true });
      setBusy(false);
    }

    async function finaliseAll() {
      if (!tournamentId || typeof tournamentId !== "string") return;

      const ok = window.confirm(`Finalise all entered scores for ${roundLabel(r)}?\n\nThis will complete each match and set the winner.`);
      if (!ok) return;

      const entries: { match_id: string; score_a: number; score_b: number }[] = [];
      for (const m of editable) {
        const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
        const a = Number((d.a ?? "").trim());
        const b = Number((d.b ?? "").trim());

        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
          setError("Bulk finalise: every match must have valid whole-number scores (>= 0).");
          return;
        }
        entries.push({ match_id: m.id, score_a: a, score_b: b });
      }

      if (!entries.length) return;

      setBusy(true);
      setError(null);

      try {
        const res = await fetch("/api/tournaments/matches/admin-final/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournament_id: tournamentId, matches: entries }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error ?? "Could not finalise matches.");
          setBusy(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error.");
        setBusy(false);
        return;
      }

      setBulkOpen(false);
      await reload({ preserveScroll: true });
      setBusy(false);
    }

    return (
      <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Bulk scoring • {roundLabel(r)}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{editable.length} matches</div>
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, padding: 14, display: "grid", gap: 10 }}>
          {editable.map((m) => {
            const d = bulkDraftByMatchId[m.id] ?? { a: "", b: "" };
            const left = teamDisplayName(m.team_a_id);
            const right = teamDisplayName(m.team_b_id);

            return (
              <div key={`bulk-${m.id}`} style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.match_no != null ? `Match ${m.match_no} · ` : ""}
                  {left} vs {right}
                </div>

                {tournament?.format === "SINGLES" && isHandicapTournament() ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 900 }}>
                    {singlesHandicapLine(m)}
                  </div>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <ScoreInput
                    valueA={(d.a ?? "").toString()}
                    valueB={(d.b ?? "").toString()}
                    onChangeA={(next) => setBulkDraftByMatchId((p) => ({ ...p, [m.id]: { a: next, b: p[m.id]?.b ?? "" } }))}
                    onChangeB={(next) => setBulkDraftByMatchId((p) => ({ ...p, [m.id]: { a: p[m.id]?.a ?? "", b: next } }))}
                    disabled={busy}
                    onFocus={pinScrollForInput}
                    onBlur={restorePinnedScrollForInput}
                  />
                </div>
              </div>
            );
          })}

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={saveOnly}
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
            >
              {busy ? "Working..." : "Save scores (no finalise)"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={finaliseAll}
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
            >
              {busy ? "Working..." : "Save & finalise all"}
            </button>

            <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
              Tip: “Save & finalise” completes each match and sets the winner. Use Admin actions per match only when needed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMatchCard(m: MatchRow) {
    const st = String(m.status ?? "");
    const hasWinner = m.winner_team_id != null && m.winner_team_id !== "";
    const isFinal = bool(m.finalized_by_admin) || st === "COMPLETED" || hasWinner;
    const locked = isFinal;

    const canStart = st === "SCHEDULED" && !locked;
    const canComplete = st === "IN_PLAY" && !locked;

    const confirmedA = bool(m.confirmed_by_a);
    const confirmedB = bool(m.confirmed_by_b);

    const scoreLine = m.score_a == null || m.score_b == null ? "-" : `${m.score_a} - ${m.score_b}`;

    const leftName = slotLabel(m, "A");
    const rightName = slotLabel(m, "B");

    const leftHC =
      tournament?.format === "SINGLES" && isHandicapTournament()
        ? (() => {
            const pid = m.team_a_id ? (teamMembersByTeamId[m.team_a_id]?.[0] ?? null) : null;
            const h = pid ? (handicapByPlayerId[pid] ?? null) : null;
            return h == null ? "" : ` (HC ${h})`;
          })()
        : "";

    const rightHC =
      tournament?.format === "SINGLES" && isHandicapTournament()
        ? (() => {
            const pid = m.team_b_id ? (teamMembersByTeamId[m.team_b_id]?.[0] ?? null) : null;
            const h = pid ? (handicapByPlayerId[pid] ?? null) : null;
            return h == null ? "" : ` (HC ${h})`;
          })()
        : "";

    const headerTitle = isMatchBye(m) ? `${leftName}${leftHC} — BYE` : `${leftName}${leftHC} vs ${rightName}${rightHC}`;

    const needsAdmin = !locked && (m.score_a == null || m.score_b == null || !(confirmedA && confirmedB));

    const cardTone = getMatchCardTone(m);

    return (
      <div
        key={m.id}
        style={{
          border: `1px solid ${cardTone.border}`,
          borderRadius: 16,
          background: cardTone.bg,
          padding: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14, minWidth: 0 }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={headerTitle}>
                {headerTitle}
              </div>
            </div>

            <div style={{ marginTop: 4, fontSize: 12, color: theme.muted, fontWeight: 800 }}>
              {m.match_no != null ? `Match ${m.match_no} • ` : ""}{roundLabel(m.round_no)}
              {tournament?.format === "SINGLES"
                ? ""
                : m.team_a_id && m.team_b_id
                ? ` • ${teamLabel(m.team_a_id)} • ${teamLabel(m.team_b_id)}`
                : ""}
            </div>

            {tournament?.format === "SINGLES" && !isMatchBye(m) && isHandicapTournament() ? (
              <div style={{ marginTop: 8, fontSize: 12, color: theme.muted, fontWeight: 900, lineHeight: 1.25 }}>
                {singlesHandicapLine(m)}
              </div>
            ) : null}

            {canStart ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateMatchStatus(m.id, "IN_PLAY")}
                style={{
                  marginTop: 8,
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: busy ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Start
              </button>
            ) : null}

            {canComplete ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateMatchStatus(m.id, "COMPLETED")}
                style={{
                  marginTop: 8,
                  border: `1px solid ${theme.border}`,
                  background: "#fff",
                  color: theme.text,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: busy ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Complete
              </button>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <StatusPill label={matchStatusLabel(st)} tone={locked ? "good" : st === "IN_PLAY" ? "warn" : "neutral"} />
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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
          >
            Score: {scoreLine}
          </div>

          {locked ? <StatusPill label="Locked" tone="neutral" /> : needsAdmin ? <StatusPill label="Needs attention" tone="warn" /> : null}
        </div>

        {!locked && !isMatchBye(m) ? (
          <div style={{ marginTop: 10 }}>
            <ScoreInput
              valueA={(scoreDraftByMatchId[m.id]?.a ?? (m.score_a == null ? "" : String(m.score_a))).toString()}
              valueB={(scoreDraftByMatchId[m.id]?.b ?? (m.score_b == null ? "" : String(m.score_b))).toString()}
              onChangeA={(next) =>
                setScoreDraftByMatchId((p) => ({
                  ...p,
                  [m.id]: { a: next, b: p[m.id]?.b ?? (m.score_b == null ? "" : String(m.score_b)) },
                }))
              }
              onChangeB={(next) =>
                setScoreDraftByMatchId((p) => ({
                  ...p,
                  [m.id]: { a: p[m.id]?.a ?? (m.score_a == null ? "" : String(m.score_a)), b: next },
                }))
              }
              disabled={busy}
              onFocus={pinScrollForInput}
              onBlur={restorePinnedScrollForInput}
            />

            <button
              type="button"
              disabled={busy}
              onClick={() => adminFinalScore(m.id)}
              style={{
                marginTop: 8,
                width: "100%",
                border: "none",
                background: theme.maroon,
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
              title="Finalise this match with the scores entered above"
            >
              Finalise match
            </button>

            <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
              This uses Admin final to complete the match quickly. Captains can still submit normally.
            </div>
          </div>
        ) : null}

        {!locked ? (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAdminFinalOpenByMatchId((p) => ({ ...p, [m.id]: !p[m.id] }));
              }}
              style={{
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.text,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>Admin actions</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>{adminFinalOpenByMatchId[m.id] ? "▾" : "▸"}</div>
            </button>

            {adminFinalOpenByMatchId[m.id] ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>
                  Use admin final if captains can’t resolve. This completes the match.
                </div>

                <div style={{ marginTop: 6, fontSize: 12, color: theme.muted, fontWeight: 900 }}>
                  Confirmed: A {confirmedA ? "✓" : "—"} • B {confirmedB ? "✓" : "—"}
                  {bool(m.finalized_by_admin) ? <span style={{ marginLeft: 8, color: theme.danger }}>Admin final</span> : null}
                </div>

                <div style={{ marginTop: 8 }}>
                  <ScoreInput
                    valueA={(scoreDraftByMatchId[m.id]?.a ?? "").toString()}
                    valueB={(scoreDraftByMatchId[m.id]?.b ?? "").toString()}
                    onChangeA={(next) =>
                      setScoreDraftByMatchId((p) => ({
                        ...p,
                        [m.id]: { a: next, b: p[m.id]?.b ?? "" },
                      }))
                    }
                    onChangeB={(next) =>
                      setScoreDraftByMatchId((p) => ({
                        ...p,
                        [m.id]: { a: p[m.id]?.a ?? "", b: next },
                      }))
                    }
                    disabled={busy}
                    onFocus={pinScrollForInput}
                    onBlur={restorePinnedScrollForInput}
                    separatorWidth={40}
                  />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => adminFinalScore(m.id)}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    border: `1px solid ${theme.border}`,
                    background: "#fff",
                    color: theme.danger,
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Working..." : "Admin final & complete"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderTreeView() {
    if (!matchesByRound.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const selected = roundMeta.selectedRound;
    const roundsToShow = treeRoundsDisplay;
    if (!roundsToShow.length) {
      return (
        <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bracket view</div>
          <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>No rounds to show yet.</div>
        </div>
      );
    }

    const preRound = matchesByRound.find((r) => roundLabel(r.round) === "Pre-Rd");
    const selectedRound = roundMeta.selectedRound ?? roundsToShow[0]?.round ?? null;
    const selectedLabel = selectedRound ? roundLabel(selectedRound) : null;
    const selectedIsPre = selectedLabel === "Pre-Rd";
    const displayRounds = matchesByRound.filter((r) => roundLabel(r.round) !== "Pre-Rd");
    const selectedIndex = selectedIsPre
      ? -1
      : selectedRound
      ? displayRounds.findIndex((r) => r.round === selectedRound)
      : -1;
    const nextRound = selectedIsPre
      ? displayRounds[0] ?? null
      : selectedIndex >= 0 && selectedIndex < displayRounds.length - 1
      ? displayRounds[selectedIndex + 1]
      : null;

    const feederSourceIds = new Set<string>();
    const collectFeederIds = (roundMatches: MatchRow[] | undefined) => {
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
        ? preRound?.matches ?? []
        : selectedRound
        ? displayRounds.find((r) => r.round === selectedRound)?.matches ?? []
        : [];
      const nextMatches = nextRound?.matches ?? [];
      const filteredNextMatches = feederSourceIds.size
        ? nextMatches.filter(
            (m) =>
              (m.slot_a_source_match_id && feederSourceIds.has(String(m.slot_a_source_match_id))) ||
              (m.slot_b_source_match_id && feederSourceIds.has(String(m.slot_b_source_match_id)))
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

      return selectedRound ? [{ round: selectedRound, matches: selectedMatches }] : roundsToShow;
    })();

    const fromLabelRaw = selected ? roundLabel(selected) : null;
    const fromLabel =
      fromLabelRaw === "Pre-Rd" && roundsForTree.length ? roundLabel(roundsForTree[0].round) : fromLabelRaw;

    const cardW = 230;
    const cardH = 44;
    const baseGap = 18;
    const colGap = 110;
    const headerOffset = 28;

    const { roundLayouts, posById, roundPositions, width, height } = computeTreeLayout(roundsForTree, {
      cardW,
      cardH,
      baseGap,
      colGap,
      headerOffset,
    });

    const positionsByRoundIndex = new Map(roundPositions.map((layout) => [layout.roundIndex, layout.matches]));
    const lines = computeBracketLines(roundLayouts, posById, positionsByRoundIndex, cardW);

    const treeSlot = (m: MatchRow, side: "A" | "B") => treeSlotLabel(m, side, teamDisplayName, matchNoById);

    return (
      <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted, marginBottom: 6 }}>
            Show rounds from
          </div>
          <RoundSelector {...props} />
        </div>

        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            Bracket view{fromLabel ? ` • from ${fromLabel}` : ""}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
            {roundsToShow.reduce((acc, r) => acc + (r.matches?.length ?? 0), 0)} matches
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${theme.border}`,
            padding: 14,
            overflowX: "auto",
          }}
        >
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
                <path key={`path-${idx}`} d={d} stroke="#CBBBA3" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              ))}
            </svg>

            {roundLayouts.map((layout) => {
              const meta = roundMeta.byRound[layout.round.round];
              const total = meta?.total ?? layout.list.length;
              const completedCount = meta?.completed ?? 0;
              const focused = selected ? layout.round.round === selected : true;
              const colX = layout.roundIndex * (cardW + colGap);
              const positioned = roundPositions.find((r) => r.roundIndex === layout.roundIndex)?.matches ?? [];
              const matchPos = new Map(positioned.map((p) => [p.id, p]));

              return (
                <div
                  key={`tree-round-${layout.round.round}`}
                  ref={treeRoundRefsSetter(layout.round.round)}
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
                      color: theme.text,
                      paddingBottom: 6,
                    }}
                  >
                    <div>{roundLabel(layout.round.round)}</div>
                    <div style={{ fontSize: 11, color: theme.muted, fontWeight: 900 }}>{completedCount}/{total}</div>
                  </div>

                  {layout.list.map((m) => {
                    const pos = matchPos.get(m.id);
                    const y = pos ? pos.top : headerOffset;
                    const left = treeSlot(m, "A");
                    const right = treeSlot(m, "B");
                    const winnerId = winnerTeamIdFromMatch(m);
                    const winA = winnerId && m.team_a_id && String(m.team_a_id) === winnerId;
                    const winB = winnerId && m.team_b_id && String(m.team_b_id) === winnerId;
                    return (
                      <div
                        key={`tree-${m.id}`}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: y,
                          width: cardW,
                          height: cardH,
                          border: `1px solid ${theme.border}`,
                          borderRadius: 10,
                          background: "#fff",
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
                            color: winA ? "#16A34A" : left === "TBD" ? theme.muted : theme.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {left}
                        </div>
                        <div
                          style={{
                            color: winB ? "#16A34A" : right === "TBD" ? theme.muted : theme.text,
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
    <>
      <div style={{ marginTop: 14 }}>
        <RoundSelector {...props} />
        <RoundAdminBar {...props} />

        {roundMeta.roundIsComplete ? (
          <div
            style={{
              marginTop: 10,
              background: "#fff",
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 12,
              fontWeight: 900,
            }}
          >
            {maxPlayableRound != null && roundMeta.selectedRound === maxPlayableRound ? 'Final complete. Click "Complete tournament" to finalise and publish the winner.' : "Round complete. You can advance to the next round."}
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setRoundsViewMode((v) => (v === "LIST" ? "TREE" : "LIST"))}
            style={{
              border: `1px solid ${theme.border}`,
              background: roundsViewMode === "TREE" ? theme.maroon : "#fff",
              color: roundsViewMode === "TREE" ? "#fff" : theme.text,
              padding: "8px 10px",
              borderRadius: 999,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {roundsViewMode === "TREE" ? "Tree view on" : "Tree view"}
          </button>

          {roundsViewMode === "LIST" ? (
            <>
              <button
                type="button"
                onClick={() => setShowProblemsOnly((v) => !v)}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: showProblemsOnly ? theme.maroon : "#fff",
                  color: showProblemsOnly ? "#fff" : theme.text,
                  padding: "8px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                title="Show only matches that still need action"
              >
                {showProblemsOnly ? "Showing problems only" : "Show problems only"}
              </button>

              <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Tip: problems = not done + not BYE</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: theme.muted, fontWeight: 900 }}>Tree view is read-only.</div>
          )}
        </div>

        {roundsViewMode === "LIST" ? (
          <>
            <button
              type="button"
              disabled={!tournament || tournament.status === "COMPLETED" || busy || !roundMeta.selectedRound}
              onClick={() => {
                const r = roundMeta.selectedRound;
                if (!r) return;

                const roundMatches = matchesByRound.find((x) => x.round === r)?.matches ?? [];
                const playable = roundMatches.filter((m) => !isMatchBye(m) && !isMatchDone(m));

                const next: Record<string, { a: string; b: string }> = {};
                for (const m of playable) {
                  next[m.id] = {
                    a: m.score_a == null ? "" : String(m.score_a),
                    b: m.score_b == null ? "" : String(m.score_b),
                  };
                }
                setBulkDraftByMatchId(next);
                setBulkOpen((v) => !v);
              }}
              style={{
                marginTop: 10,
                width: "100%",
                border: `1px solid ${theme.border}`,
                background: "#fff",
                color: theme.text,
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: !tournament || tournament.status === "COMPLETED" || busy || !roundMeta.selectedRound ? "not-allowed" : "pointer",
              }}
              title="Enter many scores at once for this round"
            >
              {bulkOpen ? "Close bulk scoring" : "Bulk score this round"}
            </button>

            {bulkOpen ? renderBulkRoundScoring() : null}
          </>
        ) : null}
      </div>

      {roundsViewMode === "TREE" ? (
        renderTreeView()
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <SectionCard
            title="Needs attention"
            count={attentionList.length}
            open={attentionOpen}
            onToggle={() => setAttentionOpen((v) => !v)}
            tone={attentionList.length ? "warn" : "good"}
          >
            {attentionList.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {attentionList.map((m) => renderMatchCard(m))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>Nothing needs attention right now.</div>
            )}
          </SectionCard>

          <SectionCard
            title="In play"
            count={inPlayList.length}
            open={inPlayOpen}
            onToggle={() => setInPlayOpen((v) => !v)}
            tone={inPlayList.length ? "warn" : "neutral"}
          >
            {inPlayList.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {inPlayList.map((m) => renderMatchCard(m))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No matches in progress.</div>
            )}
          </SectionCard>

          <SectionCard
            title="Completed"
            count={completedList.length}
            open={completedOpen}
            onToggle={() => setCompletedOpen((v) => !v)}
            tone={completedList.length ? "good" : "neutral"}
          >
            {completedList.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {completedList.map((m) => renderMatchCard(m))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.35 }}>No completed matches yet.</div>
            )}
          </SectionCard>
        </div>
      )}

    </>
  );
}
