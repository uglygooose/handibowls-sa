// lib/tournaments/handicap.ts
// Pure-function handicap helpers. Take data via explicit params; no closures over state.
//
// Phase 6c: handicap is GATED on `ruleType === "HANDICAP_START"`. When rule
// is anything else (only "SCRATCH" today, but future rules without a
// handicap concept must explicitly opt in), the public functions short-
// circuit at entry and return null — no work computed, no allocations.
// Adapter callers (`lib/tournaments/adapters.ts:dbHandicapRuleToPrimitive`)
// case-map lowercase DB enum to this uppercase string.

export type TournamentRule = "SCRATCH" | "HANDICAP_START";

export function shortName(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return t;
  const first = t.split(" ")[0] ?? t;
  return first.length ? first : t;
}

export type HandicapInfoInput = {
  format: string | null | undefined;
  /** Tournament-level handicap rule. Gated at entry — anything other than
   *  "HANDICAP_START" is a no-op. */
  ruleType: TournamentRule | string | null | undefined;
  teamAId: string | null;
  teamBId: string | null;
  teamMembersByTeamId: Record<string, string[]>;
  handicapByPlayerId: Record<string, number | null>;
  nameByPlayerId: Record<string, string>;
};

export type HandicapInfo = {
  nameA: string;
  nameB: string;
  ha: number | null;
  hb: number | null;
  diff: number | null;
  plusTo: "A" | "B" | null;
};

function isHandicapApplied(ruleType: HandicapInfoInput["ruleType"]): boolean {
  return ruleType === "HANDICAP_START";
}

export function singlesHandicapInfo(input: HandicapInfoInput): HandicapInfo | null {
  // Cheap-exit gate — runs before any field reads or allocations.
  if (!isHandicapApplied(input.ruleType)) return null;

  if (input.format !== "SINGLES") return null;
  if (!input.teamAId || !input.teamBId) return null;

  const pa = input.teamMembersByTeamId[input.teamAId]?.[0] ?? null;
  const pb = input.teamMembersByTeamId[input.teamBId]?.[0] ?? null;
  if (!pa || !pb) return null;

  const ha = input.handicapByPlayerId[pa] ?? null;
  const hb = input.handicapByPlayerId[pb] ?? null;
  const nameA = input.nameByPlayerId[pa] ?? "";
  const nameB = input.nameByPlayerId[pb] ?? "";

  if (ha == null || hb == null) {
    return { nameA, nameB, ha, hb, diff: null, plusTo: null };
  }

  const diff = Math.abs(ha - hb);
  const plusTo = diff === 0 ? null : ha < hb ? "A" : "B"; // lower handicap gets the plus
  return { nameA, nameB, ha, hb, diff, plusTo };
}

export function singlesHandicapLine(input: HandicapInfoInput): string | null {
  // Same gate as info — keeps the entry point uniform across public API.
  if (!isHandicapApplied(input.ruleType)) return null;

  const hc = singlesHandicapInfo(input);
  if (!hc) return null;
  if (hc.diff == null) return "Handicap: -";
  if (hc.diff === 0) return "Handicap: level";
  const to = hc.plusTo === "A" ? shortName(hc.nameA) : shortName(hc.nameB);
  return `Handicap: +${hc.diff} to ${to}`;
}
