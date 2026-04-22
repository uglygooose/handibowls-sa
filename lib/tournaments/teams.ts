// lib/tournaments/teams.ts
// Pure-function team/slot/winner label helpers. Take data via explicit params.

export type TeamInfo = { team_no: number };

export type MemberNameInput = {
  nameByPlayerId: Record<string, string>;
  handicapByPlayerId: Record<string, number | null>;
  isHandicapTournament: boolean;
};

function formatHandicapValue(v: number | null | undefined): string | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

/** Member display name. Appends handicap (e.g. "John (12)") when the tournament uses handicap rules. */
export function memberNameWithHandicap(playerId: string, input: MemberNameInput): string {
  const base = input.nameByPlayerId[playerId] ?? "Unknown";
  if (!input.isHandicapTournament) return base;
  const h = formatHandicapValue(input.handicapByPlayerId[playerId]);
  return h ? `${base} (${h})` : base;
}

export function teamLabel(teamId: string | null, teamById: Record<string, TeamInfo>): string {
  if (!teamId) return "Team -";
  const t = teamById[teamId];
  if (!t) return "Team -";
  return `Team ${t.team_no}`;
}

export type TeamDisplayNameInput = {
  teamId: string | null;
  format: string | null | undefined;
  teamMembersByTeamId: Record<string, string[]>;
  teamById: Record<string, TeamInfo>;
  nameByPlayerId: Record<string, string>;
  handicapByPlayerId: Record<string, number | null>;
  isHandicapTournament: boolean;
};

/**
 * Team display name:
 *  - null teamId → "BYE"
 *  - SINGLES    → first member name (with handicap if applicable)
 *  - Otherwise  → "Team N"
 */
export function teamDisplayName(input: TeamDisplayNameInput): string {
  if (!input.teamId) return "BYE";
  const memberIds = input.teamMembersByTeamId[input.teamId] ?? [];
  const names = memberIds
    .map((pid) =>
      memberNameWithHandicap(pid, {
        nameByPlayerId: input.nameByPlayerId,
        handicapByPlayerId: input.handicapByPlayerId,
        isHandicapTournament: input.isHandicapTournament,
      })
    )
    .filter(Boolean);

  if (input.format === "SINGLES") {
    return (names[0] as string) ?? teamLabel(input.teamId, input.teamById);
  }
  return teamLabel(input.teamId, input.teamById);
}

export type TeamMembersLineInput = {
  teamId: string | null;
  teamMembersByTeamId: Record<string, string[]>;
  nameByPlayerId: Record<string, string>;
  handicapByPlayerId: Record<string, number | null>;
  isHandicapTournament: boolean;
};

export function teamMembersLine(input: TeamMembersLineInput): string {
  if (!input.teamId) return "-";
  const memberIds = input.teamMembersByTeamId[input.teamId] ?? [];
  const memberNames = memberIds.map((pid) =>
    memberNameWithHandicap(pid, {
      nameByPlayerId: input.nameByPlayerId,
      handicapByPlayerId: input.handicapByPlayerId,
      isHandicapTournament: input.isHandicapTournament,
    })
  );
  return memberNames.length ? memberNames.join(" * ") : "Members not loaded";
}

export function winnerLabelForMatch(
  matchId: string | null | undefined,
  matchNoById: Record<string, number | null>
): string {
  if (!matchId) return "Winner";
  const no = matchNoById[matchId];
  if (!no) return "Winner";
  return `M${no} W`;
}

export type SlotInputSide = {
  teamId: string | null;
  sourceType: string | null | undefined;
  sourceMatchId: string | null | undefined;
};

export type SlotLabelInput = SlotInputSide & {
  format: string | null | undefined;
  teamMembersByTeamId: Record<string, string[]>;
  teamById: Record<string, TeamInfo>;
  nameByPlayerId: Record<string, string>;
  handicapByPlayerId: Record<string, number | null>;
  isHandicapTournament: boolean;
  matchNoById: Record<string, number | null>;
};

export function slotLabel(input: SlotLabelInput): string {
  if (input.teamId) {
    return teamDisplayName({
      teamId: input.teamId,
      format: input.format,
      teamMembersByTeamId: input.teamMembersByTeamId,
      teamById: input.teamById,
      nameByPlayerId: input.nameByPlayerId,
      handicapByPlayerId: input.handicapByPlayerId,
      isHandicapTournament: input.isHandicapTournament,
    });
  }
  if (input.sourceType === "WINNER_OF_MATCH") {
    return winnerLabelForMatch(input.sourceMatchId ?? null, input.matchNoById);
  }
  if (input.sourceType === "BYE") return "BYE";
  return "TBD";
}

export type SlotMembersLineInput = SlotInputSide & {
  teamMembersByTeamId: Record<string, string[]>;
  nameByPlayerId: Record<string, string>;
  handicapByPlayerId: Record<string, number | null>;
  isHandicapTournament: boolean;
};

export function slotMembersLine(input: SlotMembersLineInput): string {
  if (input.teamId) {
    return teamMembersLine({
      teamId: input.teamId,
      teamMembersByTeamId: input.teamMembersByTeamId,
      nameByPlayerId: input.nameByPlayerId,
      handicapByPlayerId: input.handicapByPlayerId,
      isHandicapTournament: input.isHandicapTournament,
    });
  }
  if (input.sourceType === "WINNER_OF_MATCH") return "Pending winner";
  if (input.sourceType === "BYE") return "BYE";
  return "Pending";
}
