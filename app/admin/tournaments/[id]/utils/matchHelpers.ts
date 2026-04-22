// app/admin/tournaments/[id]/utils/matchHelpers.ts
//
// Page-local helpers for the admin tournament detail page.
// These are narrow enough that they don't belong in lib/tournaments/.

import { theme } from "@/lib/theme";
import { bool } from "@/lib/tournaments/match";
import type { MatchRow } from "../page";

// -------------------- singlesHandicapInfo --------------------

export type SinglesHandicapInfo = {
  nameA: string;
  nameB: string;
  ha: number | null;
  hb: number | null;
  diff: number | null;
  plusTo: "A" | "B" | null;
};

export type SinglesHandicapInfoInput = {
  format: string | null | undefined;
  teamAId: string | null;
  teamBId: string | null;
  teamMembersByTeamId: Record<string, string[]>;
  handicapByPlayerId: Record<string, number | null>;
  teamDisplayName: (teamId: string | null) => string;
};

export function singlesHandicapInfo(input: SinglesHandicapInfoInput): SinglesHandicapInfo | null {
  const { format, teamAId, teamBId, teamMembersByTeamId, handicapByPlayerId, teamDisplayName } = input;
  if (format !== "SINGLES") return null;
  if (!teamAId || !teamBId) return null;
  const pa = teamMembersByTeamId[teamAId]?.[0] ?? null;
  const pb = teamMembersByTeamId[teamBId]?.[0] ?? null;
  if (!pa || !pb) return null;
  const ha = handicapByPlayerId[pa] ?? null;
  const hb = handicapByPlayerId[pb] ?? null;
  const nameA = teamDisplayName(teamAId);
  const nameB = teamDisplayName(teamBId);
  if (ha == null || hb == null) {
    return { nameA, nameB, ha, hb, diff: null, plusTo: null };
  }
  const diff = Math.abs(ha - hb);
  const plusTo: "A" | "B" | null = diff === 0 ? null : ha < hb ? "A" : "B";
  return { nameA, nameB, ha, hb, diff, plusTo };
}

// -------------------- getMatchCardTone --------------------

export type MatchCardTone = "complete" | "inplay" | "pending";

export type MatchCardToneInput = Pick<MatchRow, "finalized_by_admin" | "status" | "winner_team_id">;

export function getMatchCardTone(m: MatchCardToneInput): { tone: MatchCardTone; border: string; bg: string } {
  const st = String(m.status ?? "");
  const hasWinner = m.winner_team_id != null && m.winner_team_id !== "";
  const isFinal = bool(m.finalized_by_admin) || st === "COMPLETED" || hasWinner;

  const tone: MatchCardTone = isFinal ? "complete" : st === "IN_PLAY" ? "inplay" : "pending";
  const border = tone === "complete" ? "#16A34A" : tone === "inplay" ? "#FACC15" : theme.border;
  const bg = tone === "complete" ? "#F0FDF4" : tone === "inplay" ? "#FEFCE8" : "#fff";
  return { tone, border, bg };
}

// -------------------- bracket tree geometry --------------------

export type MatchPos = { id: string; roundIndex: number; x: number; top: number; centerY: number };

export type TreeDims = {
  cardW: number;
  cardH: number;
  baseGap: number;
  colGap: number;
  headerOffset: number;
};

export type RoundLayoutEntry = {
  round: { round: number; matches: MatchRow[] };
  roundIndex: number;
  list: MatchRow[];
};

export type TreeLayout = {
  roundLayouts: RoundLayoutEntry[];
  posById: Record<string, MatchPos>;
  roundPositions: { roundIndex: number; matches: MatchPos[] }[];
  width: number;
  height: number;
};

