// app/tournaments/views/TournamentCardView.tsx
"use client";

import { theme } from "@/lib/theme";
import {
  cleanTournamentName,
  formatLabel,
  genderLabel,
  matchStatusLabel,
  ruleLabel,
  scopeLabel,
  statusLabel,
} from "@/lib/tournaments/labels";
import {
  bool,
  hasValue,
  isMatchBye as isByeMatch,
  isMatchDone,
  winnerTeamIdFromMatch as inferWinnerTeamId,
} from "@/lib/tournaments/match";
import type { MatchLite, TournamentRow } from "../page";

type TeamRow = { id: string; team_no: number; team_handicap: number | null };

export type TournamentCardViewProps = {
  t: TournamentRow;
  entered: boolean;
  winnerName: string;
  teams: TeamRow[];
  teamMembersByTeamId: Record<string, string[]>;
  nameByPlayerId: Record<string, string>;
  matches: MatchLite[];
  clubName: string | undefined;
  playerId: string;
  teamDisplayName: (t: TournamentRow, teamId: string | null) => string;
  roundLabelForTournament: (t: TournamentRow, roundNo: number | null | undefined) => string;
  finishPlacementLabel: (t: TournamentRow, roundNo: number | null | undefined) => string | null;
  canEnterTournamentRow: (t: TournamentRow | null | undefined) => { ok: boolean; reason: string | null };
  enterTournament: (tournamentId: string) => void | Promise<void>;
};

