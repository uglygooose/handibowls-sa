// lib/tournaments/rounds.ts
//
// Round-advancement primitive. Extracted from the deleted
// app/api/tournaments/advance-round/route.ts (pre-rebuild Phase-0 commit
// f87d8ef^), keeping only the pure logic. The auth gate, Supabase queries,
// and INSERT writes live in the server action layer (Phase 6d).
//
// Was: §18 `roundAdvance.ts` → `rounds.ts`.

import { largestPowerOfTwoLE } from "@/lib/tournaments/bracket";
import { isTournamentByeMatch, isTournamentMatchDone } from "@/lib/tournaments/completion";

// -------------------- input shapes --------------------

export type RoundAdvanceMatch = {
  id: string;
  round_no: number | null;
  match_no?: number | null;
  status?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  winner_team_id?: string | null;
  finalized_by_admin?: boolean | null;
  // slot_b_source_type is read by isTournamentByeMatch().
  slot_b_source_type?: string | null;
};

export type RoundAdvanceTeam = {
  id: string;
  team_no: number;
};

// -------------------- output shapes --------------------

export type SlotSourceType = "TEAM" | "WINNER_OF_MATCH";

export type RoundAdvanceInsert = {
  round_no: number;
  match_no: number;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source_type: SlotSourceType | null;
  slot_a_source_match_id: string | null;
  slot_b_source_type: SlotSourceType | null;
  slot_b_source_match_id: string | null;
  status: "SCHEDULED" | "OPEN";
};

export type RoundAdvanceResult =
  | { kind: "incomplete"; reason: string }
  | { kind: "tournamentComplete"; championTeamId: string | null }
  | { kind: "nextRound"; nextRoundNo: number; inserts: RoundAdvanceInsert[] };

// -------------------- helpers --------------------

type SlotEntry = {
  slot: number;
  team_id: string | null;
  source_type: SlotSourceType;
  source_match_id: string | null;
};

function winnerForAdvance(m: RoundAdvanceMatch): string | null {
  if (m?.winner_team_id) return String(m.winner_team_id);
  // BYE finalisation: winner is team_a_id by convention.
  if (isTournamentByeMatch(m) && m?.team_a_id) return String(m.team_a_id);
  return null;
}

function pairEntries(
  entries: ReadonlyArray<SlotEntry | null>,
  nextRoundNo: number,
): RoundAdvanceInsert[] {
  const inserts: RoundAdvanceInsert[] = [];
  let matchNo = 1;
  for (let i = 0; i < entries.length; i += 2) {
    const aEntry = entries[i] ?? null;
    const bEntry = entries[i + 1] ?? null;
    const a = aEntry?.team_id ?? null;
    const b = bEntry?.team_id ?? null;
    inserts.push({
      round_no: nextRoundNo,
      match_no: matchNo,
      team_a_id: a,
      team_b_id: b,
      slot_a_source_type: aEntry?.source_type ?? null,
      slot_a_source_match_id: aEntry?.source_match_id ?? null,
      slot_b_source_type: bEntry?.source_type ?? null,
      slot_b_source_match_id: bEntry?.source_match_id ?? null,
      status: a && b ? "SCHEDULED" : "OPEN",
    });
    matchNo += 1;
  }
  return inserts;
}

// -------------------- public API --------------------

/**
 * Generate the next-round inserts from a completed previous round.
 *
 * Returns:
 *   • `incomplete` — the input round has un-played non-BYE matches, or an
 *     argument was malformed (negative round, no matches, etc.).
 *   • `tournamentComplete` — exactly one winner remains; the caller should
 *     mark the tournament COMPLETED instead of creating a 1-team round.
 *   • `nextRound` — pure insert specs (no tournament_id, no UUIDs, no
 *     timestamps) ready to be augmented + inserted by the action layer.
 */
export function advanceRound(input: {
  roundNo: number;
  roundMatches: RoundAdvanceMatch[];
  teams: RoundAdvanceTeam[];
}): RoundAdvanceResult {
  const { roundNo, roundMatches, teams } = input;

  if (!Number.isInteger(roundNo) || roundNo <= 0) {
    return { kind: "incomplete", reason: "Invalid roundNo" };
  }
  if (!Array.isArray(roundMatches) || roundMatches.length === 0) {
    return { kind: "incomplete", reason: `No matches found in round ${roundNo}` };
  }

  const notDone = roundMatches.filter(
    (m) => !isTournamentMatchDone(m) && !isTournamentByeMatch(m),
  );
  if (notDone.length) {
    return { kind: "incomplete", reason: `Round ${roundNo} has incomplete matches` };
  }

  const teamNoById = new Map<string, number>();
  for (const t of teams) teamNoById.set(t.id, t.team_no);

  const totalTeams = teams.length;
  const p = largestPowerOfTwoLE(totalTeams);
  const playInMatchesExpected = totalTeams - p;
  const isPlayInRound =
    roundNo === 1 &&
    playInMatchesExpected > 0 &&
    roundMatches.length === playInMatchesExpected;

  const nextRoundNo = roundNo + 1;

  if (isPlayInRound) {
    const playInTeamIds = new Set<string>();
    for (const m of roundMatches) {
      if (m.team_a_id) playInTeamIds.add(String(m.team_a_id));
      if (m.team_b_id) playInTeamIds.add(String(m.team_b_id));
    }
    const byeTeams = teams.filter((t) => !playInTeamIds.has(t.id));

    const entries: SlotEntry[] = [];
    for (const m of roundMatches) {
      const winnerId = winnerForAdvance(m);
      const aNo = m.team_a_id ? teamNoById.get(String(m.team_a_id)) : undefined;
      const bNo = m.team_b_id ? teamNoById.get(String(m.team_b_id)) : undefined;
      let slot = Math.min(
        aNo ?? Number.POSITIVE_INFINITY,
        bNo ?? Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(slot)) {
        slot = winnerId ? (teamNoById.get(winnerId) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      }
      if (!Number.isFinite(slot)) slot = 999_999;

      entries.push({
        slot,
        team_id: winnerId,
        source_type: winnerId ? "TEAM" : "WINNER_OF_MATCH",
        source_match_id: winnerId ? null : String(m.id),
      });
    }

    for (const t of byeTeams) {
      const slot = Number.isFinite(t.team_no) ? t.team_no : 999_999;
      entries.push({ slot, team_id: t.id, source_type: "TEAM", source_match_id: null });
    }

    if (entries.length !== p) {
      return {
        kind: "incomplete",
        reason: `Expected ${p} teams for Round ${nextRoundNo}, found ${entries.length}`,
      };
    }

    entries.sort(
      (a, b) =>
        a.slot - b.slot ||
        String(a.team_id ?? a.source_match_id ?? "").localeCompare(
          String(b.team_id ?? b.source_match_id ?? ""),
        ),
    );

    return {
      kind: "nextRound",
      nextRoundNo,
      inserts: pairEntries(entries, nextRoundNo),
    };
  }

  // Winners-only round (round 2+).
  const entries: SlotEntry[] = roundMatches.map((m) => {
    const winnerId = winnerForAdvance(m);
    return {
      slot: 0, // unused — order preserved by the source array (match_no order)
      team_id: winnerId,
      source_type: winnerId ? "TEAM" : "WINNER_OF_MATCH",
      source_match_id: winnerId ? null : String(m.id),
    };
  });

  if (entries.length === 1) {
    return { kind: "tournamentComplete", championTeamId: entries[0]?.team_id ?? null };
  }

  return {
    kind: "nextRound",
    nextRoundNo,
    inserts: pairEntries(entries, nextRoundNo),
  };
}