export function computeTreeLayout(
  roundsForTree: { round: number; matches: MatchRow[] }[],
  dims: TreeDims
): TreeLayout {
  const { cardW, cardH, baseGap, colGap, headerOffset } = dims;
  const baseStep = cardH + baseGap;

  const roundLayouts: RoundLayoutEntry[] = roundsForTree.map((round, roundIndex) => {
    const list = [...(round.matches ?? [])].sort(
      (a, b) => Number(a.match_no ?? 0) - Number(b.match_no ?? 0) || String(a.id).localeCompare(String(b.id))
    );
    return { round, roundIndex, list };
  });

  const posById: Record<string, MatchPos> = {};
  const roundPositions: { roundIndex: number; matches: MatchPos[] }[] = [];

  roundLayouts.forEach((layout, roundIndex) => {
    const x = roundIndex * (cardW + colGap);
    const list = layout.list;
    const matches: MatchPos[] = [];

    list.forEach((m, i) => {
      const centerY = headerOffset + baseStep * ((i + 0.5) * Math.pow(2, roundIndex));
      const top = centerY - cardH / 2;
      const pos: MatchPos = { id: m.id, roundIndex, x, top, centerY };
      matches.push(pos);
      posById[m.id] = pos;
    });

    roundPositions.push({ roundIndex, matches });
  });

  let maxBottom = 0;
  roundPositions.forEach((layout) => {
    layout.matches.forEach((m) => {
      maxBottom = Math.max(maxBottom, m.top + cardH);
    });
  });

  const width = roundLayouts.length ? roundLayouts.length * (cardW + colGap) - colGap : cardW;
  const height = Math.max(maxBottom + baseGap, cardH + headerOffset);

  return { roundLayouts, posById, roundPositions, width, height };
}

export function computeBracketLines(
  roundLayouts: RoundLayoutEntry[],
  posById: Record<string, MatchPos>,
  positionsByRoundIndex: Map<number, MatchPos[]>,
  cardW: number
): string[] {
  const lines: string[] = [];

  for (const layout of roundLayouts) {
    if (layout.roundIndex === 0) continue;
    const list = layout.list;
    list.forEach((m) => {
      const childPos = posById[m.id];
      if (!childPos) return;
      const childX = childPos.x;
      const childCenterY = childPos.centerY;

      const sourceIds = [m.slot_a_source_match_id, m.slot_b_source_match_id].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      );
      const parentPositions = sourceIds
        .map((id) => posById[id])
        .filter((p) => p && p.roundIndex === layout.roundIndex - 1) as MatchPos[];

      if (parentPositions.length === 0) {
        const fallbackParents = positionsByRoundIndex.get(layout.roundIndex - 1) ?? [];
        const i = list.indexOf(m);
        const aIdx = i * 2;
        const bIdx = i * 2 + 1;
        [aIdx, bIdx].forEach((idx) => {
          const parentPos = fallbackParents[idx];
          if (!parentPos) return;
          const parentX = parentPos.x + cardW;
          const parentCenterY = parentPos.centerY;
          const midX = (parentX + childX) / 2;
          lines.push(`M ${parentX} ${parentCenterY} H ${midX} V ${childCenterY} H ${childX}`);
        });
        return;
      }

      parentPositions.forEach((parentPos) => {
        const parentX = parentPos.x + cardW;
        const parentCenterY = parentPos.centerY;
        const midX = (parentX + childX) / 2;
        lines.push(`M ${parentX} ${parentCenterY} H ${midX} V ${childCenterY} H ${childX}`);
      });
    });
  }

  return lines;
}

// -------------------- treeSlotLabel --------------------
//
// The tree view uses a short "M# W" slot label instead of the lib's verbose
// slotLabel, so that the bracket cells fit without ellipsis.

export function treeSlotLabel(
  m: MatchRow,
  side: "A" | "B",
  teamDisplayName: (teamId: string | null) => string,
  matchNoById: Record<string, number | null>
): string {
  const teamId = side === "A" ? m.team_a_id : m.team_b_id;
  if (teamId) return teamDisplayName(teamId);
  const sourceType = side === "A" ? m.slot_a_source_type : m.slot_b_source_type;
  const sourceMatchId = side === "A" ? m.slot_a_source_match_id : m.slot_b_source_match_id;
  if (sourceType === "BYE") return "BYE";
  if (sourceType === "WINNER_OF_MATCH" && sourceMatchId) {
    const no = matchNoById[sourceMatchId];
    return no ? `M${no} W` : "Winner";
  }
  return "TBD";
}