export default function TournamentCardView(props: TournamentCardViewProps) {
  const {
    t,
    entered,
    winnerName,
    teams,
    teamMembersByTeamId,
    nameByPlayerId,
    matches,
    clubName,
    playerId,
    teamDisplayName,
    roundLabelForTournament,
    finishPlacementLabel,
    canEnterTournamentRow,
    enterTournament,
  } = props;

  const showWinner = t.status === "COMPLETED" && !!winnerName;

  const myTeam = entered ? teams.find((tm) => (teamMembersByTeamId[tm.id] ?? []).includes(playerId)) ?? null : null;
  const myTeamId = myTeam?.id ?? null;

  const myMatches = myTeamId
    ? matches.filter((m) => String(m.team_a_id ?? "") === myTeamId || String(m.team_b_id ?? "") === myTeamId)
    : [];

  const nextMatch = (() => {
    if (t.status !== "IN_PLAY" || !myTeamId) return null;
    const pending = myMatches.filter((m) => !isByeMatch(m) && !isMatchDone(m));
    if (!pending.length) return null;
    const sorted = pending.slice().sort(
      (a, b) =>
        Number(a.round_no ?? 0) - Number(b.round_no ?? 0) ||
        Number(a.match_no ?? 0) - Number(b.match_no ?? 0) ||
        String(a.id).localeCompare(String(b.id))
    );
    return sorted[0] ?? null;
  })();

  const actionNeeded = (() => {
    if (t.status !== "IN_PLAY" || !nextMatch || !myTeamId || !playerId) return null;

    // Captain = min player_id in team (matches tournament room logic)
    const captainForTeam = (teamId: string | null) => {
      if (!teamId) return null;
      const ids = (teamMembersByTeamId[teamId] ?? []).slice().sort();
      return ids[0] ?? null;
    };
    const capA = captainForTeam(nextMatch.team_a_id);
    const capB = captainForTeam(nextMatch.team_b_id);
    const iAmCaptainA = capA && capA === playerId;
    const iAmCaptainB = capB && capB === playerId;

    const mySide = iAmCaptainA ? "A" : iAmCaptainB ? "B" : null;
    if (!mySide) return null;

    const st = String(nextMatch.status ?? "");
    if (st === "IN_PLAY" && !bool(nextMatch.finalized_by_admin)) {
      return "Submit score";
    }

    const hasScores = nextMatch.score_a != null && nextMatch.score_b != null;
    const hasSubmitter = hasValue(nextMatch.submitted_by_player_id);
    if (
      !bool(nextMatch.finalized_by_admin) &&
      hasScores &&
      hasSubmitter &&
      String(nextMatch.submitted_by_player_id) !== playerId
    ) {
      if (mySide === "A" && !bool(nextMatch.confirmed_by_a)) return "Confirm score";
      if (mySide === "B" && !bool(nextMatch.confirmed_by_b)) return "Confirm score";
    }

    return null;
  })();

  const myFinish = (() => {
    if (t.status !== "COMPLETED" || !myTeamId) return null;
    const done = myMatches.filter((m) => isMatchDone(m));
    if (!done.length) return null;
    const sorted = done.slice().sort(
      (a, b) =>
        Number(b.round_no ?? 0) - Number(a.round_no ?? 0) ||
        Number(b.match_no ?? 0) - Number(a.match_no ?? 0) ||
        String(b.id).localeCompare(String(a.id))
    );
    const last = sorted[0];
    const winnerId = last ? inferWinnerTeamId(last) : null;
    if (winnerId && winnerId === myTeamId) return { label: "Champion", detail: null as string | null };
    const round = roundLabelForTournament(t, last?.round_no ?? null);
    const place = finishPlacementLabel(t, last?.round_no ?? null);
    return { label: `Knocked out: ${round}`, detail: place ? `Finish: ${place}` : null };
  })();

  const primary = (() => {
    if (t.status === "ANNOUNCED" && !entered && t.entries_open !== false) {
      const elig = canEnterTournamentRow(t);
      if (elig.ok) {
        return { label: "Enter tournament", onClick: () => enterTournament(t.id), variant: "solid" as const };
      }
      return {
        label: "View tournament",
        onClick: () => (window.location.href = `/tournaments/${t.id}`),
        variant: "solid" as const,
      };
    }
    if (t.status === "COMPLETED") {
      return {
        label: "View results",
        onClick: () => (window.location.href = `/tournaments/${t.id}`),
        variant: "solid" as const,
      };
    }
    if (t.status === "IN_PLAY") {
      return {
        label: entered ? "Open tournament" : "View bracket",
        onClick: () => (window.location.href = `/tournaments/${t.id}`),
        variant: "solid" as const,
      };
    }
    return {
      label: "View tournament",
      onClick: () => (window.location.href = `/tournaments/${t.id}`),
      variant: entered ? ("solid" as const) : ("outline" as const),
    };
  })();

  return (
    <div
      key={t.id}
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{cleanTournamentName(t.name)}</div>
        <div
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 999,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 900,
            color: theme.text,
            background: theme.surface,
            whiteSpace: "nowrap",
          }}
          title="Tournament format"
        >
          {formatLabel(t.format)}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
          {scopeLabel(t.scope)}
        </span>
        <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
          {genderLabel(t.gender ?? null)}
        </span>
        <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
          {ruleLabel(t.rule_type ?? "HANDICAP_START")}
        </span>
        <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
          {statusLabel(t.status)}
        </span>
        {entered ? (
          <span
            style={{
              border: `1px solid ${theme.maroon}`,
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 900,
              color: theme.maroon,
            }}
            title="You have entered this tournament"
          >
            Entered
          </span>
        ) : null}
        {t.scope === "CLUB" && t.club_id && clubName ? (
          <span style={{ border: `1px solid ${theme.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 900 }}>
            Host: {clubName}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13, color: theme.muted }}>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Type</span> {formatLabel(t.format)} knockout
        </div>
        {t.status === "COMPLETED" ? (
          <div>
            <span style={{ fontWeight: 800, color: theme.text }}>Winner</span> {showWinner ? winnerName : "-"}
          </div>
        ) : t.status === "IN_PLAY" ? (
          <div>
            <span style={{ fontWeight: 800, color: theme.text }}>Status</span> {entered ? "In draw" : "Spectator"}
          </div>
        ) : (
          <div>
            <span style={{ fontWeight: 800, color: theme.text }}>Entries</span>{" "}
            {t.entries_open === false ? "Locked" : "Open"}
          </div>
        )}
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Starts</span>{" "}
          {t.starts_at ? new Date(t.starts_at).toLocaleString() : "TBC"}
        </div>
        <div>
          <span style={{ fontWeight: 800, color: theme.text }}>Ends</span>{" "}
          {t.ends_at ? new Date(t.ends_at).toLocaleString() : t.status === "COMPLETED" ? "-" : "TBC"}
        </div>
        {t.status === "IN_PLAY" && entered ? (
          <>
            <div style={{ gridColumn: "1 / span 2" }}>
              <span style={{ fontWeight: 800, color: theme.text }}>Next match</span>{" "}
              {nextMatch
                ? `${roundLabelForTournament(t, nextMatch.round_no)} • vs ${teamDisplayName(
                    t,
                    String(nextMatch.team_a_id ?? "") === myTeamId ? nextMatch.team_b_id : nextMatch.team_a_id
                  )} • ${matchStatusLabel(String(nextMatch.status ?? ""))}`
                : "-"}
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              <span style={{ fontWeight: 800, color: theme.text }}>Action</span> {actionNeeded ?? "None"}
            </div>
          </>
        ) : null}
        {t.status === "COMPLETED" && entered && myFinish ? (
          <>
            <div style={{ gridColumn: "1 / span 2" }}>
              <span style={{ fontWeight: 800, color: theme.text }}>Your result</span> {myFinish.label}
              {myFinish.detail ? <span style={{ color: theme.muted }}>{` • ${myFinish.detail}`}</span> : null}
            </div>
          </>
        ) : null}
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={primary.onClick}
          style={{
            width: "100%",
            border: primary.variant === "outline" ? `1px solid ${theme.border}` : "none",
            background: primary.variant === "outline" ? "#fff" : theme.maroon,
            color: primary.variant === "outline" ? theme.text : "#fff",
            padding: "10px 12px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
          title={primary.label}
        >
          {primary.label}
        </button>
      </div>

      {teams.length ? (
        <details style={{ marginTop: 10 }}>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 900,
              color: theme.maroon,
              userSelect: "none",
            }}
            title={t.format === "SINGLES" ? "View entries" : "View generated teams"}
          >
            {t.format === "SINGLES" ? "View Entries" : "View Teams"}
          </summary>

          {(() => {
            const myTeamForList = teams.find((tm) => (teamMembersByTeamId[tm.id] ?? []).includes(playerId));
            const otherTeams = teams.filter((tm) => tm.id !== myTeamForList?.id);
            const ordered = myTeamForList ? [myTeamForList, ...otherTeams] : otherTeams;

            return (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {ordered.map((tm) => {
                  const memberIds = teamMembersByTeamId[tm.id] ?? [];
                  const memberNames = memberIds.map((pid) => nameByPlayerId[pid] ?? "Unknown");
                  const isMine = myTeamForList?.id === tm.id;
                  const isSingles = t.format === "SINGLES";

                  return (
                    <div
                      key={tm.id}
                      style={{
                        border: `1px solid ${isMine ? theme.maroon : theme.border}`,
                        borderRadius: 14,
                        padding: 10,
                        background: isMine ? "rgba(122,31,43,0.10)" : theme.surface,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {isSingles ? (isMine ? "You" : "Entry") : isMine ? "Your Team" : `Team ${tm.team_no}`}
                        </div>
                        {!isSingles ? (
                          <div style={{ fontSize: 12, fontWeight: 900, color: theme.muted }}>
                            HCP {tm.team_handicap == null ? "-" : tm.team_handicap}
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: theme.text,
                          fontWeight: 800,
                          lineHeight: 1.35,
                        }}
                      >
                        {memberNames.length ? memberNames.join(" \u2022 ") : "Members not loaded"}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </details>
      ) : null}
    </div>
  );
}
